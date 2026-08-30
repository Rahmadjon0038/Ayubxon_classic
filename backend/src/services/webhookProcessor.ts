import { Contact, InstagramAccount, Prisma, SenderType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { downloadContactAvatar, isLocalUploadUrl } from '../lib/avatar';
import { downloadRemoteMedia } from '../lib/media';
import { extractPhoneNumber } from '../lib/phone';
import { notifyNewAdLead, notifyNewLead } from '../bot/telegramNotifier';
import {
  analyzeConversation,
  ChatTurn,
  detectHandoverRequest,
  detectJobInquiry,
  generateAiReply,
  pickHandoverAcknowledgement,
} from './aiService';
import {
  fetchContactProfile,
  fetchInstagramOEmbed,
  fetchMediaShortcode,
  replyToComment,
  sendPrivateReply,
  sendTextMessage,
} from './instagramApi';
import {
  getAccessToken,
  getConnectedAccount,
  getConnectedAccountByInstagramId,
} from './accountService';
import { fetchLeadDetails } from './metaLeadAds';
import { emitMessageUpdated, emitNewMessage } from './socketService';
import { enqueueComment, enqueueDm } from '../utils/messageQueue';
import { pickVariant } from '../utils/messageVariants';

// Instagram webhook payloadining bizga kerakli qismi.
// Nomalum maydonlar passthrough qilinadi — Meta yangi maydon qoshsa parse buzilmaydi.
const attachmentSchema = z
  .object({
    type: z.string().optional(),
    payload: z.object({ url: z.string().optional() }).partial().optional(),
  })
  .passthrough();

const messagingEventSchema = z
  .object({
    sender: z.object({ id: z.string() }).optional(),
    recipient: z.object({ id: z.string() }).optional(),
    timestamp: z.union([z.number(), z.string()]).optional(),
    message: z
      .object({
        mid: z.string(),
        text: z.string().optional(),
        is_echo: z.boolean().optional(),
        attachments: z.array(attachmentSchema).optional(),
      })
      .passthrough()
      .optional(),
    // Kontakt xabarga reaksiya qoyganda/olib tashlaganda keladi.
    reaction: z
      .object({
        mid: z.string(),
        action: z.enum(['react', 'unreact']),
        reaction: z.string().optional(),
        emoji: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// Meta Dashboard'dagi "Test" tugmasi eventni entry[].changes[] formatida yuboradi,
// jonli xabarlar esa entry[].messaging[] da keladi — ikkalasini ham qabul qilamiz.
const changeSchema = z
  .object({
    field: z.string().optional(),
    value: z.unknown().optional(),
  })
  .passthrough();

const leadgenValueSchema = z
  .object({
    form_id: z.string().optional(),
    leadgen_id: z.string().optional(),
    page_id: z.string().optional(),
    created_time: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const commentValueSchema = z
  .object({
    id: z.string().optional(),
    text: z.string().optional(),
    from: z.object({ id: z.string().optional(), username: z.string().optional() }).partial().optional(),
    media: z.object({ id: z.string().optional() }).partial().optional(),
  })
  .passthrough();

const webhookPayloadSchema = z
  .object({
    object: z.string(),
    entry: z.array(
      z
        .object({
          id: z.string().optional(),
          time: z.number().optional(),
          messaging: z.array(messagingEventSchema).optional(),
          changes: z.array(changeSchema).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

type MessagingEvent = z.infer<typeof messagingEventSchema>;
type LeadgenChangeValue = z.infer<typeof leadgenValueSchema>;
type CommentChangeValue = z.infer<typeof commentValueSchema>;

async function resolveWebhookAccount(
  event: MessagingEvent,
  entryBusinessId?: string,
): Promise<InstagramAccount | null> {
  const candidateIds = new Set<string>();

  if (entryBusinessId) candidateIds.add(entryBusinessId);

  const message = event.message;
  if (message) {
    const isEcho = Boolean(message.is_echo);
    const businessId = isEcho ? event.sender?.id : event.recipient?.id;
    if (businessId) candidateIds.add(businessId);

    // Meta payloadlarida sender/recipient ba'zan kutilmagan tartibda kelishi mumkin.
    // Shu sabab ehtiyot chorasi sifatida ikkinchi tomonni ham tekshiramiz.
    const fallbackId = isEcho ? event.recipient?.id : event.sender?.id;
    if (fallbackId) candidateIds.add(fallbackId);
  } else {
    if (event.sender?.id) candidateIds.add(event.sender.id);
    if (event.recipient?.id) candidateIds.add(event.recipient.id);
  }

  for (const instagramAccountId of candidateIds) {
    const account = await getConnectedAccountByInstagramId(instagramAccountId);
    if (account) return account;
  }

  // MVP rejimida webhook ID'ni DB yozuvi bilan aniq moslashtira olmasak,
  // bitta faol ulangan akkauntga qaytamiz. Bu connect paytida Meta qaytaradigan
  // profil ID webhook entry.id bilan farqlanib qolgan holatlarda ham xabarlarni
  // saqlab qoladi.
  return getConnectedAccount();
}

interface ResolvedAttachment {
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentThumbnailUrl: string | null;
  attachmentText: string | null;
}

const KNOWN_MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file']);

// Webhook payload ichida yashiringan birinchi public HTTP(S) linkni topadi.
// Instagram ayrim xabar turlarida URL'ni text/attachments[0].payload.url dan tashqari
// boshqa nested maydonlarda ham yuborishi mumkin. Shu fallback unsupported bubble
// chiqib qolmasligi uchun ishlatiladi.
function findFirstHttpUrl(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === 'string') {
    const match = value.match(/https?:\/\/[^\s"'<>()[\]{}]+/i);
    return match ? match[0] : null;
  }

  if (!value || typeof value !== 'object') return null;
  if (seen.has(value as object)) return null;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstHttpUrl(item, seen);
      if (found) return found;
    }
    return null;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findFirstHttpUrl(item, seen);
    if (found) return found;
  }

  return null;
}

function collectMeaningfulStrings(
  value: unknown,
  seen = new WeakSet<object>(),
): string[] {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text || /^https?:\/\//i.test(text)) return [];
    return [text];
  }

  if (!value || typeof value !== 'object') return [];
  if (seen.has(value as object)) return [];
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMeaningfulStrings(item, seen));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    // Meta template/contact payloadlarida foydali bo'lishi mumkin bo'lgan asosiy maydonlarni
    // oldinga suramiz, lekin qolgan stringlarni ham yig'amiz.
    if (typeof item === 'string') {
      const text = item.trim();
      if (!text || /^https?:\/\//i.test(text)) return [];
      if (['type', 'id'].includes(key) && text.length > 80) return [];
      return [text];
    }
    return collectMeaningfulStrings(item, seen);
  });
}

function isGenericTemplateArtifact(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return ['template', 'shablon', 'quick reply', 'postback', 'button'].includes(normalized);
}

function isInstagramPermalink(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname.endsWith('instagram.com');
  } catch {
    return false;
  }
}

// Instagram post/reel havolasidan barqaror qismini (shortcode) ajratib oladi — havolalar
// query parametr, "www." prefiksi yoki oxirgi "/" bilan farq qilishi mumkin, shuning uchun
// to'g'ridan-to'g'ri satr solishtirish ishonchli emas.
// "reel" (yagona post/reel havolasi) va "reels" (Instagram ayrim kontekstlarda ko'plik
// shaklda ham beradi) ikkalasini ham qamrab olamiz — qaysi birini qoldirib ketish link
// mos kelmay qolishiga (demak AI mahsulotni tanimay qolishiga) olib kelishi mumkin.
function extractInstagramShortcode(rawUrl: string): string | null {
  try {
    const { pathname } = new URL(rawUrl);
    const match = pathname.match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Mijoz linkni tabiiy "Yuborish" (Send) tugmasi orqali emas, qo'lda nusxalab, oddiy matn
// sifatida yozib yuborishi ham mumkin — bunday holatda attachment kelmaydi, faqat matn
// ichida URL bo'ladi. Shuni ham topib olamiz.
const INSTAGRAM_URL_IN_TEXT_PATTERN = /https?:\/\/(?:www\.)?instagram\.com\/(?:reels?|p|tv)\/[A-Za-z0-9_-]+[^\s]*/i;

function findInstagramUrlInText(text: string): string | null {
  const match = text.match(INSTAGRAM_URL_IN_TEXT_PATTERN);
  return match ? match[0] : null;
}

// Xavfsizlik zaxirasi: attachment yoki matnda topilmasa, butun webhook event ichida
// (Meta payloadi ba'zan kutilmagan/ichma-ich maydonlarda link yuborishi mumkin) Instagram
// post/reel havolasini qidiradi.
function findInstagramUrlAnywhere(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === 'string') {
    return findInstagramUrlInText(value);
  }
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value as object)) return null;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findInstagramUrlAnywhere(item, seen);
      if (found) return found;
    }
    return null;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findInstagramUrlAnywhere(item, seen);
    if (found) return found;
  }

  return null;
}

// Berilgan shortcode'ga mos faol mahsulotni (GroupInfo.videoUrl orqali) topadi.
// Topilmasa null.
async function findGroupIdByShortcode(instagramAccountId: string, shortcode: string): Promise<string | null> {
  const candidates = await prisma.groupInfo.findMany({
    where: { instagramAccountId, isActive: true, videoUrl: { not: null } },
    select: { id: true, videoUrl: true },
  });

  const match = candidates.find(
    (candidate) => candidate.videoUrl && extractInstagramShortcode(candidate.videoUrl) === shortcode,
  );
  return match?.id ?? null;
}

// Mijoz Instagramda ulashgan/messages qilgan post/reel havolasini shu akkauntning faol
// mahsulotlari (GroupInfo.videoUrl) bilan solishtirib, mos kelgan mahsulot id'sini topadi.
// Topilmasa null — bu holatda avvalgi referencedGroupId o'zgarishsiz qoladi.
async function findGroupIdByVideoUrl(instagramAccountId: string, url: string): Promise<string | null> {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) return null;
  return findGroupIdByShortcode(instagramAccountId, shortcode);
}

// Meta payload'idagi attachment turi bizning oddiy image/video/audio toifalarimizga mos
// kelmasa (masalan story_mention, ig_reel, share) alohida ishlov beriladi:
// - story_mention kabi turlar haqiqiy media fayl, lekin havolasi vaqtinchalik (imzoli) —
//   ozimizga yuklab olib, haqiqiy turini (rasm/video) Content-Type orqali aniqlaymiz.
// - ig_reel/share kabi turlar shunchaki Instagram post sahifasiga havola — media fayl emas,
//   shuning uchun oEmbed orqali preview rasm olinadi.
async function resolveIncomingAttachment(
  attachment: { type?: string; payload?: { url?: string } } | undefined,
  accessToken: string,
): Promise<ResolvedAttachment> {
  const rawType = attachment?.type ?? null;
  const rawUrl = attachment?.payload?.url ?? null;
  if (!rawUrl) {
    const attachmentText = rawType === 'template'
      ? Array.from(new Set(collectMeaningfulStrings(attachment))).slice(0, 6).join('\n') || null
      : null;
    return { attachmentType: rawType, attachmentUrl: null, attachmentThumbnailUrl: null, attachmentText };
  }

  const permalink = isInstagramPermalink(rawUrl);

  if (permalink) {
    const oembed = await fetchInstagramOEmbed(accessToken, rawUrl);
    const attachmentThumbnailUrl = oembed?.thumbnailUrl
      ? await downloadContactAvatar(oembed.thumbnailUrl)
      : null;
    const attachmentText = rawType === 'template'
      ? Array.from(new Set(collectMeaningfulStrings(attachment))).slice(0, 6).join('\n') || null
      : null;
    return { attachmentType: rawType, attachmentUrl: rawUrl, attachmentThumbnailUrl, attachmentText };
  }

  if (rawType === 'file' || (rawType && !KNOWN_MEDIA_TYPES.has(rawType))) {
    const downloaded = await downloadRemoteMedia(rawUrl);
    if (downloaded) {
      return {
        attachmentType: downloaded.type,
        attachmentUrl: downloaded.localUrl,
        attachmentThumbnailUrl: null,
        attachmentText: null,
      };
    }
    // Yuklab olinmasa, asl (ehtimol muddati tez tugaydigan) havola bilan saqlanadi.
    return {
      attachmentType: rawType,
      attachmentUrl: rawUrl,
      attachmentThumbnailUrl: null,
      attachmentText: null,
    };
  }

  return { attachmentType: rawType, attachmentUrl: rawUrl, attachmentThumbnailUrl: null, attachmentText: null };
}

function normalizeLeadFieldMap(fieldData: { name?: string; values?: string[] }[] | undefined): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const field of fieldData ?? []) {
    const key = field.name?.trim();
    if (!key) continue;
    const values = (field.values ?? []).map((value) => value.trim()).filter(Boolean);
    if (!values.length) continue;
    map[key] = values;
  }
  return map;
}

function pickLeadValue(fieldMap: Record<string, string[]>, ...keys: string[]): string | null {
  for (const key of keys) {
    const direct = fieldMap[key];
    if (direct?.length) return direct[0];
    const lower = fieldMap[key.toLowerCase()];
    if (lower?.length) return lower[0];
  }
  return null;
}

function toLeadDate(value: string | number | undefined): Date | null {
  if (value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveMetaCampaignForLead(
  instagramAccountId: string,
  pageId: string | null,
  formId: string | null,
): Promise<Awaited<ReturnType<typeof prisma.adCampaign.findFirst>> & { account: InstagramAccount } | null> {
  const byForm = formId
    ? await prisma.adCampaign.findFirst({
        where: { instagramAccountId, metaFormId: formId },
        include: { account: true },
      })
    : null;
  if (byForm) return byForm;

  const byPage = pageId
    ? await prisma.adCampaign.findFirst({
        where: { instagramAccountId, metaPageId: pageId },
        include: { account: true },
      })
    : null;
  if (byPage) {
    if (!byPage.metaFormId && formId) {
      const updated = await prisma.adCampaign.update({
        where: { id: byPage.id },
        data: { metaFormId: formId },
        include: { account: true },
      });
      return updated;
    }
    return byPage;
  }

  return null;
}

async function createFallbackMetaCampaign(
  instagramAccountId: string,
  pageId: string | null,
  formId: string | null,
): Promise<Awaited<ReturnType<typeof prisma.adCampaign.create>> & { account: InstagramAccount }> {
  const title = formId ? `Meta lead form ${formId.slice(0, 8)}` : `Meta lead ${pageId?.slice(0, 8) ?? 'unknown'}`;
  return prisma.adCampaign.create({
    data: {
      instagramAccountId,
      title,
      metaPageId: pageId,
      metaFormId: formId,
      isActive: true,
    },
    include: { account: true },
  });
}

async function processMetaLeadChange(changeValue: LeadgenChangeValue, entryBusinessId?: string): Promise<void> {
  const leadgenId = changeValue.leadgen_id?.trim();
  if (!leadgenId) return;

  const pageId = changeValue.page_id?.trim() || entryBusinessId?.trim() || null;
  const formId = changeValue.form_id?.trim() || null;
  const leadCreatedAt = toLeadDate(changeValue.created_time);

  const account = await getConnectedAccount();
  if (!account) {
    console.warn('[webhook] Meta lead olindi, lekin ulangan akkaunt topilmadi');
    return;
  }

  let campaign = await resolveMetaCampaignForLead(account.id, pageId, formId);
  if (!campaign) {
    campaign = await createFallbackMetaCampaign(account.id, pageId, formId);
  }

  const accessToken = campaign.account.encryptedAccessToken
    ? getAccessToken(campaign.account)
    : getAccessToken(account);

  const leadDetails = await fetchLeadDetails(accessToken, leadgenId);
  const rawFields = normalizeLeadFieldMap(leadDetails?.field_data);
  const rawFieldsValue = leadDetails?.field_data ? rawFields : undefined;
  const nameFallback = [pickLeadValue(rawFields, 'first_name'), pickLeadValue(rawFields, 'last_name')]
    .filter(Boolean)
    .join(' ')
    .trim();
  const fullName =
    pickLeadValue(rawFields, 'full_name', 'name', 'fullName', 'first_name') ?? (nameFallback || 'Meta lead');
  const phoneNumber =
    pickLeadValue(rawFields, 'phone_number', 'phone', 'mobile', 'whatsapp_number') ??
    extractPhoneNumber(
      [
        pickLeadValue(rawFields, 'phone_number', 'phone', 'mobile', 'whatsapp_number'),
        pickLeadValue(rawFields, 'primary_phone'),
      ]
        .filter(Boolean)
        .join(' '),
    );
  const email = pickLeadValue(rawFields, 'email', 'mail') ?? null;
  const comment =
    pickLeadValue(rawFields, 'comment', 'message', 'question', 'notes', 'note') ??
    null;

  const created = await prisma.adLead.upsert({
    where: { metaLeadId: leadgenId },
    update: {
      metaPageId: pageId,
      metaFormId: formId,
      fullName,
      phoneNumber,
      email,
      comment,
      rawFields: rawFieldsValue,
      leadCreatedAt,
      adCampaignId: campaign.id,
      instagramAccountId: account.id,
    },
    create: {
      instagramAccountId: account.id,
      adCampaignId: campaign.id,
      metaLeadId: leadgenId,
      metaPageId: pageId,
      metaFormId: formId,
      fullName,
      phoneNumber,
      email,
      comment,
      rawFields: rawFieldsValue,
      leadCreatedAt,
    },
  });

  notifyNewAdLead({
    campaignTitle: campaign.title,
    pageName: campaign.metaPageName,
    formName: campaign.metaFormName,
    leadId: created.metaLeadId,
    fullName: created.fullName,
    phoneNumber: created.phoneNumber ?? 'Ko\'rsatilmagan',
    email: created.email,
    comment: created.comment,
  }).catch(() => {});

  console.log(
    `[webhook] Meta lead saqlandi (leadgen=${leadgenId.slice(0, 24)}…, campaign=${campaign.id})`,
  );
}

// Odamlar narx so'rashning o'nlab imlo/shakl variantini ishlatadi (narxi, narchi, nech
// pul, nechpul, nchpul, qanca, qancha, kofta narxi, buning narxi bormi...) — buni ANIQ
// so'zlar ro'yxati bilan sanab tugatib bo'lmaydi. Shuning uchun avval bog'lovchi (mahsulot
// nomi, salomlashuv, so'rov odob) so'zlarni olib tashlaymiz (pastda isPriceOnlyComment
// ichida), so'ng qolgan "ildiz" narx/miqdor so'zlaridan biriga mos kelsa — sof narx savoli
// deb topiladi. Aks holda (masalan boshqa mavzu ham aralashgan uzunroq komment) mos kelmaydi.
const PRICE_COMMENT_FILLER_WORDS = [
  // Ko'rsatish olmoshlari, umumiy so'zlar va kelishik qo'shimchalari
  'mahsulotning', 'mahsulot', 'buning', 'shuning', 'buni', 'shuni', 'bu', 'shu', 'mana',
  'ni', 'gi', 'dan', 'ga',
  // Odatiy kiyim nomlari — mijoz mahsulot nomini narx so'zi bilan birga yozishi mumkin
  'kofta', 'futbolka', 'shim', 'kurtka', 'koylak', 'kostyum', 'poyabzal', 'oyoqkiyim', 'oyoq', 'kiyim',
  // Salomlashuv — narx savolidan oldin kelishi mumkin. ("hi" qo'shilmagan — "narCHI" kabi
  // so'zlar ichida tasodifan uchrab, ularni buzib qo'yishi mumkin edi.)
  'assalomualaykum', 'salom', 'hello',
  // Savol/odob qo'shimchalari
  'bormi', 'bor', 'ekanini', 'ekan', 'turadi',
  'ayting', 'aytvoring', 'aytvorin', 'aytvorasizmi', 'aytib', 'ayta', 'olasizmi', 'bera', 'beraolasizmi',
  'yozing', 'yozvoring', 'yozvorin', 'yuboring', 'yubor',
  'bilmoqchiman', 'bilsam', 'bilay', 'bilasizmi',
];

// Bog'lovchi so'zlar olib tashlangandan keyin qolgan matn ichida shu ildizlardan BIRI
// (imlo variantlari — narx/narch/narh, qancha/qanca/qanch, nech/nch pul — bilan) uchrasa,
// narx so'ralgan deb hisoblanadi. Qolgan matn juda uzun bo'lsa (masalan "qanchadan beri
// savdo qilasizlar" kabi narxga aloqasi yo'q, lekin tasodifan shu ildizni o'z ichiga olgan
// uzun gap) — MAX_PRICE_CORE_LENGTH shuni saqlaydi, chunki sof narx savoli har doim juda qisqa.
const PRICE_ROOT_PATTERN = /narx|narch|narh|qanc|nech|nch|price|howmuch|нарх|канч|сколько|цена/;
const MAX_PRICE_CORE_LENGTH = 16;

function normalizeCommentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isPriceOnlyComment(text: string): boolean {
  let core = normalizeCommentText(text);
  if (!core) return false;

  for (const filler of PRICE_COMMENT_FILLER_WORDS) {
    core = core.split(filler).join('');
  }

  return core.length > 0 && core.length <= MAX_PRICE_CORE_LENGTH && PRICE_ROOT_PATTERN.test(core);
}

// Odamlar mahsulot postiga qiziqish bildirish uchun ko'pincha shunchaki "+" (yoki "+1",
// "++", "+++++🔥🔥🔥" va h.k. — istalgancha soni, ko'pincha oxirida olov/yurak kabi
// emoji bilan) deb komment qoldiradi — bu ham narx savoli bilan bir xil maqsadda ("menga
// ma'lumot kerak") ishlatiladi, shuning uchun xuddi shunday ishlov beriladi.
const PLUS_INTEREST_PATTERN = /^[+➕]+\d{0,2}\s*(?:\p{Extended_Pictographic}️?\s*)*$/u;

function isPlusInterestComment(text: string): boolean {
  return PLUS_INTEREST_PATTERN.test(text.trim());
}

// Har safar bir xil bo'lmasligi uchun bir nechta variant orasidan tasodifiy tanlanadi —
// bular ommaviy (hamma ko'radigan) kommentariyalar, shuning uchun tabiiy va turlicha bo'lishi
// muhim.
const PRICE_COMMENT_REPLIES = [
  "Assalomu alaykum! Direct'dan yozing, batafsil ma'lumot beramiz 🙌",
  "Assalomu alaykum! Narxlar va batafsil ma'lumot uchun Direct'ga yozing 😊",
  "Assalomu alaykum, Direct orqali yozing — batafsil ma'lumot beramiz 😊",
  "Assalomu alaykum! Direct'ga yozib qoldiring, tez orada javob beramiz 😊",
];

// Mahsulot aniqlanib, private DM orqali batafsil ma'lumot ALLAQACHON yuborilgan bo'lsa,
// ommaviy javobda "Direct'ga yozing" deb qayta so'ramaymiz (bu chalkash — mijoz allaqachon
// DM oldi) — buning o'rniga DM'ni tekshirishni aytamiz.
const PRICE_COMMENT_REPLIES_AFTER_DM = [
  "Assalomu alaykum! Batafsil ma'lumotni Direct'ingizga yubordik, tekshirib ko'ring 📩",
  "Assalomu alaykum! Direct'ingizga batafsil ma'lumot yubordik 😊",
  "Assalomu alaykum, Direct'ingizni tekshiring — batafsil ma'lumot yuborildi 📩",
  "Assalomu alaykum! Sizga Direct orqali batafsil ma'lumot yubordik 😊",
];

let lastPriceCommentReply: string | null = null;

function pickPriceCommentReply(privateReplySent: boolean): string {
  const pool = privateReplySent ? PRICE_COMMENT_REPLIES_AFTER_DM : PRICE_COMMENT_REPLIES;
  const picked = pickVariant(pool, lastPriceCommentReply);
  lastPriceCommentReply = picked;
  return picked;
}

// Post/reel ostidagi "narxi?" yoki "+" kabi qisqa qiziqish bildiruvchi kommentariyalarga
// avtomatik javob yozadi — bu kommentariyaning o'zida narx aytilmaydi (bir nechta o'lcham/
// rangda narx farq qilishi mumkin), shuning uchun mijoz Direct'ga yo'naltiriladi. Bundan
// tashqari, komment ANIQ qaysi mahsulot postiga yozilgani aniqlansa, private DM orqali
// (Instagramning "Private Reply" imkoniyati bilan) AI generatsiya qilgan narx/malumot ham
// yuboriladi — bu holda ommaviy javob matni ham shunga mos ravishda ("Direct'ga yozing" emas,
// "Direct'ingizga yubordik") tanlanadi.
async function processCommentEvent(value: CommentChangeValue, entryBusinessId?: string): Promise<void> {
  const commentId = value.id?.trim();
  const text = value.text?.trim();
  if (!commentId || !text) return;

  const fromId = value.from?.id?.trim();

  const account =
    (entryBusinessId ? await getConnectedAccountByInstagramId(entryBusinessId) : null) ??
    (await getConnectedAccount());
  if (!account) return;

  // O'zimizning (yoki admin qo'lda yozgan) kommentariyamizga qayta javob yozib yubormaslik.
  if (fromId && fromId === account.instagramAccountId) return;
  if (!account.aiEnabled) return;
  if (!isPriceOnlyComment(text) && !isPlusInterestComment(text)) return;

  // Meta webhookni ba'zan takror yuborishi mumkin — shu comment'ga avval javob yozgan
  // bo'lsak, unique constraint buni ushlab qoladi va jim o'tkazib yuboramiz.
  try {
    await prisma.repliedComment.create({ data: { instagramAccountId: account.id, commentId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }

  const accessToken = getAccessToken(account);

  // Avval, komment ANIQ qaysi mahsulot postiga yozilgani aniqlansa (media.id orqali
  // shortcode'ini GroupInfo.videoUrl bilan solishtirib), private DM orqali AI generatsiya
  // qilgan narx/malumot yuboriladi — shundan KEYIN ommaviy javob matni shu natijaga qarab
  // tanlanadi. Bu qadamda har qanday xato (mos mahsulot topilmadi, Meta xato qaytardi va
  // h.k.) jim o'tkazib yuboriladi — DM yuborilmagan deb hisoblanib, ommaviy javob odatdagi
  // ("Direct'ga yozing") matn bilan davom etadi.
  let privateReplySent = false;
  const mediaId = value.media?.id?.trim();
  if (mediaId) {
    try {
      const shortcode = await fetchMediaShortcode(accessToken, mediaId);
      const matchedGroupId = shortcode ? await findGroupIdByShortcode(account.id, shortcode) : null;
      if (matchedGroupId) {
        const replyText = await generateAiReply(
          account.id,
          account.name || account.username,
          [{ role: 'user', content: text }],
          matchedGroupId,
        );
        if (replyText) {
          await enqueueDm({
            userId: fromId ?? commentId,
            label: 'Komment orqali private reply',
            execute: () => sendPrivateReply(accessToken, commentId, replyText),
          });
          privateReplySent = true;
          console.log(
            `[webhook] Private reply yuborildi (comment=${commentId.slice(0, 24)}…, group=${matchedGroupId})`,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[webhook] Private reply yuborishda xato (comment=${commentId.slice(0, 24)}…): ${message}`);
    }
  }

  try {
    await enqueueComment({
      userId: fromId ?? commentId,
      label: 'Narx kommentariyasiga ommaviy javob',
      execute: () => replyToComment(accessToken, commentId, pickPriceCommentReply(privateReplySent)),
    });
    console.log(`[webhook] Narx kommentariyasiga javob yozildi (comment=${commentId.slice(0, 24)}…)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Kommentariyaga javob yozishda xato: ${message}`);
    // Javob HAQIQATDA yuborilmadi — "band qilingan" belgisini bekor qilamiz, shunda Meta
    // shu eventni qayta yuborsa (yoki xato vaqtinchalik bo'lsa), keyingi urinish o'tkazib
    // yuborilmaydi. Aks holda bir marta muvaffaqiyatsiz bo'lgan comment abadiy "javob
    // berilgan" deb hisoblanib qolar edi. (Private reply Metada bir martalik bo'lgani uchun
    // qayta urinishda takror yuborilmaydi — xato bo'lsa jim o'tkazib yuboriladi.)
    await prisma.repliedComment.delete({ where: { commentId } }).catch(() => {});
  }
}

export async function processWebhookPayload(rawPayload: unknown): Promise<void> {
  const parsed = webhookPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    console.warn('[webhook] Payload strukturasi notogri, otkazib yuborildi');
    return;
  }
  if (!['instagram', 'page'].includes(parsed.data.object)) {
    console.warn(`[webhook] Notanish object turi: ${parsed.data.object}, otkazib yuborildi`);
    return;
  }

  for (const entry of parsed.data.entry) {
    if (parsed.data.object === 'page') {
      const leadChanges = (entry.changes ?? []).filter((change) => change.field === 'leadgen');
      console.log(
        `[webhook] Page lead event qabul qilindi (entry: ${entry.id ?? '-'}, changes: ${leadChanges.length})`,
      );

      for (const change of leadChanges) {
        const parsedChange = leadgenValueSchema.safeParse(change.value);
        if (!parsedChange.success) continue;

        try {
          await processMetaLeadChange(parsedChange.data, entry.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[webhook] Meta leadni qayta ishlashda xato: ${message}`);
        }
      }
      continue;
    }

    const events = [
      ...(entry.messaging ?? []),
      ...(entry.changes ?? [])
        .filter((c) => c.field === 'messages' && c.value)
        .map((c) => c.value as MessagingEvent),
    ];

    console.log(`[webhook] Event qabul qilindi (entry: ${entry.id ?? '-'}, xabarlar: ${events.length})`);

    for (const event of events) {
      try {
        await processMessagingEvent(event, entry.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[webhook] Eventni qayta ishlashda xato: ${message}`);
      }
    }

    const commentChanges = (entry.changes ?? []).filter((c) => c.field === 'comments' && c.value);
    for (const change of commentChanges) {
      const parsedComment = commentValueSchema.safeParse(change.value);
      if (!parsedComment.success) continue;

      try {
        await processCommentEvent(parsedComment.data, entry.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[webhook] Kommentariyani qayta ishlashda xato: ${message}`);
      }
    }
  }
}

// Kontakt reaksiyasi: xabarni topib contactReaction ni yangilaymiz.
async function processReactionEvent(event: MessagingEvent): Promise<void> {
  const reaction = event.reaction!;
  const message = await prisma.message.findUnique({
    where: { instagramMessageId: reaction.mid },
  });
  if (!message) {
    console.log(`[webhook] Reaksiya kelgan xabar topilmadi (mid=${reaction.mid.slice(0, 24)}…)`);
    return;
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      contactReaction:
        reaction.action === 'react' ? reaction.emoji || reaction.reaction || 'love' : null,
    },
  });

  console.log(
    `[webhook] Kontakt reaksiyasi: ${reaction.action} (mid=${reaction.mid.slice(0, 24)}…)`,
  );
  emitMessageUpdated({ conversationId: message.conversationId, message: updated });
}

async function processMessagingEvent(
  event: MessagingEvent,
  entryBusinessId?: string,
): Promise<void> {
  if (event.reaction?.mid) {
    return processReactionEvent(event);
  }

  const message = event.message;
  if (!message?.mid) {
    // mid yoq — bu message emas (read/seen/reaction va h.k.)
    const keys = Object.keys(event).filter((k) => !['sender', 'recipient', 'timestamp'].includes(k));
    console.log(`[webhook] Message bomagan event otkazib yuborildi (maydonlar: ${keys.join(', ') || '-'})`);
    return;
  }

  // is_echo — biznes akkaunt yuborgan xabar (Instagram ilovasidan yoki API orqali).
  // Echo eventda sender = biznes, recipient = foydalanuvchi.
  const isEcho = Boolean(message.is_echo);
  const contactIgsid = isEcho ? event.recipient?.id : event.sender?.id;
  console.log(
    `[webhook] Message eventi: mid=${message.mid.slice(0, 24)}… sender=${event.sender?.id ?? '-'} recipient=${event.recipient?.id ?? '-'} echo=${isEcho} text=${message.text ? 'bor' : 'yoq'}`,
  );
  if (!contactIgsid) {
    console.warn('[webhook] Kontakt IGSID aniqlanmadi, xabar saqlanmadi');
    return;
  }
  const contactScopedId = contactIgsid;

  // Dublikatni erta aniqlash (API orqali yuborilgan xabar echo bolib qaytadi).
  const existing = await prisma.message.findUnique({
    where: { instagramMessageId: message.mid },
    select: { id: true },
  });
  if (existing) {
    console.log(`[webhook] Dublikat xabar otkazib yuborildi (mid=${message.mid.slice(0, 24)}…)`);
    return;
  }

  // Akkauntni real webhook payload'dagi business/account ID orqali topamiz.
  // Bu bir nechta akkaunt bilan ishlaganda xabarlarning noto'g'ri conversation'ga
  // tushib qolish xavfini kamaytiradi.
  const account = await resolveWebhookAccount(event, entryBusinessId);
  if (!account) {
    console.warn('[webhook] Mos Instagram akkaunti topilmadi, xabar saqlanmadi');
    return;
  }
  const accessToken = getAccessToken(account);

  // Kontaktni topish yoki yaratish.
  let contact = await prisma.contact.findUnique({ where: { instagramScopedId: contactScopedId } });
  // Meta'ning profil rasm havolasi vaqtinchalik bolgani uchun, hali ozimizga
  // yuklab olinmagan (/uploads bolmagan) rasmlar ham qayta yangilanadi.
  const needsProfileRefresh =
    !contact || !contact.name || !contact.username || !isLocalUploadUrl(contact.profilePictureUrl);

  async function hydrateContactProfile(existingContact: Contact): Promise<Contact> {
    try {
      const profile = await fetchContactProfile(accessToken, contactScopedId);
      if (profile) {
        const localAvatarUrl = profile.profilePictureUrl
          ? await downloadContactAvatar(profile.profilePictureUrl)
          : null;
        return await prisma.contact.update({
          where: { id: existingContact.id },
          data: {
            name: profile.name ?? existingContact.name,
            username: profile.username ?? existingContact.username,
            profilePictureUrl:
              localAvatarUrl ?? profile.profilePictureUrl ?? existingContact.profilePictureUrl,
          },
        });
      }
    } catch {
      // profil olinmasa ham xabar saqlanadi
    }

    return existingContact;
  }

  const baseContact: Contact =
    contact ?? (await prisma.contact.create({ data: { instagramScopedId: contactScopedId } }));
  if (needsProfileRefresh) {
    // Profil malumotlarini olishga harakat qilamiz; olinmasa ham davom etadi.
    contact = await hydrateContactProfile(baseContact);
  } else {
    contact = baseContact;
  }

  const conversation = await prisma.conversation.upsert({
    where: {
      instagramAccountId_contactId: {
        instagramAccountId: account.id,
        contactId: contact.id,
      },
    },
    create: { instagramAccountId: account.id, contactId: contact.id },
    update: {},
  });

  // Meta jonli eventlarda timestampni millisekundda, test payloadda sekundda yuboradi.
  const rawTs = Number(event.timestamp);
  const sentAt =
    event.timestamp && Number.isFinite(rawTs)
      ? new Date(rawTs < 1_000_000_000_000 ? rawTs * 1000 : rawTs)
      : new Date();
  const resolvedAttachment = await resolveIncomingAttachment(message.attachments?.[0], accessToken);
  const resolvedText = resolvedAttachment.attachmentText?.trim() || null;
  let normalizedText = message.text?.trim() || resolvedText;
  if (normalizedText && isGenericTemplateArtifact(normalizedText)) {
    normalizedText = null;
  }
  let attachmentType = resolvedAttachment.attachmentType;
  let attachmentUrl = resolvedAttachment.attachmentUrl;

  // Agar xabarda matn va attachment yo'q bo'lsa, payload ichidan yashiringan URL'ni
  // qidiramiz. Bu Instagram ba'zi link/video/share ko'rinishlarini oddiy textga
  // aylantirmay yuborganida unsupported bubble chiqib qolmasligi uchun kerak.
  if (!normalizedText && !attachmentUrl) {
    const fallbackUrl = findFirstHttpUrl(event);
    if (fallbackUrl) {
      attachmentUrl = fallbackUrl;
      attachmentType = attachmentType ?? 'file';
      console.log(`[webhook] Link fallback topildi (mid=${message.mid.slice(0, 24)}…): ${fallbackUrl}`);
    }
  }

  // Mijoz shu xabarda Instagram post/reel ulashgan/orqali yozgan BO'LSA (tabiiy "Yuborish"
  // tugmasi orqali — attachment) YOKI havolani qo'lda matn sifatida yopishtirgan bo'lsa,
  // uni bizning mahsulotlarimizdan (GroupInfo.videoUrl) biriga moslashtirishga harakat
  // qilamiz — topilsa, keyingi qisqa savollarda ("narxi qancha?") AI aynan shu mahsulotni
  // nazarda tutadi.
  const candidateProductUrl =
    (attachmentUrl && isInstagramPermalink(attachmentUrl) ? attachmentUrl : null) ??
    (normalizedText ? findInstagramUrlInText(normalizedText) : null) ??
    findInstagramUrlAnywhere(event);
  const matchedGroupId =
    !isEcho && candidateProductUrl ? await findGroupIdByVideoUrl(account.id, candidateProductUrl) : null;
  if (matchedGroupId) {
    console.log(`[webhook] Xabar mahsulotga moslashtirildi (conversation=${conversation.id}, group=${matchedGroupId})`);
  } else if (candidateProductUrl && !isEcho) {
    // Link topildi, lekin hech bir faol mahsulotning videoUrl'iga mos kelmadi — kelajakda
    // shu holatni tekshirish uchun (masalan link mahsulotga hali qo'shilmagan yoki eskirgan).
    console.log(
      `[webhook] Instagram link topildi, lekin mahsulotga mos kelmadi (conversation=${conversation.id}, url=${candidateProductUrl})`,
    );
  }

  let saved;
  try {
    saved = await prisma.message.create({
      data: {
        instagramMessageId: message.mid,
        conversationId: conversation.id,
        senderType: isEcho ? SenderType.ADMIN : SenderType.CONTACT,
        text: normalizedText,
        attachmentType,
        attachmentUrl,
        attachmentThumbnailUrl: resolvedAttachment.attachmentThumbnailUrl,
        status: isEcho ? 'SENT' : 'RECEIVED',
        sentAt,
      },
    });
  } catch (err) {
    // Parallel webhooklar orasida unique constraint dublikatni ushlab qoladi.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }

  // Telefon raqamini AI holatidan (yoqilgan/ochirilgan/operatorga otkazilgan) qatiy nazar
  // har bir kontakt xabarida qidiramiz — shu orqali mijoz operator bilan gaplashayotganda
  // ham (AI umuman ishtirok etmasa ham) qoldirgan raqami platformaga tushadi. Bu — Telegram
  // lid kanaliga xabar yuborish uchun ham ASOSIY nuqta.
  //
  // Mijoz xabarida raqam topilgan HAR SAFAR guruhga xabar yuboriladi — hatto raqam avvalgisi
  // bilan bir xil bo'lsa ham. Sabab: mijoz oldin bir kursga yozilib, keyinroq boshqa (yangi)
  // kursga qiziqib, o'sha eski raqamini yana qoldirishi mumkin — bu ham alohida lid sifatida
  // operatorga yetib borishi kerak.
  const detectedPhone = !isEcho && normalizedText ? extractPhoneNumber(normalizedText) : null;
  const previousPhoneNumber = contact.phoneNumber;
  if (detectedPhone) {
    console.log(`[webhook] Telefon raqami aniqlandi (contact=${contact.id}): ${detectedPhone}`);
  }

  // Avval kontaktni yangilaymiz (telefon shu yerda yoziladi), keyin suhbatni — shunda
  // suhbat bilan birga qaytariladigan "contact" snapshot ham yangi raqamni aks ettiradi.
  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastMessageAt: sentAt, ...(detectedPhone ? { phoneNumber: detectedPhone } : {}) },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: sentAt,
      ...(isEcho ? {} : { unreadCount: { increment: 1 } }),
      ...(detectedPhone ? { leadNotifiedAt: new Date() } : {}),
      ...(matchedGroupId ? { referencedGroupId: matchedGroupId } : {}),
    },
    include: { contact: true },
  });

  if (detectedPhone) {
    const settings = await prisma.academySettings.findUnique({ where: { instagramAccountId: account.id } });
    // Mijoz kursga emas, ISH O'RNIGA (vakansiya) qiziqib yozgan bo'lsa (masalan "Turk tili
    // bo'yicha bo'sh ish o'rni bormi" yoki umuman boshqacha so'z bilan — "sizlarda o'qituvchi
    // kerakmi" kabi), keyinroq qoldirgan telefon raqami oddiy kurs lidi sifatida Telegramga
    // tushib, sotuvchilarni chalg'itmasligi uchun tekshiramiz. Aniqlash AI orqali (suhbat
    // MA'NOSIGA qarab, aniq so'zga bog'liq bo'lmagan holda) amalga oshadi; AI ishlamay qolsa
    // (kalit sozlanmagan/xato), tezkor kalit-so'z regexi zaxira sifatida ishlatiladi.
    const recentHistory = await getConversationHistory(conversation.id);
    const jobInquiryAnalysis = await analyzeConversation(recentHistory);
    const isJobInquiry =
      jobInquiryAnalysis?.isJobInquiry ??
      recentHistory.some((turn) => turn.role === 'user' && detectJobInquiry(turn.content));
    notifyNewLead({
      academyName: settings?.academyName ?? account.name ?? account.username,
      phoneNumber: detectedPhone,
      previousPhoneNumber,
      courseName: conversation.interestedCourse,
      branch: conversation.interestedBranch,
      preferredTime: conversation.preferredTime,
      contactName: updatedConversation.contact.name,
      contactUsername: updatedConversation.contact.username,
      isJobInquiry,
    }).catch(() => {});
  }

  console.log(
    `[webhook] Xabar saqlandi (conversation=${conversation.id}, senderType=${saved.senderType}, sentAt=${saved.sentAt.toISOString()})`,
  );

  emitNewMessage({
    conversationId: conversation.id,
    message: saved,
    conversation: {
      id: updatedConversation.id,
      unreadCount: updatedConversation.unreadCount,
      lastMessageAt: updatedConversation.lastMessageAt,
      contact: updatedConversation.contact,
    },
  });

  // Mijoz shunchaki video/reel/rasm ulashsa yoki reaksiya bosса (bu funksiyaga reaksiya
  // umuman kelmaydi, alohida processReactionEvent orqali ishlanadi) — bu haqiqiy savol
  // emas, shuning uchun AI javob bermasligi kerak. attachmentType 'template' bo'lsa
  // (masalan quick-reply tugmasi) undan chiqarilgan matn baribir haqiqiy mijoz signali
  // hisoblanadi, shuning uchun bu holatga tegilmaydi.
  const isMediaOnlyShare = Boolean(attachmentUrl) && attachmentType !== 'template' && !message.text?.trim();
  if (isMediaOnlyShare) {
    console.log(
      `[webhook] Faqat media/reel ulashildi, matn yozilmagan — AI javob bermaydi (conversation=${conversation.id})`,
    );
  }

  // Faqat kontaktdan kelgan (echo emas), haqiqiy matn signaliga ega xabarlarga AI javob
  // berishga harakat qilinadi.
  if (!isEcho && normalizedText && !isMediaOnlyShare) {
    await handleIncomingContactMessage({
      account,
      accessToken,
      contactIgsid: contactScopedId,
      conversationId: conversation.id,
      text: normalizedText,
    });
  }
}

interface MaybeSendAiReplyParams {
  account: InstagramAccount;
  accessToken: string;
  contactIgsid: string;
  conversationId: string;
}

// Suhbatdagi oxirgi xabarlarni (matnli bolganlarini) OpenAI formatiga otkazadi — shu orqali
// AI faqat joriy xabarni emas, butun suhbat kontekstini "eslab" javob beradi. Masalan
// "Qaysi filial yaqin?" degan savoldan keyin mijoz shunchaki "Davlatobod" deb yozsa ham,
// AI bu nimaga javob ekanini tarixdan tushunadi.
async function getConversationHistory(conversationId: string, limit = 12): Promise<ChatTurn[]> {
  // Admin "AI xotirasini tozalash" tugmasini bosgan bo'lsa, shu vaqtdan oldingi xabarlar AI
  // kontekstiga kirmaydi — shunda AI mijozni suhbatni hali boshlamagan "yangi odam" deb biladi.
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aiMemoryResetAt: true },
  });

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      text: { not: null },
      ...(conversation?.aiMemoryResetAt ? { sentAt: { gt: conversation.aiMemoryResetAt } } : {}),
    },
    orderBy: { sentAt: 'desc' },
    take: limit,
  });
  return messages
    .reverse()
    .map((m) => ({
      role: m.senderType === SenderType.CONTACT ? ('user' as const) : ('assistant' as const),
      content: m.text!,
    }));
}

