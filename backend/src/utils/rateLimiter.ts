import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

// Instagram soatlik/kunlik yuborish limitlarini kuzatib boradigan hisoblagich. Holat
// Postgres'da (RateLimitCounter, bitta "singleton" qator) saqlanadi — shunda backend qayta
// ishga tushganda (deploy, crash, PM2 restart) hisoblagichlar 0'ga tushib qolmaydi va
// kunlik/soatlik chegara process qayta tushishlar orasida ham haqiqiy ceiling bo'lib qoladi.
// Xotiradagi o'zgaruvchilar tez (sinxron) o'qish uchun kesh sifatida ishlatiladi; har bir
// yozuvda DB'ga ham darhol (await bilan) yoziladi, shunda ikkalasi hech qachon uzoq muddat
// bir-biridan farq qilib qolmaydi.
export const HOURLY_DM_LIMIT = 45;
export const HOURLY_COMMENT_LIMIT = 40;
export const DAILY_DM_LIMIT = 600;
export const DAILY_COMMENT_LIMIT = 500;

export const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// 429/action-block xatosi ketma-ket necha marta uchraganiga qarab kutish vaqti ortib boradi:
// 1-marta 15 daqiqa, 2-marta 30 daqiqa, 3+ marta 60 daqiqa.
const BACKOFF_STAGES_MS = [15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

const SINGLETON_ID = 'singleton';

let messagesThisHour = 0;
let commentsThisHour = 0;
let messagesToday = 0;
let commentsToday = 0;
let hourResetAt = Date.now() + HOUR_MS;
let dayResetAt = Date.now() + DAY_MS;
let rateLimitStrikes = 0;
let pausedUntil: number | null = null;
let pauseReason: string | null = null;

// Operator (admin) inboxdan qo'lda yuboradigan xabarlar uchun alohida, qisqa muddatli
// tezlik chegarasi — Instagram bilan bog'liq emas, faqat UI orqali juda tez-tez bosilishining
// (ataylab yoki tasodifiy skript/bug orqali) oldini olish uchun. Barcha adminlar sherigan
// bitta umumiy hisoblagich (singleton qatorning bir qismi).
const OPERATOR_MINUTE_LIMIT = 10;
const MINUTE_MS = 60 * 1000;

let operatorMessagesThisMinute = 0;
let operatorMinuteResetAt: number | null = null;

let loaded = false;

// Backend ishga tushganda BIR MARTA (index.ts'dan, serverni tinglashni boshlashdan oldin)
// chaqiriladi — DB'dagi saqlangan holatni xotiraga yuklaydi. Qator hali mavjud bo'lmasa
// (birinchi ishga tushish), yangisini yaratadi.
export async function loadRateLimiterState(): Promise<void> {
  const now = Date.now();
  const row = await prisma.rateLimitCounter.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: {
      id: SINGLETON_ID,
      hourResetAt: new Date(now + HOUR_MS),
      dayResetAt: new Date(now + DAY_MS),
    },
  });

  messagesThisHour = row.messagesThisHour;
  commentsThisHour = row.commentsThisHour;
  messagesToday = row.messagesToday;
  commentsToday = row.commentsToday;
  hourResetAt = row.hourResetAt.getTime();
  dayResetAt = row.dayResetAt.getTime();
  rateLimitStrikes = row.rateLimitStrikes;
  pausedUntil = row.pausedUntil ? row.pausedUntil.getTime() : null;
  pauseReason = row.pauseReason;
  operatorMessagesThisMinute = row.operatorMessagesThisMinute;
  operatorMinuteResetAt = row.operatorMinuteResetAt ? row.operatorMinuteResetAt.getTime() : null;
  loaded = true;

  console.log(
    `[rateLimiter] Holat DB'dan tiklandi: DM ${messagesThisHour}/${HOURLY_DM_LIMIT} soatlik, ${messagesToday}/${DAILY_DM_LIMIT} kunlik; ` +
      `komment ${commentsThisHour}/${HOURLY_COMMENT_LIMIT} soatlik, ${commentsToday}/${DAILY_COMMENT_LIMIT} kunlik` +
      (pausedUntil ? `; navbat hali pauzada (${pauseReason ?? '-'})` : ''),
  );

  await applyDueResets();
}

