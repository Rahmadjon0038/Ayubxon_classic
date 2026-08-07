import { AcademySettings } from '@prisma/client';
import OpenAI from 'openai';
import { env } from '../config/env';

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
4. Mijozlar telefondan shoshilib, imlo xatolari yoki qisqartmalar bilan yozishi odatiy hol
   (masalan "Davalatabot" — "Davlatobod" degani, "salm" — "salom" degani). Bunday xatolarga
   e'tibor bermang, nazarda tutilgan ma'noni tushunib, o'sha bo'yicha javob bering — hech qachon
   "tushunmadim" deb javobsiz qoldirmang.
5. Yuqoridagi suhbat tarixiga tayanib javob bering — mijoz oldingi savolingizga (masalan filial
   nomi, ism yoki telefon bilan) qisqa javob bergan bo'lishi mumkin, buni kontekstda talqin qiling.
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
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.4,
      max_tokens: 500,
      messages: [{ role: 'system', content: buildSystemPrompt(settings) }, ...history],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      console.warn('[ai] OpenAI bosh javob qaytardi, xabar yuborilmadi');
      return null;
    }
    return reply;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] OpenAI chaqiruvida xato: ${message}`);
    return null;
  }
}
