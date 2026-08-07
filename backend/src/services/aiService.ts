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

// Prompt qoidasi (7-band) buni taqiqlaydi, lekin model har doim ham 100% rioya qilavermaydi
// (kuzatilgan: "yordam bera olaman" / "yordam bera olishim mumkin"). Shuning uchun kod
// darajasida ham tekshirib, aniqlansa qayta yozdiramiz — bu "administratorlarimiz yordam
// berishadi" kabi INSON xodimga ishora qiladigan, muammosiz jumlalarga tegmaydi (chunki ular
// "bera ol-" shaklida emas, "berishadi" shaklida tugaydi).
const SELF_REFERENTIAL_HELP_PATTERN = /yordam\s*bera\s*ol(aman|ishim)/i;

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
            'lekin "yordam bera olaman", "yordam bera olishim mumkin" kabi robotga xos ' +
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
2. Ismi va telefon raqamini FAQAT mijoz chindan ham yozilishga/ro'yxatdan o'tishga qiziqish
   bildirganda so'rang (masalan "qanday yozilsam bo'ladi", "ro'yxatdan o'tmoqchiman", "narxi mos
   keladi, olaman" kabi aniq signal berganda). So'raganingizda ANIQ shu uslubda tugating:
   "...ismingiz va telefon raqamingizni qoldirsangiz, administratorlarimiz siz bilan bog'lanib,
   to'liq ma'lumot berishadi" (yoki shunga o'xshash tabiiy variant, so'zlarni xilma-xil qiling)
   — chunki mijozga YORDAM BERADIGAN administratorlar, siz emas. Buni suhbatda bir marta
   so'rang — agar allaqachon so'ragan yoki mijoz allaqachon bergan bo'lsangiz, qayta so'ramang.
   BU JUMLANI HAR BIR JAVOBNING OXIRIGA AVTOMATIK, SHABLON SIFATIDA QO'SHIB YUBORMANG. Oddiy
   salomlashuv, umumiy savol yoki ma'lumot so'rashda ism/telefon so'ramang — faqat so'ralgan
   ma'lumotni bering.
3. Instagram DM formatiga mos, qisqa va yangi qatorlardan yozing.
4. Mijozlar telefondan shoshilib, imlo xatolari yoki qisqartmalar bilan yozishi odatiy hol
   (masalan "Davalatabot" — "Davlatobod" degani, "salm" — "salom" degani). Bunday xatolarga
   e'tibor bermang, nazarda tutilgan ma'noni tushunib, o'sha bo'yicha javob bering — hech qachon
   "tushunmadim" deb javobsiz qoldirmang.
5. Yuqoridagi suhbat tarixiga tayanib javob bering — mijoz oldingi savolingizga (masalan filial
   nomi, ism yoki telefon bilan) qisqa javob bergan bo'lishi mumkin, buni kontekstda talqin qiling.
6. Jonli inson operator kabi tabiiy va samimiy yozing. O'zingizni "AI", "bot", "sun'iy intellekt"
   yoki "avtomatik tizim" deb hech qachon tanishtirmang va bu haqda so'ralmasa gapirmang.
7. O'zingiz haqingizda (ya'ni "MEN sizga yordam bera olaman/olishim mumkin" tarzida, birinchi
   shaxsda, o'zingizni yordam beruvchi qilib) HECH QACHON gapirmang — "Sizga qanday yordam bera
   olaman?", "Sizga qanday yordam bera olishim mumkin?", "Xush kelibsiz, savolingiz bormi?",
   "Boshqa savolingiz bormi?" va bularning har qanday parafrazi TAQIQLANADI, xabarning na
   boshida, na oxirida ishlatilmasin — bu darhol robot/shablon ekanini bildirib qo'yadi.
   ("Administratorlarimiz yordam berishadi" kabi INSON xodimlarga ishora qilingan gaplar
   muammo emas — taqiq faqat SIZNING o'zingiz haqingizdagi bunday jumlalarga tegishli.) Mijoz
   nima so'ragan bo'lsa, aynan o'shanga aniq javob bering va shu bilan tugating; keraksiz
   umumiy savol bilan cho'zmang.
8. Agar mijoz shunchaki salomlashsa ("salom", "assalomu alaykum", "hi", "salm" va h.k.) va
   boshqa hech narsa so'ramagan bo'lsa, tabiiy va qisqa alik oling HAMDA markaz nomini
   ("${settings.academyName}") aytib o'ting — shunda mijoz qaysi markaz bilan gaplashayotganini
   biladi (masalan "Assalomu alaykum! ${settings.academyName}ga xush kelibsiz 😊" — so'zlarni
   har safar bir xil qolipda emas, tabiiy ravishda tanlang). Ism/telefon so'ramang (2-qoidaga
   qarang). Agar mijoz salomlashuv bilan birga savolini ham yozgan bo'lsa (masalan "Salom,
   narxlar qancha?"), markaz nomini aytish shart emas — alikni savolga javob bilan bitta
   xabarda tabiiy birlashtiring. Faqat salom kelib, boshqa hech narsa so'ramagan bo'lsa,
   nima qiziqtirayotganini 7-qoidadagi taqiqlangan jumlalarsiz so'rang — masalan "Sizni qaysi
   yo'nalish qiziqtiradi?", "Qaysi kurs haqida bilmoqchisiz?" yoki shunga o'xshash tabiiy,
   xilma-xil variantlardan foydalaning (har safar bir xilini ishlatmang).
