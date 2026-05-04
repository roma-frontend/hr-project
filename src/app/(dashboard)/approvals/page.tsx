import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';

const ApprovalsClient = nextDynamic(() => import('@/components/approvals/ApprovalsClient'), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

export default function ApprovalsPage() {
  return <ApprovalsClient />;
}
