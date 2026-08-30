// Bir xil shablon matnini ketma-ket ikki marta yubormaslik uchun umumiy yordamchi — Instagram
// bir xil matnni takroran (turli foydalanuvchilarga yuborilgan bo'lsa ham) ko'rganda buni
// avtomatlashtirilgan spam faoliyati sifatida belgilashi mumkin.
export function pickVariant<T>(pool: readonly T[], lastUsed: T | null): T {
  if (pool.length === 0) throw new Error('pickVariant: variantlar royxati bosh bolishi mumkin emas');
  if (pool.length === 1) return pool[0];
  const candidates = lastUsed === null ? pool : pool.filter((item) => item !== lastUsed);
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}