// ===== Handover Protocol (AI <-> inson operator) =====
//
// Har bir suhbat uchun eng ko'pi bilan bitta "kutilayotgan" AI javobi bo'ladi: yangi kontakt
// xabari kelganda avvalgi taymer bekor qilinadi va yangisi qo'yiladi. Shu orqali mijoz ketma-ket
// bir necha xabar yozsa ham, AI ularning HAMMASINI birlashtirib bitta tabiiy javob beradi —
// har bir xabarga alohida, soniyalar ichida bir nechta javob otib yubormaydi.
const pendingAiTimers = new Map<string, NodeJS.Timeout>();

// Odam yozgandek tabiiy kechikish: 4-5.5 soniya oralig'ida tasodifiy tanlanadi.
const HUMAN_LIKE_DELAY_MIN_MS = 4000;
const HUMAN_LIKE_DELAY_MAX_MS = 5500;

// Operator so'ralgach, jonli operatorga javob berish uchun qisqa oyna beriladi (7 daqiqa).
// Shu vaqt ichida admin qo'lda javob yozmasa, AI shu suhbatda avtomatik qayta yonadi — mijoz
// uzoq vaqt javobsiz qolib ketmasligi uchun.
const AUTO_RESUME_AFTER_MS = 7 * 60 * 1000;

