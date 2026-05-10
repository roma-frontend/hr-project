'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { logger } from '@/lib/logger';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export function useSyncOAuthUser() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const createOAuthUser = useMutation(api.users.auth.createOAuthUser);
  const syncingRef = useRef(false);

  useEffect(() => {
    const syncUser = async () => {
      logger.log(
        '[useSyncOAuthUser] Status:',
        status,
        'IsAuthenticated:',
        isAuthenticated,
        'Syncing:',
        syncingRef.current,
      );

      // Already syncing or already authenticated — skip
      if (syncingRef.current || isAuthenticated) {
        logger.log(
          '[useSyncOAuthUser] ⏭️  Skipping (syncing=' +
            syncingRef.current +
            ' or authenticated=' +
            isAuthenticated +
            ')',
        );
        return;
      }

      // Only run when Google OAuth session is ready
      if (status !== 'authenticated' || !session?.user?.email) {
        logger.log(
          '[useSyncOAuthUser] ⏳ Waiting for auth (status=' +
            status +
            ', email=' +
            session?.user?.email +
            ')',
        );
        return;
      }

      logger.log('[useSyncOAuthUser] 🔄 Starting OAuth user sync...');
      logger.log('[useSyncOAuthUser]   Session user:', {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      });

      syncingRef.current = true;
      try {
        // 1. Ensure user exists in Convex (create or update)
        logger.log('[useSyncOAuthUser] 📝 Calling createOAuthUser mutation...');
        // Ensure name ALWAYS has a value
        const finalName = session.user.name?.trim() || session.user.email.split('@')[0] || 'User';
        await createOAuthUser({
          email: session.user.email,
          name: finalName,
          avatarUrl: session.user.image ?? undefined,
        });
        logger.log('[useSyncOAuthUser] ✅ User synced to Convex with name:', finalName);

        // 2. Create JWT session via our API endpoint
        logger.log('[useSyncOAuthUser] 📡 Calling /api/auth/oauth-session...');
        const res = await fetch('/api/auth/oauth-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            name: finalName,
            avatarUrl: session.user.image ?? undefined,
          }),
        });

        if (!res.ok && res.status === 503) {
          const errorData = await res.json();
          if (errorData.error === 'maintenance') {
            router.push(`/login?maintenance=true${errorData.organizationId ? `&org=${errorData.organizationId}` : ''}`);
            return;
          }
        }

        if (res.ok) {
          const data = await res.json();
          logger.log('[useSyncOAuthUser] ✅ OAuth session created:', {
            userId: data.session?.userId,
            name: data.session?.name,
            email: data.session?.email,
            role: data.session?.role,
          });

          if (data.session) {
            // 3. Save to auth store — no reload needed!
            logger.log('[useSyncOAuthUser] 💾 Logging into Zustand store...');
            login({
              id: data.session.userId,
              name: data.session.name,
              email: data.session.email,
              role: data.session.role,
              organizationId: data.session.organizationId,
              organizationSlug: data.session.organizationSlug,
              organizationName: data.session.organizationName,
              department: data.session.department,
              position: data.session.position,
              employeeType: data.session.employeeType,
              avatar: data.session.avatar,
            });
            logger.log('[useSyncOAuthUser] ✅ User logged into Zustand:', {
              name: data.session.name,
              email: data.session.email,
              role: data.session.role,
            });

            // 4. Navigate to dashboard or callback URL — use window.location to avoid SSL issues on localhost
            const params = new URLSearchParams(window.location.search);
            const nextUrl = params.get('next');
            const redirectUrl = nextUrl || '/dashboard';
            logger.log('[useSyncOAuthUser] 🎯 Redirecting to', redirectUrl);
            router.push(redirectUrl);
            return;
          }
        }

        // Fallback if API failed
        console.error(
          '[useSyncOAuthUser] ❌ OAuth session API failed:',
          res.status,
          await res.text(),
        );
        const params = new URLSearchParams(window.location.search);
        const nextUrl = params.get('next');
        const redirectUrl = nextUrl || '/dashboard';
        router.push(redirectUrl);
      } catch (error) {
        console.error('[useSyncOAuthUser] ❌ Error syncing OAuth user:', error);
        syncingRef.current = false;
      }
    };

    syncUser();
  }, [status, session, isAuthenticated, login, router, createOAuthUser]);

  return { session, status };
}
