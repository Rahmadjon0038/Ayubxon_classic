import crypto from 'crypto';
import { notifySpamProtectionPause } from '../bot/telegramNotifier';
import { AppError, InstagramApiError } from '../lib/errors';
import { delayBeforeComment, delayBeforeDm, sleep } from './delay';
import {
  HOUR_MS,
  getPauseReason,
  getPauseRemainingMs,
  getSendBlockReason,
  isPaused,
  pauseQueue,
  recordCommentSent,
  recordDmSent,
  registerRateLimitHit,
  resetRateLimitStrikes,
} from './rateLimiter';

type SendJobType = 'dm' | 'comment';

// 'high' — operator inboxdan qo'lda yuborgan xabar: sun'iy kechikishsiz ishlanadi (inson
// real vaqtda kutmoqda), lekin baribir 'normal' bilan BIR XIL pauza/limit tekshiruviga
// bo'ysunadi — faqat ularga duch kelganda kutib turish o'rniga darhol rad etiladi.
type JobPriority = 'normal' | 'high';

interface QueuedJob {
  id: string;
  type: SendJobType;
  priority: JobPriority;
  userId: string;
  label: string;
  attempt: number;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

interface EnqueueParams<T> {
  // Xabar kimga tegishli (IGSID yoki komment muallifi ID'si) — faqat logga yozish uchun.
  userId: string;
  // Nima uchun yuborilayotgani (masalan "AI javobi") — log uchun qisqa izoh.
  label: string;
  execute: () => Promise<T>;
}

// Bitta xabar rate-limit/action-block xatosiga ketma-ket necha marta uchrasa, undan voz kechiladi.
const MAX_SEND_ATTEMPTS = 3;

const queue: QueuedJob[] = [];
let processing = false;

export function isRateLimitError(err: unknown): boolean {
  if (err instanceof InstagramApiError) {
    if (err.statusCode === 429) return true;
    // Meta'ning rate-limit/action-block bilan bogʻliq keng tarqalgan xato kodlari:
    // 4 — umumiy soʻrov limiti, 17/613 — maxsus limit, 32 — sahifa limiti,
    // 368 — vaqtincha bloklangan (Action Block), 80007 — business throughput limiti.
    if (err.metaCode && [4, 17, 32, 368, 613, 80007].includes(err.metaCode)) return true;
    return /rate limit|action block|too many requests|temporarily blocked|limit reached|spam/i.test(err.message);
  }
  const message = err instanceof Error ? err.message : String(err);
  return /429|rate limit|action block/i.test(message);
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function enqueue<T>(type: SendJobType, params: EnqueueParams<T>, priority: JobPriority = 'normal'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      id: crypto.randomUUID(),
      type,
      priority,
      userId: params.userId,
      label: params.label,
      attempt: 0,
      execute: params.execute as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    if (!processing) {
      processing = true;
      void processQueue();
    }
  });
}

// AI/avtomatik tizim yozgan DM javobini navbatga qo'shadi (soatlik/kunlik DM limiti va DM
// kechikishi qo'llaniladi).
export function enqueueDm<T>(params: EnqueueParams<T>): Promise<T> {
  return enqueue('dm', params);
}

// Kommentariyaga (ommaviy javob yoki private reply) yuboriladigan xabarni navbatga qo'shadi
// (soatlik/kunlik kommentariya limiti va kommentariya kechikishi qo'llaniladi).
export function enqueueComment<T>(params: EnqueueParams<T>): Promise<T> {
  return enqueue('comment', params);
}

// Operator (admin) inboxdan qo'lda yuborgan DM. Navbat BOSHQALAR bilan bir xil pauza va
// soatlik/kunlik limitga bo'ysunadi (shu limitlarga QOʻSHILADI ham — recordDmSent barcha
// turdagi jobs uchun bir xil chaqiriladi), lekin delayBeforeDm() chaqirilmaydi — chunki
// bu yerda operator allaqachon real vaqtda javob kutmoqda va route qatlamida
// (checkOperatorRateLimit/checkSharedCapsOrThrow) oldindan tekshirilgan bo'ladi.
export function enqueueHighPriorityDm<T>(
  execute: () => Promise<T>,
  meta: { userId: string; label: string },
): Promise<T> {
  return enqueue('dm', { ...meta, execute }, 'high');
}

// Operator qo'lda yuborgan rasm/video/audio — Instagram tomonidan xuddi oddiy DM kabi (bir
// xil me/messages endpointi orqali) yuboriladi, shuning uchun 'dm' turi sifatida hisoblanadi
// (soatlik/kunlik DM limitiga qo'shiladi, alohida "attachment" limiti yo'q).
export function enqueueHighPriorityAttachment<T>(
  execute: () => Promise<T>,
  meta: { userId: string; label: string },
): Promise<T> {
  return enqueue('dm', { ...meta, execute }, 'high');
}

