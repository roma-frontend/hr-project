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

// Get language from localStorage if available
const getInitialLanguage = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('i18nextLng');
    if (saved && ['en', 'hy', 'ru'].includes(saved)) {
      console.log('🔄 config.ts: Loading saved language:', saved);
      return saved;
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
    debug: true, // Enable debug mode

    interpolation: {
      escapeValue: false, // React already escapes
    },

    // Client-side language detection
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
      // Custom detection function
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupSessionStorage: 'i18nextLng',
    },

    // SSR support
    react: {
      useSuspense: false, // Disable Suspense for SSR compatibility
    },
  });

// Listen to language changes and persist to localStorage
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    console.log('🔄 i18n languageChanged event:', lng);
    localStorage.setItem('i18nextLng', lng);
    console.log('💾 Persisted to localStorage:', lng);

    // Also update HTML lang attribute
    document.documentElement.lang = lng;
  }
});

// Log for debugging
if (typeof window !== 'undefined') {
  console.log('🌍 i18n initialized:', {
    language: i18n.language,
    languages: Object.keys(resources),
    keysCount: Object.keys(enTranslations).length,
    savedLanguage: localStorage.getItem('i18nextLng')
  });
}

export default i18n;
