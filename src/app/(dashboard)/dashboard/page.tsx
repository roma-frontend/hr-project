'use client';

import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/useAuthStore';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';
import {
  DashboardSkeleton,
  EmployeeDashboardSkeleton,
} from '@/components/dashboard/DashboardSkeleton';

const DashboardClient = dynamic(
  () =>
    import('@/components/dashboard/DashboardClient').then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic HOC wrapper
      default: (props: any) => (
        <WidgetErrorBoundary name="DashboardClient">
          <m.default {...props} />
        </WidgetErrorBoundary>
      ),
    })),
  { ssr: false, loading: () => <DashboardSkeleton /> },
);

const EmployeeDashboard = dynamic(
  () =>
    import('@/components/dashboard/EmployeeDashboard').then((m) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic HOC wrapper
      default: (props: any) => (
        <WidgetErrorBoundary name="EmployeeDashboard">
          <m.default {...props} />
        </WidgetErrorBoundary>
      ),
    })),
  { ssr: false, loading: () => <EmployeeDashboardSkeleton /> },
);

export default function DashboardPage() {
  const { user } = useAuthStore();

  if (user && !user.organizationId && user.role !== 'superadmin') {
    return null;
  }

  if (user?.role === 'employee') {
    return <EmployeeDashboard />;
  }

  return <DashboardClient />;
}
