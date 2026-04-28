'use client';

import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import {
  useCookieConsent,
  type CookiePreferences as CookiePrefs,
} from '@/store/cookieConsentStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Cookie,
  Shield,
  BarChart3,
  Target,
  Palette,
  Info,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface CookieCategory {
  id: keyof CookiePrefs;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  required?: boolean;
  color: string;
}

const cookieCategories: (category: ReturnType<typeof useTranslation>['t']) => CookieCategory[] = (t) => [
  {
    id: 'necessary',
    name: t('cookies.essentialCookies'),
    description: t('cookies.essentialDesc'),
    icon: Shield,
    required: true,
    color: 'text-green-500',
  },
  {
    id: 'analytics',
    name: t('cookies.analyticsCookies'),
    description: t('cookies.analyticsDesc'),
    icon: BarChart3,
    color: 'text-blue-500',
  },
  {
    id: 'marketing',
    name: t('cookies.marketingCookies'),
    description: t('cookies.marketingDesc'),
    icon: Target,
    color: 'text-orange-500',
  },
  {
    id: 'preferences',
    name: t('cookies.preferenceCookies'),
    description: t('cookies.preferenceDesc'),
    icon: Palette,
    color: 'text-orange-500',
  },
];

export function CookiePreferences() {
  const { t } = useTranslation();
  const { hasConsent, preferences, savePreferences, resetConsent } = useCookieConsent();
  const [localPreferences, setLocalPreferences] = useState<CookiePrefs>(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  const categories = cookieCategories(t);

  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const changed = JSON.stringify(localPreferences) !== JSON.stringify(preferences);
    setHasChanges(changed);
  }, [localPreferences, preferences]);

  const handleToggle = (category: keyof CookiePrefs) => {
    if (category === 'necessary') return;
    setLocalPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleSave = () => {
    savePreferences(localPreferences);
    toast.success(t('toasts.cookiePreferencesSaved'));
    setHasChanges(false);
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePrefs = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    setLocalPreferences(allAccepted);
  };

  const handleRejectAll = () => {
    const onlyNecessary: CookiePrefs = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    setLocalPreferences(onlyNecessary);
  };

  const handleReset = () => {
    if (confirm(t('cookies.resetConfirm') || 'This will reset your cookie consent and show the banner again. Continue?')) {
      resetConsent();
      toast.info(t('toasts.cookieConsentReset'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 text-(--primary)" />
            <CardTitle className="text-base">{t('cookies.privacyAndCookies')}</CardTitle>
          </div>
          {hasConsent && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('cookies.consentGiven')}
            </div>
          )}
        </div>
        <CardDescription>{t('cookies.manageExperience')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Info Banner */}
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-(--primary)/15 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-xs">
            {t('cookies.respectPrivacy')}{' '}
            <Link
              href="/privacy"
              target="_blank"
              className="font-semibold underline hover:text-blue-700 dark:hover:text-blue-300"
              aria-label={t('cookies.privacyPolicyLabel', { defaultValue: 'Privacy Policy - learn how we collect, use and protect your personal data' })}
            >
              {t('cookies.privacyPolicy')}
            </Link>
            {t('cookies.and')}
            <Link
              href="/terms"
              target="_blank"
              className="font-semibold underline hover:text-blue-700 dark:hover:text-blue-300"
              aria-label={t('cookies.termsLabel', { defaultValue: 'Terms of Service - read the legal terms for using our platform' })}
            >
              {t('cookies.termsOfService')}
            </Link>
            .
          </div>
        </div>

        {/* Cookie Categories */}
        <div className="space-y-3">
          {categories.map((category) => {
            const Icon = category.icon;
            const isEnabled = localPreferences[category.id];

            return (
              <div
                key={category.id}
                className={`rounded-lg border transition-all ${
                  isEnabled
                    ? 'border-(--primary)/30 bg-(--primary)/5'
                    : 'border-(--border) bg-(--background-subtle)'
                }`}
              >
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        isEnabled
                          ? 'bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity'
                          : 'bg-(--background-subtle) border border-(--border)'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${isEnabled ? 'text-white' : 'text-(--text-muted)'}`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-(--text-primary)">
                          {category.name}
                        </h4>
                        {category.required && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {t('cookies.alwaysOn')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-(--text-muted)">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggle(category.id)}
                    disabled={category.required}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleAcceptAll} className="text-xs">
            {t('cookies.acceptAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRejectAll} className="text-xs">
            {t('cookies.rejectOptional')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-(--text-muted)"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {t('cookies.resetConsent')}
          </Button>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-2 border-t border-(--border)">
            <Button onClick={handleSave} className="w-full" size="sm">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {t('cookies.savePreferences')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
