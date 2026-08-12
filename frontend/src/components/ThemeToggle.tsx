'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLocale } from './LocaleProvider';
import { applyTheme, getActiveTheme, Theme } from '@/lib/theme';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const { t } = useLocale();
  // Boshlang'ich holat serverda noma'lum (localStorage yo'q), shuning uchun mount'dan keyin
  // aniqlanadi — bu bir lahzalik noto'g'ri ikonka ko'rinishining oldini oladi (hydration mismatch).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getActiveTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={theme === null}
      title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm transition hover:border-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-0 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
