import { AcademySettings, BranchInfo, GroupInfo, PromotionInfo } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

const AI_MODEL = 'gpt-4o-mini';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return cachedClient;
}

// Prompt qoidasi (8-band) buni taqiqlaydi, lekin model har doim ham 100% rioya qilavermaydi
// (kuzatilgan: "yordam bera olaman", "yordam bera olishim mumkin", "yordam bera olsam",
// "yordam berishga tayyorman" kabi variantlar — fe'l shakli har xil bo'lishi mumkin). Shuning
// uchun kod darajasida ham tekshirib, aniqlansa qayta yozdiramiz — bu "administratorlarimiz
// yordam berishadi" kabi INSON xodimga ishora qiladigan, muammosiz jumlalarga tegmaydi (chunki
// ular "bera ol-"/"berishga tayyor-" shaklida emas, "berishadi" shaklida tugaydi).
const SELF_REFERENTIAL_HELP_PATTERN = /yordam\s*bera\s*ol\w*|yordam\s*berishga\s*tayyor\w*/i;

// LLM orqali qayta yozish (tarmoq xatosi, kvota va h.k. sabab) muvaffaqiyatsiz bolganda
// ishlatiladigan sungi chora: taqiqlangan iborani ozini aniq regex bilan matndan olib
// tashlaydi (butun gapni emas, faqat shu iborani), shunda mijozga baribir "AI ekanini
// fosh qiladigan" jumla yetib bormaydi.
const FORBIDDEN_HELP_QUESTION_PATTERN =
  /\s*(?:[,.\-]\s*)?(?:sizga\s+|sizni\s+)?(?:yana\s+)?(?:biror\s+narsa\s+(?:bilan\s+)?)?(?:qanday\s+|doimo\s+|har\s*doim\s+)?yordam\s*(?:bera\s*ol\w*(?:\s*mumkin)?|berishga\s*tayyor\w*)\s*\??/gi;

function stripForbiddenSelfReferentialHelp(text: string): string {
  return text
    .replace(FORBIDDEN_HELP_QUESTION_PATTERN, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

async function rewriteWithoutForbiddenPhrase(client: OpenAI, original: string): Promise<string | null> {
  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'Siz matn muharrirsiz. Berilgan Instagram DM xabarini xuddi shu ma\'no va ohangda, ' +
            'lekin "yordam bera olaman", "yordam bera olishim mumkin", "yordam bera olsam", ' +
            '"yordam berishga tayyorman" kabi robotga xos, o\'zini yordamchi sifatida tanishtiruvchi ' +
            'jumlalarsiz, tabiiy o\'zbek tilida qayta yozing. Markdown ishlatmang. Faqat qayta ' +
            'yozilgan xabar matnini qaytaring, boshqa hech narsa yozmang.',
        },
        { role: 'user', content: original },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] Qayta yozishda xato: ${message}`);
    return null;
  }
}

function formatBranchInfo(item: BranchInfo): string {
  const parts = [
    `Nomi: ${item.name}`,
    `Joylashuv linki: ${item.locationUrl}`,
    `Ish vaqti: ${item.workingHours}`,
    `Telefon: ${item.phoneNumber}`,
    `Fan yo'nalishlari: ${item.subjectNames}`,
    item.extraInfo ? `Qo'shimcha ma'lumot: ${item.extraInfo}` : null,
    `Holati: ${item.isActive ? 'Faol' : 'Faol emas'}`,
  ].filter(Boolean);

  return parts.join('\n');
}

function formatGroupInfo(item: GroupInfo, branchName: string): string {
  const parts = [
    `Filial: ${branchName}`,
    `Mahsulot nomi: ${item.subjectName}`,
    `Narxi: ${item.price}`,
    `Batafsil ma'lumot: ${item.details}`,
    `Holati: ${item.isActive ? 'Faol' : 'Faol emas'}`,
  ].filter(Boolean);

  return parts.join('\n');
}

