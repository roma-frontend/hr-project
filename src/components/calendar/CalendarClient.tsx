"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from '@/lib/cssMotion';
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Plus,
  ExternalLink,
  Car,
} from "lucide-react";
import {
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, getLeaveTypeLabel, type LeaveType, type LeaveStatus } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { LeaveRequestModal } from "@/components/leaves/LeaveRequestModal";
import { useSelectedOrganization } from "@/hooks/useSelectedOrganization";
import { DriverRequestModal } from "./DriverRequestModal";
import { getInitials } from "@/lib/stringUtils";

type LeaveRequest = {
  _id: string;
  userId: string;
  userName?: string;
  userDepartment?: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  comment?: string;
};

type DriverScheduleEvent = {
  _id: string;
  driverId: string;
  driverName: string;
  driverVehicle?: { model: string; plateNumber: string; capacity: number; color?: string; year?: number };
  bookedByName?: string;
  startTime: number;
  endTime: number;
  type: "trip" | "blocked" | "maintenance";
  status: string;
  tripInfo?: { from: string; to: string; purpose: string; passengerCount: number; notes?: string };
  reason?: string;
};

type GoogleCalendarEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string;
  htmlLink: string;
};

// --- Helpers ------------------------------------------------------------------
function safeDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function safeFormat(dateStr: string | undefined | null, fmt: string): string {
  const d = safeDate(dateStr);
  if (!d) return "�";
  try { return format(d, fmt); } catch { return "�"; }
}

function getDateRange(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const s = safeDate(start);
  const e = safeDate(end);
  if (!s || !e) return dates;
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function StatusIcon({ status }: { status: LeaveStatus }) {
  if (status === "approved") return <CheckCircle className="w-3 h-3 text-emerald-500" />;
  if (status === "rejected") return <XCircle className="w-3 h-3 text-red-500" />;
  return <Clock className="w-3 h-3 text-amber-500" />;
}

const LEAVE_TYPE_BG: Record<string, string> = {
  paid: "#2563eb",
  unpaid: "#f59e0b",
  sick: "#ef4444",
  family: "#10b981",
  doctor: "#06b6d4",
};

// Days of week will be translated using i18n

// --- Calendar Day Cell ---------------------------------------------------------
const GOOGLE_EVENT_COLOR = "#8b5cf6";
const DRIVER_EVENT_COLOR = "#f97316"; // orange for driver bookings

function DayCell({
  date,
  currentMonth,
  selected,
  leaves,
  googleEvents,
  driverEvents,
  onClick,
}: {
  date: Date;
  currentMonth: Date;
  selected: Date | null;
  leaves: LeaveRequest[];
  googleEvents: GoogleCalendarEvent[];
  driverEvents: DriverScheduleEvent[];
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isTodayDate = isToday(date);
  const isSelected = selected ? isSameDay(date, selected) : false;
  const hasLeaves = leaves.length > 0 && isCurrentMonth;
  const hasGoogle = googleEvents.length > 0 && isCurrentMonth;
  const hasDriver = driverEvents.length > 0 && isCurrentMonth;
  const totalItems = leaves.length + googleEvents.length + driverEvents.length;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={[
        "relative w-full min-h-[80px] sm:min-h-[90px] rounded-xl p-1.5 text-left transition-all duration-200 border",
        isSelected
          ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20"
          : isTodayDate
            ? "bg-[var(--primary)]/10 border-[var(--primary)]/40"
            : isCurrentMonth
              ? "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--background-subtle)]"
              : "bg-transparent border-transparent opacity-40",
      ].join(" ")}
    >
      {/* Day number */}
      <span
        className={[
          "text-xs font-semibold leading-none block mb-1",
          isSelected
            ? "text-white"
            : isTodayDate
              ? "text-[var(--primary)] font-bold"
              : isCurrentMonth
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)]",
        ].join(" ")}
      >
        {isTodayDate && !isSelected && (
          <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
        )}
        {date.getDate()}
      </span>

      {/* Event pills */}
      {(hasLeaves || hasGoogle || hasDriver) && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {/* Leave pills */}
          {leaves.slice(0, (hasGoogle || hasDriver) ? 1 : 2).map((l, i) => (
            <div
              key={`l-${i}`}
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{ background: `${LEAVE_TYPE_BG[l.type]}22` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: LEAVE_TYPE_BG[l.type] }}
              />
              <span
                className="text-[9px] font-medium truncate hidden sm:block"
                style={{ color: LEAVE_TYPE_BG[l.type] }}
              >
                {(l.userName ?? t('calendar.unknown')).split(" ")[0]}
              </span>
            </div>
          ))}
          {/* Driver booking pills */}
          {driverEvents.slice(0, 1).map((evt, i) => (
            <div
              key={`d-${i}`}
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{ background: `${DRIVER_EVENT_COLOR}22` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: DRIVER_EVENT_COLOR }}
              />
              <span
                className="text-[9px] font-medium truncate hidden sm:block"
                style={{ color: DRIVER_EVENT_COLOR }}
              >
                {evt.driverName.split(" ")[0]}
              </span>
            </div>
          ))}
          {/* Google Calendar pills */}
          {googleEvents.slice(0, (hasLeaves || hasDriver) ? 1 : 2).map((evt, i) => (
            <div
              key={`g-${i}`}
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{ background: `${GOOGLE_EVENT_COLOR}22` }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: GOOGLE_EVENT_COLOR }}
              />
              <span
                className="text-[9px] font-medium truncate hidden sm:block"
                style={{ color: GOOGLE_EVENT_COLOR }}
              >
                {evt.title}
              </span>
            </div>
          ))}
          {totalItems > 2 && (
            <span className="text-[9px] text-[var(--text-muted)] pl-1">
              +{totalItems - 2} more
            </span>
          )}
        </div>
      )}
    </motion.button>
  );
}

