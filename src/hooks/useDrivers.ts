import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VehicleInfo {
  model: string;
  plateNumber: string;
  capacity: number;
  color?: string;
  year?: number;
}

interface Driver {
  id: string;
  userName: string;
  userAvatar?: string;
  userPosition?: string;
  rating: number;
  totalTrips: number;
  isOnShift?: boolean;
  isAvailable: boolean;
  isActive: boolean;
  organizationId: string;
  vehicleInfo?: VehicleInfo | null;
}

interface ScheduleItem {
  id: string;
  driverId: string;
  type: string;
  status: string;
  startTime: number;
  endTime: number;
  tripInfo?: {
    from?: string;
    to?: string;
    purpose?: string;
  };
  reason?: string;
  userName?: string;
}

interface DriverRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  driverId?: string;
  status: string;
  startTime: number;
  endTime: number;
  tripInfo?: {
    from: string;
    to: string;
    purpose: string;
    passengerCount: number;
    notes?: string;
  };
  assignedDriver?: {
    userName: string;
  };
  createdAt: number;
}

interface RecurringTrip {
  id: string;
  organizationId: string;
  userId: string;
  driverId: string;
  isActive: boolean;
  tripInfo?: {
    from: string;
    to: string;
    purpose: string;
    passengerCount: number;
  };
  schedule: {
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
  };
  createdAt: number;
  updatedAt: number;
  driverName?: string;
  driverVehicle?: VehicleInfo | null;
}

interface DriverShift {
  id: string;
  organizationId: string;
  driverId: string;
  startTime: number;
  endTime?: number;
  isActive: boolean;
  status?: string;
  tripsCompleted?: number;
  totalDistance?: number;
  totalDuration?: number;
  createdAt: number;
}

interface FavoriteDriver {
  id: string;
  passengerId: string;
  driverId: string;
  driver?: Driver;
}

interface DriverStats {
  totalTrips: number;
  totalWorkedHours: number;
  totalDistance?: number;
}

// ─── Available Drivers ───────────────────────────────────────────────────────

export function useAvailableDrivers(organizationId: string | undefined, date?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'available', organizationId, date],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'available-drivers');
      url.searchParams.set('organizationId', organizationId!);
      if (date) url.searchParams.set('date', date);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchAvailableDrivers', 'Failed to fetch available drivers'));
      return res.json() as Promise<Driver[]>;
    },
    enabled: !!organizationId,
  });
}

// ─── Driver Schedules ────────────────────────────────────────────────────────

export function useDriverSchedules(
  driverId: string | undefined,
  startTime?: number,
  endTime?: number,
) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'schedules', driverId, startTime, endTime],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'driver-schedules');
      url.searchParams.set('driverId', driverId!);
      if (startTime) url.searchParams.set('startDate', String(startTime));
      if (endTime) url.searchParams.set('endDate', String(endTime));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchSchedules', 'Failed to fetch driver schedules'));
      return res.json() as Promise<ScheduleItem[]>;
    },
    enabled: !!driverId,
  });
}

// ─── Driver Requests ─────────────────────────────────────────────────────────

export function useDriverRequests(organizationId: string | undefined, status?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'requests', organizationId, status],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'driver-requests');
      url.searchParams.set('organizationId', organizationId!);
      if (status) url.searchParams.set('status', status);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchRequests', 'Failed to fetch driver requests'));
      return res.json() as Promise<DriverRequest[]>;
    },
    enabled: !!organizationId,
  });
}

export function useMyRequests(userId: string | undefined) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'my-requests', userId],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'driver-requests');
      url.searchParams.set('userId', userId!);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchMyRequests', 'Failed to fetch my requests'));
      return res.json() as Promise<DriverRequest[]>;
    },
    enabled: !!userId,
  });
}

// ─── Recurring Trips ─────────────────────────────────────────────────────────

export function useRecurringTrips(organizationId: string | undefined) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'recurring-trips', organizationId],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'recurring-trips');
      url.searchParams.set('organizationId', organizationId!);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchRecurringTrips', 'Failed to fetch recurring trips'));
      return res.json() as Promise<RecurringTrip[]>;
    },
    enabled: !!organizationId,
  });
}

// ─── Driver Shifts ───────────────────────────────────────────────────────────

