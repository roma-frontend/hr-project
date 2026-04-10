'use client';

import './drivers-animations.css';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { DriverBookingPage } from '@/components/drivers/sections';
import { RequestDriverWizard } from '@/components/drivers/RequestDriverWizard';
import {
  RegisterDriverModal,
  DriverCalendarDialog,
  TripDetailsModal,
} from '@/components/drivers/modals';
import { toast } from 'sonner';

// @ts-ignore - Convex drivers API type causes infinite instantiation
const driversApi = (api as any).drivers;

export default function DriversPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  // ═══════════════════════════════════════════════════════════════════════════
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY, IN SAME ORDER, EVERY RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. State hooks
  const [searchQuery, setSearchQuery] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'name' | 'availability'>('rating');
  const [showRequestWizard, setShowRequestWizard] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const userId = user?.id as Id<'users'> | undefined;
  const orgId = user?.organizationId as Id<'organizations'> | undefined;

  // 2. Mutation hooks
  const addFavorite = useMutation(driversApi.driver_registration.addFavoriteDriver);
  const removeFavorite = useMutation(driversApi.driver_registration.removeFavoriteDriver);
  const registerAsDriver = useMutation(driversApi.driver_registration.registerAsDriver);

  // 3. Effect hooks
  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && user && !orgId) router.push('/onboarding/select-organization');
  }, [isAuthenticated, user, orgId, router]);

  // 4. Query hooks
  const driverRecord = useQuery(
    driversApi.queries.getDriverByUserId,
    userId && orgId ? { userId } : 'skip',
  );

  const availableDrivers = useQuery(
    driversApi.queries.getAvailableDrivers,
    orgId ? { organizationId: orgId } : 'skip',
  );

  const myRequests = useQuery(
    driversApi.requests_queries.getMyRequests,
    userId ? { userId } : 'skip',
  );

  const favoriteDrivers = useQuery(
    driversApi.requests_queries.getFavoriteDrivers,
    userId ? { userId } : 'skip',
  );

  // Optimistic favorite IDs state
  const [optimisticFavoriteIds, setOptimisticFavoriteIds] = useState<Set<string>>(() => new Set());
  const [initialized, setInitialized] = useState(false);

  // Initialize optimistic state ONCE when query first loads
  useEffect(() => {
    if (favoriteDrivers && !initialized) {
      // getFavoriteDrivers returns enriched driver objects with _id = driver._id
      setOptimisticFavoriteIds(new Set((favoriteDrivers as any[]).map((f: any) => f._id)));
      setInitialized(true);
    }
  }, [favoriteDrivers, initialized]);

  const recurringTrips = useQuery(
    driversApi.recurring_trips.getRecurringTrips,
    userId ? { userId } : 'skip',
  );

  // 5. Redirect effect
  useEffect(() => {
    if (driverRecord && user?.role !== 'admin' && user?.role !== 'superadmin') {
      router.replace('/drivers/dashboard');
    }
  }, [driverRecord, router, user?.role]);

  // 6. Memo hooks (MUST be before early returns!)
  const favoriteIds = useMemo(() => optimisticFavoriteIds, [optimisticFavoriteIds]);

  const drivers = useMemo(
    () =>
      (availableDrivers ?? []).map((d: any) => ({
        _id: d._id,
        userName: d.userName,
        userAvatar: d.userAvatar,
        userPosition: d.userPosition,
        rating: d.rating ?? 5.0,
        totalTrips: d.totalTrips ?? 0,
        isOnShift: d.isOnShift,
        vehicleInfo: d.vehicleInfo ?? { model: 'Unknown', capacity: 4, plateNumber: 'N/A' },
      })),
    [availableDrivers],
  );

  const activeRequests = useMemo(
    () => (myRequests ?? []).filter((r: any) => r.status === 'pending' || r.status === 'approved'),
    [myRequests],
  );

  const historyRequests = useMemo(
    () =>
      (myRequests ?? []).filter((r: any) => r.status === 'completed' || r.status === 'cancelled'),
    [myRequests],
  );

  const recurringData = useMemo(
    () =>
      (recurringTrips ?? []).map((trip: any) => ({
        _id: trip._id,
        isActive: trip.isActive ?? true,
        days: trip.days ?? [1, 2, 3, 4, 5],
        startTime: trip.startTime ?? '08:00',
        endTime: trip.endTime ?? '09:00',
        tripInfo: { from: trip.tripInfo?.from ?? 'Unknown', to: trip.tripInfo?.to ?? 'Unknown' },
      })),
    [recurringTrips],
  );

  const stats = useMemo(
    () => ({
      availableDrivers: (availableDrivers ?? []).filter((d: any) => d.isAvailable).length,
      pendingRequests: (myRequests ?? []).filter((r: any) => r.status === 'pending').length,
      totalTrips: (myRequests ?? []).filter((r: any) => r.status === 'approved').length,
    }),
    [availableDrivers, myRequests],
  );

  // 7. Effect for scroll blocking when wizard or trip details are open
  useEffect(() => {
    if (showRequestWizard || showTripDetails) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      const mainContent = document.querySelector<HTMLElement>('main, [role="main"]');
      if (mainContent) mainContent.style.overflow = 'hidden';

      const preventScroll = (e: WheelEvent | TouchEvent) => {
        const target = e.target as HTMLElement;
        const isInsideModal = target.closest('[class*="max-h-"]');
        if (!isInsideModal) e.preventDefault();
      };
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchmove', preventScroll, { passive: false });

      return () => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        if (mainContent) mainContent.style.overflow = '';
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchmove', preventScroll);
      };
    }
  }, [showRequestWizard, showTripDetails]);

  // 8. Callback hooks (MUST be before early returns!)
  const handleBook = useCallback((id: string) => {
    setSelectedDriverId(id);
    setShowRequestWizard(true);
  }, []);

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      if (!userId || !orgId) return;

      // Optimistic update
      const wasFavorite = optimisticFavoriteIds.has(id);
      const newSet = new Set(optimisticFavoriteIds);
      if (wasFavorite) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      setOptimisticFavoriteIds(newSet);

      try {
        if (wasFavorite) {
          await removeFavorite({ userId, driverId: id as Id<'drivers'> });
          toast.success(t('driver.removedFromFavorites', 'Removed from favorites'));
        } else {
          await addFavorite({ organizationId: orgId, userId, driverId: id as Id<'drivers'> });
          toast.success(t('driver.addedToFavorites', 'Added to favorites'));
        }
      } catch (e: any) {
        // Revert on error
        setOptimisticFavoriteIds(optimisticFavoriteIds);
        toast.error(e.message || t('driver.failed', 'Failed'));
      }
    },
    [userId, orgId, optimisticFavoriteIds, addFavorite, removeFavorite, t],
  );

  const handleRequestDriver = useCallback(() => {
    setSelectedDriverId(null);
    setShowRequestWizard(true);
  }, []);

  const handleRegisterSubmit = useCallback(
    async (data: any) => {
      if (!userId || !orgId) return;
      try {
        await registerAsDriver({
          userId,
          organizationId: orgId,
          vehicleInfo: {
            model: data.vehicleMake || '',
            year: data.vehicleYear ? parseInt(data.vehicleYear) : 2024,
            color: data.vehicleColor || '',
            plateNumber: data.licensePlate || '',
            capacity: data.maxPassengers || 4,
          },
          workingHours: {
            startTime: '09:00',
            endTime: '18:00',
            workingDays: [1, 2, 3, 4, 5],
          },
          maxTripsPerDay: data.maxTripsPerDay || 3,
        });
        toast.success(t('driver.registered', 'Registered as driver!'));
        setShowRegisterModal(false);
      } catch (e: any) {
        toast.error(e.message || t('driver.failedToRegister', 'Failed to register'));
      }
    },
    [userId, orgId, registerAsDriver, t],
  );

  const noOp = useCallback(() => {}, []);
  const closeModal = useCallback(() => {
    setShowRequestWizard(false);
    setSelectedDriverId(null);
  }, []);
  const closeRegisterModal = useCallback(() => setShowRegisterModal(false), []);

  // ═══════════════════════════════════════════════════════════════════════════
  // NOW EARLY RETURNS ARE SAFE (all hooks are above)
  // ═══════════════════════════════════════════════════════════════════════════

  if (
    !isAuthenticated ||
    !userId ||
    !orgId ||
    driverRecord === undefined ||
    availableDrivers === undefined ||
    myRequests === undefined ||
    favoriteDrivers === undefined ||
    recurringTrips === undefined
  ) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  if (driverRecord && user?.role !== 'admin' && user?.role !== 'superadmin') {
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <DriverBookingPage
        drivers={drivers}
        activeRequests={activeRequests}
        historyRequests={historyRequests}
        recurringTrips={recurringData}
        favoriteIds={favoriteIds}
        stats={stats}
        searchQuery={searchQuery}
        capacityFilter={capacityFilter}
        sortBy={sortBy}
        onSearchChange={setSearchQuery}
        onCapacityChange={setCapacityFilter}
        onSortChange={setSortBy}
        onBook={handleBook}
        onCalendar={(id: string) => {
          setSelectedDriverId(id);
          setShowCalendarDialog(true);
        }}
        onToggleFavorite={handleToggleFavorite}
        onRequestDriver={handleRequestDriver}
        onViewRequestDetails={(request) => {
          setSelectedRequest(request);
          setShowTripDetails(true);
        }}
        onRateRequest={noOp}
        onEditRequest={noOp}
        onDeleteRequest={noOp}
        onCancelRequest={noOp}
        onToggleRecurring={noOp}
        onDeleteRecurring={noOp}
        onRegisterAsDriver={() => setShowRegisterModal(true)}
        canRegisterDrivers={user?.role === 'admin'}
      />

      {showRequestWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('driver.requestDriver', 'Request Driver')}</h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-[var(--background-subtle)] transition-colors"
              >
                ✕
              </button>
            </div>
            <RequestDriverWizard userId={userId!} onComplete={closeModal} onCancel={closeModal} />
          </div>
        </div>
      )}

      {showRegisterModal && (
        <RegisterDriverModal
          userName={user?.name ?? ''}
          userEmail={user?.email ?? ''}
          userPhone={user?.phone}
          onSubmit={handleRegisterSubmit}
          onClose={closeRegisterModal}
        />
      )}

      {showCalendarDialog && orgId && (
        <DriverCalendarDialog
          open={showCalendarDialog}
          onClose={() => setShowCalendarDialog(false)}
          driverId={selectedDriverId}
          organizationId={orgId}
        />
      )}

      {showTripDetails && selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTripDetails(false);
              setSelectedRequest(null);
            }
          }}
        >
          <div className="w-full max-w-2xl min-h-screen sm:min-h-0 flex items-center justify-center">
            <TripDetailsModal
              schedule={{
                type: 'trip',
                status: selectedRequest.status,
                startTime: selectedRequest.startTime || Date.now(),
                endTime: selectedRequest.startTime
                  ? selectedRequest.startTime + 3600000
                  : Date.now() + 3600000,
                tripInfo: selectedRequest.tripInfo || {},
                userName: selectedRequest.assignedDriver?.userName,
              }}
              currentTime={Date.now()}
              onClose={() => {
                setShowTripDetails(false);
                setSelectedRequest(null);
              }}
              userId={userId!}
            />
          </div>
        </div>
      )}
    </>
  );
}