// --- Main Component ------------------------------------------------------------
export const CalendarClient = React.memo(function CalendarClient() {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [mounted, setMounted] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const { user } = useAuthStore();
  const selectedOrgId = useSelectedOrganization();

  const DAYS_OF_WEEK = [
    t('weekdays.sun'), t('weekdays.mon'), t('weekdays.tue'), t('weekdays.wed'),
    t('weekdays.thu'), t('weekdays.fri'), t('weekdays.sat')
  ];

  // Google Calendar events
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);

  const fetchGoogleEvents = useCallback(async (month: Date) => {
    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const timeMin = start.toISOString();
      const timeMax = end.toISOString();
      const res = await fetch(`/api/calendar/google/events?timeMin=${timeMin}&timeMax=${timeMax}`);
      const data = await res.json();
      setGoogleConnected(data.connected ?? false);
      setGoogleEvents(data.events ?? []);
    } catch {
      setGoogleEvents([]);
    }
  }, []);

  useEffect(() => {
    if (mounted) fetchGoogleEvents(currentMonth);
  }, [mounted, currentMonth, fetchGoogleEvents]);

  useEffect(() => {
    setMounted(true);
    console.log('📅 CalendarClient mounted');
  }, []);

  // Debug: Log whenever selectedOrgId changes
  useEffect(() => {
    if (mounted) {
      console.log('📅 selectedOrgId changed to:', selectedOrgId);
    }
  }, [selectedOrgId, mounted]);

  // Determine which query to use based on selectedOrgId
  const shouldUseOrgQuery = mounted && selectedOrgId && user?.id;
  const queryParams = shouldUseOrgQuery
    ? { organizationId: selectedOrgId as Id<"organizations"> }
    : (mounted && user?.id ? { requesterId: user.id as Id<"users"> } : "skip" as const);

  // Use organization-specific query if org selected, otherwise use default
  const leavesData = useQuery(
    shouldUseOrgQuery ? api.leaves.getLeavesForOrganization : api.leaves.getAllLeaves,
    mounted && user?.id && queryParams !== "skip"
      ? queryParams
      : "skip"
  );
  const leaves: LeaveRequest[] = leavesData ?? [];
  
  // Debug: Log data load
  useEffect(() => {
    if (mounted) {
      console.log('📅 Leaves loaded:', { 
        selectedOrgId, 
        count: leaves.length, 
        usingOrgQuery: shouldUseOrgQuery,
        mounted 
      });
    }
  }, [leaves.length, selectedOrgId, mounted, shouldUseOrgQuery]);

  // Driver schedule events
  const monthStart = useMemo(() => startOfMonth(currentMonth).getTime(), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth).getTime(), [currentMonth]);

  const driverSchedules = useQuery(
    api.drivers.getOrgDriverSchedules,
    mounted && selectedOrgId
      ? { organizationId: selectedOrgId as Id<"organizations">, startTime: monthStart, endTime: monthEnd }
      : "skip"
  ) as DriverScheduleEvent[] | undefined;

  const [selectedDriverEvent, setSelectedDriverEvent] = useState<DriverScheduleEvent | null>(null);

  // Build driver schedule map
  const driverDateMap = useMemo(() => {
    const map = new Map<string, DriverScheduleEvent[]>();
    (driverSchedules ?? []).forEach((evt) => {
      // A schedule can span multiple days
      const startD = new Date(evt.startTime);
      const endD = new Date(evt.endTime);
      const cur = new Date(startD);
      cur.setHours(0, 0, 0, 0);
      while (cur <= endD) {
        const key = format(cur, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(evt);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [driverSchedules]);

  // Build leave map
  const leaveDateMap = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    leaves.filter((r) => r.status !== "rejected").forEach((req) => {
      getDateRange(req.startDate, req.endDate).forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(req);
      });
    });
    return map;
  }, [leaves]);

  // Build Google Calendar events map
  const googleDateMap = useMemo(() => {
    const map = new Map<string, GoogleCalendarEvent[]>();
    googleEvents.forEach((evt) => {
      // For all-day events, Google returns end as exclusive (next day)
      const endDate = evt.allDay && evt.endDate
        ? format(addDays(new Date(evt.endDate), -1), "yyyy-MM-dd")
        : evt.endDate;
      const start = evt.startDate;
      if (!start) return;
      getDateRange(start, endDate || start).forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(evt);
      });
    });
    return map;
  }, [googleEvents]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [currentMonth]);

  const selectedDayLeaves = useMemo(() => {
    if (!selectedDay) return [];
    return leaveDateMap.get(format(selectedDay, "yyyy-MM-dd")) ?? [];
  }, [selectedDay, leaveDateMap]);

  const selectedDayGoogle = useMemo(() => {
    if (!selectedDay) return [];
    return googleDateMap.get(format(selectedDay, "yyyy-MM-dd")) ?? [];
  }, [selectedDay, googleDateMap]);

  const selectedDayDriverEvents = useMemo(() => {
    if (!selectedDay) return [];
    return driverDateMap.get(format(selectedDay, "yyyy-MM-dd")) ?? [];
  }, [selectedDay, driverDateMap]);

  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const goToday = () => {
    const t = new Date();
    setCurrentMonth(t);
    setSelectedDay(t);
  };

  // Monthly summary
  const monthlySummary = useMemo(() => {
    return (Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((type) => {
      const count = leaves.filter(
        (r) =>
          r.type === type &&
          r.status !== "rejected" &&
          (isSameMonth(new Date(r.startDate), currentMonth) ||
            isSameMonth(new Date(r.endDate), currentMonth))
      ).length;
      return { type, count };
    }).filter((s) => s.count > 0);
  }, [leaves, currentMonth]);

  // On leave today
  const onLeaveToday = useMemo(() => {
    if (!mounted) return [];
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return leaves.filter(
      (r) => r.status === "approved" && r.startDate <= todayStr && r.endDate >= todayStr
    );
  }, [mounted, leaves]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* -- Header -- */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('calendarExtended.leaveCalendar')}</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {t('calendarExtended.visualOverview')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            <CalendarDays className="w-4 h-4" />
            {t('buttons.today')}
          </Button>
          <Button size="sm" onClick={() => setShowLeaveModal(true)}>
            <Plus className="w-4 h-4" />
            {t('calendar.newLeave')}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* -- Calendar Panel -- */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="xl:col-span-3 space-y-4"
        >
          <Card className="overflow-hidden">
            {/* Month nav */}
            <CardHeader className="pb-0 px-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button size="icon-sm" variant="ghost" onClick={prevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <motion.h3
                    key={format(currentMonth, "yyyy-MM")}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-lg font-bold text-[var(--text-primary)] min-w-[160px] text-center"
                  >
                    {format(currentMonth, "MMMM yyyy")}
                  </motion.h3>
                  <Button size="icon-sm" variant="ghost" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Quick month stats */}
                <div className="hidden sm:flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[var(--text-muted)]">
                      {leaves.filter(
                        (r) => r.status === "approved" && isSameMonth(new Date(r.startDate), currentMonth)
                      ).length} approved
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-[var(--text-muted)]">
                      {leaves.filter(
                        (r) => r.status === "pending" && isSameMonth(new Date(r.startDate), currentMonth)
                      ).length} pending
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {DAYS_OF_WEEK.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-semibold text-[var(--text-muted)] py-2 border-b border-[var(--border)]"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={format(currentMonth, "yyyy-MM")}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-7 gap-1.5"
                >
                  {calendarDays.map((date, i) => {
                    const key = format(date, "yyyy-MM-dd");
                    const leaves = leaveDateMap.get(key) ?? [];
                    const gEvents = googleDateMap.get(key) ?? [];
                    const dEvents = driverDateMap.get(key) ?? [];
                    return (
                      <DayCell
                        key={i}
                        date={date}
                        currentMonth={currentMonth}
                        selected={selectedDay}
                        leaves={leaves}
                        googleEvents={gEvents}
                        driverEvents={dEvents}
                        onClick={() => setSelectedDay(date)}
                      />
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Legend */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-3 px-1"
          >
            {(Object.entries(LEAVE_TYPE_COLORS) as [LeaveType, string][]).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-[var(--text-muted)]">{getLeaveTypeLabel(type, t)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: DRIVER_EVENT_COLOR }} />
              <span className="text-xs text-[var(--text-muted)]">{t('driver.driverBookings', 'Driver Bookings')}</span>
            </div>
            {googleConnected && (
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: GOOGLE_EVENT_COLOR }} />
                <span className="text-xs text-[var(--text-muted)]">Google Calendar</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-[var(--primary)] bg-[var(--primary)]/10 flex-shrink-0" />
              <span className="text-xs text-[var(--text-muted)]">{t('timePeriods.today')}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* -- Side Panel -- */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Selected day details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-[var(--text-muted)]">
                {selectedDay ? format(selectedDay, "EEEE, MMM d") : t('calendar.selectADay')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <AnimatePresence mode="wait">
                {selectedDayLeaves.length === 0 && selectedDayGoogle.length === 0 && selectedDayDriverEvents.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-6 text-center"
                  >
                    <CalendarDays className="w-8 h-8 text-[var(--border)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-muted)]">{t('calendarExtended.noLeavesThisDay')}</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2 max-h-80 overflow-y-auto"
                  >
                    {/* Leave requests */}
                    {selectedDayLeaves.map((leave, i) => (
                      <motion.div
                        key={leave._id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)]"
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarFallback
                            className="text-[10px] font-bold text-white"
                            style={{ background: LEAVE_TYPE_BG[leave.type] }}
                          >
                            {getInitials(leave.userName ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {leave.userName ?? "Unknown"}
                            </p>
                            <StatusIcon status={leave.status as LeaveStatus} />
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{leave.userDepartment ?? ""}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LEAVE_TYPE_BG[leave.type] }} />
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              {getLeaveTypeLabel(leave.type as LeaveType, t)}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {safeFormat(leave.startDate, "MMM d")} &ndash;{" "}
                            {safeFormat(leave.endDate, "MMM d")} &middot; {leave.days}d
                          </p>
                          {leave.comment && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1 italic line-clamp-2">
                              &quot;{leave.comment}&quot;
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {/* Google Calendar events */}
                    {selectedDayGoogle.map((evt, i) => (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (selectedDayLeaves.length + i) * 0.04 }}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)]"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                          style={{ background: GOOGLE_EVENT_COLOR }}
                        >
                          G
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {evt.title}
                            </p>
                            {evt.htmlLink && (
                              <a
                                href={evt.htmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--text-muted)] hover:text-[var(--primary)] flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {evt.startTime && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              {format(new Date(evt.startTime), "h:mm a")}
                              {evt.endTime && ` – ${format(new Date(evt.endTime), "h:mm a")}`}
                            </p>
                          )}
                          {!evt.startTime && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">All day</p>
                          )}
                          {evt.location && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                              📍 {evt.location}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GOOGLE_EVENT_COLOR }} />
                            <span className="text-[10px] text-[var(--text-secondary)]">Google Calendar</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Driver booking events */}
                    {selectedDayDriverEvents.map((evt, i) => (
                      <motion.div
                        key={evt._id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (selectedDayLeaves.length + selectedDayGoogle.length + i) * 0.04 }}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] cursor-pointer hover:border-[var(--primary)]/50 transition-colors"
                        onClick={() => setSelectedDriverEvent(evt)}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                          style={{ background: DRIVER_EVENT_COLOR }}
                        >
                          <Car className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {evt.driverName}
                            </p>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 flex-shrink-0">
                              {evt.type}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {format(new Date(evt.startTime), "h:mm a")} – {format(new Date(evt.endTime), "h:mm a")}
                          </p>
                          {evt.tripInfo && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                              {evt.tripInfo.from} → {evt.tripInfo.to}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DRIVER_EVENT_COLOR }} />
                            <span className="text-[10px] text-[var(--text-secondary)]">{t('driver.driverBookings', 'Driver Booking')}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Monthly summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wider text-[var(--text-muted)]">
                {format(currentMonth, "MMMM")} {t('calendar.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {monthlySummary.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">{t('calendarExtended.noLeavesThisMonth')}</p>
              ) : (
                monthlySummary.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: LEAVE_TYPE_BG[type] }}
                      />
                      <span className="text-xs text-[var(--text-secondary)]">
                        {getLeaveTypeLabel(type, t)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs h-5 px-2">{count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* On leave today */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-wider text-[var(--text-muted)]">
                  {t('calendar.onLeaveToday')}
                </CardTitle>
                {onLeaveToday.length > 0 && (
                  <Badge variant="warning" className="text-[10px] h-5 px-2">
                    {onLeaveToday.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {onLeaveToday.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <Users className="w-4 h-4 text-[var(--border)]" />
                  <p className="text-xs text-[var(--text-muted)]">{t('calendarExtended.everyoneInToday')}</p>
                </div>
              ) : (
                onLeaveToday.map((l) => (
                  <div key={l._id} className="flex items-center gap-2.5">
                    <Avatar className="w-7 h-7 flex-shrink-0">
                      <AvatarFallback
                        className="text-[9px] font-bold text-white"
                        style={{ background: LEAVE_TYPE_BG[l.type] }}
                      >
                        {getInitials(l.userName ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {l.userName ?? "Unknown"}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {getLeaveTypeLabel(l.type as LeaveType, t)}
                      </p>
                    </div>
                    <Badge className="ml-auto text-[9px] h-4 px-1.5 flex-shrink-0" variant="success">
                      away
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Leave Request Modal */}
      <LeaveRequestModal
        open={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
      />

      {/* Driver Request Modal */}
      <DriverRequestModal
        open={showDriverModal}
        onOpenChange={setShowDriverModal}
        selectedDate={selectedDay ?? undefined}
      />

      {/* Driver Event Detail Modal */}
      <AnimatePresence>
        {selectedDriverEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setSelectedDriverEvent(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ background: DRIVER_EVENT_COLOR }}
                  >
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {selectedDriverEvent.driverName}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedDriverEvent.type === "trip" ? t('driver.trip', 'Trip') : selectedDriverEvent.type === "blocked" ? t('driver.blocked', 'Blocked') : t('driver.maintenance', 'Maintenance')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDriverEvent(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-5 space-y-3">
                {/* Time */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-secondary)]">
                    {format(new Date(selectedDriverEvent.startTime), "MMM d, h:mm a")} – {format(new Date(selectedDriverEvent.endTime), "h:mm a")}
                  </span>
                </div>

                {/* Vehicle info */}
                {selectedDriverEvent.driverVehicle && (
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-secondary)]">
                      {selectedDriverEvent.driverVehicle.model} · {selectedDriverEvent.driverVehicle.plateNumber}
                      {selectedDriverEvent.driverVehicle.color && ` · ${selectedDriverEvent.driverVehicle.color}`}
                    </span>
                  </div>
                )}

                {/* Trip info */}
                {selectedDriverEvent.tripInfo && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-[var(--text-muted)] w-14 shrink-0">{t('driver.from', 'From')}</span>
                      <span className="text-xs text-[var(--text-primary)]">{selectedDriverEvent.tripInfo.from}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-[var(--text-muted)] w-14 shrink-0">{t('driver.to', 'To')}</span>
                      <span className="text-xs text-[var(--text-primary)]">{selectedDriverEvent.tripInfo.to}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-[var(--text-muted)] w-14 shrink-0">{t('driver.purpose', 'Purpose')}</span>
                      <span className="text-xs text-[var(--text-primary)]">{selectedDriverEvent.tripInfo.purpose}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="w-3 h-3 text-[var(--text-muted)] mt-0.5 shrink-0" />
                      <span className="text-xs text-[var(--text-primary)]">
                        {selectedDriverEvent.tripInfo.passengerCount} {t('driver.passengers', 'passengers')}
                      </span>
                    </div>
                    {selectedDriverEvent.tripInfo.notes && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-[var(--text-muted)] w-14 shrink-0">{t('driver.notes', 'Notes')}</span>
                        <span className="text-xs text-[var(--text-primary)]">{selectedDriverEvent.tripInfo.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Booked by */}
                {selectedDriverEvent.bookedByName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-secondary)]">
                      {t('driver.bookedBy', 'Booked by')} {selectedDriverEvent.bookedByName}
                    </span>
                  </div>
                )}

                {/* Blocked reason */}
                {selectedDriverEvent.reason && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--text-secondary)]">
                      {t('driver.reason', 'Reason')}: {selectedDriverEvent.reason}
                    </span>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge variant={selectedDriverEvent.status === "scheduled" ? "default" : selectedDriverEvent.status === "completed" ? "success" : "secondary"}>
                    {selectedDriverEvent.status}
                  </Badge>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CalendarClient;