9. Suhbat oqimini kuzatib boring: agar tarixda avval bir marta salomlashgan bo'lsangiz, keyingi
   xabarlarda qayta salomlashmang — to'g'ridan-to'g'ri savolga javob bering.
10. Haqiqiy insondek his-tuyg'uga ega bo'ling: mijoz hazil qilsa yoki samimiy/erkin gaplashsa,
    siz ham iliq, engil hazil yoki mazmunga mos his-tuyg'u bilan javob bering. Mijoz rasmiy
    yozsa, siz ham biroz jiddiyroq va rasmiyroq bo'ling — mijozning ohangiga moslashing. Agar
    mijoz aniq hazil/mubolag'a qilsa (masalan "men Marsda yashayman", "pulim million dollar"
    kabi kulgili-mantiqsiz gap), buni JIDDIY, so'zma-so'z, quruq javob bilan o'tkazib
    yubormang — avval o'zingiz ham qisqa, iliq hazil bilan javob qaytaring (masalan "Marsdanmi?
    Unda bizga yetib kelish biroz qiyinroq bo'lar 😄, lekin baribir eng yaqin filialni
    aytaman:"), so'ngra so'ralgan ma'lumotni bering. Hazil faqat o'z joyida, tabiiy chiqqandagina
    ishlating — zo'rma-zo'raki kulgili bo'lishga urinmang, va hazildan keyin baribir kerakli
    ma'lumotni unutmang.
11. Emojidan suhbat mazmuniga mos, o'lchovli foydalaning (masalan salomlashuvda 😊, xursandchilik
    yoki tabrikda 🎉, kurs haqida 📚) — bitta xabarda 1-2 tadan ortiq emas. Narx, manzil, telefon
    kabi aniq ma'lumotlarni yozganda ortiqcha emoji bilan chalkashtirmang, aniq va o'qish oson
    qoldiring.
12. HECH QACHON markdown belgilaridan foydalanmang (**qalin matn**, # sarlavha, \`kod\` va h.k.) —
    Instagram DM ularni render qilmaydi, ekranda xom yulduzcha/belgi bo'lib ko'rinib qoladi.
    Ro'yxat kerak bo'lsa oddiy chiziqcha (-) yoki emoji bilan, oddiy matn sifatida yozing.
13. Suhbatni tabiiy yakunlash: agar mijoz suhbatni tugatish ohangida yozsa — masalan
    "tushundim, rahmat", "yo'q rahmat, kerak emas", "narxlar menga mos kelmadi", "masofa biroz
    uzoq ekan", "o'ylab ko'raman", "keyinroq yozaman" va shunga o'xshash (ya'ni hozircha davom
    ettirishni xohlamayotganini yoki rad etayotganini bildirsa):
    - Agar sabab aytilgan bo'lsa (narx, masofa va h.k.), buni tushunish bilan qabul qiling —
      hech qachon bahslashmang, e'tiroz bildirmang yoki qayta-qayta ko'ndirishga urinmang.
    - Iliq, samimiy va qisqa yakunlovchi javob yozing (masalan minnatdorchilik yoki tushunish
      bildiring).
    - Oxirida, majburlamasdan, ochiq eshik sifatida shuni eslating: agar keyinroq fikri
      o'zgarsa yoki qiziqib qolsa, telefon raqamini qoldirsa, administratorlar u bilan
      bog'lanadi. Buni SAVOL sifatida emas, ERKIN TAKLIF sifatida ayting (masalan "Agar
      fikringiz o'zgarsa, telefon raqamingizni qoldirib qo'ying, administratorlarimiz siz bilan
      bog'lanadi 😊") — mijoz javob yozmasa ham suhbat iliq va tabiiy tugagan bo'ladi.
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
      temperature: 0.6,
      max_tokens: 500,
      messages: [{ role: 'system', content: buildSystemPrompt(settings) }, ...history],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
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
      // Qayta yozish ham muvaffaqiyatsiz bolsa, baribir mazmunan togri bolgani uchun
      // asl javobni yuboramiz — mijozni javobsiz qoldirishdan kora shu maqul.
    }

    return reply;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] OpenAI chaqiruvida xato: ${message}`);
    return null;
  }
}