// Admin qo'lda xabar yozganda (routes/conversations.ts) yoki suhbatni qo'lda pauza qilganda,
// o'sha paytda kutilayotgan (hali yuborilmagan) AI javobini bekor qilish uchun tashqariga ochiladi.
export function cancelPendingAiTurn(conversationId: string): void {
  const existing = pendingAiTimers.get(conversationId);
  if (existing) {
    clearTimeout(existing);
    pendingAiTimers.delete(conversationId);
  }
}

function scheduleAiTurn(params: MaybeSendAiReplyParams): void {
  const { conversationId } = params;
  cancelPendingAiTurn(conversationId);

  const delay =
    HUMAN_LIKE_DELAY_MIN_MS + Math.random() * (HUMAN_LIKE_DELAY_MAX_MS - HUMAN_LIKE_DELAY_MIN_MS);

  const timer = setTimeout(() => {
    pendingAiTimers.delete(conversationId);
    runAiTurn(params).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[webhook] AI javobini yozishda xato: ${message}`);
    });
  }, delay);

  pendingAiTimers.set(conversationId, timer);
}

interface HandoverParams {
  accessToken: string;
  contactIgsid: string;
  conversationId: string;
}

// Mijoz aniq operator so'raganda darhol (AI javob generatsiya qilishga urinmasdan) chaqiriladi:
// suhbatni aiPaused=true qilib belgilaydi va qisqa, tabiiy "operatorga ulanmoqda" xabarini yuboradi.
async function triggerHandover({ accessToken, contactIgsid, conversationId }: HandoverParams): Promise<void> {
  cancelPendingAiTurn(conversationId);

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiPaused: true, aiPausedAt: new Date() },
    include: { contact: true },
  });

  const ackText = pickHandoverAcknowledgement();

  try {
    const { messageId } = await enqueueDm({
      userId: contactIgsid,
      label: 'Operatorga ulanish xabari',
      execute: () => sendTextMessage(accessToken, contactIgsid, ackText),
    });
    const ackMessage = await prisma.message.create({
      data: {
        instagramMessageId: messageId,
        conversationId,
        senderType: SenderType.ADMIN,
        text: ackText,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: ackMessage.sentAt },
    });

    emitNewMessage({
      conversationId,
      message: ackMessage,
      conversation: {
        id: updatedConversation.id,
        unreadCount: updatedConversation.unreadCount,
        lastMessageAt: ackMessage.sentAt,
        contact: updatedConversation.contact,
      },
    });

    console.log(`[webhook] Operator so'ralgan, AI to'xtatildi (conversation=${conversationId})`);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Handover xabarini yuborishda xato: ${message}`);
  }
}