function assertLoaded(): void {
  if (!loaded) {
    throw new Error('[rateLimiter] loadRateLimiterState() hali chaqirilmagan — index.ts ni tekshiring');
  }
}

// Soat/kun chegarasi o'tib ketgan bo'lsa hisoblagichlarni 0'ga qaytaradi va keyingi chegarani
// oldinga suradi. setInterval o'rniga "har murojaatda tekshirish" usuli ishlatiladi — chunki
// setInterval process qayta tushganda yo'qolib qoladi, DB'dagi timestamp esa yo'qolmaydi, shu
// bilan reset process qanday va qachon qayta tushishidan qat'i nazar to'g'ri joyda bo'ladi.
async function applyDueResets(): Promise<void> {
  const now = Date.now();
  const data: Record<string, number | Date> = {};

  if (now >= hourResetAt) {
    messagesThisHour = 0;
    commentsThisHour = 0;
    hourResetAt = now + HOUR_MS;
    data.messagesThisHour = 0;
    data.commentsThisHour = 0;
    data.hourResetAt = new Date(hourResetAt);
    console.log("[rateLimiter] Soatlik hisoblagichlar tozalandi");
  }

  if (now >= dayResetAt) {
    messagesToday = 0;
    commentsToday = 0;
    dayResetAt = now + DAY_MS;
    data.messagesToday = 0;
    data.commentsToday = 0;
    data.dayResetAt = new Date(dayResetAt);
    console.log("[rateLimiter] Kunlik hisoblagichlar tozalandi");
  }

  if (Object.keys(data).length > 0) {
    await persist(data);
  }
}

