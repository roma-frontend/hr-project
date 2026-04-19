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
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['approvals', 'pending', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/users?action=get-pending-approvals');
      if (!res.ok) throw new Error(t('approvals.fetchPendingFailed'));
      const json = await res.json();
      return json.data as PendingUser[];
    },
    enabled: enabled && !!user?.id && ['admin', 'superadmin'].includes(user?.role || ''),
  });
}

export function useApproveUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/users?action=approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminId: user?.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('approvals.approveFailed'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('approvals.approveFailed', t('approvals.approveFailed')));
    },
  });
}

export function useRejectUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/users?action=reject-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminId: user?.id }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('approvals.rejectFailed'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t('approvals.rejectFailed', t('approvals.rejectFailed')));
    },
  });
}
