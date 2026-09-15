import nextDynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/server-auth';

const PaymentProvidersClient = nextDynamic(
  () => import('@/components/superadmin/PaymentProvidersClient'),
  { loading: () => <SkeletonLoader /> },
);

function SkeletonLoader() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-4 p-6">
      <div className="h-8 w-72 rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-96 rounded-2xl bg-white/5" />
        <div className="h-96 rounded-2xl bg-white/5" />
        <div className="h-96 rounded-2xl bg-white/5" />
        <div className="h-96 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Local Payment Providers',
};

export default async function SuperadminPaymentsPage() {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (user.role !== 'superadmin') redirect('/dashboard');

  return <PaymentProvidersClient />;
}
