'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

// Inline SVG icons to avoid lucide-react on SSR
function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

export default function HeroCTA() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  if (user) {
    return (
      <div className="hero-fade-2 flex flex-col sm:flex-row items-center gap-4 mb-16">
        <Button
          onClick={() => router.push('/dashboard')}
          variant="cta"
          size="2xl"
          className="gap-3"
          aria-label={t('landing.goToDashboard')}
        >
          <ActivityIcon />
          {t('landing.goToDashboard')}
          <ArrowRightIcon />
        </Button>
        <Button
          onClick={() => router.push('/analytics')}
          variant="ctaSecondary"
          size="2xl"
          className="gap-3"
          aria-label={t('landing.viewAnalytics')}
        >
          <BarChartIcon />
          {t('landing.viewAnalytics')}
        </Button>
      </div>
    );
  }

  return (
    <div className="hero-fade-2 flex flex-col sm:flex-row items-center gap-4 mb-16">
      <Link href="/register">
        <Button variant="cta" size="2xl" className="gap-3" aria-label={t('landing.getStartedFree')}>
          <ZapIcon />
          {t('landing.getStartedFree')}
          <ArrowRightIcon />
        </Button>
      </Link>
      <Link href="/login">
        <Button
          variant="ctaSecondary"
          size="2xl"
          className="gap-3"
          aria-label={t('landing.signIn')}
        >
          {t('landing.signIn')}
          <ArrowRightIcon />
        </Button>
      </Link>
    </div>
  );
}
