'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';

export function useSyncOAuthUser() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const syncingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const syncUser = async () => {
      if (syncingRef.current || isAuthenticated) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        return;
      }

      syncingRef.current = true;
      setIsProcessing(true);

      try {
        const finalName = session.user.user_metadata?.name?.trim()
          || session.user.email.split('@')[0]
          || 'User';

        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, name, role, employee_type, department, position, avatar_url, is_approved, organization_id')
          .eq('email', session.user.email)
          .maybeSingle();

        if (!existingUser) {
          const { data: newUser, error } = await supabase
            .from('users')
            .insert({
              email: session.user.email,
              name: finalName,
              password_hash: 'oauth',
              role: 'employee',
              employee_type: 'staff',
              is_active: true,
              is_approved: false,
              travel_allowance: 0,
              paid_leave_balance: 20,
              sick_leave_balance: 10,
              family_leave_balance: 5,
              created_at: Math.floor(Date.now() / 1000),
              updated_at: Math.floor(Date.now() / 1000),
            })
            .select()
            .maybeSingle();

          if (error) {
            console.error('[useSyncOAuthUser] Error creating user:', error);
            syncingRef.current = false;
            setIsProcessing(false);
            return;
          }

          if (!newUser) {
            console.error('[useSyncOAuthUser] Failed to create user');
            syncingRef.current = false;
            setIsProcessing(false);
            return;
          }

          login({
            id: newUser.id,
            name: finalName,
            email: newUser.email,
            role: newUser.role,
            avatar: newUser.avatar_url || session.user.user_metadata?.avatar_url || undefined,
            department: newUser.department || undefined,
            position: newUser.position || undefined,
            employeeType: newUser.employee_type || undefined,
            organizationId: newUser.organization_id || undefined,
            isApproved: newUser.is_approved,
          });
        } else {
          login({
            id: existingUser.id,
            name: existingUser.name || finalName,
            email: existingUser.email,
            role: existingUser.role,
            avatar: existingUser.avatar_url || session.user.user_metadata?.avatar_url || undefined,
            department: existingUser.department || undefined,
            position: existingUser.position || undefined,
            employeeType: existingUser.employee_type || undefined,
            organizationId: existingUser.organization_id || undefined,
            isApproved: existingUser.is_approved,
          });
        }

        const params = new URLSearchParams(window.location.search);
        const isMaintenance = params.get('maintenance') === 'true';
        const path = window.location.pathname;

        if (isMaintenance) {
          window.location.href = `/login?maintenance=true`;
          return;
        }

        const nextUrl = params.get('next');
        const redirectUrl = nextUrl || '/dashboard';

        if (!isDashboardPage(path)) {
          window.location.href = redirectUrl;
        }
      } catch (error) {
        console.error('[useSyncOAuthUser] Error syncing OAuth user:', error);
        syncingRef.current = false;
      } finally {
        setIsProcessing(false);
      }
    };

    syncUser();
  }, [isAuthenticated, login, router]);

  function isDashboardPage(path: string): boolean {
    const dashboardPrefixes = [
      '/dashboard',
      '/superadmin',
      '/admin',
      '/employees',
      '/tasks',
      '/calendar',
      '/leaves',
      '/attendance',
      '/settings',
      '/chat',
      '/analytics',
      '/reports',
      '/join-requests',
      '/org-requests',
      '/approvals',
      '/profile',
      '/ai-site-editor',
      '/drivers',
      '/events',
    ];
    return dashboardPrefixes.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
  }

  return { isProcessing };
}
