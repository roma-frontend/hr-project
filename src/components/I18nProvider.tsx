'use client';

import { useEffect, useState } from 'react';
import { useTranslation, I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';

function getSavedLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  
  const getCookieValue = (name: string) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  };

  const savedLang = getCookieValue('NEXT_LOCALE') || localStorage.getItem('i18nextLng');
  if (savedLang && ['en', 'hy', 'ru'].includes(savedLang)) {
    return savedLang;
  }
  return null;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedLang = getSavedLanguage();
    const currentLang = i18nInstance.language;

    if (savedLang && savedLang !== currentLang) {
      i18nInstance.changeLanguage(savedLang);
    }
    setIsReady(true);
  }, [i18nInstance]);

  if (!isReady) {
    return <>{children}</>;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
