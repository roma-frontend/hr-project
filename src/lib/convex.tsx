'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode } from 'react';

// Singleton — only created when actually needed
let convexInstance: ConvexReactClient | null = null;

function getConvexClient() {
  if (!convexInstance) {
    convexInstance = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
      unsavedChangesWarning: false,
    });
  }
  return convexInstance;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getConvexClient();

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

/**
 * Hook to check if Convex is ready.
 * Now always returns true since ConvexProvider is always mounted.
 */
export function useConvexAuthReady(): boolean {
  return true;
}
