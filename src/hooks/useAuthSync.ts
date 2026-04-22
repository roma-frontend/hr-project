'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase/client';

function extractUserName(user: any): string {
  return user.user_metadata?.name?.trim() || user.email?.split('@')[0] || 'User';
}


export function useAuthSync() {
  const { login, isAuthenticated, initialize } = useAuthStore();
  const initializedRef = useRef(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const prevUserState = useRef<{ organizationId?: string | null; isApproved?: boolean }>({});

  console.log('[useAuthSync] Hook mounted, initializedRef:', initializedRef.current);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    console.log('[useAuthSync] Calling initialize()...');
    initialize().catch(err => {
      console.error('[useAuthSync] initialize() failed:', err);
    });
  }, [initialize]);

  // Removed duplicate session sync logic - useAuthStore.initialize() handles it
  // This useEffect was causing race conditions with useAuthStore.initialize()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useAuthSync] onAuthStateChange:', event, session ? { userId: session.user.id } : null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Skip if we already have a valid user in store (login page already set it)
        const currentState = useAuthStore.getState();
        if (currentState.user && currentState.user.email === session.user.email) {
          return;
        }

        // Use API route to bypass RLS infinite recursion
        const response = await fetch(`/api/user/profile?email=${encodeURIComponent(session.user.email!)}`);
        
        if (!response.ok) {
          console.error('[useAuthSync] Failed to fetch profile via API');
          return;
        }

        const profileData = await response.json();

        if (profileData && !profileData.error) {
          const org = profileData.organization;
          const finalName = profileData.name || extractUserName(session.user);

          login({
            id: profileData.id,
            name: finalName,
            email: profileData.email,
            role: profileData.role,
            avatar: profileData.avatar_url || undefined,
            department: profileData.department || undefined,
            position: profileData.position || undefined,
            employeeType: profileData.employee_type || undefined,
            organizationId: profileData.organization_id || undefined,
            organizationSlug: org?.slug || undefined,
            organizationName: org?.name || undefined,
            isApproved: profileData.is_approved,
          });

          prevUserState.current = {
            organizationId: profileData.organization_id,
            isApproved: profileData.is_approved,
          };
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[useAuthSync] SIGNED_OUT - clearing state');
        useAuthStore.getState().logout();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[useAuthSync] TOKEN_REFRESHED');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [login]);

  return { userEmail };
}
