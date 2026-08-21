'use client';

import { LOCALES, Locale } from '@/lib/i18n';
import { useLocale } from './LocaleProvider';

const LOCALE_CODES: Record<Locale, string> = { uz: 'UZ', en: 'EN', ru: 'RU' };

interface Props {
  className?: string;
  buttonClassName?: string;
}

export default function LanguageSwitcher({ className = '', buttonClassName = '' }: Props) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-gray-300 bg-white p-1 dark:border-tg-hover dark:bg-tg-panelAlt ${className}`}
      role="group"
      aria-label={t('language.label')}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${buttonClassName} ${
            locale === l
              ? 'bg-brand-600 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-tg-textMuted dark:hover:bg-tg-hover'
          }`}
        >
          {LOCALE_CODES[l]}
        </button>
      ))}
    </div>
  );
}
