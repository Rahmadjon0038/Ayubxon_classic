import axios from 'axios';
import { env } from '../config/env';

export interface NewLeadNotification {
  academyName: string;
  phoneNumber: string;
  // Kontaktda shu xabardan OLDIN saqlangan raqam (bo'lmasa null). Faqat xabar matnida qanday
  // izoh chiqishini belgilash uchun — dedup uchun EMAS: mijoz bir xil raqamni qayta yozsa ham
  // (masalan yangi kursga yozilmoqchi bo'lsa), baribir har safar guruhga xabar yuboriladi.
  previousPhoneNumber: string | null;
  courseName: string | null;
  branch: string | null;
  preferredTime: string | null;
  contactName: string | null;
  contactUsername: string | null;
}

export interface NewAdLeadNotification {
  campaignTitle: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  comment: string | null;
  pageUrl: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMessage(lead: NewLeadNotification): string {
  const title = lead.branch ? escapeHtml(lead.branch) : `${escapeHtml(lead.academyName)} — yangi lid`;

  const lines = [`<b>📍 ${title}</b>`, ''];
  if (lead.previousPhoneNumber && lead.previousPhoneNumber === lead.phoneNumber) {
    lines.push("🔁 <i>Mijoz shu raqamni yana yubordi — yangi kursga qiziqqan bo'lishi mumkin</i>");
  } else if (lead.previousPhoneNumber) {
    lines.push('🔄 <i>Mijoz raqamini yangiladi</i>');
  }
  lines.push(`📞 <b>Telefon:</b> ${escapeHtml(lead.phoneNumber)}`);
  lines.push(`📚 <b>Kurs:</b> ${lead.courseName ? escapeHtml(lead.courseName) : 'aniqlanmagan'}`);
  if (lead.preferredTime) {
    lines.push(`🕒 <b>Qulay vaqt:</b> ${escapeHtml(lead.preferredTime)}`);
  }
  const contactLabel = lead.contactName || lead.contactUsername;
  if (contactLabel) {
    lines.push(`👤 <b>Instagram:</b> ${escapeHtml(contactLabel)}`);
  }

  return lines.join('\n');
}

// Telefon raqam birinchi marta aniqlangan lidni Telegram kanaliga yuboradi. BOT_TOKEN yoki
// CHANNEL_ID sozlanmagan bo'lsa, jim o'chiq holatda ishlaydi (xato tashlamaydi) — chaqiruvchi
// tomon (webhookProcessor) buni fire-and-forget sifatida chaqiradi.
export async function notifyNewLead(lead: NewLeadNotification): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL_ID sozlanmagan, lid xabarnomasi otkazib yuborildi');
    return;
  }

  console.log(`[telegram] Lid xabarnomasi yuborilmoqda (chat_id=${env.TELEGRAM_CHANNEL_ID}, telefon=${lead.phoneNumber})`);

  try {
    const response = await axios.post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: env.TELEGRAM_CHANNEL_ID,
      text: buildMessage(lead),
      parse_mode: 'HTML',
    });

    if (response.data?.ok) {
      console.log(`[telegram] Lid xabarnomasi muvaffaqiyatli yuborildi (chat_id=${env.TELEGRAM_CHANNEL_ID})`);
    } else {
      console.error(`[telegram] Telegram "ok:false" qaytardi (chat_id=${env.TELEGRAM_CHANNEL_ID}): ${JSON.stringify(response.data)}`);
    }
  } catch (err) {
    const details = axios.isAxiosError(err) && err.response ? JSON.stringify(err.response.data) : undefined;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[telegram] Lid xabarnomasini yuborishda xato (chat_id=${env.TELEGRAM_CHANNEL_ID}): ${message}${details ? ` — ${details}` : ''}`,
    );
  }
}

function buildAdLeadMessage(lead: NewAdLeadNotification): string {
  const lines = [`<b>📣 ${escapeHtml(lead.campaignTitle)}</b>`, ''];
  lines.push(`👤 <b>Ism:</b> ${escapeHtml(lead.fullName)}`);
  lines.push(`📞 <b>Telefon:</b> ${escapeHtml(lead.phoneNumber)}`);
  if (lead.email) {
    lines.push(`✉️ <b>Email:</b> ${escapeHtml(lead.email)}`);
  }
  if (lead.comment) {
    lines.push(`📝 <b>Izoh:</b> ${escapeHtml(lead.comment)}`);
  }
  if (lead.pageUrl) {
    lines.push(`🔗 <b>Link:</b> ${escapeHtml(lead.pageUrl)}`);
  }
  return lines.join('\n');
}

export async function notifyNewAdLead(lead: NewAdLeadNotification): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHANNEL_ID sozlanmagan, reklama lid xabarnomasi otkazib yuborildi');
    return;
  }

  console.log(`[telegram] Reklama lid xabarnomasi yuborilmoqda (chat_id=${env.TELEGRAM_CHANNEL_ID}, telefon=${lead.phoneNumber})`);

  try {
    const response = await axios.post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: env.TELEGRAM_CHANNEL_ID,
      text: buildAdLeadMessage(lead),
      parse_mode: 'HTML',
    });

    if (response.data?.ok) {
      console.log(`[telegram] Reklama lid xabarnomasi muvaffaqiyatli yuborildi (chat_id=${env.TELEGRAM_CHANNEL_ID})`);
    } else {
      console.error(`[telegram] Telegram "ok:false" qaytardi (reklama lead): ${JSON.stringify(response.data)}`);
    }
  } catch (err) {
    const details = axios.isAxiosError(err) && err.response ? JSON.stringify(err.response.data) : undefined;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[telegram] Reklama lid xabarnomasini yuborishda xato: ${message}${details ? ` — ${details}` : ''}`,
    );
  }
}
