import { AcademySettings } from '@prisma/client';
import OpenAI from 'openai';
import { env } from '../config/env';

const AI_MODEL = 'gpt-4o-mini';

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return cachedClient;
}

function buildSystemPrompt(settings: AcademySettings): string {
  return `
Siz InboxCRM tizimiga ulangan "${settings.academyName}" o'quv markazining rasmiy AI assistentisiz. Foydalanuvchilar Instagram DM orqali yozishmoqda.
Faqat quyidagi eng oxirgi ma'lumotlar bazasiga tayanib javob bering. Ma'lumotlar tez-tez o'zgaradi, shuning uchun eski bilimlarni unuting:

=== AKTUAL MA'LUMOTLAR BAZASI ===
KURSLARIMIZ VA NARXLAR:
${settings.coursesAndPrices}

MARKAZNING MANZILI VA MO'LJAL:
${settings.address}

ALOQA TELEFONLARI:
${settings.phoneNumbers}

AKSIYALAR VA CHEGIRMALAR:
${settings.promotions || "Hozircha faol aksiyalar yo'q."}
=================================

Qoidalar:
1. Yo'q kurslarni to'qib chiqarmang (No hallucinations).
2. Mijoz kursga qiziqsa, Ismi va Telefon raqamini so'rab oling (Lead generation) va operatorga yo'naltiring.
3. Instagram DM formatiga mos, qisqa va yangi qatorlardan yozing.
`.trim();
}

// Sozlamalar asosida AI javobini generatsiya qiladi. Kalit sozlanmagan yoki
// OpenAI xato qaytarsa null qaytadi — chaqiruvchi tomon buni "inson javob yozsin"
// signali sifatida qabul qiladi (auto-reply yubormaydi, mavjud suhbat buzilmaydi).
export async function generateAiReply(
  settings: AcademySettings,
  userMessage: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.warn('[ai] OPENAI_API_KEY sozlanmagan, AI javobi otkazib yuborildi');
    return null;
  }

  try {
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        { role: 'system', content: buildSystemPrompt(settings) },
        { role: 'user', content: userMessage },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    return reply || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] OpenAI chaqiruvida xato: ${message}`);
    return null;
  }
}
