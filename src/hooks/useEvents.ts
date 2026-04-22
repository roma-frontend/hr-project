import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export interface LeaveConflictAlert {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  eventId: string;
  eventName: string;
  eventStartDate: string;
  eventEndDate: string;
  leaveStartDate: string;
  leaveEndDate: string;
  leaveType: string;
  conflictType: string;
  severity: string;
  isReviewed: boolean;
  reviewNotes?: string;
  createdAt: number;
}

export function useLeaveConflictAlerts(organizationId: string, isReviewed: boolean) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['events', 'leave-conflicts', organizationId, isReviewed],
    queryFn: async () => {
      const params = new URLSearchParams({
        organizationId,
        isReviewed: String(isReviewed),
      });
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error(t('hooks.events.failedToFetchConflictAlerts', 'Failed to fetch conflict alerts'));
      const json = await res.json();
      return json.data as LeaveConflictAlert[];
    },
    enabled: !!organizationId,
  });
}

export function useReviewConflictAlert() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      alertId: string;
      adminId: string;
      isApproved: boolean;
      reviewNotes?: string;
    }) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review-conflict-alert', ...data }),
      });
      if (!res.ok) throw new Error(t('hooks.events.failedToReviewAlert', 'Failed to review alert'));
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', 'leave-conflicts'] });
    },
  });
}

export function useCreateCompanyEvent() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      userId: string;
      name: string;
      description?: string;
      startDate: string | number;
      endDate: string | number;
      isAllDay?: boolean;
      eventType: string;
      priority?: 'high' | 'medium' | 'low';
      requiredDepartments: string[];
      notifyDaysBefore?: number;
    }) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-company-event', ...data }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || t('hooks.events.failedToCreateCompanyEvent', 'Failed to create company event'));
      }
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCheckLeaveConflictsManual() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      leaveRequestId: string;
      userId: string;
      startDate: string | number;
      endDate: string | number;
      organizationId: string;
    }) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-leave-conflicts-manual', ...data }),
      });
      if (!res.ok) throw new Error(t('hooks.events.failedToCheckLeaveConflicts', 'Failed to check leave conflicts'));
      const json = await res.json();
      return json;
    },
  });
}