interface HandleIncomingParams extends MaybeSendAiReplyParams {
  text: string;
}

// Kontaktdan har bir yangi matnli xabar kelganda chaqiriladi. Handover Protocol'ning
// "kirish nuqtasi": pauza/avtomatik-qayta-yoqilish holatini va operator so'rovini shu yerda
// tekshiramiz, so'ng AI javobini (agar hammasi mos bo'lsa) tabiiy kechikish bilan navbatga qo'yamiz.
async function handleIncomingContactMessage({
  account,
  accessToken,
  contactIgsid,
  conversationId,
  text,
}: HandleIncomingParams): Promise<void> {
  if (!account.aiEnabled) return;

  const current = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aiPaused: true, aiPausedAt: true },
  });
  if (!current) return;

  if (current.aiPaused) {
    const pausedAtMs = current.aiPausedAt?.getTime() ?? Date.now();
    if (Date.now() - pausedAtMs < AUTO_RESUME_AFTER_MS) {
      console.log(`[webhook] Suhbat operator kutmoqda, AI javob bermadi (conversation=${conversationId})`);
      return;
    }
    // Belgilangan vaqt otdi, admin javob yozmadi — AI shu suhbatda avtomatik qayta yoqiladi.
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiPaused: false, aiPausedAt: null },
    });
    console.log(`[webhook] AI avtomatik qayta yoqildi (conversation=${conversationId})`);
  }

  if (detectHandoverRequest(text)) {
    await triggerHandover({ accessToken, contactIgsid, conversationId });
    return;
  }

  scheduleAiTurn({ account, accessToken, contactIgsid, conversationId });
}

