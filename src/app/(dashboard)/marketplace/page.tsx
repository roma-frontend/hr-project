import nextDynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/server-auth';

const MarketplaceClient = nextDynamic(() => import('@/components/marketplace/MarketplaceClient'), {
  loading: () => (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-white/5" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-36 rounded-2xl bg-white/5" />
        <div className="h-36 rounded-2xl bg-white/5" />
        <div className="h-36 rounded-2xl bg-white/5" />
      </div>
    </div>
  ),
});

/**
 * Integration marketplace.
 *
 * Route exists for every role because the catalog is a marketing surface too;
 * the install action inside it is org-admin only and is enforced server-side by
 * the outbound-webhook mutations, so a non-admin sees the directory without
 * ever being able to create an endpoint.
 */
export default async function MarketplacePage() {
  const user = await getServerUser();
  if (!user) redirect('/login');

  return <MarketplaceClient />;
}
