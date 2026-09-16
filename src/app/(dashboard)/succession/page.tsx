import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

const SuccessionClient = nextDynamic(
  () => import('@/components/succession/SuccessionClient').then((m) => m.default),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
  },
);

export default function SuccessionPage() {
  return <SuccessionClient />;
}
