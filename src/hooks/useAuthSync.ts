'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useAuthSync() {
  const { data: session, status } = useSession();
  const { login, logout, isAuthenticated } = useAuthStore();
  const createOAuthUser = useMutation(api.users.auth.createOAuthUser);
  const sessionCreated = useRef(false);
  const lastSyncedUserRef = useRef<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const prevUserState = useRef<{ organizationId?: string | null; isApproved?: boolean }>({});

  // Get current user by email
  const currentUser = useQuery(
    api.users.queries.getCurrentUser,
    userEmail ? { email: userEmail } : 'skip',
  );

  useEffect(() => {
    const syncAuth = async () => {
      console.log('[useAuthSync] Status:', status, 'Session:', session?.user?.email);
      console.log('[useAuthSync] Session user name:', session?.user?.name);
      console.log('[useAuthSync] userEmail state:', userEmail);

      if (status === 'loading') {
        console.log('[useAuthSync] Still loading...');
        return;
      }

      // When NextAuth logs user out, clear everything
      // BUT only if we don't have a valid email/password session (JWT cookie)
      if (status === 'unauthenticated') {
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
          // User logged in via email/password — JWT session is active, don't logout
          console.log(
            '[useAuthSync] NextAuth unauthenticated but email/password session active - skipping logout',
          );
          return;
        }
        console.log('[useAuthSync] NextAuth unauthenticated and no active session - logging out');
        logout();
        setUserEmail(null);
        sessionCreated.current = false;
        return;
      }

      // If authenticated via NextAuth
      if (status === 'authenticated' && session?.user) {
        console.log('[useAuthSync] Authenticated! User:', session.user.email);
        console.log('[useAuthSync] Session user full details:', {
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          id: session.user.id,
        });

        // Only sync if user email changed (prevent excess mutations)
        if (userEmail !== session.user.email) {
          console.log('[useAuthSync] Email changed, syncing to Convex...');
          try {
            // Ensure name is never empty
            const finalName =
              session.user.name?.trim() || session.user.email!.split('@')[0] || 'User';
            console.log('[useAuthSync] Name extraction:', {
              sessionName: session.user.name,
              sessionNameTrimmed: session.user.name?.trim(),
              emailPrefix: session.user.email!.split('@')[0],
              finalName,
            });
            const userData = {
              email: session.user.email!,
              name: finalName,
              avatarUrl: session.user.image || undefined,
            };

            const result = await createOAuthUser(userData);
            console.log('[useAuthSync] User synced to Convex with name:', finalName);
            setUserEmail(session.user.email!);
          } catch (error) {
            console.error('[useAuthSync] Error syncing OAuth user:', error);
          }
        }
      }
    };

    syncAuth();
  }, [status, session?.user?.email, userEmail, createOAuthUser]);

  // Separate effect to handle user data once it's loaded
  useEffect(() => {
    console.log('[useAuthSync] Effect 2 triggered');
    console.log(
      '[useAuthSync]   currentUser:',
      currentUser
        ? {
            id: currentUser._id,
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
          }
        : null,
    );
    console.log(
      '[useAuthSync]   session.user:',
      session?.user
        ? { name: session.user.name, email: session.user.email, role: (session.user as any).role }
        : null,
    );

    if (!session?.user?.email) {
      console.log('[useAuthSync] ❌ No session.user - skipping sync');
      return;
    }

    // Prevent syncing the same user multiple times (race condition safeguard)
    if (lastSyncedUserRef.current === session.user.email) {
      console.log(
        '[useAuthSync] ℹ️  Already synced',
        session.user.email,
        '- skipping to prevent race condition',
      );
      return;
    }

    // If we have currentUser from Convex, use it (has full profile)
    if (currentUser) {
      console.log('[useAuthSync] ✅ Current user from Convex:', {
        id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department,
        position: currentUser.position,
      });

      // If user name is "User" but we have better name from session, use that
      let finalName = currentUser.name;
      if (currentUser.name === 'User' || !currentUser.name) {
        const sessionName = session.user.name?.trim();
        if (sessionName && sessionName !== 'User') {
          console.log(
            '[useAuthSync] 📝 Upgrading name from DB',
            currentUser.name,
            'to session name:',
            sessionName,
          );
          finalName = sessionName;
        }
      }

      console.log('[useAuthSync] 📤 Syncing to useAuthStore from Convex...');

      // Create JWT session cookie via oauth-session API (required for server-side auth)
      const syncSession = async () => {
        try {
          const res = await fetch('/api/auth/oauth-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: currentUser.email,
              name: finalName,
              avatarUrl: currentUser.avatarUrl || session?.user?.image || undefined,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            console.log('[useAuthSync] ✅ JWT session cookie created');
            if (data.session) {
              // Use server response data (more complete)
              const { login } = useAuthStore.getState();
              login({
                id: data.session.userId,
                name: data.session.name,
                email: data.session.email,
                role: data.session.role,
                avatar: data.session.avatar,
                department: data.session.department,
                position: data.session.position,
                employeeType: data.session.employeeType,
                organizationId: data.session.organizationId,
              });

              console.log('[useAuthSync] ✅ User logged into useAuthStore from oauth-session:', {
                id: data.session.userId,
                name: data.session.name,
                email: data.session.email,
                role: data.session.role,
              });

              // Mark as synced
              lastSyncedUserRef.current = currentUser.email;
              prevUserState.current = {
                organizationId: data.session.organizationId,
                isApproved: currentUser.isApproved,
              };

              return; // Skip fallback login below
            }
          } else {
            console.error('[useAuthSync] ❌ OAuth session API failed:', res.status);
          }
        } catch (error) {
          console.error('[useAuthSync] ❌ Error creating JWT session:', error);
        }

        // Fallback: sync to useAuthStore from Convex data (no JWT cookie)
        const { login } = useAuthStore.getState();
        login({
          id: currentUser._id,
          name: finalName,
          email: currentUser.email,
          role: currentUser.role,
          avatar: currentUser.avatarUrl,
          department: currentUser.department,
          position: currentUser.position,
          employeeType: currentUser.employeeType,
          organizationId: currentUser.organizationId,
          isApproved: currentUser.isApproved,
        });
      };
      syncSession();

      console.log('[useAuthSync] ✅ User logged into useAuthStore (fallback):', {
        id: currentUser._id,
        name: finalName,
        email: currentUser.email,
        role: currentUser.role,
        organizationId: currentUser.organizationId,
        isApproved: currentUser.isApproved,
      });

      // Check if user was just approved (organizationId or isApproved changed)
      const prevOrg = prevUserState.current.organizationId;
      const prevApproved = prevUserState.current.isApproved;
      const currOrg = currentUser.organizationId;
      const currApproved = currentUser.isApproved;

      // Only redirect if user was NOT approved before but IS approved now
      // AND we're not already on a dashboard page
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const isDashboardPage =
        currentPath === '/dashboard' ||
        currentPath.startsWith('/superadmin') ||
        currentPath.startsWith('/admin') ||
        currentPath.startsWith('/employees') ||
        currentPath.startsWith('/tasks') ||
        currentPath.startsWith('/calendar') ||
        currentPath.startsWith('/leaves') ||
        currentPath.startsWith('/attendance') ||
        currentPath.startsWith('/settings') ||
        currentPath.startsWith('/chat') ||
        currentPath.startsWith('/analytics') ||
        currentPath.startsWith('/reports') ||
        currentPath.startsWith('/join-requests') ||
        currentPath.startsWith('/org-requests') ||
        currentPath.startsWith('/approvals') ||
        currentPath.startsWith('/profile') ||
        currentPath.startsWith('/ai-site-editor');

      if (!prevApproved && currApproved && currOrg && !isDashboardPage) {
        console.log('[useAuthSync] 🎉 User was just approved! WOULD redirect to dashboard...');
        // TEMP: Disabled for debugging
        // setTimeout(() => {
        //   window.location.href = "/dashboard";
        // }, 1000);
      } else if (prevApproved && currApproved) {
        console.log('[useAuthSync] ℹ️  User already approved, skipping redirect');
      }

      // Update previous state
      prevUserState.current = {
        organizationId: currOrg,
        isApproved: currApproved,
      };

      // Mark as synced to prevent race condition re-syncs
      lastSyncedUserRef.current = currentUser.email;
    } else {
      // Convex query hasn't returned yet — do NOT populate the store with
      // incomplete NextAuth session data (which may have name "User").
      // OAuthSyncLoader + Providers ShieldLoader will keep showing until
      // Convex returns the full profile and login() is called above.
      console.log('[useAuthSync] ⏳ Waiting for Convex query to return full user profile...');
    }

    // Create server-side session cookie for dashboard auth (only once per user)
    if (!sessionCreated.current) {
      sessionCreated.current = true;

      const createSession = async () => {
        try {
          // Check if we're in maintenance mode
          const params = new URLSearchParams(window.location.search);
          const isMaintenance = params.get('maintenance') === 'true';
          const isDebug = params.get('debug') === 'true';

          // Skip redirect if in maintenance mode or already on dashboard/login
          if (isMaintenance) {
            console.log('[useAuthSync] Maintenance mode detected - not redirecting');
            return;
          }

          // Debug mode - log but don't redirect
          if (isDebug) {
            console.log('[useAuthSync] Debug mode - logging but not redirecting');
          }

          // Public routes that should NOT redirect
          const publicRoutes = ['/', '/contact', '/privacy', '/terms', '/test-i18n', '/landing'];
          const path = window.location.pathname;

          console.log('[useAuthSync] Checking route:', {
            path,
            publicRoutes,
            isPublicRouteCheck: publicRoutes.some(
              (route) => path === route || path === route + '/' || path.startsWith(route + '/'),
            ),
            isLandingPage: path === '/' || path.startsWith('/landing'),
          });

          // Check for exact match or sub-route
          const isPublicRoute = publicRoutes.some(
            (route) => path === route || path === route + '/' || path.startsWith(route + '/'),
          );

          // Landing page should never redirect
          const isLandingPage = path === '/' || path.startsWith('/landing');

          // Only redirect if we're on auth pages (login/register), not if already on a dashboard page or public page
          const isAuthPage =
            path === '/login' ||
            path === '/register' ||
            path === '/forgot-password' ||
            path.startsWith('/register-org');

          if (isPublicRoute || isLandingPage) {
            console.log('[useAuthSync] ✅ Public/landing route - not redirecting:', path);
            return;
          }

          const isDashboardPage =
            path === '/dashboard' ||
            path.startsWith('/superadmin') ||
            path.startsWith('/admin') ||
            path.startsWith('/employees') ||
            path.startsWith('/tasks') ||
            path.startsWith('/calendar') ||
            path.startsWith('/leaves') ||
            path.startsWith('/attendance') ||
            path.startsWith('/settings') ||
            path.startsWith('/chat') ||
            path.startsWith('/analytics') ||
            path.startsWith('/reports') ||
            path.startsWith('/join-requests') ||
            path.startsWith('/org-requests') ||
            path.startsWith('/approvals') ||
            path.startsWith('/profile') ||
            path.startsWith('/ai-site-editor') ||
            path.startsWith('/drivers') ||
            path.startsWith('/events') ||
            path.startsWith('/admin/events');

          console.log('[useAuthSync] Route check result:', {
            isPublicRoute,
            isLandingPage,
            isAuthPage,
            isDashboardPage,
            path,
          });

          // Don't redirect to dashboard if user has no organization (needs onboarding)
          if (currentUser && !currentUser.organizationId) {
            console.log('[useAuthSync] 🚨 User has no organization - not redirecting to dashboard');
            return;
          }

          // Check for callback URL parameter
          const callbackUrl = params.get('next');
          const redirectTarget = callbackUrl || '/dashboard';

          if (!isDashboardPage && !isAuthPage && !isPublicRoute) {
            console.log('[useAuthSync] ⚠️ WOULD Redirect from', path, 'to', redirectTarget);
            // TEMP: Disabled for debugging
            // window.location.href = redirectTarget;
          } else {
            console.log('[useAuthSync] ✅ No redirect needed:', {
              isDashboardPage,
              isAuthPage,
              isPublicRoute,
            });
          }
        } catch (error) {
          console.error('[useAuthSync] Session creation error:', error);
          sessionCreated.current = false; // Allow retry on error
        }
      };

      // Wait for state to update before redirecting
      setTimeout(createSession, 0);
    }
  }, [currentUser]);

  return { session, status, currentUser };
}
