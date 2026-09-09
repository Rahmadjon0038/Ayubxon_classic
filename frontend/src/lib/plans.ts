export type PlanName = 'Basic' | 'Standart' | 'Pro';

// Tarif -> narx (so'mda). Hozircha qo'lda belgilangan — Click/Payme ulanganda bu
// narxlar API orqali dinamik keladi, struktura o'zgarmaydi.
export const PLAN_PRICES: Record<PlanName, number> = {
  Basic: 150_000,
  Standart: 300_000,
  Pro: 500_000,
};

export function planLabelKey(plan: PlanName): string {
  if (plan === 'Basic') return 'superAdmin.planBasic';
  if (plan === 'Standart') return 'superAdmin.planStandart';
  return 'superAdmin.planPro';
}

export function formatSum(amount: number): string {
  return `${amount.toLocaleString('uz-UZ')} so'm`;
}

// Kompaniya nomidan avatar uchun 1-2 harfli bosh harflar (masalan "Anor Market" -> "AM").
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
];

// id'dan barqaror (har doim bir xil) rang tanlaydi — sahifa qayta yuklanganda
// kabinetning avatar rangi o'zgarib turmasligi uchun.
export function avatarColorClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
