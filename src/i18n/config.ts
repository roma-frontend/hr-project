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

i18n
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: 'en',
    supportedLngs: ['en', 'hy', 'ru'],
    nonExplicitSupportedLngs: false,
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false,
    },

    // Client-side language detection
    detection: {
      order: ['cookie', 'localStorage', 'navigator', 'htmlTag'],
      lookupCookie: 'NEXT_LOCALE',
      lookupLocalStorage: 'i18nextLng',
      caches: ['cookie', 'localStorage'],
      cookieMinutes: 525600, // 1 year
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
      },
    },

    // SSR support
    react: {
      useSuspense: false,
    },
  });

// Listen to language changes and persist to localStorage and cookie
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('i18nextLng', lng);
    document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = lng;
  }
});

export default i18n;
