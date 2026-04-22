import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeType: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: number;
  organizationId: string | null;
}

export function usePendingApprovals(enabled = true) {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useQuery({
    queryKey: ['approvals', 'pending', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/users?action=get-pending-approvals');
      if (!res.ok) throw new Error(t('hooks.approvals.failedToFetchPending', 'Failed to fetch pending approvals'));
      const json = await res.json();
      return json.data as PendingUser[];
    },
    enabled: enabled && !!user?.id && ['admin', 'superadmin'].includes(user?.role || ''),
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/users?action=approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminId: user?.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.approvals.failedToApproveUser', 'Failed to approve user'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('approvals.approveFailed', 'Failed to approve user'));
    },
  });
}

export function useRejectUser() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/users?action=reject-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminId: user?.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reject user');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('approvals.rejectFailed', 'Failed to reject user'));
    },
  });
}
