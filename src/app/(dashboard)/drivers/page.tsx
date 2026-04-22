'use client';

import './drivers-animations.css';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrgSelectorStore } from '@/store/useOrgSelectorStore';
import { useTranslation } from 'react-i18next';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { DriverBookingPage } from '@/components/drivers/sections';
import { RequestDriverWizard } from '@/components/drivers/RequestDriverWizard';
import {
  RegisterDriverModal,
  SelectDriverModal,
  DriverCalendarDialog,
  TripDetailsModal,
} from '@/components/drivers/modals';
import { toast } from 'sonner';
import {
  useAvailableDrivers,
  useMyRequests,
  useFavoriteDrivers,
  useRecurringTrips,
  useAddFavorite,
  useRemoveFavorite,
} from '@/hooks/useDrivers';
import { format, type Locale } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';

interface VehicleInfo {
  model: string;
  plateNumber: string;
  capacity: number;
  color?: string;
  year?: number;
}

interface TripRequest {
  id: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed';
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
}

export default function DriversPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { selectedOrgId: storeSelectedOrgId } = useOrgSelectorStore();

  const dateFnsLocale: Locale = {
    en: enUS,
    ru: ru,
    hy: hy,
  }[i18n.language] || enUS;

  const [searchQuery, setSearchQuery] = useState('');
  const [capacityFilter, setCapacityFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'name' | 'availability'>('rating');
  const [showRequestWizard, setShowRequestWizard] = useState(false);
  const [showSelectDriverModal, setShowSelectDriverModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedDriverCandidate, setSelectedDriverCandidate] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null>(null);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TripRequest | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const userId = user?.id as string | undefined;
  const orgId = user?.organizationId as string | undefined;
  const isSuperadmin = user?.role === 'superadmin';
  const effectiveOrgId = isSuperadmin ? (storeSelectedOrgId as string | undefined) : orgId;

  const addFavoriteMutation = useAddFavorite();
  const removeFavoriteMutation = useRemoveFavorite();

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && user && !isSuperadmin && !effectiveOrgId) router.push('/onboarding/select-organization');
  }, [isAuthenticated, user, isSuperadmin, effectiveOrgId, router]);

  const { data: availableDrivers, isLoading: isLoadingDrivers } = useAvailableDrivers(effectiveOrgId);
  const { data: myRequests, isLoading: isLoadingRequests } = useMyRequests(userId);
  const { data: favoriteDrivers, isLoading: isLoadingFavorites } = useFavoriteDrivers(userId);
  const { data: recurringTrips, isLoading: isLoadingRecurring } = useRecurringTrips(effectiveOrgId);

  const [optimisticFavoriteIds, setOptimisticFavoriteIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (favoriteDrivers) {
      setOptimisticFavoriteIds(new Set(favoriteDrivers.map((f: any) => f.driverId)));
    }
  }, [favoriteDrivers]);

  useEffect(() => {
    if (availableDrivers && user?.role !== 'admin' && user?.role !== 'superadmin') {
      const hasDriverRecord = availableDrivers.length > 0;
      if (hasDriverRecord) {
        router.replace('/drivers/dashboard');
      }
    }
  }, [availableDrivers, router, user?.role]);

  const favoriteIds = useMemo(() => optimisticFavoriteIds, [optimisticFavoriteIds]);

  const drivers = useMemo(
    () =>
      (availableDrivers ?? []).filter(Boolean).map((d: any) => ({
        id: String(d.id),
        userName: d.userName,
        userAvatar: d.userAvatar,
        userPosition: d.userPosition,
        rating: d.rating ?? 5.0,
        totalTrips: d.totalTrips ?? 0,
        isOnShift: d.isOnShift,
        vehicleInfo: d.vehicleInfo ?? {
          model: t('common.unknown', 'Unknown'),
          capacity: 4,
          plateNumber: t('common.na', 'N/A'),
        },
      })),
    [availableDrivers, t],
  );

  const activeRequests = useMemo(
    () =>
      (myRequests ?? []).filter(
        (r: any) =>
          r.status === 'pending' ||
          r.status === 'approved',
      ),
    [myRequests],
  );

  const historyRequests = useMemo(
    () =>
      (myRequests ?? []).filter(
        (r: any) =>
          r.status === 'completed' ||
          r.status === 'cancelled',
      ),
    [myRequests],
  );

  const recurringData = useMemo(
    () =>
      (recurringTrips ?? []).map((trip: any) => ({
        id: String(trip.id),
        isActive: trip.isActive ?? true,
        days: trip.schedule?.daysOfWeek ?? [1, 2, 3, 4, 5],
        startTime: trip.schedule?.startTime ?? '08:00',
        endTime: trip.schedule?.endTime ?? '09:00',
        tripInfo: {
          from: trip.tripInfo?.from ?? t('common.unknown', 'Unknown'),
          to: trip.tripInfo?.to ?? t('common.unknown', 'Unknown'),
        },
      })),
    [recurringTrips, t],
  );

  const stats = useMemo(
    () => ({
      availableDrivers: (availableDrivers ?? []).filter(
        (d: any) => d.isAvailable,
      ).length,
      pendingRequests: (myRequests ?? []).filter(
        (r: any) => r.status === 'pending',
      ).length,
      totalTrips: (myRequests ?? []).filter((r: any) => r.status === 'approved')
        .length,
    }),
    [availableDrivers, myRequests],
  );

  useEffect(() => {
    if (showRequestWizard || showTripDetails || showCalendarDialog) {
      const mainEl = document.querySelector<HTMLElement>('main');
      const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;

      document.body.style.overflow = 'hidden';
      if (mainEl) {
        mainEl.style.overflow = 'hidden';
        mainEl.style.paddingRight = '0px';
      }

      return () => {
        document.body.style.overflow = '';
        if (mainEl) {
          mainEl.style.overflow = '';
          mainEl.style.paddingRight = '';
          mainEl.scrollTo({ top: scrollY, behavior: 'instant' });
        }
      };
    }
  }, [showRequestWizard, showTripDetails, showCalendarDialog]);

  const handleBook = useCallback((id: string) => {
    setSelectedDriverId(id);
    setShowRequestWizard(true);
    const mainEl = document.querySelector<HTMLElement>('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleViewRequestDetails = useCallback((request: any) => {
    setSelectedRequest(request);
    setShowTripDetails(true);
    const mainEl = document.querySelector<HTMLElement>('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      if (!userId || !effectiveOrgId) return;

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
          await removeFavoriteMutation.mutateAsync({ userId, driverId: id });
          toast.success(t('driver.removedFromFavorites', 'Removed from favorites'));
        } else {
          await addFavoriteMutation.mutateAsync({ organizationId: effectiveOrgId, userId, driverId: id });
          toast.success(t('driver.addedToFavorites', 'Added to favorites'));
        }
      } catch (e: unknown) {
        setOptimisticFavoriteIds(optimisticFavoriteIds);
        toast.error(e instanceof Error ? t('driver.error', { defaultValue: e.message }) : t('driver.failed', 'Failed'));
      }
    },
    [userId, effectiveOrgId, optimisticFavoriteIds, addFavoriteMutation, removeFavoriteMutation, t],
  );

  const handleRequestDriver = useCallback(() => {
    setSelectedDriverId(null);
    setShowRequestWizard(true);
  }, []);

  const handleOpenRegisterModal = useCallback(() => {
    setShowSelectDriverModal(true);
  }, []);

  const handleSelectDriver = useCallback(
    (driver: { id: string; name: string; email: string; phone?: string }) => {
      setSelectedDriverCandidate(driver);
      setShowSelectDriverModal(false);
      setShowRegisterModal(true);
    },
    [],
  );

  const handleRegisterSubmit = useCallback(
    async (data: {
      vehicleMake: string;
      vehicleModel: string;
      vehicleYear: string;
      vehicleColor: string;
      licensePlate: string;
      maxPassengers: number;
      vehicleType: string;
      notes?: string;
      availability: {
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
        sunday: boolean;
      };
      maxTripsPerDay?: number;
    }) => {
      if (!userId || !effectiveOrgId || !selectedDriverCandidate) return;
      try {
        const res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'register-driver',
            userId: selectedDriverCandidate.id,
            organizationId: effectiveOrgId,
            adminId: userId,
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
          }),
        });
        if (!res.ok) throw new Error(t('driver.failedToRegister', 'Failed to register driver'));
        toast.success(t('driver.registered', 'Registered as driver!'));
        setShowRegisterModal(false);
        setSelectedDriverCandidate(null);
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : t('driver.failedToRegister', 'Failed to register'),
        );
      }
    },
    [userId, effectiveOrgId, selectedDriverCandidate, t],
  );

  const noOp = useCallback(() => {}, []);
  const closeModal = useCallback(() => {
    setShowRequestWizard(false);
    setSelectedDriverId(null);
  }, []);
  const closeRegisterModal = useCallback(() => setShowRegisterModal(false), []);

  const [currentTime] = useState(() => Date.now());
  const tripModalTime = currentTime;

  const isLoading = isLoadingDrivers || isLoadingRequests || isLoadingFavorites || isLoadingRecurring;

  if (!isAuthenticated || !userId || !effectiveOrgId || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-100">
        <ShieldLoader size="lg" />
      </div>
    );
  }

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
        onViewRequestDetails={handleViewRequestDetails}
        onRateRequest={noOp}
        onEditRequest={noOp}
        onDeleteRequest={noOp}
        onCancelRequest={noOp}
        onToggleRecurring={noOp}
        onDeleteRecurring={noOp}
        onRegisterAsDriver={handleOpenRegisterModal}
        canRegisterDrivers={user?.role === 'admin'}
      />

      {showRequestWizard && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-(--card) rounded-2xl border border-(--border) shadow-2xl">
            <div className="p-6 border-b border-(--border) flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('driver.requestDriver', 'Request Driver')}</h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-(--background-subtle) transition-colors"
              >
                ✕
              </button>
            </div>
            <RequestDriverWizard userId={userId!} onComplete={closeModal} onCancel={closeModal} />
          </div>
        </div>
      )}

      {showSelectDriverModal && (
        <SelectDriverModal
          candidates={(availableDrivers ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            department: c.department,
            position: c.position,
          }))}
          onSelect={handleSelectDriver}
          onClose={() => setShowSelectDriverModal(false)}
        />
      )}

      {showRegisterModal && selectedDriverCandidate && (
        <RegisterDriverModal
          userName={selectedDriverCandidate.name}
          userEmail={selectedDriverCandidate.email}
          userPhone={selectedDriverCandidate.phone}
          onSubmit={handleRegisterSubmit}
          onClose={closeRegisterModal}
        />
      )}

      {showCalendarDialog && effectiveOrgId && (
        <div className="fixed inset-0 z-[9999]">
          <DriverCalendarDialog
            open={showCalendarDialog}
            onClose={() => setShowCalendarDialog(false)}
            driverId={selectedDriverId}
            organizationId={effectiveOrgId}
            role={user?.role as 'admin' | 'driver'}
          />
        </div>
      )}

      {showTripDetails && selectedRequest && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div
            className="w-full max-w-3xl rounded-2xl bg-(--card) shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '85vh' }}
          >
            <TripDetailsModal
              schedule={{
                type: 'trip',
                status: selectedRequest.status,
                startTime: selectedRequest.startTime || tripModalTime,
                endTime: selectedRequest.startTime
                  ? selectedRequest.startTime + 3600000
                  : tripModalTime + 3600000,
                tripInfo: selectedRequest.tripInfo || {},
                userName: selectedRequest.assignedDriver?.userName,
              }}
              currentTime={tripModalTime}
              onClose={() => {
                setShowTripDetails(false);
                setSelectedRequest(null);
              }}
              userId={userId!}
              isAdmin={user?.role === 'admin' || user?.role === 'superadmin'}
            />
          </div>
        </div>
      )}
    </>
  );
}
