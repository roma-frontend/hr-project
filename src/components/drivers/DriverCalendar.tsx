/**
 * Driver Calendar Component
 * Visual calendar showing trip schedule, availability, and time-off
 * Fully responsive - works on all screen sizes
 */

"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { Input } from "../ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DriverCalendarProps {
  driverId: Id<"drivers">;
  organizationId: Id<"organizations">;
  userId: Id<"users">;
}

interface ScheduleItem {
  _id: Id<"driverSchedules">;
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

export function DriverCalendar({ driverId, organizationId, userId }: DriverCalendarProps) {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockType, setBlockType] = useState<"vacation" | "sick_leave" | "personal">("vacation");
  const [blockReason, setBlockReason] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [selectedDaySchedule, setSelectedDaySchedule] = useState<ScheduleItem[] | null>(null);

  // Get current week
  const weekStart = useMemo(() => {
    const d = startOfWeek(selectedDate, { weekStartsOn: 1 });
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [selectedDate]);

  const weekEnd = useMemo(() => {
    return weekStart + 7 * 24 * 60 * 60 * 1000 - 1;
  }, [weekStart]);

  // Get schedule for the week
  const schedule = useQuery(
    api.drivers.getDriverSchedule,
    driverId ? { driverId, startTime: weekStart, endTime: weekEnd } : "skip"
  );

  // Mutations
  const blockTimeOff = useMutation(api.drivers.blockTimeOff);
  const updateTripStatus = useMutation(api.drivers.updateTripStatus);

  const handleBlockTime = async () => {
    if (!blockStartTime || !blockEndTime || !blockReason) {
      toast.error(t("toasts.pleaseFillAllFields"));
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
      toast.success(t("toasts.timeBlockedSuccess"));
      setShowBlockModal(false);
      setBlockReason("");
      setBlockStartTime("");
      setBlockEndTime("");
    } catch (error: any) {
      toast.error(error.message || "Failed to block time");
    }
  };

  const handleUpdateTripStatus = async (scheduleId: Id<"driverSchedules">, status: "in_progress" | "completed" | "cancelled") => {
    try {
      await updateTripStatus({ scheduleId, userId, status });
      toast.success(`Trip status updated to ${status}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_: any, i: any) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i));
  }, [selectedDate]);

  const getScheduleForDay = (date: Date) => {
    return schedule?.filter(s => isSameDay(new Date(s.startTime), date)) || [];
  };

  const getStatusColor = (status: string, type: string) => {
    if (type === "time_off") {
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800";
    }
    if (type === "blocked") {
      return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800";
    }
    if (type === "maintenance") {
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";
    }
    switch (status) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800";
      case "in_progress":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800";
    }
  };

  const getStatusIcon = (type: string, status: string) => {
    if (type === "time_off") return "🏖";
    if (type === "blocked") return "🚫";
    if (type === "maintenance") return "🔧";
    if (status === "completed") return "✓";
    if (status === "in_progress") return "▶";
    if (status === "cancelled") return "✕";
    return "•";
  };

  // Mobile day view
  const [mobileViewDay, setMobileViewDay] = useState<number>(0);

  return (
    <div className="space-y-4">
      {/* Calendar Header - Responsive */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-[100px] shrink-0"
            onClick={() => {
              setSelectedDate(new Date());
              setMobileViewDay(0);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="hidden sm:block text-sm font-medium text-muted-foreground ml-2">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </div>
        </div>
        <Button 
          onClick={() => setShowBlockModal(true)}
          className="w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Block Time
        </Button>
      </div>

      {/* Week Range for Mobile */}
      <div className="sm:hidden text-center text-sm font-medium text-muted-foreground">
        {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
      </div>

      {/* Desktop Week View - Hidden on mobile */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day: any) => {
            const daySchedule = getScheduleForDay(day);
            const today = isToday(day);

            return (
              <Card 
                key={day.toISOString()} 
                className={`min-h-[280px] transition-all duration-200 ${
                  today 
                    ? "ring-2 ring-primary ring-offset-2 shadow-md" 
                    : "hover:shadow-sm"
                }`}
              >
                <CardHeader className="p-3 pb-2 border-b">
                  <div className="text-center">
                    <div className={`text-xs font-semibold uppercase tracking-wide ${
                      today ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {format(day, "EEE")}
                    </div>
                    <div className={`text-2xl font-bold mt-1 ${
                      today ? "text-primary" : "text-foreground"
                    }`}>
                      {format(day, "d")}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-2 max-h-[200px] overflow-y-auto">
                  {daySchedule.length > 0 ? (
                    daySchedule
                      .sort((a, b) => a.startTime - b.startTime)
                      .map((s: any) => (
                        <div
                          key={s._id}
                          className={`p-2 rounded-lg border text-xs transition-all ${getStatusColor(s.status, s.type)}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs">
                              {format(new Date(s.startTime), "HH:mm")}
                            </span>
                            <span className="text-xs opacity-70">
                              {getStatusIcon(s.type, s.status)}
                            </span>
                          </div>
                          {s.type === "trip" && s.tripInfo ? (
                            <>
                              <div className="flex items-center gap-1 mt-1 text-[10px]">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate font-medium">{s.tripInfo.from}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate font-medium">{s.tripInfo.to}</span>
                              </div>
                            </>
                          ) : (
                            <div className="mt-1 text-[10px] font-medium">{s.reason || s.type}</div>
                          )}
                          
                          {/* Status Actions */}
                          {s.type === "trip" && s.status === "scheduled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] w-full mt-2 bg-white/50 hover:bg-white dark:bg-transparent"
                              onClick={() => handleUpdateTripStatus(s._id, "in_progress")}
                            >
                              ▶ Start
                            </Button>
                          )}
                          {s.type === "trip" && s.status === "in_progress" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] w-full mt-2 bg-white/50 hover:bg-white dark:bg-transparent"
                              onClick={() => handleUpdateTripStatus(s._id, "completed")}
                            >
                              ✓ Complete
                            </Button>
                          )}
                        </div>
                      ))
                  ) : (
                    <div className="text-center text-xs text-muted-foreground py-12">
                      <CalendarIcon className="w-6 h-6 mx-auto mb-1 opacity-20" />
                      <span>No trips</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Mobile Day View - Horizontal Scroll */}
      <div className="sm:hidden">
        <Card className="min-h-[320px]">
          <CardHeader className="p-3 pb-2 border-b">
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
                      className={`flex flex-col items-center justify-center min-w-[60px] p-2 rounded-lg transition-all ${
                        isSelected
                          ? today
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-muted text-foreground"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span className={`text-xs font-semibold uppercase ${
                        isSelected ? "" : "text-muted-foreground"
                      }`}>
                        {format(day, "EEE")}
                      </span>
                      <span className={`text-xl font-bold mt-0.5 ${
                        isSelected ? "" : today ? "text-primary" : ""
                      }`}>
                        {format(day, "d")}
                      </span>
                      {daySchedule.length > 0 && (
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          today
                            ? "bg-primary-foreground"
                            : "bg-primary"
                        }`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardHeader>
          <CardContent className="p-3 space-y-2 max-h-[240px] overflow-y-auto">
            {getScheduleForDay(weekDays[mobileViewDay]).length > 0 ? (
              getScheduleForDay(weekDays[mobileViewDay])
                .sort((a, b) => a.startTime - b.startTime)
                .map((s: any) => (
                  <div
                    key={s._id}
                    className={`p-3 rounded-lg border text-sm transition-all ${getStatusColor(s.status, s.type)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold">
                          {format(new Date(s.startTime), "HH:mm")} - {format(new Date(s.endTime), "HH:mm")}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {getStatusIcon(s.type, s.status)}
                      </Badge>
                    </div>
                    {s.type === "trip" && s.tripInfo ? (
                      <>
                        <div className="flex items-start gap-2 mt-2 text-xs">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="font-medium">{s.tripInfo.from}</div>
                            <div className="text-muted-foreground">↓</div>
                            <div className="font-medium">{s.tripInfo.to}</div>
                          </div>
                        </div>
                        {s.tripInfo.purpose && (
                          <div className="mt-2 text-xs text-muted-foreground italic">
                            {s.tripInfo.purpose}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mt-2 text-sm font-medium">{s.reason || s.type}</div>
                    )}
                    
                    {/* Status Actions */}
                    {s.type === "trip" && s.status === "scheduled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3 h-8 text-xs bg-white/50 hover:bg-white dark:bg-transparent"
                        onClick={() => handleUpdateTripStatus(s._id, "in_progress")}
                      >
                        ▶ Start Trip
                      </Button>
                    )}
                    {s.type === "trip" && s.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3 h-8 text-xs bg-white/50 hover:bg-white dark:bg-transparent"
                        onClick={() => handleUpdateTripStatus(s._id, "completed")}
                      >
                        ✓ Complete Trip
                      </Button>
                    )}
                  </div>
                ))
            ) : (
              <div className="text-center text-muted-foreground py-16">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No trips scheduled</p>
                <p className="text-xs mt-1">{format(weekDays[mobileViewDay], "EEEE, MMM d")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend - Responsive */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700" />
          <span className="text-muted-foreground">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-700" />
          <span className="text-muted-foreground">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-gray-100 border border-gray-300 dark:bg-gray-900/30 dark:border-gray-700" />
          <span className="text-muted-foreground">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-300 dark:bg-purple-900/30 dark:border-purple-700" />
          <span className="text-muted-foreground">Time Off</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-orange-100 border border-orange-300 dark:bg-orange-900/30 dark:border-orange-700" />
          <span className="text-muted-foreground">Maintenance</span>
        </div>
      </div>

      {/* Block Time Modal */}
      <Dialog open={showBlockModal} onOpenChange={setShowBlockModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Block Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Type</Label>
              <Select value={blockType} onValueChange={(v) => setBlockType(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">🏖 Vacation</SelectItem>
                  <SelectItem value="sick_leave">🤒 Sick Leave</SelectItem>
                  <SelectItem value="personal">📅 Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Enter reason..."
                rows={3}
              />
            </div>
            <Button onClick={handleBlockTime} className="w-full">
              Block Time
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
