'use client';

import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useTranslation } from 'react-i18next';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

const TasksClient = dynamic(() => import('@/components/tasks/TasksClient'), {
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-white/5" />
      ))}
    </div>
  ),
});

export default function TasksPage() {
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation();

  // Show loader while user is loading
  if (!isAuthenticated || !user?.id || !user?.role) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  return (
    <WidgetErrorBoundary name="TasksPage">
      <div className="space-y-6">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
          <div>
            <h1 className="text-2xl font-bold text-(--text-primary)">{t('nav.tasks')}</h1>
            <p className="text-sm text-(--text-muted) mt-1">{t('tasksPage.subtitle')}</p>
          </div>
        </div>
        <TasksClient userId={user.id} userRole={user.role} />
      </div>
    </WidgetErrorBoundary>
  );
}
