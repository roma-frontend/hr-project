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
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  const changeLanguage = async (lng: string) => {
    console.log('🔄 LanguageSwitcher: Changing language from', i18n.language, 'to', lng);

    // Save to localStorage BEFORE changing language
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('i18nextLng', lng);
        console.log('💾 Saved to localStorage FIRST:', lng);

        // Verify it was saved
        const saved = localStorage.getItem('i18nextLng');
        console.log('✅ Verification - localStorage now has:', saved);
      } catch (error) {
        console.error('❌ Failed to save to localStorage:', error);
      }
    }

    // Then change the language
    await i18n.changeLanguage(lng);
    console.log('✅ Language changed to:', i18n.language);
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
            {languages[currentLang as keyof typeof languages]?.name || 'English'}
          </span>
          <span className="sm:hidden">
            {languages[currentLang as keyof typeof languages]?.flag || '🇬🇧'}
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
