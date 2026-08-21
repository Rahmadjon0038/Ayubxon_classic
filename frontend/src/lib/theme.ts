const THEME_KEY = 'theme';

export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

// Saqlangan sozlama bo'lmasa, standart holat qorong'i tema (platformaning asosiy ko'rinishi).
export function getActiveTheme(): Theme {
  return getStoredTheme() ?? 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(THEME_KEY, theme);
}

// <head> ichiga inline script sifatida yuboriladi — React hydratsiya qilishidan oldin
// <html> ga "dark" klassini qo'yib, sahifa ochilganda yorug' rejim birlashib (FOUC) ko'rinib
// qolishining oldini oladi.
export const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var isDark = stored ? stored === 'dark' : true;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();
