'use client';

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const languages = {
  en: { name: 'English', flag: '🇬🇧' },
  hy: { name: 'Հայերեն', flag: '🇦🇲' },
  ru: { name: 'Русский', flag: '🇷🇺' },
};

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language || 'en';

  const changeLanguage = async (lng: string) => {
    // Save to both cookie and localStorage for server/client sync
    if (typeof window !== 'undefined') {
      document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=31536000; SameSite=Lax`;
      localStorage.setItem('i18nextLng', lng);
    }

    await i18n.changeLanguage(lng);
  };

  // Фильтруем языки, исключая текущий выбранный
  const availableLanguages = Object.entries(languages).filter(([code]) => code !== currentLang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {languages[currentLang as keyof typeof languages]?.flag}{' '}
            {languages[currentLang as keyof typeof languages]?.name || t('languages.english')}
          </span>
          <span className="sm:hidden">
            {languages[currentLang as keyof typeof languages]?.flag || t('languages.englishFlag')}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={5}>
        {availableLanguages.map(([code, { name, flag }]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => changeLanguage(code)}
            className="cursor-pointer transition-colors"
          >
            <span className="mr-2">{flag}</span>
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
