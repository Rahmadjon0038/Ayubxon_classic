import { AcademySettings } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
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
2. FAQAT telefon raqamini so'rang — ISM SO'RAMANG (faqat telefon kifoya). Buni ham FAQAT mijoz
   chindan ham yozilishga/ro'yxatdan o'tishga qiziqish bildirganda so'rang (masalan "qanday
   yozilsam bo'ladi", "ro'yxatdan o'tmoqchiman", "narxi mos keladi, olaman" kabi aniq signal
   berganda). So'raganingizda QISQA va ODDIY qiling — faqat shunga o'xshash bitta jumla
   yeting, ortiqcha gap qo'shmang: "Yozilish uchun telefon raqamingizni qoldiring,
   administratorlarimiz siz bilan bog'lanadi." (so'zlarni ozgina o'zgartirishingiz mumkin,
   lekin QISQA bo'lishi shart — 1 ta jumladan oshmasin). Mijozning savolini ("qanday
   yozilaman?", "ro'yxatdan qanday o'taman?" kabi) HECH QACHON qaytarib yozmang/takrorlamang —
   to'g'ridan-to'g'ri shu qisqa javobni bering, boshqa izoh qo'shmang. Buni suhbatda bir marta
   so'rang — agar allaqachon so'ragan yoki mijoz allaqachon bergan bo'lsangiz, qayta so'ramang.
   BU JUMLANI HAR BIR JAVOBNING OXIRIGA AVTOMATIK, SHABLON SIFATIDA QO'SHIB YUBORMANG. Oddiy
   salomlashuv, umumiy savol yoki ma'lumot so'rashda telefon so'ramang — faqat so'ralgan
   ma'lumotni bering.
3. Instagram DM formatiga mos, qisqa va yangi qatorlardan yozing.
4. Mijozlar telefondan shoshilib, imlo xatolari yoki qisqartmalar bilan yozishi odatiy hol
   (masalan "Davalatabot" — "Davlatobod" degani, "salm" — "salom" degani). Bunday xatolarga
   e'tibor bermang, nazarda tutilgan ma'noni tushunib, o'sha bo'yicha javob bering — hech qachon
   "tushunmadim" deb javobsiz qoldirmang.
