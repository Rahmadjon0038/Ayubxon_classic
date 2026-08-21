import { getActiveLocale, getMonthNames, translate } from './i18n';

const LOCALE_TAGS: Record<string, string> = { uz: 'uz-UZ', en: 'en-US', ru: 'ru-RU' };

export function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const locale = getActiveLocale();
  const tag = LOCALE_TAGS[locale];

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return translate(locale, 'time.yesterday');

  return date.toLocaleDateString(tag, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const tag = LOCALE_TAGS[getActiveLocale()];
  return date.toLocaleString(tag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLocalizedDate(date: Date, includeYear = false): string {
  const locale = getActiveLocale();
  const day = String(date.getDate()).padStart(2, '0');
  const month = getMonthNames(locale)[date.getMonth()];
  return includeYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

// Chatdagi "06 August" korinishidagi kun ajratuvchisi uchun (Telegram'dagi kabi).
export function formatDaySeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const locale = getActiveLocale();

  if (date.toDateString() === now.toDateString()) return translate(locale, 'time.today');

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return translate(locale, 'time.yesterday');

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  return formatLocalizedDate(date, !isCurrentYear);
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const locale = getActiveLocale();
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < 0) {
    return formatTime(dateString);
  }

  if (diffMs < minute) return translate(locale, 'time.justNow');
  if (diffMs < hour) return translate(locale, 'time.minutesAgo', { n: Math.floor(diffMs / minute) });
  if (diffMs < day) return translate(locale, 'time.hoursAgo', { n: Math.floor(diffMs / hour) });
  if (diffMs < 7 * day) return translate(locale, 'time.daysAgo', { n: Math.floor(diffMs / day) });

  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  return formatLocalizedDate(date, !isCurrentYear);
}

export function contactDisplayName(contact: {
  name: string | null;
  username: string | null;
  instagramScopedId: string;
}): string {
  if (contact.name) return contact.name;
  if (contact.username) return contact.username;
  return translate(getActiveLocale(), 'contact.fallbackName', { id: contact.instagramScopedId.slice(-6) });
}