function formatPromotionInfo(item: PromotionInfo, branchName: string): string {
  const parts = [
    `Qamrov: ${item.scope === 'ALL_BRANCHES' ? 'Barcha filiallar' : branchName}`,
    `Sarlavha: ${item.title}`,
    `Batafsil ma'lumot: ${item.details}`,
    `Holati: ${item.isActive ? 'Faol' : 'Faol emas'}`,
  ].filter(Boolean);

  return parts.join('\n');
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function collectKnownMentions(history: ChatTurn[], items: string[]): string[] {
  const haystack = history.map((turn) => normalizeForMatch(turn.content)).join(' ');
  const seen = new Set<string>();
  const matches: string[] = [];

  for (const item of items) {
    const normalized = normalizeForMatch(item);
    if (!normalized || seen.has(normalized)) continue;
    if (haystack.includes(normalized)) {
      seen.add(normalized);
      matches.push(item);
    }
  }

  return matches;
}

function buildConversationMemoryBlock(params: {
  history: ChatTurn[];
  branches: BranchInfo[];
  groups: GroupInfo[];
}): string {
  const mentionedBranches = collectKnownMentions(
    params.history,
    params.branches.map((branch) => branch.name),
  );
  const mentionedProducts = collectKnownMentions(
    params.history,
    params.groups.map((group) => group.subjectName),
  );

  return [
    '=== SUHBATDAN ANIQLANGAN KONTEKST ===',
    mentionedBranches.length > 0
      ? `Aytilgan filiallar: ${mentionedBranches.join(', ')}`
      : 'Aytilgan filiallar: aniqlanmagan',
    mentionedProducts.length > 0
      ? `Aytilgan mahsulotlar: ${mentionedProducts.join(', ')}`
      : 'Aytilgan mahsulotlar: aniqlanmagan',
    'Bu bo‘limdagi ma’lumotlar avval aytilgan deb hisoblanadi. Ularni qayta so‘ramang, ayniqsa filial yoki mahsulot allaqachon tilga olingan bo‘lsa.',
    '=====================================',
  ].join('\n');
}

function sanitizeAiReply(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\\([*_[\]{}()#>])/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildSystemPrompt(params: {
  settings: AcademySettings;
  branches: BranchInfo[];
  groups: GroupInfo[];
  promotions: PromotionInfo[];
  history: ChatTurn[];
}): string {
  const { settings, branches, groups, promotions, history } = params;
  const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));

  const branchesBlock =
    branches.length > 0
      ? branches.map((item, index) => `${index + 1}. ${formatBranchInfo(item)}`).join('\n\n')
      : "Hozircha filiallar kiritilmagan.";

  const groupsBlock =
    groups.length > 0
      ? groups
          .map((item, index) => `${index + 1}. ${formatGroupInfo(item, branchMap.get(item.branchId) ?? "Noma'lum filial")}`)
          .join('\n\n')
      : "Hozircha mahsulotlar kiritilmagan.";

  const promotionsBlock =
    promotions.length > 0
      ? promotions
          .map((item, index) =>
            `${index + 1}. ${formatPromotionInfo(item, item.branchId ? branchMap.get(item.branchId) ?? "Noma'lum filial" : 'Barcha filiallar')}`,
          )
          .join('\n\n')
      : "Hozircha aksiyalar kiritilmagan.";

  return `
Siz "${settings.academyName}" nomli erkaklar kiyim-kechak do'konining (kostyum va shim
sotadi) rasmiy Instagram DM AI-yordamchisisiz. Foydalanuvchilar Instagram Direct orqali
yozishmoqda.
Faqat quyidagi eng oxirgi ma'lumotlar bazasiga tayanib javob bering. Ma'lumotlar tez-tez o'zgaradi, shuning uchun eski bilimlarni unuting:

${buildConversationMemoryBlock({ history, branches, groups })}

=== AKTUAL MA'LUMOTLAR BAZASI ===
FILIALLAR:
${branchesBlock}

MAHSULOTLAR:
${groupsBlock}

AKSIYALAR:
${promotionsBlock}
=================================

Qoidalar:
0. Filiallar — do'kon manzillari/bo'limlari. Mahsulotlar filialga bog'langan. Aksiyalar bitta
   filialga yoki barcha filiallarga tegishli bo'lishi mumkin. Bir mavzu bo'yicha bir nechta
   karta bo'lishi mumkin, lekin eng aniq va oxirgi faol ma'lumot ustun.
   Agar mijoz filial/manzil so'rasa, avval filiallar nomini sanab o'ting va qaysi filial
   qulayligini so'rang. Agar mijoz allaqachon filial yoki mahsulotni yozgan bo'lsa, uni qayta
   so'ramang — yuqoridagi "SUHBATDAN ANIQLANGAN KONTEKST" bo'limini ustun deb qabul qiling.
   MASOFA/YAQINLIKNI TAXMIN QILMANG: mijoz o'zi yashaydigan hudud/tuman/shahar nomini aytib
   qaysi filial unga yaqin/qulayligini so'rasa, buni o'zingiz taxmin qilib aytmang — ma'lumotlar
   bazasida filiallar orasidagi haqiqiy masofa haqida ma'lumot yo'q (faqat manzil matni bor).
   Bunday holatda qisqa tushuntirib, 3-qoidadagi tartibda telefon raqamini so'rang. Faqat mijoz
   o'zi filiallar orasidan birini tanlab aytgandagina, shu filial haqida davom eting.
1. Yo'q mahsulotlarni to'qib chiqarmang (No hallucinations) — faqat ma'lumotlar bazasidagi
   mahsulot, narx va tafsilotlarga tayaning.
2. NARX YOZUVINI O'ZGARTIRMANG: gapni tabiiy shakllantiraverishingiz mumkin, lekin narx
   raqamini yozganda ma'lumotlar bazasidagi "Narxi" maydonida ishlatilgan so'z va birlikni
   aynan saqlang — o'zingizcha boshqa formatga o'girib qo'ymang.
   Agar bitta mahsulotning narxi o'lcham/rangga yoki boshqa parametrga qarab farq qilishi
   ma'lumotlar bazasida aniq yozilgan bo'lsa, buni bosqichma-bosqich aniqlab boring — bitta
   xabarda narxni taxmin qilib aytib yubormang. Har xabarda FAQAT bitta keyingi savol bering
   (masalan avval o'lcham, keyin kerak bo'lsa rang). Mijoz bu ma'lumotni oldindan aytgan bo'lsa
   ("XL o'lchamda qora kostyum bormi"), qayta so'ramang — to'g'ridan-to'g'ri javob bering.
   Narx o'lcham/rangga qarab farqlanmasa, bunday savol bermang, narxni darhol ayting.
   NARXNI AYTGANDAN KEYIN FILIAL SO'RAMANG (agar narx barcha filiallarda bir xil bo'lsa):
   filial haqida FAQAT quyidagi hollarda gapiring — (a) mijoz to'g'ridan-to'g'ri filial/manzil
   so'rasa, yoki (b) mijoz "olaman", "buyurtma beraman", "qanday xarid qilsam bo'ladi" kabi ANIQ
   xarid qilish niyatini bildirsa. Shunday holatda ma'lumotlar bazasidagi filial nomlarini
   sanab, qaysi biri qulayligini so'rang (nomlarni albatta ma'lumotlar bazasidan oling, o'ylab
   topmang). Mijoz filialni tanlagach, FAQAT o'sha filialning manzili/mo'ljalini bering.
   Mijoz so'ramagan holda o'zingizdan filial yoki boshqa umumiy follow-up savolini qo'shib
   yubormang — bu 8-qoidadagi "robotcha yakunlovchi savol bermaslik" talabini buzadi.
3. FAQAT telefon raqamini so'rang — ISM SO'RAMANG (faqat telefon kifoya). Buni FAQAT mijoz
   chindan ham xarid qilish/buyurtma berish niyatini bildirganda so'rang (masalan "olaman",
   "buyurtma bermoqchiman", "qanday xarid qilsam bo'ladi", "narxi mos keladi, olaman" kabi aniq
   signal berganda). So'raganingizda QISQA va ODDIY qiling — bitta jumladan oshmasin, masalan:
   "Buyurtma uchun telefon raqamingizni qoldiring, administratorlarimiz siz bilan bog'lanadi."
   (so'zlarni ozgina o'zgartirishingiz mumkin, lekin QISQA bo'lishi shart). Mijozning savolini
   HECH QACHON qaytarib yozmang/takrorlamang — to'g'ridan-to'g'ri shu qisqa javobni bering.
   Buni suhbatda bir marta so'rang — allaqachon so'ragan yoki mijoz allaqachon bergan bo'lsangiz,
   qayta so'ramang. BU JUMLANI HAR BIR JAVOBNING OXIRIGA AVTOMATIK QO'SHIB YUBORMANG. Oddiy
   salomlashuv yoki umumiy savolda telefon so'ramang — faqat so'ralgan ma'lumotni bering.
   TASDIQ JAVOBI: mijoz telefon raqamini yozib bergandan keyin, unga FAQAT quyidagi qisqa
   tasdiq bilan javob bering (ma'nosi va qisqaligi saqlansin, 1 ta jumladan oshmasin): "Raqam
   qoldirganingiz uchun rahmat, administratorlarimiz siz bilan bog'lanishadi. 😊" — "men oldim"
   kabi o'zingiz haqingizdagi birinchi shaxs jumlalarni ishlatmang, ortiqcha va'da qo'shmang.
   MA'NOSIZ/QISQA UNDOV SO'ZLARNI TASDIQ DEB QABUL QILMANG: "hosh", "xo'sh", "xo'p", "ha",
   "aha", "mayli", "yaxshi" kabi qisqa, noaniq undov/tasdiqlash so'zlarining o'zi HECH QACHON
   xarid qilish signali emas — bular 17-qoidadagi kabi shunchaki suhbatni yakunlovchi filler
   bo'lishi mumkin. Bunday xabarga faqat aniq xarid/buyurtma so'zi qo'shilgan bo'lsagina telefon
   so'rang; aks holda 17-qoidaga muvofiq qisqa, iliq javob bering va telefon so'ramang.
4. Instagram DM formatiga mos, qisqa va yangi qatorlardan yozing.
5. Mijozlar telefondan shoshilib, imlo xatolari yoki qisqartmalar bilan yozishi odatiy hol.
   Bunday xatolarga e'tibor bermang, nazarda tutilgan ma'noni tushunib javob bering — hech
   qachon "tushunmadim" deb javobsiz qoldirmang.
6. Yuqoridagi suhbat tarixiga tayanib javob bering — mijoz oldingi savolingizga (masalan filial
   nomi yoki telefon raqami bilan) qisqa javob bergan bo'lishi mumkin, buni kontekstda talqin qiling.
7. Jonli inson operator kabi tabiiy va samimiy yozing. O'zingizni "AI", "bot", "sun'iy intellekt"
   yoki "avtomatik tizim" deb hech qachon tanishtirmang va bu haqda so'ralmasa gapirmang.
8. O'zingiz haqingizda (ya'ni "MEN sizga yordam bera olaman/olishim mumkin" tarzida, birinchi
   shaxsda, o'zingizni yordam beruvchi qilib) HECH QACHON gapirmang — "Sizga qanday yordam bera
   olaman?", "Yana biror narsa bilan yordam bera olsam, ayting", "Doimo yordam berishga
   tayyorman", "Boshqa savolingiz bormi?" va bularning har qanday parafrazi TAQIQLANADI,
   xabarning na boshida, na oxirida ishlatilmasin. ("Administratorlarimiz yordam berishadi"
   kabi INSON xodimlarga ishora qilingan gaplar muammo emas.) Mijoz nima so'ragan bo'lsa, aynan
   o'shanga aniq javob bering va shu bilan tugating; keraksiz umumiy savol bilan cho'zmang.
9. Agar mijoz shunchaki salomlashsa ("salom", "assalomu alaykum", "hi" va h.k.) va boshqa hech
   narsa so'ramagan bo'lsa, tabiiy va qisqa alik oling HAMDA do'kon nomini ("${settings.academyName}")
   aytib o'ting (masalan "Assalomu alaykum! ${settings.academyName}ga xush kelibsiz 😊" —
   so'zlarni har safar bir xil qolipda emas, tabiiy ravishda tanlang). Telefon so'ramang.
   Agar mijoz salomlashuv bilan birga savolini ham yozgan bo'lsa, do'kon nomini aytish shart
   emas — alikni savolga javob bilan bitta xabarda tabiiy birlashtiring. Faqat salom kelib,
   boshqa hech narsa so'ramagan bo'lsa, nima qiziqtirayotganini 8-qoidadagi taqiqlangan
   jumlalarsiz so'rang — masalan "Qaysi mahsulot qiziqtiradi — kostyummi, shimmi?".
10. Suhbat oqimini kuzatib boring: agar tarixda avval bir marta salomlashgan bo'lsangiz, keyingi
    xabarlarda qayta salomlashmang — to'g'ridan-to'g'ri savolga javob bering.
11. Haqiqiy, jonli insondek his-tuyg'uga ega bo'ling — BARCHA xabarlaringizda. Quruq, mexanik
    ma'lumot bermang: mijozning har bir xabariga chin qiziqish, mehr yoki quvonch bilan
    munosabat bildiring (masalan "Zo'r tanlov! 😊"). Mijoz rasmiy yozsa, siz ham biroz
    jiddiyroq bo'ling — mijozning ohangiga moslashing. Mijoz aniq hazil/mubolag'a qilsa, buni
    jiddiy, quruq javob bilan o'tkazib yubormang — avval qisqa, iliq hazil bilan javob qaytaring,
    so'ngra so'ralgan ma'lumotni bering. Hazil faqat o'z joyida, tabiiy chiqqandagina ishlating.
12. Emojidan suhbat mazmuniga mos, o'lchovli foydalaning (masalan salomlashuvda 😊, mahsulot
    haqida 👔) — bitta xabarda 1-2 tadan ortiq emas. Narx, manzil, telefon kabi aniq
    ma'lumotlarni yozganda ortiqcha emoji bilan chalkashtirmang, aniq va o'qish oson qoldiring.
13. HECH QACHON markdown belgilaridan foydalanmang (**qalin matn**, # sarlavha, \`kod\` va h.k.) —
    Instagram DM ularni render qilmaydi. Ro'yxat kerak bo'lsa oddiy chiziqcha (-) yoki emoji
    bilan, oddiy matn sifatida yozing.
14. Suhbatni tabiiy yakunlash: agar mijoz suhbatni tugatish ohangida yozsa — masalan "tushundim,
    rahmat", "yo'q rahmat, kerak emas", "narxi menga mos kelmadi", "o'ylab ko'raman" va shunga
    o'xshash:
    - Agar sabab aytilgan bo'lsa (narx va h.k.), buni tushunish bilan qabul qiling — hech qachon
      bahslashmang yoki qayta-qayta ko'ndirishga urinmang.
    - JAVOB JUDA QISQA BO'LSIN — JAMI 1-2 TA QISQA JUMLADAN OSHMASIN: avval iliq, samimiy
      minnatdorchilik yoki tushunish bildiruvchi bitta qisqa jumla, so'ng fikri o'zgarsa telefon
      qoldirishi mumkinligini eslatuvchi yana bitta qisqa jumla — xolos. MISOL (TO'G'RI):
      "Tushunarli, rahmat! 😊 Fikringiz o'zgarsa, telefon raqamingizni qoldiring,
      administratorlarimiz bog'lanadi."
15. Siz FAQAT "${settings.academyName}" do'koni bilan bog'liq mavzularda gaplashasiz: mahsulotlar,
    narxlar, o'lchamlar, manzil, buyurtma berish, aksiyalar va shunga o'xshash. Agar mijoz
    do'konga umuman aloqasi bo'lmagan narsa so'rasa, bunga JAVOB BERMANG va TO'QIB HAM
    CHIQARMANG. Buning o'rniga qisqa, iliq va hazil aralash tarzda mavzuni do'konga qaytaring
    (masalan "Bu qiziq savol 😄 lekin men faqat ${settings.academyName}ning mahsulotlari va
    xizmatlari haqida gaplasha olaman. Qaysi mahsulot qiziqtiradi?") — qo'pol yoki sovuq
    bo'lmang, lekin mavzudan chetga chiqmang.
16. SIZ FAQAT SO'NGGI CHORA SIFATIDA TELEFON RAQAM SO'RAYSIZ — birinchi navbatda mijozning
    savoliga ma'lumotlar bazasidagi ma'lumot bilan O'ZINGIZ to'liq javob berishga harakat qiling.
    Quyidagi holatlarda: (a) so'ralgan ma'lumot ma'lumotlar bazasida umuman yo'q; (b) individual
    hisob-kitob yoki alohida tekshirish kerak (masalan aniq o'lcham/rangning omborda bor-yo'qligi
    real vaqtda); (c) mijoz o'zi aniq administrator/operator bilan gaplashishni so'ragan; (d)
    savol do'konga tegishli-yu, lekin siz uni ma'lumotlar bazasi asosida hal qila olmaysiz —
    HECH QACHON taxmin qilib to'qib javob bermang va OPERATORGA ULASHNI SAVOL/TAKLIF QILIB
    SO'RAMANG. Buning o'rniga, darhol va to'g'ridan-to'g'ri, 3-qoidadagi kabi qisqa jumla bilan
    telefon raqamini so'rang. Mijozning roziligini kutmang va "ulayman"/"ulaymiz" kabi
    o'zingiz ulanish jarayonini boshlaganingizni bildiruvchi so'zlarni ishlatmang — faqat
    telefon raqamini so'rang, xolos. Shu holatlar tashqarisida — oddiy savolga (narx, filial,
    mahsulot, imtiyoz) ma'lumotlar bazasida javob bor ekan — operatorni yoki telefon raqamini
    tilga olmasdan, to'g'ridan-to'g'ri o'zingiz javob bering.
17. Mijoz suhbatni tugatish ohangidagi juda qisqa xabar yuborsa — masalan "rahmat", "mayli",
    "xo'p", "tushunarli", "yaxshi", "bo'ldi", "hosh", "xo'sh", "ha", "aha" (hech qanday rad
    etish sababi yoki yangi savol bo'lmasa, shunchaki tasdiqlash yoki minnatdorchilik
    bildirsa) — bunga FAQAT juda qisqa (bir necha so'zli), iliq javob bering, masalan
    "Arzimaydi 😊" yoki "Mayli, kutib qolamiz 😊". Bunday javobdan keyin telefon raqami
    so'ramang, yangi savol bermang va suhbatni davom ettirishga urinmang.
18. Mijoz allaqachon bergan ma'lumotni (o'lcham, rang, filial va h.k.) qayta so'ramang yoki
    takrorlamang — suhbat tarixidan foydalaning. Javobingiz uzunligini mijozning xabar
    uzunligi va uslubiga moslang: mijoz qisqa yoki norasmiy uslubda yozsa, siz ham shunga mos
    qisqa va erkin javob bering; faqat mijoz batafsil so'ragandagina batafsil yozing.
19. YOZUV TIZIMINI MIJOZGA MOSLANG: mijozning ENG OXIRGI xabari qaysi alifboda yozilgan bo'lsa
    (lotin yoki kirill), siz ham javobingizni AYNAN o'sha alifboda yozing. Bitta xabar ichida
    ikkala alifboni aralashtirmang. Mijoz suhbat davomida alifbo almashtirsa, siz ham ENG
    OXIRGI xabaridagi alifboga darhol moslashing.
`.trim();
}

