import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment?: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  createdAt: number;
}

export function useAllLeaves(requesterId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['leaves', 'all', requesterId],
    queryFn: async () => {
      const res = await fetch(`/api/leaves?requesterId=${requesterId}`);
      if (!res.ok) throw new Error(t('hooks.bulkactions.failedToFetchLeaves', 'Failed to fetch leaves'));
      const data = await res.json();
      return data.leaves as LeaveRequest[];
    },
    enabled: !!requesterId,
  });
}

export function useBulkApproveLeaves() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      leaveIds,
      reviewerId,
      comment,
    }: {
      leaveIds: string[];
      reviewerId: string;
      comment?: string;
    }) => {
      const res = await fetch('/api/superadmin/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', leaveIds, reviewerId, comment }),
      });
      if (!res.ok) throw new Error(t('hooks.bulkactions.failedToBulkApprove', 'Failed to bulk approve leaves'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}

export function useBulkRejectLeaves() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      leaveIds,
      reviewerId,
      comment,
    }: {
      leaveIds: string[];
      reviewerId: string;
      comment?: string;
    }) => {
      const res = await fetch('/api/superadmin/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', leaveIds, reviewerId, comment }),
      });
      if (!res.ok) throw new Error(t('hooks.bulkactions.failedToBulkReject', 'Failed to bulk reject leaves'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
  });
}