// AI yoqilgan va markaz sozlamalari mavjud bolsa, suhbat tarixi asosida javob generatsiya
// qilib, Instagram Send API orqali yuboradi va suhbatga admin xabari sifatida yozadi. Xato
// yoki sozlama yoqligida jim otkazib yuboriladi — mijoz inson agentga qoladi.
async function runAiTurn({ account, accessToken, contactIgsid, conversationId }: MaybeSendAiReplyParams): Promise<void> {
  // Kutish davomida (4-5.5 soniya) suhbat holati o'zgargan bo'lishi mumkin (masalan admin
  // qo'lda javob yozdi yoki boshqa xabar handover'ni ishga tushirdi) — shuni oxirgi marta tekshiramiz.
  const current = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aiPaused: true, referencedGroupId: true },
  });
  if (!current || current.aiPaused) return;

  const history = await getConversationHistory(conversationId);
  const replyText = await generateAiReply(
    account.id,
    account.name || account.username,
    history,
    current.referencedGroupId,
  );
  if (!replyText) return;

  try {
    const { messageId } = await enqueueDm({
      userId: contactIgsid,
      label: 'AI javobi',
      execute: async () => {
        // Navbatda kutish paytida (limit sabab pauza bo'lsa, bir necha daqiqagacha) suhbat
        // holati o'zgargan bo'lishi mumkin — aynan yuborish oldidan yana tekshiramiz.
        const stillActive = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { aiPaused: true },
        });
        if (stillActive?.aiPaused) {
          throw new Error("AI javobi eskirgan — suhbat operator rejimiga o'tkazilgan, yuborish bekor qilindi");
        }
        return sendTextMessage(accessToken, contactIgsid, replyText);
      },
    });
    const aiMessage = await prisma.message.create({
      data: {
        instagramMessageId: messageId,
        conversationId,
        senderType: SenderType.ADMIN,
        text: replyText,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // AI javob yozgandan keyin, yangilangan suhbat tarixini leads ustunlari
    // (temperatura / gaplashish / kursga yozilish) bo'yicha avtomatik tasniflaymiz — shu bilan
    // birga mijoz shu javobga ham operator so'rab javob berganini (handoverRequested) tekshiramiz.
    // Xato yoki noaniq javob bo'lsa, analysis null bo'ladi — eski qiymatlar saqlanib qoladi.
    const analysisHistory = await getConversationHistory(conversationId, 20);
    const analysis = await analyzeConversation(analysisHistory);

    // AI suhbatdan telefon raqamini aniqlagan bo'lsa, kontakt yozuviga saqlaymiz — shu orqali
    // lidlar ro'yxatida va chat ichida "pin" sifatida ko'rsatiladi. Bu — regex asosidagi asosiy
    // nuqta (processMessagingEvent) o'tkazib yuborgan hollar uchun ZAXIRA: masalan AI raqamni
    // regex qamrab olmagan formatda tushunib olsa. MUHIM: bu yerda "raqam avvalgisidan farq
    // qilsa" tekshiruvi SAQLANADI (asosiy nuqtadan farqli) — chunki analyzeConversation butun
    // suhbat TARIXini har AI navbatida qayta tahlil qiladi, shuning uchun bitta raqam bir marta
    // aytilgach, dedup bo'lmasa HAR safar (suhbatdagi navbat sayin) qayta xabar yuborilib,
    // spam bo'lib qolardi. Asosiy nuqta esa faqat JORIY xabarda raqam borligini tekshirgani
    // uchun u yerda dedup shart emas.
    let shouldNotifyLead = false;
    let previousPhoneNumber: string | null = null;
    if (analysis?.phoneNumber) {
      const priorState = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { contact: { select: { phoneNumber: true } } },
      });
      previousPhoneNumber = priorState?.contact.phoneNumber ?? null;
      shouldNotifyLead = analysis.phoneNumber !== previousPhoneNumber;

      await prisma.contact
        .update({
          where: { instagramScopedId: contactIgsid },
          data: { phoneNumber: analysis.phoneNumber },
        })
        .catch(() => {});
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: aiMessage.sentAt,
        ...(analysis
          ? {
              leadTemperature: analysis.leadTemperature,
              talkStatus: analysis.talkStatus,
              courseDecision: analysis.courseDecision,
              ...(analysis.interestedCourse ? { interestedCourse: analysis.interestedCourse } : {}),
              ...(analysis.interestedBranch ? { interestedBranch: analysis.interestedBranch } : {}),
              ...(analysis.preferredTime ? { preferredTime: analysis.preferredTime } : {}),
              ...(analysis.handoverRequested ? { aiPaused: true, aiPausedAt: new Date() } : {}),
              ...(shouldNotifyLead ? { leadNotifiedAt: new Date() } : {}),
            }
          : {}),
      },
      include: { contact: true },
    });

    if (shouldNotifyLead && analysis?.phoneNumber) {
      const isJobInquiry =
        analysis.isJobInquiry ||
        analysisHistory.some((turn) => turn.role === 'user' && detectJobInquiry(turn.content));
      notifyNewLead({
        academyName: account.name || account.username,
        phoneNumber: analysis.phoneNumber,
        previousPhoneNumber,
        courseName: analysis.interestedCourse,
        branch: analysis.interestedBranch,
        preferredTime: analysis.preferredTime,
        contactName: updatedConversation.contact.name,
        contactUsername: updatedConversation.contact.username,
        isJobInquiry,
      }).catch(() => {});
    }

    emitNewMessage({
      conversationId,
      message: aiMessage,
      conversation: {
        id: updatedConversation.id,
        unreadCount: updatedConversation.unreadCount,
        lastMessageAt: updatedConversation.lastMessageAt,
        contact: updatedConversation.contact,
      },
    });

    console.log(
      `[webhook] AI javobi yuborildi (conversation=${conversationId})` +
        (analysis
          ? ` — tahlil: temperatura=${analysis.leadTemperature}, gaplashish=${analysis.talkStatus}, kurs=${analysis.courseDecision}, handover=${analysis.handoverRequested}, telefon=${analysis.phoneNumber ?? '-'}`
          : ' — tahlil otkazib yuborildi'),
    );
  } catch (err) {
    // Instagram Send API xatosi (masalan 24 soatlik oyna yopilgan) AI javobini yuborishni
    // toxtatadi, lekin webhook oqimini buzmaydi.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] AI javobini yuborishda xato: ${message}`);
  }
}
