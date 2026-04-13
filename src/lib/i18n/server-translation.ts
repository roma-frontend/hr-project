// Server-side translation helper for Server Components
import { resources } from '@/i18n/config';

type Namespace = string;
type TranslationKey = string;

interface ServerTranslation {
  t: (key: TranslationKey) => string;
  locale: string;
}

/**
 * Get translation function for Server Components
 * This avoids loading i18next on the server, directly reading from JSON files
 */
export async function getServerTranslation(
  namespace: Namespace = 'translation',
  locale: string = 'en'
): Promise<ServerTranslation> {
  // Validate locale
  const validLocale = ['en', 'hy', 'ru'].includes(locale) ? locale : 'en';

  // Get translations from resources
  const resource = resources[validLocale as keyof typeof resources];
  // Try direct namespace access first (e.g., resource?.landing), then fallback to translation namespace
  const translations = resource?.[namespace as keyof typeof resource] 
    || resource?.translation 
    || (resource as any)?.[namespace]
    || {};

  // Translation function
  function t(key: TranslationKey): string {
    // Handle nested keys like 'landing.heroTitle'
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Key not found, return the key itself
      }
    }
    return typeof value === 'string' ? value : key;
  }

  return { t, locale: validLocale };
}
