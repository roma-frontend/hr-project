import { Suspense } from 'react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { LocalResultClient } from '../LocalResultClient';

export const metadata = {
  title: 'Payment received',
};

export default function LocalCheckoutSuccessPage() {
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
      <LocalResultClient outcome="success" />
    </Suspense>
  );
}
