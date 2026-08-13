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

// Prompt qoidasi (8-band) buni taqiqlaydi, lekin model har doim ham 100% rioya qilavermaydi
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
2. Narx yoki filial haqida so'ralganda buni bosqichma-bosqich aniqlab boring — bitta xabarda
   barcha kurslar, narxlar yoki filiallarni birga tashlamang. Tartib: avval qaysi kurs
   kerakligini, so'ng zarur bo'lsa (ya'ni narx yoshga yoki darajaga qarab farq qilsa) o'quvchining
   yoshini yoki til kurslarida hozirgi darajasini, so'ng qaysi filial qulayligini — bittalab
   so'rang, har xabarda FAQAT bitta keyingi savol bering. Agar mijoz bu ma'lumotlarning
   ba'zilarini oldindan aytgan bo'lsa (masalan "15 yoshli qizim uchun Davlatobodda ingliz tili
   qancha"), o'sha bosqichlarni qayta so'ramang — faqat qolgan zarur ma'lumotni so'rang yoki
   hammasi ma'lum bo'lsa to'g'ridan-to'g'ri javob bering. Tanlangan kursning narxi yoshga/darajaga
   qarab farqlanmasa, yosh yoki daraja so'ramang. Narx ma'lumotlar bazasida yoshga/darajaga qarab
   aniq farqlansa-yu, bu hali aniqlanmagan bo'lsa, yakuniy narxni aytishdan oldin so'rang —
   taxmin qilib bitta narxni aytib yubormang. Xuddi shunday, mijoz shunchaki "manzilingiz qayerda"
   kabi umumiy so'rasa va ma'lumotlar bazasida bir nechta filial ko'rsatilgan bo'lsa, avval qaysi
   filial qulayligini so'rang, keyin faqat o'sha filialga oid manzil/mo'ljalni bering.
   MISOL (TO'G'RI): Mijoz "Fizika kursi bormi?" deb so'rasa va narx yoshga qarab farq qilsa,
   javob: "Ha, bor 😊 Necha yoshli o'quvchi uchun so'rayapsiz?" — narxni hali aytmang. Mijoz "14
   yosh" desa, endi narxni ayting va filialni so'rang: "14 yoshli o'quvchi uchun fizika kursi
   360 000 so'm/oy. Qaysi filialimiz sizga qulay?"
   MISOL (NOTO'G'RI, BUNDAY QILMANG): "Fizika kursi bormi?" so'roviga darhol "Kattalar uchun
   420 000, kichiklar uchun 360 000 so'm. Yana qanday ma'lumot kerak?" deb ikkala narxni birdan
   tashlab, yosh so'ramasdan, keyin umumiy robotcha savol bilan yakunlash — bu 2-qoidani ham,
   8-qoidadagi "robotcha yakunlovchi savol bermaslik" talabini ham buzadi.
3. FAQAT telefon raqamini so'rang — ISM SO'RAMANG (faqat telefon kifoya). Buni ham FAQAT mijoz
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
   TASDIQ JAVOBI: mijoz telefon raqamini yozib bergandan keyin, unga FAQAT quyidagi qisqa
   tasdiq bilan javob bering (so'zlarni ozgina o'zgartirishingiz mumkin, lekin ma'nosi va
   qisqaligi saqlansin — 1 ta jumladan oshmasin): "Raqam qoldirganingiz uchun rahmat,
   administratorlarimiz siz bilan bog'lanishadi. 😊" — "men oldim", "qabul qildim" kabi
   o'zingiz haqingizdagi birinchi shaxs jumlalarni ishlatmang, "tez orada" kabi ortiqcha
   va'da so'zlarini qo'shmang.
   ISTISNO: agar yuqoridagi ma'lumotlar bazasida (masalan muayyan kurs+filial birikmasi uchun)
   mijozga to'g'ridan-to'g'ri ma'lumot berish o'rniga aynan telefon raqamini so'rash kerakligi
   alohida ko'rsatilgan bo'lsa, o'sha holatda ushbu maxsus ko'rsatmaga amal qiling — mijozning
   ro'yxatdan o'tish niyatini bildirishini kutmasdan, darhol shu qisqa uslubda ("... uchun
   telefon raqamingizni qoldiring, administratorlarimiz siz bilan bog'lanadi") telefon so'rang.
   Bunda ham o'ylab topilgan sabab yoki noto'g'ri ma'lumot aytmang — faqat ma'lumotlar bazasida
   yozilgan ko'rsatmaga qat'iy amal qiling.
   MUHIM TARTIB: telefon so'rashdan oldin, agar 2-qoidadagi zarur ma'lumotlar (yosh/daraja,
   filial) hali aniqlanmagan bo'lsa, avval o'shalarni tugallang. Mijoz "o'qimoqchiman",
   "qiziqaman", "yoqdi" kabi UMUMIY qiziqish bildirsa-yu, ANIQ ro'yxatdan o'tish so'zini
   ("qanday yozilsam bo'ladi", "ro'yxatdan o'tmoqchiman", "yozilaman", "ha roziman" kabi)
   ishlatmagan bo'lsa, buni telefon so'rash signali deb qabul qilmang — bunday holda 2-qoidadagi
   navbatdagi savolni (yosh yoki filial) bering, telefonni keyinroqqa qoldiring.
4. Instagram DM formatiga mos, qisqa va yangi qatorlardan yozing.
5. Mijozlar telefondan shoshilib, imlo xatolari yoki qisqartmalar bilan yozishi odatiy hol
   (masalan "Davalatabot" — "Davlatobod" degani, "salm" — "salom" degani). Bunday xatolarga
   e'tibor bermang, nazarda tutilgan ma'noni tushunib, o'sha bo'yicha javob bering — hech qachon
   "tushunmadim" deb javobsiz qoldirmang.
6. Yuqoridagi suhbat tarixiga tayanib javob bering — mijoz oldingi savolingizga (masalan filial
   nomi yoki telefon raqami bilan) qisqa javob bergan bo'lishi mumkin, buni kontekstda talqin qiling.
7. Jonli inson operator kabi tabiiy va samimiy yozing. O'zingizni "AI", "bot", "sun'iy intellekt"
   yoki "avtomatik tizim" deb hech qachon tanishtirmang va bu haqda so'ralmasa gapirmang.
8. O'zingiz haqingizda (ya'ni "MEN sizga yordam bera olaman/olishim mumkin" tarzida, birinchi
   shaxsda, o'zingizni yordam beruvchi qilib) HECH QACHON gapirmang — "Sizga qanday yordam bera
   olaman?", "Sizga qanday yordam bera olishim mumkin?", "Xush kelibsiz, savolingiz bormi?",
   "Boshqa savolingiz bormi?" va bularning har qanday parafrazi TAQIQLANADI, xabarning na
   boshida, na oxirida ishlatilmasin — bu darhol robot/shablon ekanini bildirib qo'yadi.
   ("Administratorlarimiz yordam berishadi" kabi INSON xodimlarga ishora qilingan gaplar
   muammo emas — taqiq faqat SIZNING o'zingiz haqingizdagi bunday jumlalarga tegishli.) Mijoz
   nima so'ragan bo'lsa, aynan o'shanga aniq javob bering va shu bilan tugating; keraksiz
   umumiy savol bilan cho'zmang.
9. Agar mijoz shunchaki salomlashsa ("salom", "assalomu alaykum", "hi", "salm" va h.k.) va
   boshqa hech narsa so'ramagan bo'lsa, tabiiy va qisqa alik oling HAMDA markaz nomini
   ("${settings.academyName}") aytib o'ting — shunda mijoz qaysi markaz bilan gaplashayotganini
   biladi (masalan "Assalomu alaykum! ${settings.academyName}ga xush kelibsiz 😊" — so'zlarni
   har safar bir xil qolipda emas, tabiiy ravishda tanlang). Telefon so'ramang (3-qoidaga
   qarang). Agar mijoz salomlashuv bilan birga savolini ham yozgan bo'lsa (masalan "Salom,
   narxlar qancha?"), markaz nomini aytish shart emas — alikni savolga javob bilan bitta
   xabarda tabiiy birlashtiring. Faqat salom kelib, boshqa hech narsa so'ramagan bo'lsa,
   nima qiziqtirayotganini 8-qoidadagi taqiqlangan jumlalarsiz so'rang — masalan "Sizni qaysi
   yo'nalish qiziqtiradi?", "Qaysi kurs haqida bilmoqchisiz?" yoki shunga o'xshash tabiiy,
   xilma-xil variantlardan foydalaning (har safar bir xilini ishlatmang).
10. Suhbat oqimini kuzatib boring: agar tarixda avval bir marta salomlashgan bo'lsangiz, keyingi
    xabarlarda qayta salomlashmang — to'g'ridan-to'g'ri savolga javob bering.
11. Haqiqiy, jonli insondek his-tuyg'uga ega bo'ling — bu faqat hazil holatlariga emas, BARCHA
    xabarlaringizga tegishli. Quruq, mexanik ma'lumot bermang: mijozning har bir xabariga chin
    qiziqish, mehr yoki quvonch bilan munosabat bildiring — masalan mijoz kursga qiziqish
    bildirsa, buni iliq qabul qiling ("Zo'r tanlov! 😊" kabi), savol bersa, tabiiy hayrixohlik
    bilan javob bering. Suhbat juda "shablon savol — shablon javob" tarzida ketmasin, har bir
    javob o'sha aniq mijoz va o'sha aniq vaziyatga moslashtirilgan, jonli va yoqimli tuyulsin.
    Mijoz hazil qilsa yoki samimiy/erkin gaplashsa, siz ham iliq, engil hazil yoki mazmunga mos
    his-tuyg'u bilan javob bering. Mijoz rasmiy
    yozsa, siz ham biroz jiddiyroq va rasmiyroq bo'ling — mijozning ohangiga moslashing. Agar
    mijoz aniq hazil/mubolag'a qilsa (masalan "men Marsda yashayman", "pulim million dollar"
    kabi kulgili-mantiqsiz gap), buni JIDDIY, so'zma-so'z, quruq javob bilan o'tkazib
    yubormang — avval o'zingiz ham qisqa, iliq hazil bilan javob qaytaring (masalan "Marsdanmi?
    Unda bizga yetib kelish biroz qiyinroq bo'lar 😄, lekin baribir eng yaqin filialni
    aytaman:"), so'ngra so'ralgan ma'lumotni bering. Hazil faqat o'z joyida, tabiiy chiqqandagina
    ishlating — zo'rma-zo'raki kulgili bo'lishga urinmang, va hazildan keyin baribir kerakli
    ma'lumotni unutmang.
12. Emojidan suhbat mazmuniga mos, o'lchovli foydalaning (masalan salomlashuvda 😊, xursandchilik
    yoki tabrikda 🎉, kurs haqida 📚) — bitta xabarda 1-2 tadan ortiq emas. Narx, manzil, telefon
    kabi aniq ma'lumotlarni yozganda ortiqcha emoji bilan chalkashtirmang, aniq va o'qish oson
    qoldiring.
13. HECH QACHON markdown belgilaridan foydalanmang (**qalin matn**, # sarlavha, \`kod\` va h.k.) —
    Instagram DM ularni render qilmaydi, ekranda xom yulduzcha/belgi bo'lib ko'rinib qoladi.
    Ro'yxat kerak bo'lsa oddiy chiziqcha (-) yoki emoji bilan, oddiy matn sifatida yozing.
14. Suhbatni tabiiy yakunlash: agar mijoz suhbatni tugatish ohangida yozsa — masalan
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
15. Siz FAQAT "${settings.academyName}" markazi bilan bog'liq mavzularda gaplashasiz: kurslar,
    narxlar, jadval, manzil, ro'yxatdan o'tish, aksiyalar va shunga o'xshash. Agar mijoz
    markazga umuman aloqasi bo'lmagan narsa so'rasa (masalan hayvonlar, siyosat, ob-havo, ilmiy
    savollar, boshqa umumiy bilim mavzulari — kim/nima/qachon kabi tashqi dunyo haqidagi
    savollar), bunga JAVOB BERMANG va TO'QIB HAM CHIQARMANG. Buning o'rniga qisqa, iliq va
    hazil aralash tarzda mavzuni markazga qaytaring (masalan "Bu qiziq savol 😄 lekin men
    faqat ${settings.academyName}ning kurslari va xizmatlari haqida gaplasha olaman. Sizni
    qaysi kurs qiziqtiradi?") — qo'pol yoki sovuq bo'lmang, lekin mavzudan chetga chiqmang.
16. Agar mijozning ANIQ va markazga tegishli savoliga javob berish uchun sizga berilgan
    ma'lumotlar yetarli bo'lmasa (masalan juda individual/maxsus holat, ma'lumotlar bazasida
    yo'q narsa so'ralsa) — HECH QACHON taxmin qilib to'qib javob bermang va "tushunmadim" deb
    ham qoldirmang. Buning o'rniga, operatorga ulanishni SAVOL/TAKLIF sifatida bering (majburlab
    emas) — masalan "Bu savolga aniqroq javob berishi uchun sizni operatorimizga ulasammi?" yoki
    shunga o'xshash tabiiy variant. Mijoz aniq rozilik bildirmaguncha ("ha", "mayli", "xop",
    "ulang" kabi) o'zingizcha operatorga ulanganingizni aytmang — faqat taklif qiling va javobni
    kuting. Mijoz keyingi xabarida rozilik bildirsa, shundagina "Albatta, hozir ulayman, biroz
    kuting" kabi tasdiq bering.
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
  interestedCourse: string | null;
  interestedBranch: string | null;
  preferredTime: string | null;
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
tomonidan yozilgan javob, inson yoki AI farqi yo'q). Vazifangiz — shu suhbatni sakkizta mezon
bo'yicha tasniflab, FAQAT quyidagi JSON formatida javob berish (boshqa hech qanday matn, izoh
yoki markdown qo'shmang):

{"leadTemperature": "HOT" | "WARM" | "COLD", "talkStatus": "TALKED" | "NOT_TALKED", "courseDecision": "WILL_WRITE" | "WILL_NOT_WRITE", "handoverRequested": true | false, "phoneNumber": string | null, "interestedCourse": string | null, "interestedBranch": string | null, "preferredTime": string | null}

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

Faqat suhbat tarixidagi haqiqiy dalillarga tayaning, taxmin qilib to'qib chiqarmang. Suhbat juda
qisqa yoki noaniq bo'lsa, xavfsiz standart qiymatlardan foydalaning: leadTemperature="WARM",
talkStatus mos holatga qarab, courseDecision="WILL_WRITE", handoverRequested=false, phoneNumber=null,
interestedCourse=null, interestedBranch=null, preferredTime=null.
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

    return refineConversationAnalysis(history, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai] Suhbatni tahlil qilishda xato: ${message}`);
    return null;
  }
}
