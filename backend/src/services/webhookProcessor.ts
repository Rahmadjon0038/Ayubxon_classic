import { Contact, InstagramAccount, Prisma, SenderType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { downloadContactAvatar, isLocalUploadUrl } from '../lib/avatar';
import { generateAiReply } from './aiService';
import { fetchContactProfile, sendTextMessage } from './instagramApi';
import {
  getAccessToken,
  getConnectedAccount,
  getConnectedAccountByInstagramId,
} from './accountService';
import { emitMessageUpdated, emitNewMessage } from './socketService';

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
    value: messagingEventSchema.optional(),
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

export async function processWebhookPayload(rawPayload: unknown): Promise<void> {
  const parsed = webhookPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    console.warn('[webhook] Payload strukturasi notogri, otkazib yuborildi');
    return;
  }
  if (parsed.data.object !== 'instagram') {
    console.warn(`[webhook] Notanish object turi: ${parsed.data.object}, otkazib yuborildi`);
    return;
  }

  for (const entry of parsed.data.entry) {
    const events = [
      ...(entry.messaging ?? []),
      ...(entry.changes ?? [])
        .filter((c) => c.field === 'messages' && c.value)
        .map((c) => c.value!),
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

  // Webhook entry.id — xabarni qabul qilgan haqiqiy biznes akkaunt IGSID'i. Avval shu
  // orqali aniq akkauntni topamiz; topilmasa (masalan Dashboard test payloadida fake ID
  // kelsa) yagona ulangan akkauntga qaytamiz — bitta-akkauntli MVP rejimi uchun.
  const account =
    (entryBusinessId ? await getConnectedAccountByInstagramId(entryBusinessId) : null) ??
    (await getConnectedAccount());
  if (!account) {
    console.warn('[webhook] Ulangan Instagram akkaunt yoq, xabar saqlanmadi');
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
  const attachment = message.attachments?.[0];

  let saved;
  try {
    saved = await prisma.message.create({
      data: {
        instagramMessageId: message.mid,
        conversationId: conversation.id,
        senderType: isEcho ? SenderType.ADMIN : SenderType.CONTACT,
        text: message.text ?? null,
        attachmentType: attachment?.type ?? null,
        attachmentUrl: attachment?.payload?.url ?? null,
        status: isEcho ? 'SENT' : 'RECEIVED',
        sentAt,
      },
    });
  } catch (err) {
    // Parallel webhooklar orasida unique constraint dublikatni ushlab qoladi.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }

  const [updatedConversation] = await Promise.all([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: sentAt,
        ...(isEcho ? {} : { unreadCount: { increment: 1 } }),
      },
      include: { contact: true },
    }),
    prisma.contact.update({
      where: { id: contact.id },
      data: { lastMessageAt: sentAt },
    }),
  ]);

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

  // Faqat kontaktdan kelgan (echo emas) matnli xabarlarga AI javob berishga harakat qilinadi.
  if (!isEcho && message.text) {
    await maybeSendAiReply({
      account,
      accessToken,
      contactIgsid: contactScopedId,
      conversationId: conversation.id,
      userMessageText: message.text,
    });
  }
}

interface MaybeSendAiReplyParams {
  account: InstagramAccount;
  accessToken: string;
  contactIgsid: string;
  conversationId: string;
  userMessageText: string;
}

// AI yoqilgan va markaz sozlamalari mavjud bolsa, dinamik system prompt asosida javob
// generatsiya qilib, Instagram Send API orqali yuboradi va suhbatga admin xabari sifatida
// yozadi. Xato yoki sozlama yoqligida jim otkazib yuboriladi — mijoz inson agentga qoladi.
async function maybeSendAiReply({
  account,
  accessToken,
  contactIgsid,
  conversationId,
  userMessageText,
}: MaybeSendAiReplyParams): Promise<void> {
  if (!account.aiEnabled) return;

  const settings = await prisma.academySettings.findUnique({
    where: { instagramAccountId: account.id },
  });
  if (!settings) {
    console.log(
      `[webhook] AI yoqilgan, lekin "${account.username}" uchun markaz sozlamalari topilmadi — inson javobiga qoldirildi`,
    );
    return;
  }

  const replyText = await generateAiReply(settings, userMessageText);
  if (!replyText) return;

  try {
    const { messageId } = await sendTextMessage(accessToken, contactIgsid, replyText);
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

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: aiMessage.sentAt },
      include: { contact: true },
    });

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

    console.log(`[webhook] AI javobi yuborildi (conversation=${conversationId})`);
  } catch (err) {
    // Instagram Send API xatosi (masalan 24 soatlik oyna yopilgan) AI javobini yuborishni
    // toxtatadi, lekin webhook oqimini buzmaydi.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] AI javobini yuborishda xato: ${message}`);
  }
}
