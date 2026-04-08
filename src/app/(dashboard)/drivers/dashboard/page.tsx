'use client';

/**
 * Driver Dashboard - For drivers only
 * Shows: pending requests, today's schedule, shift management
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  Clock,
  TrendingUp,
  Star,
  ThumbsUp,
  ThumbsDown,
  Users,
  Timer,
  MapPinned,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DriverStatsCard } from '@/components/drivers/DriverStatsCard';
import { DriverShiftControls } from '@/components/drivers/DriverShiftControls';
import { ShiftHistory } from '@/components/drivers/ShiftHistory';
import { DriverCalendar } from '@/components/drivers/DriverCalendar';
import {
  NavigatorDropdown,
  InAppCallButton,
  DriverQuickMessage,
} from '@/components/drivers/DriverActions';

export default function DriverDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const userId = user?.id as Id<'users'> | undefined;
  const orgId = user?.organizationId as Id<'organizations'> | undefined;

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Check if user is a driver
  const driver = useQuery(api.drivers.queries.getDriverByUserId, userId ? { userId } : 'skip');

  // Redirect if not a driver
  useEffect(() => {
    if (driver === null && userId) {
      router.push('/drivers');
    }
  }, [driver, userId, router]);

  // Data queries
  const pendingRequests = useQuery(
    api.drivers.requests_queries.getDriverRequests,
    driver ? { driverId: driver._id, status: 'pending' as const } : 'skip',
  );

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const todayEnd = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);

  const todaySchedule = useQuery(
    api.drivers.queries.getDriverSchedule,
    driver ? { driverId: driver._id, startTime: todayStart, endTime: todayEnd } : 'skip',
  );

  // Mutations
  const respondToRequest = useMutation(api.drivers.requests_mutations.respondToDriverRequest);
  const updateAvailability = useMutation(api.drivers.driver_registration.updateDriverAvailability);
  const markArrived = useMutation(api.drivers.driver_operations.markDriverArrived);
  const markPickedUp = useMutation(api.drivers.driver_operations.markPassengerPickedUp);

  // Handlers
  const handleRespond = async (requestId: Id<'driverRequests'>, approved: boolean) => {
    if (!driver || !userId) return;
    try {
      await respondToRequest({
        requestId,
        driverId: driver._id,
        userId,
        approved,
        declineReason: approved ? undefined : 'Declined by driver',
      });
      toast.success(
        approved
          ? t('driver.requestApproved', 'Request approved!')
          : t('driver.requestDeclined', 'Request declined!'),
      );
    } catch (error: any) {
      toast.error(error.message || t('driver.failedToRespond', 'Failed to respond'));
    }
  };

  const handleToggleAvailability = async (checked: boolean) => {
    if (!driver) return;
    try {
      await updateAvailability({ driverId: driver._id, isAvailable: checked });
      toast.success(
        checked
          ? t('driver.youAreNowAvailable', 'You are now available')
          : t('driver.youAreNowUnavailable', 'You are now unavailable'),
      );
    } catch (error: any) {
      toast.error(
        error.message || t('driver.failedToUpdateAvailability', 'Failed to update availability'),
      );
    }
  };

  // Loading
  if (driver === undefined || pendingRequests === undefined || todaySchedule === undefined) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <ShieldLoader size="lg" />
      </div>
    );
  }

  if (!driver) {
    return null;
  }

  const todayTrips =
    todaySchedule?.filter((s) => s.type === 'trip' && s.status === 'scheduled').length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div
        className="relative p-6 mb-6 rounded-2xl overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)',
        }}
      >
        <div
          className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white"
              style={{ textShadow: '0 2px 20px rgba(0,0,0,0.15)' }}
            >
              {t('driver.dashboard', 'Driver Dashboard')}
            </h1>
            <p className="text-sm sm:text-base mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {t('driver.dashboardDesc', 'Manage your trips and availability')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80">
              {driver.isAvailable ? t('driver.available') : t('driver.busy')}
            </span>
            <Switch checked={driver.isAvailable} onCheckedChange={handleToggleAvailability} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-8 drivers-stagger">
        <StatCard
          label={t('driver.todayTrips', "Today's Trips")}
          value={todayTrips}
          icon={Calendar}
          gradientFrom="#3b82f6"
          gradientTo="#2563eb"
        />
        <StatCard
          label={t('driver.pendingRequests', 'Pending')}
          value={pendingRequests?.length ?? 0}
          icon={Clock}
          gradientFrom="#f59e0b"
          gradientTo="#d97706"
        />
        <StatCard
          label={t('driver.totalCompleted', 'Completed')}
          value={driver.totalTrips ?? 0}
          icon={TrendingUp}
          gradientFrom="#22c55e"
          gradientTo="#16a34a"
        />
        <StatCard
          label={t('driver.rating', 'Rating')}
          value={driver.rating?.toFixed(1) ?? '5.0'}
          icon={Star}
          gradientFrom="#eab308"
          gradientTo="#ca8a04"
        />
      </div>

      {/* Shift Management */}
      <DriverShiftControls driverId={driver._id} userId={userId!} organizationId={orgId!} />

      {/* Pending Requests */}
      <Card className="mb-8 border-[var(--border)]">
        <CardHeader>
          <h2 className="text-xl font-semibold">
            {t('driver.pendingRequests', 'Pending Requests')}
          </h2>
        </CardHeader>
        <CardContent>
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {pendingRequests.map((request: any) => (
                <div
                  key={request._id}
                  className="p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        {request.requesterAvatar && <AvatarImage src={request.requesterAvatar} />}
                        <AvatarFallback>
                          {request.requesterName
                            ?.split(' ')
                            .map((n: string) => n[0])
                            .join('') ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">
                          {request.requesterName ?? 'Unknown'}
                        </h3>
                        <p className="text-sm text-[var(--text-muted)]">
                          {request.tripInfo.from} → {request.tripInfo.to}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {format(new Date(request.startTime), 'MMM dd, HH:mm')} -{' '}
                          {format(new Date(request.endTime), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespond(request._id, false)}
                      >
                        <ThumbsDown className="w-4 h-4 mr-1" /> {t('driver.decline', 'Decline')}
                      </Button>
                      <Button size="sm" onClick={() => handleRespond(request._id, true)}>
                        <ThumbsUp className="w-4 h-4 mr-1" /> {t('driver.approve', 'Approve')}
                      </Button>
                    </div>
                  </div>
                  {/* Quick actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {request.requesterId && (
                      <InAppCallButton
                        callerUserId={userId!}
                        callerName={driver.userName || 'Driver'}
                        remoteUserId={request.requesterId}
                        remoteName={request.requesterName || 'Passenger'}
                        remotePhone={request.requesterPhone}
                        organizationId={orgId!}
                      />
                    )}
                    {request.requesterId && (
                      <DriverQuickMessage
                        passengerUserId={request.requesterId}
                        passengerName={request.requesterName}
                        driverUserId={userId!}
                        organizationId={orgId!}
                        tripInfo={request.tripInfo}
                      />
                    )}
                    {request.tripInfo.pickupCoords && (
                      <NavigatorDropdown
                        label={t('driver.pickup', 'Pickup')}
                        coords={request.tripInfo.pickupCoords}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('driver.noRequests', 'No pending requests')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card className="mb-8 border-[var(--border)]">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t('driver.todaySchedule', "Today's Schedule")}</h2>
        </CardHeader>
        <CardContent>
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule
                .sort((a, b) => a.startTime - b.startTime)
                .map((schedule: any) => (
                  <div
                    key={schedule._id}
                    className="flex gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all duration-300"
                  >
                    <div
                      className={`w-2 shrink-0 rounded-full ${
                        schedule.status === 'scheduled'
                          ? 'bg-blue-500'
                          : schedule.status === 'completed'
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                      }`}
                      style={{
                        boxShadow:
                          schedule.status === 'scheduled'
                            ? '0 0 12px rgba(59, 130, 246, 0.5)'
                            : schedule.status === 'completed'
                              ? '0 0 12px rgba(34, 197, 94, 0.5)'
                              : undefined,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base">
                            {format(new Date(schedule.startTime), 'HH:mm')} -{' '}
                            {format(new Date(schedule.endTime), 'HH:mm')}
                          </span>
                          <Badge variant={schedule.type === 'trip' ? 'default' : 'secondary'}>
                            {schedule.type}
                          </Badge>
                        </div>
                      </div>
                      {schedule.tripInfo && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                          {schedule.tripInfo.from} → {schedule.tripInfo.to}
                        </p>
                      )}
                      {schedule.userName && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {t('driver.passenger', 'Passenger')}: {schedule.userName}
                        </p>
                      )}
                      {/* Actions */}
                      {schedule.type === 'trip' &&
                        (schedule.status === 'scheduled' || schedule.status === 'in_progress') && (
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {schedule.status === 'scheduled' && !schedule.arrivedAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 px-2 text-xs bg-green-50 border-green-200 text-green-700"
                                onClick={async () => {
                                  try {
                                    await markArrived({
                                      scheduleId: schedule._id,
                                      userId: userId!,
                                    });
                                    toast.success(
                                      t('driver.markedAsArrived', 'Marked as arrived!'),
                                    );
                                  } catch (e: any) {
                                    toast.error(e.message);
                                  }
                                }}
                              >
                                <MapPinned className="w-3 h-3" />
                                {t('driver.arrived', "I've Arrived")}
                              </Button>
                            )}
                            {schedule.arrivedAt && !schedule.passengerPickedUpAt && (
                              <>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-yellow-50 border-yellow-200"
                                >
                                  <Timer className="w-3 h-3 mr-1" />
                                  {t('driver.waiting', 'Waiting')}:{' '}
                                  {Math.round((currentTime - schedule.arrivedAt) / 60000)}{' '}
                                  {t('driver.minutes', 'min')}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-7 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700"
                                  onClick={async () => {
                                    try {
                                      await markPickedUp({
                                        scheduleId: schedule._id,
                                        userId: userId!,
                                      });
                                      toast.success(
                                        t('driver.passengerPickedUp', 'Passenger picked up!'),
                                      );
                                    } catch (e: any) {
                                      toast.error(e.message);
                                    }
                                  }}
                                >
                                  <Users className="w-3 h-3" />
                                  {t('driver.passengerIn', 'Passenger In')}
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('driver.noSchedule', 'No trips scheduled for today')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Calendar */}
      <Card className="mb-8 border-[var(--border)]">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t('driver.weeklySchedule', 'Weekly Schedule')}</h2>
        </CardHeader>
        <CardContent>
          <DriverCalendar driverId={driver._id} organizationId={orgId!} />
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card className="mb-8 border-[var(--border)]">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t('driver.tripStatistics', 'Trip Statistics')}</h2>
        </CardHeader>
        <CardContent>
          <DriverStatsCard driverId={driver._id} organizationId={orgId!} />
        </CardContent>
      </Card>

      {/* Shift History */}
      <Card className="mb-8 border-[var(--border)]">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t('driver.shiftHistory', 'Shift History')}</h2>
        </CardHeader>
        <CardContent>
          <ShiftHistory driverId={driver._id} />
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component
function StatCard({
  label,
  value,
  icon: Icon,
  gradientFrom,
  gradientTo,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <Card className="drivers-card-hover relative overflow-hidden border-[var(--border)]">
      <div className="drivers-stats-shimmer absolute inset-0 pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <h3 className="text-sm font-medium text-[var(--text-muted)]">{label}</h3>
        <div className="p-2 rounded-lg" style={{ background: `${gradientFrom}15` }}>
          <Icon className="w-4 h-4" style={{ color: gradientFrom }} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
          className="text-2xl font-bold"
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
