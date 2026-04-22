import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import React from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver';
  avatar?: string | null;
  department?: string | null;
  position?: string | null;
  employeeType?: 'staff' | 'contractor';
  organizationId?: string | null;
  organizationSlug?: string | null;
  organizationName?: string | null;
  isApproved?: boolean;
  phone?: string | null;
  presenceStatus?: 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy';
}

interface AuthState {
  user: UserProfile | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  isLoading: boolean;

  setUser: (user: UserProfile) => void;
  setSupabaseUser: (user: SupabaseUser | null) => void;
  setSession: (session: Session | null) => void;
  login: (user: UserProfile) => void;
  logout: () => Promise<void>;
  checkOnboarding: () => void;
  initialize: () => Promise<void>;
}

async function fetchUserProfile(supabaseUserId: string, userEmail?: string): Promise<UserProfile | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const params = new URLSearchParams();
    if (supabaseUserId) params.set('userId', supabaseUserId);
    if (userEmail) params.set('email', userEmail);

    const url = `/api/user/profile?${params.toString()}`;
    console.log('[fetchUserProfile] Fetching from:', url);

    const response = await fetch(url, { signal: controller.signal });
    console.log('[fetchUserProfile] Response status:', response.status);
    
    const responseText = await response.text();
    console.log('[fetchUserProfile] Response body:', responseText);
    
    if (!response.ok) {
      console.error('[fetchUserProfile] API error:', response.status, responseText);
      return null;
    }

    const data = JSON.parse(responseText);
    console.log('[fetchUserProfile] Parsed data:', data);
    
    if (!data || data.error) {
      console.error('[fetchUserProfile] No profile found:', data?.error);
      return null;
    }

    const org = data.organization;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      avatar: data.avatar_url || undefined,
      department: data.department || undefined,
      position: data.position || undefined,
      employeeType: data.employee_type || undefined,
      organizationId: data.organization_id || undefined,
      organizationSlug: org?.slug || undefined,
      organizationName: org?.name || undefined,
      isApproved: data.is_approved,
      phone: data.phone || undefined,
      presenceStatus: data.presence_status || undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[fetchUserProfile] Request timed out after 10s');
    } else {
      console.error('[fetchUserProfile] Error:', error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  supabaseUser: null,
  session: null,
  isAuthenticated: false,
  needsOnboarding: false,
  isLoading: true,

  setUser: (user: UserProfile) => {
    const needsOnboarding = user.role !== 'superadmin' && (!user.organizationId || !user.isApproved);
    set({ user, needsOnboarding });
  },

  setSupabaseUser: (supabaseUser: SupabaseUser | null) => {
    set({ supabaseUser });
  },

  setSession: (session: Session | null) => {
    set({ session });
  },

  login: (user: UserProfile) => {
    const needsOnboarding = user.role !== 'superadmin' && (!user.organizationId || !user.isApproved);
    set({ user, isAuthenticated: true, needsOnboarding });
  },

  logout: async () => {
    console.log('[useAuthStore.logout] Starting logout...');
    
    // Clear localStorage first (before any async operations)
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('[useAuthStore.logout] Cleared all localStorage keys');
    
    // Try to sign out from Supabase (but don't wait for it)
    supabase.auth.signOut().catch(error => {
      console.error('[useAuthStore.logout] signOut error (non-fatal):', error);
    });
    
    // Clear state immediately
    set({
      user: null,
      supabaseUser: null,
      session: null,
      isAuthenticated: false,
      needsOnboarding: false,
      isLoading: false,
    });
    
    console.log('[useAuthStore.logout] Logout completed');
  },

  checkOnboarding: () => {
    const { user } = get();
    const needsOnboarding = user?.role !== 'superadmin' && (!user?.organizationId || !user?.isApproved);
    set({ needsOnboarding });
  },

  initialize: async () => {
    console.log('[useAuthStore.initialize] START - Checking current state...');
    
    // Debug: Check localStorage for session tokens
    const allStorageKeys = Object.keys(localStorage);
    console.log('[useAuthStore.initialize] ALL localStorage keys:', allStorageKeys);
    
    // Log the actual content of each auth-related key
    allStorageKeys.forEach(key => {
      if (key.includes('sb-') || key.includes('auth') || key.includes('supabase') || key.includes('token')) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            console.log(`[useAuthStore.initialize] Key "${key}":`, {
              hasAccessToken: !!parsed.access_token,
              hasRefreshToken: !!parsed.refresh_token,
              userId: parsed.user?.id,
              expiresAt: parsed.expires_at,
            });
          }
        } catch (e) {
          console.log(`[useAuthStore.initialize] Key "${key}" parse error:`, e);
        }
      }
    });
    
    // Check what key Supabase is using
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'supabase';
    const expectedKey = `sb-${projectRef}-auth-token`;
    console.log('[useAuthStore.initialize] Expected Supabase key:', expectedKey);
    console.log('[useAuthStore.initialize] Value at expected key:', localStorage.getItem(expectedKey));
    
    // Don't reinitialize if we already have a valid user (e.g., from login page)
    const current = get();
    console.log('[useAuthStore.initialize] Current state:', {
      hasUser: !!current.user,
      isAuthenticated: current.isAuthenticated,
      isLoading: current.isLoading,
    });
    
    if (current.user && current.isAuthenticated) {
      console.log('[useAuthStore.initialize] Already authenticated, skipping');
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });

    // Try to get session from Supabase client first
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log('[useAuthStore.initialize] Supabase session:', session ? { userId: session.user.id, email: session.user.email } : null);

    // Fallback: read session directly from localStorage if Supabase client returns null
    let effectiveSession = session;
    if (!effectiveSession) {
      console.log('[useAuthStore.initialize] Supabase returned null, trying localStorage fallback...');
      const storedSession = localStorage.getItem(expectedKey);
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          if (parsed.access_token && parsed.user) {
            console.log('[useAuthStore.initialize] Found session in localStorage, using it directly');
            effectiveSession = {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              token_type: parsed.token_type || 'bearer',
              expires_in: parsed.expires_in || 3600,
              expires_at: parsed.expires_at,
              user: parsed.user,
            } as Session;
          }
        } catch (e) {
          console.error('[useAuthStore.initialize] Failed to parse localStorage session:', e);
        }
      }
    }

    console.log('[useAuthStore.initialize] Effective session:', effectiveSession ? { userId: effectiveSession.user.id, email: effectiveSession.user.email } : null);

    if (effectiveSession?.user) {
      set({ session: effectiveSession, supabaseUser: effectiveSession.user });

      const profile = await fetchUserProfile(effectiveSession.user.id, effectiveSession.user.email);
      console.log('[useAuthStore.initialize] Profile:', profile ? { id: profile.id, name: profile.name, email: profile.email, orgId: profile.organizationId } : null);

      if (profile) {
        const needsOnboarding = profile.role !== 'superadmin' && (!profile.organizationId || !profile.isApproved);
        set({
          user: profile,
          isAuthenticated: true,
          needsOnboarding,
          isLoading: false,
        });
        console.log('[useAuthStore.initialize] SUCCESS - User authenticated:', profile.name, profile.role);
      } else {
        // Profile not found - user may need to complete onboarding or there's a data issue
        // Set isLoading to false to prevent infinite loading
        console.error('[useAuthStore.initialize] Profile not found for user:', effectiveSession.user.id, effectiveSession.user.email);
        set({ isLoading: false });
      }
    } else {
      // No session - user needs to login
      console.log('[useAuthStore.initialize] No session found');
      set({ isLoading: false });
    }

    if (session?.user) {
      set({ session, supabaseUser: session.user });

      const profile = await fetchUserProfile(session.user.id, session.user.email);
      console.log('[useAuthStore.initialize] Profile:', profile ? { id: profile.id, name: profile.name, email: profile.email, orgId: profile.organizationId } : null);

      if (profile) {
        const needsOnboarding = profile.role !== 'superadmin' && (!profile.organizationId || !profile.isApproved);
        set({
          user: profile,
          isAuthenticated: true,
          needsOnboarding,
          isLoading: false,
        });
        console.log('[useAuthStore.initialize] SUCCESS - User authenticated:', profile.name, profile.role);
      } else {
        // Profile not found - user may need to complete onboarding or there's a data issue
        // Set isLoading to false to prevent infinite loading
        console.error('[useAuthStore.initialize] Profile not found for user:', session.user.id, session.user.email);
        set({ isLoading: false });
      }
    } else {
      // No session - user needs to login
      console.log('[useAuthStore.initialize] No session found');
      set({ isLoading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({ session, supabaseUser: session.user });

        const profile = await fetchUserProfile(session.user.id, session.user.email);

        if (profile) {
          const needsOnboarding = profile.role !== 'superadmin' && (!profile.organizationId || !profile.isApproved);
          set({
            user: profile,
            isAuthenticated: true,
            needsOnboarding,
          });
        }
      } else if (event === 'SIGNED_OUT') {
        set({
          user: null,
          supabaseUser: null,
          session: null,
          isAuthenticated: false,
          needsOnboarding: false,
        });
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        set({ session });
      } else if (event === 'USER_UPDATED' && session?.user) {
        set({ session, supabaseUser: session.user });

        const profile = await fetchUserProfile(session.user.id, session.user.email);
        if (profile) {
          const needsOnboarding = profile.role !== 'superadmin' && (!profile.organizationId || !profile.isApproved);
          set({ user: profile, needsOnboarding });
        }
      }
    });
  },
}));

export function useAuthStoreShallow() {
  const user = useAuthStore(useShallow((state) => state.user));
  const isAuthenticated = useAuthStore(useShallow((state) => state.isAuthenticated));
  const needsOnboarding = useAuthStore(useShallow((state) => state.needsOnboarding));
  const isLoading = useAuthStore(useShallow((state) => state.isLoading));

  return React.useMemo(
    () => ({
      user,
      isAuthenticated,
      needsOnboarding,
      isLoading,
    }),
    [user, isAuthenticated, needsOnboarding, isLoading],
  );
}

export const useAuthUser = (): UserProfile | null =>
  useAuthStore(useShallow((state) => state.user));
export const useAuthIsAuthenticated = () =>
  useAuthStore(useShallow((state) => state.isAuthenticated));
export const useAuthNeedsOnboarding = () =>
  useAuthStore(useShallow((state) => state.needsOnboarding));
export const useAuthIsLoading = () =>
  useAuthStore(useShallow((state) => state.isLoading));
export const useAuthLogout = () => useAuthStore((state) => state.logout);
export const useAuthInitialize = () => useAuthStore((state) => state.initialize);
