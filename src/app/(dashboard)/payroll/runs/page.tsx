'use client';

import dynamic from 'next/dynamic';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

const PayrollRecordsTable = dynamic(
  () =>
    import('@/components/payroll/PayrollRecordsTable').then((m) => ({
      default: (props: any) => (
        <WidgetErrorBoundary name="PayrollRecordsTable">
          <m.default {...props} />
        </WidgetErrorBoundary>
      ),
    })),
  {
    ssr: false,
    loading: () => <RecordsSkeleton />,
  },
);

function RecordsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-(--card) rounded" />
      <div className="h-12 bg-(--card) rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-(--card) rounded" />
      ))}
    </div>
  );
}

export default function PayrollRunsPage() {
  return (
    <>
      <PayrollRecordsTable />
    </>
  );
}
