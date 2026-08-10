'use client';

import { LOCALES, Locale } from '@/lib/i18n';
import { useLocale } from './LocaleProvider';

const LOCALE_CODES: Record<Locale, string> = { uz: 'UZ', en: 'EN', ru: 'RU' };

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-gray-300 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800"
      role="group"
      aria-label={t('language.label')}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-1.5 py-1 text-[10px] font-semibold transition ${
            locale === l
              ? 'bg-brand-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {LOCALE_CODES[l]}
        </button>
      ))}
    </div>
  );
}
