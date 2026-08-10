'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getActiveLocale, Locale, setStoredLocale, translate } from '@/lib/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Server va birinchi render'da localStorage yo'q, shuning uchun standart 'uz' bilan
  // boshlanadi, keyin mount'da haqiqiy saqlangan til bilan yangilanadi.
  const [locale, setLocaleState] = useState<Locale>('uz');

  useEffect(() => {
    setLocaleState(getActiveLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale LocaleProvider ichida ishlatilishi kerak');
  return ctx;
}
