import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'high' | 'medium' | 'low';

interface CompanyEvent {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  startDate: number;
  endDate: number;
  priority?: Priority;
  eventType: string;
  requiredDepartments?: string[];
  createdAt: number;
  isAllDay?: boolean;
}

interface LeaveConflict {
  id: string;
  leaveRequestId: string;
  eventId: string;
  userId: string;
  userName: string;
  startDate: number;
  endDate: number;
  conflictType: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useCompanyEvents(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'events', organizationId],
    queryFn: async () => {
      const url = new URL('/api/admin/events', window.location.origin);
      url.searchParams.set('organizationId', organizationId ?? '');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch company events');
      return res.json() as Promise<CompanyEvent[]>;
    },
    enabled: !!organizationId,
  });
}

export function usePendingLeaves(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'leaves', 'pending', organizationId],
    queryFn: async () => {
      const url = new URL('/api/admin/events', window.location.origin);
      url.searchParams.set('type', 'pending-leaves');
      url.searchParams.set('organizationId', organizationId!);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch pending leaves');
      return res.json() as Promise<any[]>;
    },
    enabled: !!organizationId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateCompanyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      userId: string;
      name: string;
      description?: string;
      startDate: number;
      endDate: number;
      priority?: Priority;
      eventType: string;
      requiredDepartments?: string[];
      isAllDay?: boolean;
    }) => {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create event');
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', variables.organizationId] });
    },
  });
}

export function useUpdateCompanyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventId: string;
      userId: string;
      name?: string;
      description?: string;
      startDate?: number;
      endDate?: number;
      priority?: Priority;
      eventType?: string;
      location?: string;
      requiredDepartments?: string[];
      isAllDay?: boolean;
    }) => {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update event');
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useDeleteCompanyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { eventId: string; userId: string }) => {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
  });
}

export function useCheckLeaveConflicts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      leaveRequestId: string;
      userId: string;
      startDate: number;
      endDate: number;
      organizationId: string;
    }) => {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-conflicts',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to check conflicts');
      }

      return res.json() as Promise<{ conflictsFound: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leaves', 'conflicts'] });
    },
  });
}
