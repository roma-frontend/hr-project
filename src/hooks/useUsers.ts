import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  position?: string;
  employee_type?: string;
  phone?: string;
  avatar_url?: string;
  organizationId?: string;
  supervisorid?: string;
  is_active?: boolean;
  is_approved?: boolean;
  is_suspended?: boolean | null;
  suspended_until?: number | null;
  suspended_reason?: string | null;
  suspended_by?: string | null;
  suspended_at?: number | null;
}

export function useOrgUsers(organizationId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['org-users', organizationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-org-users',
        organizationId,
      });
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error(t('users.fetchOrgUsersFailed', 'Failed to fetch org users'));
      const json = await res.json();
      return json.data as User[];
    },
    enabled: !!organizationId,
  });
}

export function useMyEmployees(supervisorId?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['my-employees', supervisorId],
    queryFn: async () => {
      if (!supervisorId) return [];
      const params = new URLSearchParams({
        action: 'get-my-employees',
        supervisorId,
      });
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error(t('users.fetchMyEmployeesFailed', 'Failed to fetch my employees'));
      const json = await res.json();
      return json.data as User[];
    },
    enabled: !!supervisorId,
  });
}

export function useUserById(userId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['user-by-id', userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-user-by-id',
        userId,
      });
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error(t('users.fetchUserFailed', 'Failed to fetch user'));
      const json = await res.json();
      return json.data as User | null;
    },
    enabled: !!userId,
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      adminId: string;
      userId: string;
      reason: string;
      duration: number;
    }) => {
      const params = new URLSearchParams({ action: 'suspend-user' });
      const res = await fetch(`/api/users?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to suspend user');
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-by-id'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'user-360'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('users.suspendFailed'));
    },
  });
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { adminId: string; userId: string }) => {
      const params = new URLSearchParams({ action: 'unsuspend-user' });
      const res = await fetch(`/api/users?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to unsuspend user');
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-by-id'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'user-360'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('users.unsuspendFailed', 'Failed to unsuspend user'));
    },
  });
}

export function useUpdatePresenceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; presenceStatus: string }) => {
      const params = new URLSearchParams({ action: 'update-presence-status' });
      const res = await fetch(`/api/users?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update presence status');
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-by-id'] });
    },
  });
}
