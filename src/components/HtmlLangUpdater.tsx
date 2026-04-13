'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Dynamically updates <html lang=""> when i18n language changes.
 * Fixes Lighthouse accessibility warning about static lang="en".
 */
export function HtmlLangUpdater() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const handleLangChange = () => {
      document.documentElement.lang = i18n.language || 'en';
    };

    // Set initial lang
    handleLangChange();

    // Listen for future changes
    i18n.on('languageChanged', handleLangChange);
    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, [i18n]);

  return null;
}
