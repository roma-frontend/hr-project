import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';

const GoalsClient = nextDynamic(() => import('@/components/GoalsClient'), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

export default function GoalsPage() {
  return <GoalsClient />;
}
