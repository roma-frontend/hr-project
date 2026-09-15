import { Suspense } from 'react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { LocalResultClient } from '../LocalResultClient';

export const metadata = {
  title: 'Payment not completed',
};

export default function LocalCheckoutFailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ background: 'var(--background)' }}
        >
          <ShieldLoader size="sm" variant="inline" />
        </div>
      }
    >
      <LocalResultClient outcome="fail" />
    </Suspense>
  );
}
