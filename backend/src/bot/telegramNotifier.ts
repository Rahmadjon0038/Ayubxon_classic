import axios from 'axios';
import { env } from '../config/env';

export interface NewLeadNotification {
  academyName: string;
  phoneNumber: string;
  courseName: string | null;
  branch: string | null;
  preferredTime: string | null;
  contactName: string | null;
  contactUsername: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMessage(lead: NewLeadNotification): string {
  const title = lead.branch ? escapeHtml(lead.branch) : `${escapeHtml(lead.academyName)} — yangi lid`;

  const lines = [`<b>📍 ${title}</b>`, ''];
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

  try {
    await axios.post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: env.TELEGRAM_CHANNEL_ID,
      text: buildMessage(lead),
      parse_mode: 'HTML',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[telegram] Lid xabarnomasini yuborishda xato: ${message}`);
  }
}
