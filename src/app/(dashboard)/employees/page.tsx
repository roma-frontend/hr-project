'use client';

import dynamic from 'next/dynamic';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import { useTranslation } from 'react-i18next';

function EmployeesSkeleton() {
  return (
    <div className="p-3 sm:p-4 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-40 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

// EmployeesClient pulls face-api.js + large modal components — lazy load
const EmployeesClient = dynamic(() => import('@/components/employees/EmployeesClient'), {
  ssr: false,
  loading: () => <EmployeesSkeleton />,
});

export default function EmployeesPage() {
  const { t } = useTranslation();
  
  return (
    <WidgetErrorBoundary name="EmployeesPage" fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">{t('errors.failedToLoad', 'Failed to load employees')}</h2>
        <p className="text-sm text-(--text-muted) max-w-sm">
          {t('errors.tryAgainLater', 'Please try again later. If the problem persists, contact support.')}
        </p>
      </div>
    }>
      <EmployeesClient />
    </WidgetErrorBoundary>
  );
}
