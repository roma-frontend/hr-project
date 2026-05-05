/**
 * Locale-aware date/time formatting utilities
 * Maps i18n language codes to proper locale strings for Intl APIs
 */

export type SupportedLocale = 'en' | 'ru' | 'hy';

const LOCALE_MAP: Record<SupportedLocale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  hy: 'hy-AM',
};

/**
 * Convert i18n language code to Intl locale string
 */
export function getLocaleString(lang: SupportedLocale | string | undefined): string {
  if (!lang) return LOCALE_MAP.en;
  return LOCALE_MAP[lang as SupportedLocale] ?? LOCALE_MAP.en;
}

/**
 * Format a date using the current locale
 */
export function formatDate(
  date: Date | number | string,
  lang: SupportedLocale | string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale = getLocaleString(lang);
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString(locale, options);
}

/**
 * Format a date and time using the current locale
 */
export function formatDateTime(
  date: Date | number | string,
  lang: SupportedLocale | string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale = getLocaleString(lang);
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString(locale, options);
}

/**
 * Format a time using the current locale
 */
export function formatTime(
  date: Date | number | string,
  lang: SupportedLocale | string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale = getLocaleString(lang);
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString(locale, options);
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | number | string,
  lang: SupportedLocale | string | undefined,
): string {
  const locale = getLocaleString(lang);
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  return rtf.format(diffDay, 'day');
}

/**
 * Get weekday names in the current locale
 */
export function getWeekdayNames(
  lang: SupportedLocale | string | undefined,
  format: 'short' | 'long' | 'narrow' = 'short',
): string[] {
  const locale = getLocaleString(lang);
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  // Jan 1, 2024 is a Monday, so we can get all weekdays
  const baseDate = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    return formatter.format(d);
  });
}

/**
 * Get month names in the current locale
 */
export function getMonthNames(
  lang: SupportedLocale | string | undefined,
  format: 'short' | 'long' | 'narrow' = 'long',
): string[] {
  const locale = getLocaleString(lang);
  const formatter = new Intl.DateTimeFormat(locale, { month: format });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2024, i, 1);
    return formatter.format(d);
  });
}
