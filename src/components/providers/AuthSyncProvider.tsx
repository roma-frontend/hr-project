'use client';

import { useAuthSync } from '@/hooks/useAuthSync';
import { useConvexAuthReady } from '@/lib/convex';
import { ReactNode } from 'react';

/**
 * This component ONLY renders useAuthSync when Convex is activated.
 * It does NOT wrap children - it renders them as siblings.
 * This prevents Convex hooks from being called before ConvexProvider is active.
 */
export function AuthSyncProvider({ children }: { children: ReactNode }) {
  const isConvexReady = useConvexAuthReady();

  // Only activate useAuthSync when Convex is ready
  if (!isConvexReady) {
    return <>{children}</>;
  }

  return (
    <>
      <AuthSyncInner />
      {children}
    </>
  );
}

// Inner component that actually uses Convex hooks
function AuthSyncInner() {
  useAuthSync();
  return null;
}
