'use client';

import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { useSession } from 'next-auth/react';
import { ReactNode, useMemo } from 'react';
import type { Session } from 'next-auth';

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

function useAuth() {
  const { data: session, status, update } = useSession();
  const hasToken = !!session?.convexToken;

  return useMemo(
    () => ({
      isLoading: status === 'loading',
      isAuthenticated: hasToken,
      fetchAccessToken: async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
        if (!hasToken) return null;
        if (forceRefreshToken) {
          const refreshed = await update();
          return (refreshed as Session | null)?.convexToken ?? null;
        }
        return session?.convexToken ?? null;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, hasToken],
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = getConvexClient();

  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

/**
 * Hook to check if Convex is ready.
 * Now always returns true since ConvexProvider is always mounted.
 */
export function useConvexAuthReady(): boolean {
  return true;
}
