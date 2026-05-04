import nextDynamic from 'next/dynamic';
import { SkeletonTable } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';

const LeavesClient = nextDynamic(
  () => import('@/components/leaves/LeavesClient').then((m) => ({ default: m.LeavesClient })),
  { loading: () => <SkeletonTable rows={8} /> },
);

export default function LeavesPage() {
  return <LeavesClient />;
}
