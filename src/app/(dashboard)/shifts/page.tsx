'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ShiftsClient = dynamic(() => import('@/components/shifts/ShiftsClient'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  ),
});

export default function ShiftsPage() {
  return <ShiftsClient />;
}