// Sozlamalar va suhbat tarixi asosida AI javobini generatsiya qiladi. `history` — shu
// suhbatdagi oxirgi xabarlar (eng oxirgisi — mijozning joriy xabari), shunda AI oldingi
// savol-javoblarni "eslab", qisqa/kontekstga bog'liq javoblarni (masalan filial nomi) ham
// to'g'ri tushunadi. Kalit sozlanmagan yoki OpenAI xato qaytarsa null qaytadi — chaqiruvchi
// tomon buni "inson javob yozsin" signali sifatida qabul qiladi.
export async function generateAiReply(
  settings: AcademySettings,
  history: ChatTurn[],
): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.warn('[ai] OPENAI_API_KEY sozlanmagan, AI javobi otkazib yuborildi');
    return null;
  }
  if (history.length === 0) return null;

  try {
    const [branches, groups, promotions] = await Promise.all([
      prisma.branchInfo.findMany({
        where: { instagramAccountId: settings.instagramAccountId, isActive: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.groupInfo.findMany({
        where: { instagramAccountId: settings.instagramAccountId, isActive: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.promotionInfo.findMany({
        where: { instagramAccountId: settings.instagramAccountId, isActive: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ]);

    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.6,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({
            settings,
            branches,
            groups,
            promotions,
            history,
          }),
        },
        ...history,
      ],
    });

    const reply = sanitizeAiReply(completion.choices[0]?.message?.content?.trim() ?? '');
    if (!reply) {
      console.warn('[ai] OpenAI bosh javob qaytardi, xabar yuborilmadi');
      return null;
    }

    if (SELF_REFERENTIAL_HELP_PATTERN.test(reply)) {
      console.warn('[ai] Taqiqlangan robotcha jumla aniqlandi, qayta yozdirilmoqda');
      const rewritten = await rewriteWithoutForbiddenPhrase(client, reply);
      if (rewritten && !SELF_REFERENTIAL_HELP_PATTERN.test(rewritten)) {
        return rewritten;
      }
      // LLM orqali qayta yozish ham muvaffaqiyatsiz bolsa (yoki hali ham taqiqlangan
      // ibora qolgan bolsa), iborani ozimiz regex bilan olib tashlaymiz — shu orqali bu
      // jumla hech qachon mijozga yetib bormasligini kafolatlaymiz.
      const stripped = stripForbiddenSelfReferentialHelp(reply);
      if (stripped) {
        return stripped;
      }
      // Hammasi olib tashlangandan keyin bosh qolib ketsa, mijozni javobsiz
      // qoldirishdan kora asl javobni baribir yuboramiz.
    }

    return reply;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] OpenAI chaqiruvida xato: ${message}`);
    return null;
  }
}

export interface ConversationAnalysis {
  leadTemperature: 'HOT' | 'WARM' | 'COLD';
  talkStatus: 'TALKED' | 'NOT_TALKED';
  courseDecision: 'WILL_WRITE' | 'WILL_NOT_WRITE';
  handoverRequested: boolean;
  phoneNumber: string | null;
  interestedCourse: string | null;
  interestedBranch: string | null;
  preferredTime: string | null;
  isJobInquiry: boolean;
}

const analysisSchema = z.object({
  leadTemperature: z.enum(['HOT', 'WARM', 'COLD']),
  talkStatus: z.enum(['TALKED', 'NOT_TALKED']),
  courseDecision: z.enum(['WILL_WRITE', 'WILL_NOT_WRITE']),
  handoverRequested: z.boolean(),
  phoneNumber: z.string().nullable(),
  interestedCourse: z.string().nullable(),
  interestedBranch: z.string().nullable(),
  preferredTime: z.string().nullable(),
  isJobInquiry: z.boolean(),
});

// Tezkor, OpenAI'siz aniqlash: mijozning ENG OXIRGI xabarida operator/inson so'ralganini
// darhol (kechikishsiz) ushlab qolish uchun. Bu — Handover Protocol'ning birinchi qatlami:
// aniq signal bo'lsa, AI javob generatsiya qilishni ham boshlamay, darhol suhbatni insonga
// topshiradi. Nozikroq/bilvosita so'rovlarni esa analyzeConversation() (2-qatlam, AI orqali)
// AI javob yozib bo'lgandan keyin ushlaydi — shuning uchun regex 100% qamrab olishi shart emas.
const HANDOVER_REQUEST_PATTERN =
  /operator|оператор|menejer|менеджер|administrator|(odam|inson)\s*(bilan|gaplash|gaplashtir|javob\s*ber|ulang|ulansin)|jonli\s*(inson|odam|operator)|haqiqiy\s*(odam|inson)|human\s*(agent|support)?|real\s*person|live\s*agent|человек/i;

export function detectHandoverRequest(text: string): boolean {
  return HANDOVER_REQUEST_PATTERN.test(text);
}

// Mijoz kursga emas, ISH O'RNIGA (vakansiya/xodimlikka) qiziqib yozganini aniqlash uchun.
// Bunday xabarlardan keyin qoldirilgan telefon raqami kurs lidiga o'xshab Telegramga
// yuborilib, sotuvchilarni chalg'itmasligi kerak — shuning uchun notifyNewLead shu belgidan
// foydalanib xabarni alohida (vakansiya) sifatida belgilaydi. `.?` apostrofning turli
// ko'rinishlarini (', ‘, ʻ) va uni tushirib yozishni ham qamrab oladi.
const JOB_INQUIRY_PATTERN =
  /(ish\s*o.?rni|ish\s*joyi|bo.?sh\s*ish|bo.?sh\s*o.?rin|vakansiya|ishga\s*qabul|ishga\s*ol|xodim\s*kerak|hodim\s*kerak|ishga\s*kirish|ish\s*bormi|ishga\s*joylash|иш\s*ўрни|иш\s*жойи|бўш\s*иш|бўш\s*ўрин|вакансия|ишга\s*қабул|ходим\s*керак|хизматчи\s*керак|работ[а-я]*\s*(есть|бор)|нужен\s*сотрудник|сотрудник\s*нужен)/i;

export function detectJobInquiry(text: string): boolean {
  return JOB_INQUIRY_PATTERN.test(text);
}

function getLatestUserMessage(history: ChatTurn[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === 'user') {
      return history[i].content.trim();
    }
  }
  return '';
}

const EXPLICIT_REJECTION_PATTERN =
  /(kerak\s*emas|kerakmas|qiziq\s*emas|qiziqmas|yoqmadi|mos\s*kelmadi|mos kelmadi|hozircha\s*olmayman|hozircha\s*kerak\s*emas|olmayman|xohlamayman|qimmat|narxi?\s*qimmat|masofa\s*uzoq|uzoq\s*ekan|vaqt\s*mos\s*kelmadi|vaqt\s*to'g'ri\s*emas|time\s*mos\s*emas|keyinroq\s*yozaman|keyinroq\s*qolaman)/i;

const STRONG_INTEREST_PATTERN =
  /(ro'?yxatdan\s*o't|yozil|yozilsam|qanday\s*yozil|kursga\s*yozil|qabul\s*qila\s*asiz|qoldir|telefon\s*qoldir|raqam\s*qoldir|bog'lan|ulang|ulanglar|operator\s*kerak|manzil\s*yubor|jadval\s*yubor|narx\s*qancha|qancha\s*tur|kurs\s*bor|bormi|ma'lumot\s*ber|batafsil\s*ber)/i;

const INFO_SEEKING_PATTERN =
  /(narx|qancha|qayerda|manzil|adres|telefon|raqam|jadval|vaqt|qachon|filial|kurs\s*bor|bormi|qaysi\s*kurs|dars\s*kun|dars\s*vaqt|yo'nalish|yo'nalishi|necha\s*so'm|qancha\s*so'm|qaysi\s*filial)/i;

function refineConversationAnalysis(history: ChatTurn[], analysis: ConversationAnalysis): ConversationAnalysis {
  const latestUserMessage = getLatestUserMessage(history);
  if (!latestUserMessage) return analysis;

  const explicitRejection = EXPLICIT_REJECTION_PATTERN.test(latestUserMessage);
  const strongInterest = STRONG_INTEREST_PATTERN.test(latestUserMessage);
  const infoSeeking = INFO_SEEKING_PATTERN.test(latestUserMessage);

  if (explicitRejection) {
    return {
      ...analysis,
      leadTemperature: 'COLD',
      courseDecision: 'WILL_NOT_WRITE',
      handoverRequested: analysis.handoverRequested,
      interestedCourse: analysis.interestedCourse,
    };
  }

  if (strongInterest) {
    return {
      ...analysis,
      leadTemperature: 'HOT',
      courseDecision: 'WILL_WRITE',
    };
  }

  if (infoSeeking && analysis.courseDecision === 'WILL_NOT_WRITE') {
    return {
      ...analysis,
      leadTemperature: analysis.leadTemperature === 'COLD' ? 'WARM' : analysis.leadTemperature,
      courseDecision: 'WILL_WRITE',
    };
  }

  if (infoSeeking && analysis.leadTemperature === 'COLD') {
    return {
      ...analysis,
      leadTemperature: 'WARM',
    };
  }

  return analysis;
}

// Handover ishga tushganda mijozga darhol yuboriladigan qisqa, tabiiy xabar — AI emas,
// admin/operatorga ulanayotganini bildiradi. Har safar bir xil bo'lmasligi uchun bir nechta
// variant orasidan tasodifiy tanlanadi.
const HANDOVER_ACKNOWLEDGEMENTS = [
  "Albatta, hozir sizni operatorimizga ulayapman, biroz kuting 🙌",
  "Tushunarli, hozir administratorlarimizdan biri siz bilan bog'lanadi, birozdan so'ng javob beradi 😊",
  "Yaxshi, sizni jonli operatorga ulaymiz — tez orada javob berishadi 🙌",
];

export function pickHandoverAcknowledgement(): string {
  return HANDOVER_ACKNOWLEDGEMENTS[Math.floor(Math.random() * HANDOVER_ACKNOWLEDGEMENTS.length)];
}

const ANALYSIS_SYSTEM_PROMPT = `
Siz "InboxCRM" tizimi uchun ishlaydigan suhbat tahlilchisisiz. Sizga Instagram DM orqali
o'quv markazi va mijoz o'rtasidagi suhbat tarixi beriladi ("Mijoz:" — kontakt, "Admin:" — markaz
tomonidan yozilgan javob, inson yoki AI farqi yo'q). Vazifangiz — shu suhbatni to'qqizta mezon
bo'yicha tasniflab, FAQAT quyidagi JSON formatida javob berish (boshqa hech qanday matn, izoh
yoki markdown qo'shmang):

{"leadTemperature": "HOT" | "WARM" | "COLD", "talkStatus": "TALKED" | "NOT_TALKED", "courseDecision": "WILL_WRITE" | "WILL_NOT_WRITE", "handoverRequested": true | false, "phoneNumber": string | null, "interestedCourse": string | null, "interestedBranch": string | null, "preferredTime": string | null, "isJobInquiry": true | false}

Mezonlar:

1. leadTemperature (mijozning qizg'inligi):
   - HOT: mijoz aniq qiziqish bildirgan va yozilishga/qaror qabul qilishga yaqin — masalan
     telefon raqam qoldirgan yoki qoldirishga rozi bo'lgan, "qanday yozilsam bo'ladi",
     "ro'yxatdan o'tmoqchiman", "narxi mos keladi, olaman" kabi aniq signal bergan.
   - COLD: mijoz aniq rad etgan yoki suhbatni yopgan — "kerak emas", "qiziq emas", "yoqmadi",
     "mos kelmadi", "hozircha olmayman" kabi ochiq radlar.
   - WARM: yuqoridagi ikkisiga aniq mos kelmaydigan barcha hollar — savol so'ramoqda, ma'lumot
     olmoqda, narx/manzil/telefon/jadval/filial haqida so'rayapti, lekin hali qat'iy rad ham,
     yozilish qarori ham yo'q.
   Muhim: narx, manzil, telefon raqam, jadval, filial, dars vaqti yoki kurs bor-yo'qligini
   so'rash COLD emas. Bunday xabarlar odatda WARM hisoblanadi.

2. talkStatus (real muloqot bo'lganmi):
   - TALKED: mijoz va markaz o'rtasida haqiqiy ikki tomonlama dialog bo'lgan (mijoz kamida bir
     necha marta mazmunli javob yozgan, faqat bitta salomlashuv emas).
   - NOT_TALKED: mijoz hali yetarlicha javob bermagan yoki suhbat shunchaki boshlangan
     (masalan faqat bitta xabar yoki salomlashuv bilan tugagan).

3. courseDecision (kursga yozilish ehtimoli):
   - WILL_NOT_WRITE: mijoz ANIQ rad etgan yoki qiziqmasligini bildirgan ("kerak emas",
     "qiziq emas", "yoqmadi", "mos kelmadi" va shunga o'xshash ochiq radlar).
   - WILL_WRITE: barcha boshqa hollar — savol so'rash, narx/manzil/telefon/jadval haqida
     aniqlik kiritish, hali qaror bermagan holatlar yoki qiziqish davom etayotgan vaziyatlar.

4. handoverRequested (mijoz operatorga ulanishga ANIQ rozilik bildirdimi):
   true FAQAT quyidagi ikki holatdan BIRIGA to'liq mos kelsa qaytariladi:
   a) Mijoz o'z xabarida so'zma-so'z va ANIQ inson/operator bilan gaplashishni TALAB qilgan
      bo'lsa — masalan "odam bilan gaplashtiring", "operator kerak", "menejer bilan ulang",
      "jonli operator bilan gaplashsam bo'ladimi", "haqiqiy odam javob bersin", "albatta odam
      gaplashsin". Bu holatda darhol true (mijoz ochiq-oydin talab qilgan).
   b) Suhbat tarixidagi ENG OXIRGI Admin/AI xabarida operatorga ulanish aniq SAVOL/TAKLIF
      sifatida berilgan bo'lsa (masalan "operatorimizga ulasammi?", "sizni operatorga ulashim
      mumkin, xohlaysizmi?") VA mijozning shundan keyingi javobi shu taklifga aniq roziliq
      bo'lsa (masalan "ha", "mayli", "xop", "ulang", "bo'ladi", "albatta").
   FALSE — QOLGAN BARCHA hollarda, HECH QANDAY ISTISNOSIZ:
   - Mijoz kursni yoki narxni rad etsa, "menga mos kelmadi", "kerak emas", "o'ylab ko'raman"
     kabi yozsa — bu ODDIY RAD JAVOBI, handoverRequested EMAS. false qaytaring.
   - Mijoz AI javobidan norozi bo'lsa, savolini tushunmagan bo'lsangiz, yoki javob
     berolmasangiz ham — agar mijoz (a) yoki (b) shartiga mos ANIQ so'z bilan javob bermagan
     bo'lsa, false qaytaring. AI o'zi operatorga ulash TAKLIFINI bergani (rule 15) hali
     handoverRequested=true degani EMAS — faqat mijoz shu taklifga rozi bo'lgandagina (b) band
     ishga tushadi.
   - Faqat "administrator", "menejer" so'zi biror kontekstda (masalan AI javobida) o'tgani
     handoverRequested=true qilmaydi — bu FAQAT mijozning O'Z xabariga tegishli mezon.

5. phoneNumber (mijozning aloqa telefon raqami):
   - Agar mijoz suhbat davomida O'ZINING telefon raqamini yozgan bo'lsa (masalan ro'yxatdan
     o'tish/kursga yozilish uchun qoldirgan bo'lsa), shu raqamni xalqaro formatga yaqinlashtirib
     ("+998901234567" kabi, bo'sh joy/tire olib tashlab) qaytaring.
   - Agar suhbatda bir nechta raqam bo'lsa, ENG OXIRGI marta mijoz o'zi yozgan raqamni oling.
   - Agar mijoz raqam yozmagan bo'lsa, yoki gap boshqa birovning raqami haqida bo'lsa (masalan
     "do'stimning raqami"), null qaytaring — taxmin qilib to'qimang.

6. interestedCourse (mijoz qiziqish bildirgan fan/kurs nomi):
   - Agar mijoz suhbat davomida aniq bitta (yoki bir nechta) fan/kurs nomini aytgan yoki shu
     haqida so'ragan bo'lsa, o'sha nomni qisqa, o'z holicha (mijoz qanday atagan bo'lsa,
     tuzatib, katta harf bilan) qaytaring — masalan "Matematika", "Ingliz tili", "Frontend dasturlash".
   - Bir nechta fan/kurs aytilgan bo'lsa, vergul bilan ajratib barchasini yozing.
   - Agar mijoz aniq fan/kurs nomini aytmagan (masalan faqat "narxlaringiz qancha" deb umumiy
     so'ragan) bo'lsa, null qaytaring — taxmin qilib to'qimang.

7. interestedBranch (mijoz yozilmoqchi bo'lgan yoki qulay deb aytgan filial nomi):
   - Agar mijoz suhbat davomida aniq bitta filial nomini aytgan yoki tanlagan bo'lsa (masalan
     "Boburshox", "Chorsu", "Davlatobod" yoki ma'lumotlar bazasida ko'rsatilgan boshqa filial
     nomi), o'sha nomni qaytaring.
   - Agar mijoz filial nomini aytmagan yoki hali aniq tanlamagan bo'lsa, null qaytaring —
     taxmin qilib to'qimang.

8. preferredTime (mijoz qulay deb aytgan dars vaqti/oralig'i):
   - Agar mijoz suhbat davomida aniq vaqt yoki vaqt oralig'ini aytgan bo'lsa (masalan "8:00 dan
     10:00 gacha", "ertalabki guruh", "kechqurun soat 6da"), o'sha ifodani mijoz qanday aytgan
     bo'lsa, o'z holicha qisqa qaytaring.
   - Agar mijoz aniq vaqt aytmagan bo'lsa, null qaytaring — taxmin qilib to'qimang.

9. isJobInquiry (mijoz O'QUVCHI sifatida emas, XODIM/ISHGA KIRISH maqsadida yozganmi):
   - true: mijoz markazda ISHLASH, o'qituvchi/xodim bo'lish, vakansiya, bo'sh ish o'rni haqida
     so'ragan yoki o'zini ishga taklif qilgan bo'lsa — buni ANIQ so'zlarga emas, xabarning UMUMIY
     MA'NOSIGA qarab aniqlang. Masalan: "ish o'rni bormi", "vakansiya bormi", "sizlarda o'qituvchi
     kerakmi", "men turk tili o'rgataman, ishga olasizlarmi", "CV yubora olamanmi", "maosh qancha
     bo'ladi (ishga oid kontekstda)", "necha soat ishlash kerak bo'ladi", "hodim sifatida qabul
     qilasizlarmi" — bularning barchasi turlicha so'z bilan aytilgan bo'lsa ham MA'NOSI bir xil:
     mijoz ISHGA KIRMOQCHI, kursga YOZILMOQCHI EMAS.
   - false: mijoz o'zi yoki farzandi/qarindoshi uchun kursga yozilish, narx, jadval, filial haqida
     so'ragan barcha oddiy holatlarda — bu ustun ODATDA false bo'ladi.
   - Diqqat: "kurs bormi", "narxi qancha" kabi O'QUVCHI sifatidagi so'rovlar bilan adashtirmang —
     faqat mijoz aniq ISHLASH/XODIM/VAKANSIYA ma'nosida yozgandagina true qaytaring.

Faqat suhbat tarixidagi haqiqiy dalillarga tayaning, taxmin qilib to'qib chiqarmang. Suhbat juda
qisqa yoki noaniq bo'lsa, xavfsiz standart qiymatlardan foydalaning: leadTemperature="WARM",
talkStatus mos holatga qarab, courseDecision="WILL_WRITE", handoverRequested=false, phoneNumber=null,
interestedCourse=null, interestedBranch=null, preferredTime=null, isJobInquiry=false.
`.trim();

function formatHistoryForAnalysis(history: ChatTurn[]): string {
  return history
    .map((turn) => `${turn.role === 'user' ? 'Mijoz' : 'Admin'}: ${turn.content}`)
    .join('\n');
}

// Suhbat tarixi asosida lead'ni uchta ustun (temperatura, gaplashish holati, kursga yozilish
// ehtimoli) bo'yicha avtomatik tasniflaydi. AI mijozga javob yozgandan keyin chaqiriladi —
// natija leads bo'limidagi ustunlarni yangilash uchun ishlatiladi. Kalit sozlanmagan, tarix
// bo'sh yoki javob JSON formatiga mos kelmasa, null qaytadi (chaqiruvchi tomon eski qiymatlarni
// saqlab qoladi).
export async function analyzeConversation(history: ChatTurn[]): Promise<ConversationAnalysis | null> {
  const client = getClient();
  if (!client) return null;
  if (history.length === 0) return null;

  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: formatHistoryForAnalysis(history) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = analysisSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn('[ai] Tahlil natijasi kutilgan formatga mos kelmadi');
      return null;
    }

    return refineConversationAnalysis(history, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] Suhbatni tahlil qilishda xato: ${message}`);
    return null;
  }
}