// Navbatni boshidan oxirigacha, BIR VAQTNING O'ZIDA FAQAT BITTA xabar yuborilishini ta'minlab
// (hech qachon Promise.all/parallel emas) qayta ishlaydi. Turli webhook so'rovlaridan bir vaqtda
// kelgan yuborish so'rovlari ham shu yagona navbat orqali ketma-ket tartiblanadi.
async function processQueue(): Promise<void> {
  while (queue.length > 0) {
    const job = queue[0];

    // 'high' (operator) so'rovlar pauza tugashini KUTMAYDI — bu yerga faqat route
    // qatlamidagi oldindan tekshiruv bilan yuborish o'rtasida holat o'zgargan (kamdan-kam,
    // masalan boshqa bir job aynan shu payt pauza qo'ygan) holatlarda yetib keladi, shuning
    // uchun darhol xato bilan rad etiladi — operator soatlab osilib qolmasligi kerak.
    if (isPaused()) {
      if (job.priority === 'high') {
        queue.shift();
        const remainingMinutes = Math.max(1, Math.ceil(getPauseRemainingMs() / 60_000));
        console.warn(
          `[messageQueue] [high-priority] Navbat pauzada (${getPauseReason() ?? '-'}), operator so'rovi rad etildi (user=${job.userId})`,
        );
        job.reject(
          new AppError(`Instagram vaqtincha chekladi, ${remainingMinutes} daqiqadan so'ng qayta urinib ko'ring`, 503),
        );
        continue;
      }
      const waitMs = getPauseRemainingMs();
      console.log(`[messageQueue] Navbat pauzada: ${getPauseReason() ?? '-'} (~${Math.ceil(waitMs / 1000)}s qoldi)`);
      await sleep(Math.min(waitMs, 60_000) + 500);
      continue;
    }

    const blockReason = await getSendBlockReason(job.type);
    if (blockReason) {
      if (job.priority === 'high') {
        queue.shift();
        const message =
          blockReason === 'hourly'
            ? "Soatlik xabar limiti tugadi, birozdan keyin qayta urinib ko'ring"
            : "Kunlik xabar limiti tugadi, ertaga qayta urinib ko'ring";
        console.warn(
          `[messageQueue] [high-priority] ${blockReason} limit, operator so'rovi rad etildi (user=${job.userId})`,
        );
        job.reject(new AppError(message, 429));
        continue;
      }
      const reason = blockReason === 'hourly' ? 'Hourly limit reached, pausing' : 'Daily limit reached, pausing';
      await pauseQueue(HOUR_MS, reason);
      continue;
    }

    if (job.priority === 'high') {
      console.log(`[messageQueue] [high-priority] Kechikishsiz yuborilmoqda (type=${job.type} user=${job.userId})`);
    } else if (job.type === 'dm') {
      await delayBeforeDm();
    } else {
      await delayBeforeComment();
    }

    queue.shift();

    try {
      const result = await job.execute();
      if (job.type === 'dm') await recordDmSent();
      else await recordCommentSent();
      await resetRateLimitStrikes();
      console.log(
        `[messageQueue]${job.priority === 'high' ? ' [high-priority]' : ''} Yuborildi: type=${job.type} user=${job.userId} label="${job.label}" vaqt=${new Date().toISOString()}`,
      );
      job.resolve(result);
    } catch (err) {
      if (isRateLimitError(err)) {
        job.attempt += 1;
        const description = describeError(err);
        console.error(
          `[messageQueue] Instagram rate limit/action block xatosi (type=${job.type} user=${job.userId} urinish=${job.attempt}/${MAX_SEND_ATTEMPTS}): ${description}`,
        );
        if (job.attempt < MAX_SEND_ATTEMPTS) {
          queue.unshift(job);
        } else {
          console.error(
            `[messageQueue] Xabar ${MAX_SEND_ATTEMPTS} marta urinishdan keyin tashlab yuborildi (type=${job.type} user=${job.userId})`,
          );
          job.reject(err);
        }
        const backoffMs = await registerRateLimitHit();
        await pauseQueue(backoffMs, 'Instagram rate limit / action block aniqlandi');
        notifySpamProtectionPause('Instagram rate limit / action block aniqlandi', Math.round(backoffMs / 60_000)).catch(
          () => {},
        );
      } else {
        console.error(
          `[messageQueue] Yuborishda xato (type=${job.type} user=${job.userId} label="${job.label}"): ${describeError(err)}`,
        );
        job.reject(err);
      }
    }
  }
  processing = false;
}
