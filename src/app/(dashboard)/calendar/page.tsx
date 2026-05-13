import nextDynamic from 'next/dynamic';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

const CalendarClient = nextDynamic(() => import('@/components/calendar/CalendarClient'), {
  loading: () => (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      <div className="h-150 rounded-2xl bg-white/5" />
    </div>
  ),
});

export default function CalendarPage() {
  return (
    <WidgetErrorBoundary name="CalendarPage">
      <CalendarClient />
    </WidgetErrorBoundary>
  );
}
