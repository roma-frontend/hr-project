// Server-side translation helper for Server Actions
// This provides synchronous translation without React hooks
import { cookies } from 'next/headers';
import enTranslations from '@/i18n/locales/en.json';
import hyTranslations from '@/i18n/locales/hy.json';
import ruTranslations from '@/i18n/locales/ru.json';

const translations: Record<string, any> = {
  en: enTranslations,
  hy: hyTranslations,
  ru: ruTranslations,
};

type Locale = 'en' | 'hy' | 'ru';

/**
 * Get the current locale from the NEXT_LOCALE cookie.
 * Falls back to 'en' if no cookie is set.
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get('NEXT_LOCALE')?.value;
    if (locale && ['en', 'hy', 'ru'].includes(locale)) {
      return locale as Locale;
    }
  } catch {
    // cookies() may throw outside of a request context
  }
  return 'en';
}

/**
 * Translate a key on the server side.
 * @param key - Dot-notation key like 'actions.auth.emailExists'
 * @param fallback - English fallback string if translation is missing
 * @param locale - Optional locale override (defaults to 'en')
 */
export function serverT(key: string, fallback: string, locale?: Locale): string {
  const lang = locale || 'en';
  const keys = key.split('.');
  
  // Try the requested locale first
  let value: any = translations[lang];
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      value = null;
      break;
    }
  }
  
  // If not found, try English as fallback
  if (!value || typeof value !== 'string') {
    value = translations['en'];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = null;
        break;
      }
    }
  }
  
  // Return the translated value or the provided fallback
  return typeof value === 'string' ? value : fallback;
}
