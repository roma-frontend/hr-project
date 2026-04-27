import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import hyTranslations from './locales/hy.json';
import ruTranslations from './locales/ru.json';

export const defaultNS = 'translation';

export const resources = {
  en: {
    translation: enTranslations,
  },
  hy: {
    translation: hyTranslations,
  },
  ru: {
    translation: ruTranslations,
  },
} as const;

// Only use LanguageDetector on client side
if (typeof window !== 'undefined') {
  i18n.use(LanguageDetector);
}

// Get language from cookie (SSR-compatible) or fallback to 'en'
const getInitialLanguage = () => {
  // Check for cookie first (works on both server and client)
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/i18nextLng=(en|hy|ru)/);
    if (match && match[1] && ['en', 'hy', 'ru'].includes(match[1])) {
      return match[1];
    }
  }
  return 'en';
};

i18n
  .use(initReactI18next) // Pass i18n to react-i18next
  .init({
    resources,
    defaultNS,
    fallbackLng: 'en',
    lng: getInitialLanguage(), // Use saved language or default to 'en'
    supportedLngs: ['en', 'hy', 'ru'], // Explicitly define supported languages
    nonExplicitSupportedLngs: false, // Only use exact matches
    debug: process.env.NODE_ENV === 'development', // Enable debug mode only in development

    interpolation: {
      escapeValue: false, // React already escapes
    },

    // Client-side language detection
    detection: {
      order: ['cookie', 'localStorage', 'navigator', 'htmlTag'],
      lookupCookie: 'i18nextLng',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
      // Custom detection function
      lookupQuerystring: 'lng',
    },

    // SSR support
    react: {
      useSuspense: false, // Disable Suspense for SSR compatibility
    },
  });

export default i18n;
