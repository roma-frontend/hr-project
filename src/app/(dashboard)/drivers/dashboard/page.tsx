'use client';

/**
 * Driver Dashboard - For drivers only
 * Shows: pending requests, today's schedule, shift management
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { format, type Locale } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';
import { toast } from 'sonner';
import { DriverStatsCard } from '@/components/drivers/DriverStatsCard';
import { DriverShiftControls } from '@/components/drivers/DriverShiftControls';
import { ShiftHistory } from '@/components/drivers/ShiftHistory';
import { DriverCalendar } from '@/components/drivers/DriverCalendar';
import {
  NavigatorDropdown,
} from '@/components/drivers/DriverActions';
import {
  useDriverRequests,
  useDriverSchedules,
  useUpdateRequestStatus,
} from '@/hooks/useDrivers';

interface Driver {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  totalTrips: number;
  isAvailable: boolean;
  organizationId: string;
}

export default function DriverDashboardPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const dateFnsLocale: Locale = {
    en: enUS,
    ru: ru,
    hy: hy,
  }[i18n.language] || enUS;

  const userId = user?.id as string | undefined;
  const orgId = user?.organizationId as string | undefined;

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { t: tDash } = useTranslation();
  // Mock driver data - in production this would come from API
  const driver: Driver | undefined = useMemo(() => {
    if (!userId || !orgId) return undefined;
    return {
      id: 'driver-1',
      userName: user?.name || tDash('driver.defaultName', 'Driver'),
      rating: 4.8,
      totalTrips: 150,
      isAvailable: true,
      organizationId: orgId,
    };
  }, [userId, orgId, user?.name, tDash]);

  const { data: pendingRequests } = useDriverRequests(orgId, 'pending');
  
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

  const { data: todaySchedule } = useDriverSchedules(driver?.id, todayStart, todayEnd);

  const updateRequestStatus = useUpdateRequestStatus();

  const handleRespond = async (requestId: string, approved: boolean) => {
    if (!driver || !userId) return;
    try {
      await updateRequestStatus.mutateAsync({
        requestId,
        status: approved ? 'approved' : 'declined',
      });
      toast.success(
        approved
          ? t('driver.requestApproved', 'Request approved!')
          : t('driver.requestDeclined', 'Request declined!'),
      );
    } catch (error) {
      const message =
        error instanceof Error ? t('driver.error', { defaultValue: error.message }) : t('driver.failedToRespond', 'Failed to respond');
      toast.error(message);
    }
  };

  const handleToggleAvailability = async (checked: boolean) => {
    if (!driver) return;
    toast.success(
      checked
        ? t('driver.youAreNowAvailable', 'You are now available')
        : t('driver.youAreNowUnavailable', 'You are now unavailable'),
    );
  };

  if (!driver) {
    return null;
  }

  const todayTrips =
    todaySchedule?.filter((s: any) => s.type === 'trip' && s.status === 'scheduled').length ?? 0;

  return (
    <div className="max-w-400 mx-auto px-3 sm:px-4 lg:px-6">
      <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 mb-4 sm:mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
        <div
          className="relative p-4 sm:p-6 rounded-xl sm:rounded-2xl overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--primary) 90%, var(--background)) 0%, color-mix(in srgb, var(--primary) 70%, var(--background)) 100%)',
          }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 justify-between">
            <div>
              <h1
                className="text-xl sm:text-2xl lg:text-3xl font-bold text-white"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.15)' }}
              >
                {t('driver.dashboard', 'Driver Dashboard')}
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('driver.dashboardDesc', 'Manage your trips and availability')}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-white/90">
                {driver.isAvailable ? t('driver.available') : t('driver.busy')}
              </span>
              <Switch checked={driver.isAvailable} onCheckedChange={handleToggleAvailability} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 mb-6 sm:mb-8 drivers-stagger">
        <StatCard
          label={t('driver.todayTrips', "Today's Trips")}
          value={todayTrips}
          icon={Calendar}
          color="var(--primary)"
        />
        <StatCard
          label={t('driver.pendingRequests', 'Pending')}
          value={pendingRequests?.length ?? 0}
          icon={Clock}
          color="var(--warning)"
        />
        <StatCard
          label={t('driver.totalCompleted', 'Completed')}
          value={driver.totalTrips ?? 0}
          icon={TrendingUp}
          color="var(--success)"
        />
        <StatCard
          label={t('driver.rating', 'Rating')}
          value={driver.rating?.toFixed(1) ?? t('driver.perfectRating', '5.0')}
          icon={Star}
          color="var(--warning)"
        />
      </div>

      {user?.role !== 'admin' && user?.role !== 'superadmin' && (
        <DriverShiftControls driverId={driver.id} userId={userId!} organizationId={orgId!} />
      )}

      <Card className="mb-6 sm:mb-8 border-(--border)">
        <CardHeader className="pb-3 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-xl font-semibold">
            {t('driver.pendingRequests', 'Pending Requests')}
          </h2>
        </CardHeader>
        <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {pendingRequests.map((request: any) => (
                <div
                  key={request.id}
                  className="p-3 sm:p-4 rounded-xl border border-(--border) hover:border-(--primary)/30 transition-all duration-300"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0">
                        {request.requesterAvatar && <AvatarImage src={request.requesterAvatar} />}
                        <AvatarFallback className="text-xs">
                          {request.requesterName
                            ?.split(' ')
                            .map((n: string) => n[0])
                            .join('') ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm sm:text-base truncate">
                          {request.requesterName ?? t('common.unknown', 'Unknown')}
                        </h3>
                        <p className="text-xs sm:text-sm text-(--text-muted) truncate">
                          {request.tripInfo?.from} → {request.tripInfo?.to}
                        </p>
                        <p className="text-xs text-(--text-muted)">
                          {format(new Date(request.startTime), 'MMM dd, HH:mm', { locale: dateFnsLocale })} -{' '}
                          {format(new Date(request.endTime), 'HH:mm', { locale: dateFnsLocale })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRespond(request.id, false)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <ThumbsDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />{' '}
                        {t('driver.decline', 'Decline')}
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleRespond(request.id, true)}
                        className="flex-1 sm:flex-none text-xs"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />{' '}
                        {t('driver.approve', 'Approve')}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {request.tripInfo?.pickupCoords && (
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
            <div className="text-center py-6 sm:py-8 text-(--text-muted)">
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm">{t('driver.noRequests', 'No pending requests')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 sm:mb-8 border-(--border)">
        <CardHeader className="pb-3 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-xl font-semibold">
            {t('driver.todaySchedule', "Today's Schedule")}
          </h2>
        </CardHeader>
        <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule
                .sort((a: any, b: any) => a.startTime - b.startTime)
                .map((schedule: any) => (
                  <div
                    key={schedule.id}
                    className="flex gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-(--border) hover:border-(--primary)/30 transition-all duration-300"
                  >
                    <div
                      className={`w-1.5 sm:w-2 shrink-0 rounded-full ${
                        schedule.status === 'scheduled'
                          ? 'bg-(--primary)'
                          : schedule.status === 'completed'
                            ? 'bg-(--success)'
                            : 'bg-(--text-disabled)'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm">
                            {format(new Date(schedule.startTime), 'HH:mm', { locale: dateFnsLocale })} -{' '}
                            {format(new Date(schedule.endTime), 'HH:mm', { locale: dateFnsLocale })}
                          </span>
                          <Badge
                            variant={schedule.type === 'trip' ? 'default' : 'secondary'}
                            className="text-[10px] sm:text-xs"
                          >
                            {schedule.type === 'trip'
                              ? t('driver.scheduleType.trip', 'Trip')
                              : schedule.type === 'blocked'
                                ? t('driver.scheduleType.blocked', 'Blocked')
                                : String(t(`driver.scheduleType.${schedule.type}`, schedule.type))}
                          </Badge>
                        </div>
                      </div>
                      {schedule.tripInfo && (
                        <p className="text-xs sm:text-sm text-(--text-muted) mt-1 truncate">
                          {schedule.tripInfo.from} → {schedule.tripInfo.to}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-(--text-muted)">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm">{t('driver.noSchedule', 'No trips scheduled for today')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 sm:mb-8 border-(--border)">
        <CardHeader className="pb-3 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-xl font-semibold">
            {t('driver.weeklySchedule', 'Weekly Schedule')}
          </h2>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 py-2 sm:py-4">
          <DriverCalendar
            driverId={driver.id}
            organizationId={orgId!}
            userId={userId}
            role="driver"
          />
        </CardContent>
      </Card>

      <Card className="mb-6 sm:mb-8 border-(--border)">
        <CardHeader className="pb-3 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-xl font-semibold">
            {t('driver.tripStatistics', 'Trip Statistics')}
          </h2>
        </CardHeader>
        <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
          <DriverStatsCard driverId={driver.id} organizationId={orgId!} />
        </CardContent>
      </Card>

      <Card className="mb-6 sm:mb-8 border-(--border)">
        <CardHeader className="pb-3 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-xl font-semibold">
            {t('driver.shiftHistory', 'Shift History')}
          </h2>
        </CardHeader>
        <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
          <ShiftHistory driverId={driver.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <Card className="drivers-card-hover relative overflow-hidden border-(--border) bg-(--card-elevated)">
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <h3 className="text-sm font-medium text-(--text-muted)">{label}</h3>
        <div className="p-2 rounded-lg" style={{ background: `${color}20`, color }}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-2xl font-bold" style={{ color }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