async function persist(data: Record<string, unknown>): Promise<void> {
  try {
    await prisma.rateLimitCounter.update({ where: { id: SINGLETON_ID }, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[rateLimiter] DB'ga yozib bo'lmadi (xotiradagi holat bilan davom etilmoqda): ${message}`);
  }
}

export async function recordDmSent(): Promise<void> {
  assertLoaded();
  await applyDueResets();
  messagesThisHour += 1;
  messagesToday += 1;
  await persist({ messagesThisHour, messagesToday });
}

export async function recordCommentSent(): Promise<void> {
  assertLoaded();
  await applyDueResets();
  commentsThisHour += 1;
  commentsToday += 1;
  await persist({ commentsThisHour, commentsToday });
}

// Yuborishga toʻsiq bormi (limitga yetganmi) va bo'lsa qaysi turi (soatlik/kunlik) — navbat
// shunga qarab toʻgʻri sababli xabar bilan pauza qilinishi uchun.
export async function getSendBlockReason(type: 'dm' | 'comment'): Promise<'hourly' | 'daily' | null> {
  assertLoaded();
  await applyDueResets();
  if (type === 'dm') {
    if (messagesToday >= DAILY_DM_LIMIT) return 'daily';
    if (messagesThisHour >= HOURLY_DM_LIMIT) return 'hourly';
    return null;
  }
  if (commentsToday >= DAILY_COMMENT_LIMIT) return 'daily';
  if (commentsThisHour >= HOURLY_COMMENT_LIMIT) return 'hourly';
  return null;
}

// pausedUntil/pauseReason har bir yozuvda DB bilan birga yangilanadi, shuning uchun bu
// o'qishlar xotiradagi keshdan sinxron amalga oshirilaveradi — DB'ga qayta murojaat shart emas.
export function isPaused(): boolean {
  return pausedUntil !== null && Date.now() < pausedUntil;
}

export function getPauseRemainingMs(): number {
  if (!pausedUntil) return 0;
  return Math.max(0, pausedUntil - Date.now());
}

export function getPauseReason(): string | null {
  return pauseReason;
}

// Navbatni berilgan davrga toʻxtatadi. Agar allaqachon uzoqroq pauza kutilayotgan bo'lsa
// (masalan avval 60 daqiqalik backoff qo'yilgan bo'lsa), uni qisqartirib qo'ymaydi.
export async function pauseQueue(durationMs: number, reason: string): Promise<void> {
  const resumeAt = Date.now() + durationMs;
  if (pausedUntil && pausedUntil > resumeAt) return;
  pausedUntil = resumeAt;
  pauseReason = reason;
  console.warn(
    `[rateLimiter] ${reason} — navbat ${Math.round(durationMs / 60_000)} daqiqaga toʻxtatildi (${new Date(resumeAt).toISOString()} gacha)`,
  );
  await persist({ pausedUntil: new Date(resumeAt), pauseReason: reason });
}

// Muvaffaqiyatli yuborishdan keyin chaqiriladi — ketma-ket xatolar hisobini nolga qaytaradi,
// shunda keyingi (bog'liq bo'lmagan) xato yana eng qisqa (15 daqiqalik) bosqichdan boshlanadi.
export async function resetRateLimitStrikes(): Promise<void> {
  rateLimitStrikes = 0;
  await persist({ rateLimitStrikes: 0 });
}

// Har chaqirilganda navbatdagi backoff davomiyligini qaytaradi va bosqichni bittaga oshiradi.
export async function registerRateLimitHit(): Promise<number> {
  const stageIndex = Math.min(rateLimitStrikes, BACKOFF_STAGES_MS.length - 1);
  rateLimitStrikes += 1;
  await persist({ rateLimitStrikes });
  return BACKOFF_STAGES_MS[stageIndex];
}

// Operator inboxdan qo'lda xabar yuborganda ("real" navbatga qo'yishdan OLDIN) chaqiriladi.
// Bu — "yuborildimi" emas, "so'rov keldimi" hisoblagichi: shu sababli tekshiruv bilan bir
// vaqtning o'zida oshiriladi, haqiqiy Instagram yuborilishi (va uning muvaffaqiyati) bilan
// bog'liq emas. Belgilangan 60 soniyalik oynada 10 tadan ortiq so'rov kelsa, keyingisi
// darhol (navbatga qo'yilmasdan) rad etiladi.
export async function checkOperatorRateLimit(): Promise<void> {
  assertLoaded();
  const now = Date.now();
  if (!operatorMinuteResetAt || now >= operatorMinuteResetAt) {
    operatorMessagesThisMinute = 0;
    operatorMinuteResetAt = now + MINUTE_MS;
  }
  if (operatorMessagesThisMinute >= OPERATOR_MINUTE_LIMIT) {
    throw new AppError("Operator juda tez yozmoqda, 1 daqiqadan so'ng urinib ko'ring", 429);
  }
  operatorMessagesThisMinute += 1;
  await persist({
    operatorMessagesThisMinute,
    operatorMinuteResetAt: new Date(operatorMinuteResetAt),
  });
}

// Qo'lda yuboriladigan xabar ham AVTOMATIK xabarlar bilan BIR XIL umumiy soatlik/kunlik
// chegara va 429/action-block sabab qo'yilgan pauzaga bo'ysunishi shart — aks holda operator
// ikkalasini ham chetlab o'tib, akkauntni Action Block xavfiga qoldiradi. checkOperatorRateLimit
// bilan bir xil operatorga xos EMAS — bu umumiy, avtomatik va qo'lda yuborishlar SHERIGAN
// hisoblagichni tekshiradi.
export async function checkSharedCapsOrThrow(type: 'dm' | 'comment'): Promise<void> {
  assertLoaded();
  if (isPaused()) {
    const remainingMinutes = Math.max(1, Math.ceil(getPauseRemainingMs() / 60_000));
    throw new AppError(`Instagram vaqtincha chekladi, ${remainingMinutes} daqiqadan so'ng qayta urinib ko'ring`, 429);
  }
  const blockReason = await getSendBlockReason(type);
  if (blockReason === 'hourly') {
    throw new AppError("Soatlik xabar limiti tugadi, birozdan keyin qayta urinib ko'ring", 429);
  }
  if (blockReason === 'daily') {
    throw new AppError("Kunlik xabar limiti tugadi, ertaga qayta urinib ko'ring", 429);
  }
}

// Route qatlamida javobga "retryAfter" qo'shish uchun — operator limitiga qachon urinish
// mumkinligini soniyaga aylantirish uchun ishlatiladi.
export function getOperatorLimitRemainingMs(): number {
  if (!operatorMinuteResetAt) return 0;
  return Math.max(0, operatorMinuteResetAt - Date.now());
}

// Route qatlamida "retryAfter" hisoblash uchun — soatlik/kunlik chegara qachon
// tozalanishini soniyaga aylantirish uchun ishlatiladi.
export function getLimitResetRemainingMs(kind: 'hourly' | 'daily'): number {
  const resetAt = kind === 'hourly' ? hourResetAt : dayResetAt;
  return Math.max(0, resetAt - Date.now());
}
