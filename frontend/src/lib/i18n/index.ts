import uz, { Translations } from './uz';
import en from './en';
import ru from './ru';

export type Locale = 'uz' | 'en' | 'ru';

export const LOCALES: Locale[] = ['uz', 'en', 'ru'];

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  en: 'English',
  ru: 'Русский',
};

const dictionaries: Record<Locale, Translations> = { uz, en, ru };

const LOCALE_KEY = 'locale';

export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(LOCALE_KEY);
  return value === 'uz' || value === 'en' || value === 'ru' ? value : null;
}

// Standart til — o'zbekcha (lotin). Bu funksiya React tashqarisida (masalan lib/format.ts,
// lib/api.ts kabi oddiy funksiyalarda) ham chaqirilishi mumkin.
export function getActiveLocale(): Locale {
  return getStoredLocale() ?? 'uz';
}

export function setStoredLocale(locale: Locale): void {
  window.localStorage.setItem(LOCALE_KEY, locale);
}

function resolve(dict: Translations, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

// Nuqta bilan ajratilgan kalit (masalan "leads.searchPlaceholder") bo'yicha tarjimani topadi.
// Topilmasa (masalan yangi kalit hali biror tilga qo'shilmagan bo'lsa), o'zbekcha (uz) ga
// qaytadi — shu orqali hech qachon xom kalit yoki bo'sh matn ko'rinmaydi.
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let value = resolve(dictionaries[locale], key);
  if (typeof value !== 'string') value = resolve(dictionaries.uz, key);
  if (typeof value !== 'string') return key;

  if (!vars) return value;
  return Object.entries(vars).reduce(
    (text, [name, val]) => text.replaceAll(`{{${name}}}`, String(val)),
    value,
  );
}

export function getMonthNames(locale: Locale): string[] {
  return dictionaries[locale].time.months;
}
