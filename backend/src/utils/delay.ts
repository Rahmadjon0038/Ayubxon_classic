// Instagram DM/kommentariya xabarlarini "odam kabi" tabiiy tezlikda yuborish uchun tasodifiy
// kechikish yordamchilari. Bir xil oraliqda, doim bir xil tezlikda ketma-ket yuborilgan xabarlar
// Meta tomonidan avtomatlashtirilgan (bot) faoliyat sifatida belgilanib, akkauntga Action Block
// qo'yilishiga olib kelishi mumkin.
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

// DM: mijoz javobini sekinlashtirmaslik uchun qisqa. AI javobi uchun asosiy "odamga o'xshash"
// kutish webhookProcessor'dagi scheduleAiTurn'da (1.5-2.5 s), bu yerdagi esa ketma-ket
// yuborishlar orasidagi kichik tasodifiy oraliq. Spamdan haqiqiy himoya — rateLimiter'dagi
// soatlik/kunlik limitlar va rate-limit xatosida navbatni pauza qilish.
export const DM_DELAY_MIN_MS = 500;
export const DM_DELAY_MAX_MS = 1_500;
export const COMMENT_DELAY_MIN_MS = 8_000;
export const COMMENT_DELAY_MAX_MS = 20_000;

// Har bir DM yuborishdan oldin chaqiriladi.
export async function delayBeforeDm(): Promise<void> {
  await sleep(randomBetween(DM_DELAY_MIN_MS, DM_DELAY_MAX_MS));
}

// Har bir kommentariya javobidan oldin chaqiriladi.
export async function delayBeforeComment(): Promise<void> {
  await sleep(randomBetween(COMMENT_DELAY_MIN_MS, COMMENT_DELAY_MAX_MS));
}