export function useDriverShifts(organizationId?: string, driverId?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'shifts', organizationId, driverId],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'driver-shifts');
      if (organizationId) url.searchParams.set('organizationId', organizationId);
      if (driverId) url.searchParams.set('driverId', driverId);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchShifts', 'Failed to fetch driver shifts'));
      return res.json() as Promise<DriverShift[]>;
    },
    enabled: !!organizationId || !!driverId,
  });
}

// ─── Favorite Drivers ────────────────────────────────────────────────────────

export function useFavoriteDrivers(userId: string | undefined) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'favorites', userId],
    queryFn: async () => {
      const url = new URL('/api/drivers', window.location.origin);
      url.searchParams.set('type', 'driver-favorites');
      url.searchParams.set('userId', userId!);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchFavorites', 'Failed to fetch favorite drivers'));
      return res.json() as Promise<FavoriteDriver[]>;
    },
    enabled: !!userId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateDriverRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      driverId: string;
      startTime: number;
      endTime: number;
      tripInfo: {
        from: string;
        to: string;
        purpose: string;
        passengerCount: number;
        notes?: string;
      };
    }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create-request',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToCreateRequest', 'Failed to create request'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', 'my-requests'] });
    },
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { requestId: string; status: string }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update-request-status',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToUpdateRequestStatus', 'Failed to update request status'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', 'my-requests'] });
    },
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      driverId: string;
      type: string;
      startTime: number;
      endTime: number;
      tripInfo?: any;
      reason?: string;
    }) => {
      const { type: _, ...restData } = data;
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create-schedule',
          ...restData,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToCreateSchedule', 'Failed to create schedule'));
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['drivers', 'schedules', variables.driverId],
      });
    },
  });
}

export function useUpdateScheduleStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { scheduleId: string; status: string }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update-schedule-status',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToUpdateScheduleStatus', 'Failed to update schedule status'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'schedules'] });
    },
  });
}

export function useSubmitRating() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      scheduleId: string;
      requestId?: string;
      passengerId: string;
      driverId: string;
      organizationId: string;
      rating: number;
      comment?: string;
    }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'submit-rating',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToSubmitRating', 'Failed to submit rating'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'requests'] });
    },
  });
}

export function useCreateRecurringTrip() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      driverId: string;
      tripInfo: any;
      schedule: {
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
      };
    }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create-recurring-trip',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToCreateRecurringTrip', 'Failed to create recurring trip'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'recurring-trips'] });
    },
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      driverId: string;
      startTime: number;
      endTime?: number;
    }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create-shift',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToCreateShift', 'Failed to create shift'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'shifts'] });
    },
  });
}

export function useEndShift() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { shiftId: string; endTime?: string }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'end-shift',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToEndShift', 'Failed to end shift'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'shifts'] });
    },
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { organizationId: string; userId: string; driverId: string }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'add-favorite',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToAddFavorite', 'Failed to add favorite'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'favorites'] });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { userId: string; driverId: string }) => {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'remove-favorite',
          ...data,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.drivers.failedToRemoveFavorite', 'Failed to remove favorite'));
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'favorites'] });
    },
  });
}

export function useIsDriverOnLeave(
  driverId: string | undefined,
  startTime: number | undefined,
  endTime: number | undefined,
  enabled = true,
) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'is-on-leave', driverId, startTime, endTime],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'is-driver-on-leave',
        driverId: driverId!,
        startTime: String(startTime!),
        endTime: String(endTime!),
      });
      const res = await fetch(`/api/drivers/available?${params}`);
      if (!res.ok) throw new Error(t('hooks.drivers.failedToCheckLeaveStatus', 'Failed to check driver leave status'));
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!driverId && !!startTime && !!endTime,
    refetchInterval: 5000,
  });
}

export function useAlternativeDrivers(
  organizationId: string | undefined,
  startTime: number | undefined,
  endTime: number | undefined,
  excludeDriverId: string | undefined,
  enabled = true,
) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['drivers', 'alternative', organizationId, startTime, endTime, excludeDriverId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-alternative-drivers',
        organizationId: organizationId!,
        startTime: String(startTime!),
        endTime: String(endTime!),
        excludeDriverId: excludeDriverId!,
      });
      const res = await fetch(`/api/drivers/available?${params}`);
      if (!res.ok) throw new Error(t('hooks.drivers.failedToFetchAlternativeDrivers', 'Failed to fetch alternative drivers'));
      const json = await res.json();
      return json.data as Driver[];
    },
    enabled:
      enabled && !!organizationId && !!startTime && !!endTime && !!excludeDriverId,
  });
}

