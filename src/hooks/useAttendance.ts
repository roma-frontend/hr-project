import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useMonthlyAttendanceStats(month?: string) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const currentMonth = month || new Date().toISOString().slice(0, 7);

  return useQuery({
    queryKey: ['attendance', 'monthly-stats', user?.id, currentMonth],
    queryFn: async () => {
      const url = new URL('/api/dashboard', window.location.origin);
      url.searchParams.set('type', 'monthly-stats-attendance');
      url.searchParams.set('month', currentMonth);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.attendance.failedToFetchMonthlyStats', 'Failed to fetch monthly attendance stats'));
      return res.json();
    },
    enabled: !!user?.id,
  });
}

export function useAttendanceHistory(limit: number = 10) {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useQuery({
    queryKey: ['attendance', 'history', user?.id, limit],
    queryFn: async () => {
      const url = new URL('/api/dashboard', window.location.origin);
      url.searchParams.set('type', 'user-history');
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.attendance.failedToFetchHistory', 'Failed to fetch attendance history'));
      return res.json();
    },
    enabled: !!user?.id,
  });
}

export function useEmployeeAttendanceHistory(userId: string | undefined, month?: string) {
  const { t } = useTranslation();
  const currentMonth = month || new Date().toISOString().slice(0, 7);

  return useQuery({
    queryKey: ['attendance', 'employee-history', userId, currentMonth],
    queryFn: async () => {
      const url = new URL('/api/dashboard', window.location.origin);
      url.searchParams.set('type', 'employee-history');
      url.searchParams.set('userId', userId!);
      url.searchParams.set('month', currentMonth);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.attendance.failedToFetchEmployeeHistory', 'Failed to fetch employee attendance history'));
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useTodayStatus(enabled = true) {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useQuery({
    queryKey: ['attendance', 'today-status', user?.id],
    queryFn: async () => {
      const url = new URL('/api/time-tracking', window.location.origin);
      url.searchParams.set('type', 'today-status');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.attendance.failedToFetchTodayStatus', 'Failed to fetch today status'));
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!user?.id,
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'check-in' }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to check in');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today-status', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today-summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today-all', user?.id] });
      toast.success(t('attendance.checkedIn', 'Checked in successfully'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('attendance.checkInFailed', 'Failed to check in'));
    },
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'check-out' }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to check out');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today-status', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today-summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today-all', user?.id] });
      toast.success(t('attendance.checkedOut', 'Checked out successfully'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('attendance.checkOutFailed', 'Failed to check out'));
    },
  });
}
