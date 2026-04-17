/**
 * Driver Calendar Component
 * Visual calendar showing trip schedule, availability, and time-off
 * Fully responsive - works on all screen sizes
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { FunctionReference } from 'convex/server';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Calendar as CalendarIcon,
  Car,
  Coffee,
  Shield,
  ArrowRight,
  Play,
  CheckCircle2,
  Wrench,
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';
import { Input } from '../ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DriverCalendarProps {
  driverId: Id<'drivers'>;
  organizationId: Id<'organizations'>;
  userId?: Id<'users'>;
}

interface ScheduleItem {
  _id: Id<'driverSchedules'>;
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

// Trip Card Component
function TripCard({
  item,
  onUpdateStatus,
}: {
  item: ScheduleItem;
  onUpdateStatus: (
    id: Id<'driverSchedules'>,
    status: 'in_progress' | 'completed' | 'cancelled',
  ) => void;
}) {
  const { t } = useTranslation();
  const startTime = format(new Date(item.startTime), 'HH:mm');
  const endTime = format(new Date(item.endTime), 'HH:mm');

  const isTimeOff = item.type === 'time_off';
  const isBlocked = item.type === 'blocked';
  const isMaintenance = item.type === 'maintenance';

  const getStatusConfig = () => {
    if (isTimeOff)
      return {
        bg: 'bg-purple-50 dark:bg-purple-500/5',
        border: 'border-purple-200 dark:border-purple-500/20',
        accent: 'bg-purple-500',
        dot: 'bg-purple-400',
        text: 'text-purple-700 dark:text-purple-300',
        textMuted: 'text-purple-500 dark:text-purple-400',
        btnBg: 'bg-purple-500 hover:bg-purple-600',
        btnText: 'text-white',
      };
    if (isBlocked)
      return {
        bg: 'bg-slate-50 dark:bg-slate-500/5',
        border: 'border-slate-200 dark:border-slate-500/20',
        accent: 'bg-slate-500',
        dot: 'bg-slate-400',
        text: 'text-slate-700 dark:text-slate-300',
        textMuted: 'text-slate-500 dark:text-slate-400',
        btnBg: 'bg-slate-500 hover:bg-slate-600',
        btnText: 'text-white',
      };
    if (isMaintenance)
      return {
        bg: 'bg-orange-50 dark:bg-orange-500/5',
        border: 'border-orange-200 dark:border-orange-500/20',
        accent: 'bg-orange-500',
        dot: 'bg-orange-400',
        text: 'text-orange-700 dark:text-orange-300',
        textMuted: 'text-orange-500 dark:text-orange-400',
        btnBg: 'bg-orange-500 hover:bg-orange-600',
        btnText: 'text-white',
      };
    switch (item.status) {
      case 'completed':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-500/5',
          border: 'border-emerald-200 dark:border-emerald-500/20',
          accent: 'bg-emerald-500',
          dot: 'bg-emerald-400',
          text: 'text-emerald-700 dark:text-emerald-300',
          textMuted: 'text-emerald-500 dark:text-emerald-400',
          btnBg: 'bg-emerald-500 hover:bg-emerald-600',
          btnText: 'text-white',
        };
      case 'in_progress':
        return {
          bg: 'bg-blue-50 dark:bg-blue-500/5',
          border: 'border-blue-200 dark:border-blue-500/20',
          accent: 'bg-blue-500',
          dot: 'bg-blue-400',
          text: 'text-blue-700 dark:text-blue-300',
          textMuted: 'text-blue-500 dark:text-blue-400',
          btnBg: 'bg-blue-500 hover:bg-blue-600',
          btnText: 'text-white',
        };
      case 'cancelled':
        return {
          bg: 'bg-red-50 dark:bg-red-500/5',
          border: 'border-red-200 dark:border-red-500/20',
          accent: 'bg-red-500',
          dot: 'bg-red-400',
          text: 'text-red-700 dark:text-red-300',
          textMuted: 'text-red-500 dark:text-red-400',
          btnBg: 'bg-red-500 hover:bg-red-600',
          btnText: 'text-white',
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-500/5',
          border: 'border-slate-200 dark:border-slate-500/20',
          accent: 'bg-slate-400',
          dot: 'bg-slate-400',
          text: 'text-slate-700 dark:text-slate-300',
          textMuted: 'text-slate-500 dark:text-slate-400',
          btnBg: 'bg-blue-500 hover:bg-blue-600',
          btnText: 'text-white',
        };
    }
  };

  const config = getStatusConfig();

  const getTypeIcon = () => {
    if (isTimeOff) return <Coffee className="w-3 h-3" />;
    if (isBlocked) return <Shield className="w-3 h-3" />;
    if (isMaintenance) return <Wrench className="w-3 h-3" />;
    return <Car className="w-3 h-3" />;
  };

  const getTypeLabel = () => {
    if (isTimeOff) return t('driverCalendar.timeOff');
    if (isBlocked) return t('driverCalendar.blocked');
    if (isMaintenance) return t('driverCalendar.maintenance');
    return t('driverCalendar.trip');
  };

  const routeText =
    item.type === 'trip' && item.tripInfo
      ? `${item.tripInfo.from ?? ''} → ${item.tripInfo.to ?? ''}`
      : '';

  return (
    <div
      className={`group relative rounded-lg border ${config.border} ${config.bg} transition-all duration-200 hover:shadow-sm`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${config.accent}`} />

      <div className="p-2.5 pl-3.5">
        {/* Time & Status */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3 h-3 ${config.textMuted}`} />
            <span className={`text-xs font-semibold ${config.text}`}>{startTime}</span>
            <span className="text-[10px] text-muted-foreground/50">{endTime}</span>
          </div>
          <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        </div>

        {/* Route - single line, truncated */}
        {item.type === 'trip' && item.tripInfo ? (
          <div className="mb-2">
            <p className="text-[11px] font-medium text-foreground truncate leading-tight">
              {routeText}
            </p>
            {item.tripInfo.purpose && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {item.tripInfo.purpose}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground truncate">
            {item.reason || getTypeLabel()}
          </p>
        )}

        {/* Action Button */}
        {item.type === 'trip' && item.status === 'scheduled' && (
          <button
            onClick={() => onUpdateStatus(item._id, 'in_progress')}
            className={`w-full mt-1.5 h-6 text-[10px] font-semibold rounded-md ${config.btnBg} ${config.btnText} transition-colors flex items-center justify-center gap-1`}
          >
            <Play className="w-2.5 h-2.5" />
            {t('driverCalendar.startTrip', 'Start')}
          </button>
        )}
        {item.type === 'trip' && item.status === 'in_progress' && (
          <button
            onClick={() => onUpdateStatus(item._id, 'completed')}
            className="w-full mt-1.5 h-6 text-[10px] font-semibold rounded-md bg-emerald-500 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-2.5 h-2.5" />
            {t('driverCalendar.completeTrip', 'Complete')}
          </button>
        )}
      </div>
    </div>
  );
}

export function DriverCalendar({ driverId, organizationId, userId }: DriverCalendarProps) {
  const { t, i18n } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockType, setBlockType] = useState<'vacation' | 'sick' | 'personal'>('vacation');
  const [blockReason, setBlockReason] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');

  const dateFnsLocale = i18n.language === 'ru' ? ru : i18n.language === 'hy' ? hy : enUS;

  // Get current week
  const weekStart = useMemo(() => {
    const d = startOfWeek(selectedDate, { weekStartsOn: 1 });
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [selectedDate]);

  const weekEnd = useMemo(() => weekStart + 7 * 24 * 60 * 60 * 1000 - 1, [weekStart]);

  // Get schedule for the week
  const schedule = useQuery(
    api.drivers.queries.getDriverSchedule,
    driverId ? { driverId, startTime: weekStart, endTime: weekEnd } : 'skip',
  );

  // Mutations
  const blockTimeOff = useMutation(
    api.drivers.driver_operations.blockTimeOff as FunctionReference<'mutation'>,
  );
  const updateTripStatus = useMutation(
    api.drivers.driver_operations.updateTripStatus as FunctionReference<'mutation'>,
  );

  const handleBlockTime = async () => {
    if (!blockStartTime || !blockEndTime || !blockReason) {
      toast.error(t('toasts.pleaseFillAllFields'));
      return;
    }

    try {
      await blockTimeOff({
        driverId,
        organizationId,
        startTime: new Date(blockStartTime).getTime(),
        endTime: new Date(blockEndTime).getTime(),
        reason: blockReason,
        type: blockType,
      });
      toast.success(t('toasts.timeBlockedSuccess'));
      setShowBlockModal(false);
      setBlockReason('');
      setBlockStartTime('');
      setBlockEndTime('');
    } catch (error: any) {
      toast.error(error.message || t('driverCalendar.failedToBlockTime', 'Failed to block time'));
    }
  };

  const handleUpdateTripStatus = async (
    scheduleId: Id<'driverSchedules'>,
    status: 'in_progress' | 'completed' | 'cancelled',
  ) => {
    if (!userId) {
      toast.error(t('driverCalendar.userIdRequired', 'User ID is required'));
      return;
    }
    try {
      await updateTripStatus({ scheduleId, userId, status });
      toast.success(
        t('driverCalendar.tripStatusUpdated', 'Trip status updated to {{status}}', { status }),
      );
    } catch (error: any) {
      toast.error(
        error.message || t('driverCalendar.failedToUpdateStatus', 'Failed to update status'),
      );
    }
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_: any, i: any) =>
      addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i),
    );
  }, [selectedDate]);

  const getScheduleForDay = (date: Date): ScheduleItem[] => {
    return (
      (schedule as ScheduleItem[])?.filter((s: ScheduleItem) =>
        isSameDay(new Date(s.startTime), date),
      ) || []
    );
  };

  // Mobile day view
  const [mobileViewDay, setMobileViewDay] = useState<number>(0);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Calendar Header - Modern Design */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-background"
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              aria-label={t('driverCalendar.previousWeek', 'Previous week')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-lg text-xs font-medium hover:bg-background"
              onClick={() => {
                setSelectedDate(new Date());
                setMobileViewDay(0);
              }}
            >
              {t('driverCalendar.today', 'Today')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-background"
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              aria-label={t('driverCalendar.nextWeek', 'Next week')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="hidden sm:block">
            <h3 className="text-sm font-semibold text-white">
              {format(weekStart, 'MMM d', { locale: dateFnsLocale })} —{' '}
              {format(new Date(weekEnd), 'MMM d, yyyy', { locale: dateFnsLocale })}
            </h3>
          </div>
        </div>
        <Button
          onClick={() => setShowBlockModal(true)}
          className="w-full sm:w-auto gap-2 rounded-xl bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm hover:shadow-md transition-all"
        >
          <Shield className="w-4 h-4" />
          {t('driverCalendar.blockTime', 'Block Time')}
        </Button>
      </div>

      {/* Week Range for Mobile */}
      <div className="sm:hidden text-center">
        <p className="text-sm font-semibold text-white">
          {format(weekStart, 'MMM d', { locale: dateFnsLocale })} —{' '}
          {format(new Date(weekEnd), 'MMM d, yyyy', { locale: dateFnsLocale })}
        </p>
      </div>

      {/* Desktop Week View - Hidden on mobile */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day: any) => {
            const daySchedule = getScheduleForDay(day);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`rounded-2xl border transition-all duration-200 ${
                  today
                    ? 'border-primary/40 bg-linear-to-b from-primary/5 to-transparent shadow-lg shadow-primary/5'
                    : 'border-border/50 bg-card/50 hover:border-border'
                }`}
              >
                {/* Day Header */}
                <div className="p-3 pb-2 border-b border-border/30">
                  <div className="text-center">
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        today ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {format(day, 'EEE', { locale: dateFnsLocale })}
                    </div>
                    <div
                      className={`text-2xl font-bold mt-1 ${
                        today ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                </div>

                {/* Schedule Items */}
                <div className="p-2 space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                  {daySchedule.length > 0 ? (
                    daySchedule
                      .sort((a: ScheduleItem, b: ScheduleItem) => a.startTime - b.startTime)
                      .map((s: ScheduleItem) => (
                        <TripCard key={s._id} item={s} onUpdateStatus={handleUpdateTripStatus} />
                      ))
                  ) : (
                    <div className="text-center py-8">
                      <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <span className="text-[11px] text-muted-foreground">
                        {t('driverCalendar.noTrips')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Day View - Horizontal Scroll */}
      <div className="sm:hidden">
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          {/* Day Selector */}
          <div className="p-3 pb-2 border-b border-border/30">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {weekDays.map((day: any, index: any) => {
                  const today = isToday(day);
                  const isSelected = index === mobileViewDay;
                  const daySchedule = getScheduleForDay(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setMobileViewDay(index)}
                      className={`flex flex-col items-center justify-center min-w-14 p-2.5 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? today
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                            : 'bg-muted text-foreground shadow-sm'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase ${
                          isSelected ? 'opacity-80' : 'text-muted-foreground'
                        }`}
                      >
                        {format(day, 'EEE', { locale: dateFnsLocale })}
                      </span>
                      <span
                        className={`text-xl font-bold mt-0.5 ${
                          isSelected ? '' : today ? 'text-primary' : ''
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {daySchedule.length > 0 && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                            isSelected
                              ? 'bg-primary-foreground'
                              : today
                                ? 'bg-primary'
                                : 'bg-primary/60'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Schedule Content */}
          <div className="p-3 space-y-3 max-h-90 overflow-y-auto">
            {weekDays[mobileViewDay] && getScheduleForDay(weekDays[mobileViewDay]).length > 0 ? (
              getScheduleForDay(weekDays[mobileViewDay])
                .sort((a: ScheduleItem, b: ScheduleItem) => a.startTime - b.startTime)
                .map((s: ScheduleItem) => (
                  <TripCard key={s._id} item={s} onUpdateStatus={handleUpdateTripStatus} />
                ))
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm font-medium text-foreground">
                  {t('driverCalendar.noTripsScheduled')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(weekDays[mobileViewDay] ?? new Date(), 'EEEE, MMM d', {
                    locale: dateFnsLocale,
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend - Modern Design */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-xs text-muted-foreground">{t('driverCalendar.completed')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
          <span className="text-xs text-muted-foreground">{t('driverCalendar.inProgress')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400 shadow-sm shadow-slate-400/50" />
          <span className="text-xs text-muted-foreground">{t('driverCalendar.scheduled')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
          <span className="text-xs text-muted-foreground">{t('driverCalendar.timeOff')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
          <span className="text-xs text-muted-foreground">{t('driverCalendar.maintenance')}</span>
        </div>
      </div>

      {/* Block Time Modal - Beautiful Design */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent className="sm:max-w-120 p-0 overflow-hidden">
          {/* Modal Header with Gradient */}
          <div className="relative bg-linear-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">
                    {t('driverCalendar.blockTime')}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'driverCalendar.blockTimeDesc',
                      'Select dates and provide a reason to block your availability.',
                    )}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Modal Body */}
          <div className="p-6 pt-5 space-y-5">
            {/* Block Type Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('driverCalendar.type')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    value: 'vacation',
                    label: t('driverCalendar.vacation'),
                    icon: <Coffee className="w-4 h-4" />,
                  },
                  {
                    value: 'sick',
                    label: t('driverCalendar.sickLeave'),
                    icon: <Shield className="w-4 h-4" />,
                  },
                  {
                    value: 'personal',
                    label: t('driverCalendar.personal'),
                    icon: <Clock className="w-4 h-4" />,
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setBlockType(option.value as 'vacation' | 'sick' | 'personal')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                      blockType === option.value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/50 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <span
                      className={
                        blockType === option.value ? 'text-primary' : 'text-muted-foreground'
                      }
                    >
                      {option.icon}
                    </span>
                    <span
                      className={`text-xs font-medium ${blockType === option.value ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t('driverCalendar.startTime')}
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="pl-10 rounded-xl border-border/50 focus:border-primary focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {t('driverCalendar.endTime')}
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="pl-10 rounded-xl border-border/50 focus:border-primary focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label className="text-sm font-medium mb-2 block">{t('driverCalendar.reason')}</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t('driverCalendar.enterReason')}
                rows={3}
                className="resize-none rounded-xl border-border/50 focus:border-primary focus:ring-primary/20"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleBlockTime}
              className="w-full h-11 rounded-xl bg-linear-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm hover:shadow-md transition-all font-medium"
            >
              <Shield className="w-4 h-4 mr-2" />
              {t('driverCalendar.blockTimeBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
