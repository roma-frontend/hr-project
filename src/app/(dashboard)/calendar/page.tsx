'use client';

import dynamic from 'next/dynamic';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { useTranslation } from 'react-i18next';

// CalendarClient pulls @fullcalendar which is ~300KB — lazy load it
const CalendarClient = dynamic(() => import('@/components/calendar/CalendarClient'), {
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      <div className="h-150 rounded-2xl bg-white/5" />
    </div>
  ),
});

export default function CalendarPage() {
  const { t } = useTranslation();
  
  return (
    <WidgetErrorBoundary name="CalendarPage" fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">{t('errors.failedToLoad', 'Failed to load calendar')}</h2>
        <p className="text-sm text-(--text-muted) max-w-sm">
          {t('errors.tryAgainLater', 'Please try again later. If the problem persists, contact support.')}
        </p>
      </div>
    }>
      <CalendarClient />
    </WidgetErrorBoundary>
  );
}
