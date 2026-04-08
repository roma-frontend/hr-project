'use client';

import dynamic from 'next/dynamic';

const LeavesClient = dynamic(() => import('@/components/leaves/LeavesClient'), {
  ssr: false,
});

export default function LeavesPage() {
  return <LeavesClient />;
}
