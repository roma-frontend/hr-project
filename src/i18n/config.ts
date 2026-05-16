import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Only common is bundled — all other namespaces load lazily via HttpBackend
import commonEn from './locales/en/common.json';

export const allNamespaces = [
  'common',
  'landing',
  'auth',
  'dashboard',
  'leaves',
  'tasks',
  'employees',
  'chat',
  'admin',
  'drivers',
  'settings',
  'modules',
  'payroll',
  'compensation',
  'learning',
  'expenses',
] as const;

export type AppNamespace = (typeof allNamespaces)[number];
export const defaultNS: AppNamespace = 'common';

// Only common EN is bundled (~28KB). All other namespaces load on-demand via HTTP.
export const resources = {
  en: {
    common: commonEn,
  },
} as const;

const getInitialLanguage = () => {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/i18nextLng=(en|hy|ru)/);
    if (match?.[1]) return match[1];
  }
  return 'en';
};

if (!i18n.isInitialized) {
  if (typeof window !== 'undefined') {
    i18n.use(HttpBackend);
    i18n.use(LanguageDetector);
  }

  i18n.use(initReactI18next).init({
    defaultNS,
    ns: [...allNamespaces],
    fallbackNS: [...allNamespaces],
    fallbackLng: 'en',
    lng: getInitialLanguage(),
    supportedLngs: ['en', 'hy', 'ru'],
    nonExplicitSupportedLngs: false,
    debug: false,
    interpolation: { escapeValue: false },
    resources,
    partialBundledLanguages: true,
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    detection: {
      order: ['cookie', 'localStorage', 'navigator'],
      lookupCookie: 'i18nextLng',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
    },
    react: { useSuspense: false },
  });
}

export default i18n;
