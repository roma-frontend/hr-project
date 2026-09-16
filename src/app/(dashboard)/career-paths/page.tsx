import nextDynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

const CareerPathsClient = nextDynamic(
  () => import('@/components/careerPaths/CareerPathsClient').then((m) => m.default),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
  },
);

export default function CareerPathsPage() {
  return <CareerPathsClient />;
}
