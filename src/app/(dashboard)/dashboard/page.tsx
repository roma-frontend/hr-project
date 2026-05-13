import nextDynamic from 'next/dynamic';
import { getServerUser } from '@/lib/server-auth';
import { redirect } from 'next/navigation';
import { WidgetErrorBoundary } from '@/components/error/WidgetErrorBoundary';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-3 sm:p-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="h-64 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

const DashboardClient = nextDynamic(
  () =>
    import('@/components/dashboard/DashboardClient').then((m) => ({
      default: (props: any) => (
        <WidgetErrorBoundary name="DashboardClient">
          <m.default {...props} />
        </WidgetErrorBoundary>
      ),
    })),
  { loading: () => <DashboardSkeleton /> },
);

const EmployeeDashboard = nextDynamic(
  () =>
    import('@/components/dashboard/EmployeeDashboard').then((m) => ({
      default: (props: any) => (
        <WidgetErrorBoundary name="EmployeeDashboard">
          <m.default {...props} />
        </WidgetErrorBoundary>
      ),
    })),
  { loading: () => <DashboardSkeleton /> },
);

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.organizationId) return null;

  if (user.role === 'employee') {
    return <EmployeeDashboard />;
  }
  return <DashboardClient />;
}