5. Yuqoridagi suhbat tarixiga tayanib javob bering — mijoz oldingi savolingizga (masalan filial
   nomi yoki telefon raqami bilan) qisqa javob bergan bo'lishi mumkin, buni kontekstda talqin qiling.
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
   har safar bir xil qolipda emas, tabiiy ravishda tanlang). Telefon so'ramang (2-qoidaga
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
14. Siz FAQAT "${settings.academyName}" markazi bilan bog'liq mavzularda gaplashasiz: kurslar,
    narxlar, jadval, manzil, ro'yxatdan o'tish, aksiyalar va shunga o'xshash. Agar mijoz
    markazga umuman aloqasi bo'lmagan narsa so'rasa (masalan hayvonlar, siyosat, ob-havo, ilmiy
    savollar, boshqa umumiy bilim mavzulari — kim/nima/qachon kabi tashqi dunyo haqidagi
    savollar), bunga JAVOB BERMANG va TO'QIB HAM CHIQARMANG. Buning o'rniga qisqa, iliq va
    hazil aralash tarzda mavzuni markazga qaytaring (masalan "Bu qiziq savol 😄 lekin men
    faqat ${settings.academyName}ning kurslari va xizmatlari haqida gaplasha olaman. Sizni
    qaysi kurs qiziqtiradi?") — qo'pol yoki sovuq bo'lmang, lekin mavzudan chetga chiqmang.
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

export interface ConversationAnalysis {
  leadTemperature: 'HOT' | 'WARM' | 'COLD';
  talkStatus: 'TALKED' | 'NOT_TALKED';
  courseDecision: 'WILL_WRITE' | 'WILL_NOT_WRITE';
  handoverRequested: boolean;
  phoneNumber: string | null;
}

const analysisSchema = z.object({
  leadTemperature: z.enum(['HOT', 'WARM', 'COLD']),
  talkStatus: z.enum(['TALKED', 'NOT_TALKED']),
  courseDecision: z.enum(['WILL_WRITE', 'WILL_NOT_WRITE']),
  handoverRequested: z.boolean(),
  phoneNumber: z.string().nullable(),
});

// Tezkor, OpenAI'siz aniqlash: mijozning ENG OXIRGI xabarida operator/inson so'ralganini
// darhol (kechikishsiz) ushlab qolish uchun. Bu — Handover Protocol'ning birinchi qatlami:
// aniq signal bo'lsa, AI javob generatsiya qilishni ham boshlamay, darhol suhbatni insonga
// topshiradi. Nozikroq/bilvosita so'rovlarni esa analyzeConversation() (2-qatlam, AI orqali)
// AI javob yozib bo'lgandan keyin ushlaydi — shuning uchun regex 100% qamrab olishi shart emas.
const HANDOVER_REQUEST_PATTERN =
  /operator|оператор|menejer|менеджер|administrator|odam\s*bilan|inson\s*bilan|jonli\s*(inson|odam|operator)|haqiqiy\s*(odam|inson)|human\s*(agent|support)?|real\s*person|live\s*agent|человек/i;

export function detectHandoverRequest(text: string): boolean {
  return HANDOVER_REQUEST_PATTERN.test(text);
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
tomonidan yozilgan javob, inson yoki AI farqi yo'q). Vazifangiz — shu suhbatni beshta mezon
bo'yicha tasniflab, FAQAT quyidagi JSON formatida javob berish (boshqa hech qanday matn, izoh
yoki markdown qo'shmang):

{"leadTemperature": "HOT" | "WARM" | "COLD", "talkStatus": "TALKED" | "NOT_TALKED", "courseDecision": "WILL_WRITE" | "WILL_NOT_WRITE", "handoverRequested": true | false, "phoneNumber": string | null}

Mezonlar:

1. leadTemperature (mijozning qizg'inligi):
   - HOT: mijoz aniq qiziqish bildirgan va yozilishga/qaror qabul qilishga yaqin — masalan
     telefon raqam qoldirgan yoki qoldirishga rozi bo'lgan, "qanday yozilsam bo'ladi",
     "ro'yxatdan o'tmoqchiman", "narxi mos keladi, olaman" kabi aniq signal bergan.
   - COLD: mijoz aniq qiziqish bildirmagan, sovuq/qisqa javob bergan, rad etgan yoki suhbatni
     ochiq rad javobi bilan yakunlagan ("kerak emas", "qiziq emas", "narx mos kelmadi" va h.k.).
   - WARM: yuqoridagi ikkisiga aniq mos kelmaydigan barcha hollar — savol so'ramoqda, ma'lumot
     olmoqda, lekin hali qat'iy qaror bermagan.

2. talkStatus (real muloqot bo'lganmi):
   - TALKED: mijoz va markaz o'rtasida haqiqiy ikki tomonlama dialog bo'lgan (mijoz kamida bir
     necha marta mazmunli javob yozgan, faqat bitta salomlashuv emas).
   - NOT_TALKED: mijoz hali yetarlicha javob bermagan yoki suhbat shunchaki boshlangan
     (masalan faqat bitta xabar yoki salomlashuv bilan tugagan).

3. courseDecision (kursga yozilish ehtimoli):
   - WILL_NOT_WRITE: mijoz ANIQ rad etgan yoki qiziqmasligini bildirgan (narx, masofa, vaqt
     mos kelmasligi, "kerak emas", "o'ylab ko'raman" kabi rad ohangidagi javoblar ham shu yerga
     kiradi, chunki ular hozircha yozilishni istamayotganini bildiradi).
   - WILL_WRITE: barcha boshqa hollar — hali rad javobi yo'q, qiziqish davom etmoqda yoki
     hali aniqlik yo'q.

4. handoverRequested (mijoz aniq inson operator bilan gaplashishni so'raganmi):
   - true: FAQAT mijoz ANIQ ravishda inson/operator/administrator bilan gaplashishni so'ragan
     bo'lsa (masalan "odam bilan gaplashtiring", "operator kerak", "menejer bilan ulang",
     "jonli operator bilan gaplashsam bo'ladimi").
   - false: bunday aniq so'rov bo'lmasa — mijoz AI javobidan norozi bo'lsa yoki tushunmagan
     bo'lsa ham, agar ANIQ inson/operator so'ramagan bo'lsa, false qaytaring.

5. phoneNumber (mijozning aloqa telefon raqami):
   - Agar mijoz suhbat davomida O'ZINING telefon raqamini yozgan bo'lsa (masalan ro'yxatdan
     o'tish/kursga yozilish uchun qoldirgan bo'lsa), shu raqamni xalqaro formatga yaqinlashtirib
     ("+998901234567" kabi, bo'sh joy/tire olib tashlab) qaytaring.
   - Agar suhbatda bir nechta raqam bo'lsa, ENG OXIRGI marta mijoz o'zi yozgan raqamni oling.
   - Agar mijoz raqam yozmagan bo'lsa, yoki gap boshqa birovning raqami haqida bo'lsa (masalan
     "do'stimning raqami"), null qaytaring — taxmin qilib to'qimang.

Faqat suhbat tarixidagi haqiqiy dalillarga tayaning, taxmin qilib to'qib chiqarmang. Suhbat juda
qisqa yoki noaniq bo'lsa, xavfsiz standart qiymatlardan foydalaning: leadTemperature="WARM",
talkStatus mos holatga qarab, courseDecision="WILL_WRITE", handoverRequested=false, phoneNumber=null.
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
      max_tokens: 150,
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

    return parsed.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] Suhbatni tahlil qilishda xato: ${message}`);
    return null;
  }
}
