import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Import all EN namespaces (bundled for instant render, ~30KB each)
import commonEn from './locales/en/common.json';
import landingEn from './locales/en/landing.json';
import authEn from './locales/en/auth.json';
import dashboardEn from './locales/en/dashboard.json';
import leavesEn from './locales/en/leaves.json';
import tasksEn from './locales/en/tasks.json';
import employeesEn from './locales/en/employees.json';
import chatEn from './locales/en/chat.json';
import adminEn from './locales/en/admin.json';
import driversEn from './locales/en/drivers.json';
import settingsEn from './locales/en/settings.json';
import modulesEn from './locales/en/modules.json';

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
] as const;

export type AppNamespace = (typeof allNamespaces)[number];
export const defaultNS: AppNamespace = 'common';

// Only EN is bundled in JS (~333KB instead of ~1.3MB for all 3 languages)
// RU and HY load lazily via HTTP backend when user switches language
export const resources = {
  en: {
    common: commonEn,
    landing: landingEn,
    auth: authEn,
    dashboard: dashboardEn,
    leaves: leavesEn,
    tasks: tasksEn,
    employees: employeesEn,
    chat: chatEn,
    admin: adminEn,
    drivers: driversEn,
    settings: settingsEn,
    modules: modulesEn,
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
    ns: allNamespaces as unknown as string[],
    fallbackNS: allNamespaces as unknown as string[],
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
