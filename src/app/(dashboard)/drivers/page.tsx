/**
 * Driver Management Page
 * 
 * Features:
 * - Request a driver
 * - View available drivers
 * - Check driver availability
 * - View my driver requests
 * - AI Assistant integration
 */

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Car,
  Calendar,
  AlertCircle,
  Clock,
  MapPin,
  Users,
  Star,
  CheckCircle,
  XCircle,
  Plus,
  Search,
  MessageSquare,
  Clipboard,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Pencil,
  Trash2,
  PhoneCall,
  Navigation2,
  Heart,
  HeartOff,
  Repeat,
  Timer,
  Navigation,
  History,
  ArrowRightLeft,
  ArrowRight,
  Filter,
  SortAsc,
  StickyNote,
  MapPinned,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { DriverStatsCard } from "@/components/drivers/DriverStatsCard";
import { DriverCalendar } from "@/components/drivers/DriverCalendar";
import { MessageTemplates } from "@/components/drivers/MessageTemplates";
import { DriverMap } from "@/components/drivers/DriverMap";
import { CorporateTripFields } from "@/components/drivers/CorporateTripFields";
import { PlaceAutocomplete } from "@/components/drivers/PlaceAutocomplete";
import { DriverShiftControls } from "@/components/drivers/DriverShiftControls";
import { ShiftHistory } from "@/components/drivers/ShiftHistory";
import { CallModal } from "@/components/chat/CallModal";
import type { ActiveCall } from "@/components/chat/ChatClient";

interface TripInfo {
  from: string;
  to: string;
  purpose: string;
  passengerCount: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver Dashboard (shown when user.role === "driver")
// ─────────────────────────────────────────────────────────────────────────────

function DriverDashboard({ userId, organizationId }: { userId: Id<"users">; organizationId: Id<"organizations"> }) {
  const { t } = useTranslation();

  // Get driver record for this user
  const driver = useQuery(api.drivers.getDriverByUserId, { userId });

  // Get pending requests
  const pendingRequests = useQuery(
    api.drivers.getDriverRequests,
    driver ? { driverId: driver._id, status: "pending" as const } : "skip"
  );

  // Get today's schedule
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
    api.drivers.getDriverSchedule,
    driver ? { driverId: driver._id, startTime: todayStart, endTime: todayEnd } : "skip"
  );

  // Mutations
  const respondToRequest = useMutation(api.drivers.respondToDriverRequest);
  const updateAvailability = useMutation(api.drivers.updateDriverAvailability);
  const addDriverNotes = useMutation(api.drivers.addDriverNotes);
  const markArrived = useMutation(api.drivers.markDriverArrived);
  const markPickedUp = useMutation(api.drivers.markPassengerPickedUp);
  const updateETAMutation = useMutation(api.drivers.updateETA);

  // Driver notes state
  const [notesScheduleId, setNotesScheduleId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [etaScheduleId, setEtaScheduleId] = useState<string | null>(null);
  const [etaValue, setEtaValue] = useState("");

  const handleRespond = async (requestId: Id<"driverRequests">, approved: boolean) => {
    if (!driver) return;
    try {
      await respondToRequest({
        requestId,
        driverId: driver._id,
        userId,
        approved,
        declineReason: approved ? undefined : "Declined by driver",
      });
      toast.success(approved ? t("driver.requestApprovedMsg", "Request approved!") : t("driver.requestDeclinedMsg", "Request declined!"));
    } catch (error: any) {
      toast.error(error.message || t("driver.failedToRespond", "Failed to respond"));
    }
  };

  const handleToggleAvailability = async (checked: boolean) => {
    if (!driver) return;
    try {
      await updateAvailability({ driverId: driver._id, isAvailable: checked });
      toast.success(checked ? t("driver.youAreNowAvailable", "You are now available") : t("driver.youAreNowUnavailable", "You are now unavailable"));
    } catch (error: any) {
      toast.error(error.message || t("driver.failedToUpdateAvailability", "Failed to update availability"));
    }
  };

  if (driver === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <ShieldLoader />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Car className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Driver Not Registered</h2>
          <p className="text-muted-foreground">Your driver profile has not been set up yet. Please contact an admin.</p>
        </div>
      </div>
    );
  }

  const todayTrips = todaySchedule?.filter((s) => s.type === "trip" && s.status === "scheduled").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("driver.dashboard", "Driver Dashboard")}</h1>
          <p className="text-muted-foreground">
            {t("driver.dashboardDesc", "Manage your trips and availability")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {driver.isAvailable ? t("driver.available", "Available") : t("driver.busy", "Busy")}
          </span>
          <Switch checked={driver.isAvailable} onCheckedChange={handleToggleAvailability} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.todayTrips", "Today's Trips")}</h3>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTrips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.pendingRequests", "Pending Requests")}</h3>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.totalCompleted", "Total Completed")}</h3>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{driver.totalTrips ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.rating", "Rating")}</h3>
            <Star className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {driver.rating?.toFixed(1) ?? "5.0"}
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shift Management */}
      <DriverShiftControls
        driverId={driver._id}
        userId={userId}
        organizationId={organizationId}
      />

      {/* Pending Requests */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.pendingRequests", "Pending Requests")}</h2>
        </CardHeader>
        <CardContent>
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request._id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        {request.requesterAvatar && <AvatarImage src={request.requesterAvatar} />}
                        <AvatarFallback>
                          {request.requesterName?.split(" ").map((n: string) => n[0]).join("") ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{request.requesterName ?? "Unknown"}</h3>
                        <p className="text-sm text-muted-foreground break-words">
                          {request.tripInfo.from} → {request.tripInfo.to}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.startTime), "MMM dd, HH:mm")} - {format(new Date(request.endTime), "HH:mm")}
                        </p>
                        {request.tripInfo.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{request.tripInfo.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-13 sm:ml-0">
                      <Button size="sm" variant="outline" onClick={() => handleRespond(request._id, false)}>
                        <ThumbsDown className="w-4 h-4 mr-1" />
                        {t("driver.decline", "Decline")}
                      </Button>
                      <Button size="sm" onClick={() => handleRespond(request._id, true)}>
                        <ThumbsUp className="w-4 h-4 mr-1" />
                        {t("driver.approve", "Approve")}
                      </Button>
                    </div>
                  </div>

                  {/* Driver actions: call passenger, message, navigate */}
                  <div className="flex flex-wrap items-center gap-2 ml-13 sm:ml-0">
                    {request.requesterId && (
                      <InAppCallButton
                        callerUserId={userId}
                        callerName={driver?.userName || "Driver"}
                        remoteUserId={request.requesterId}
                        remoteName={request.requesterName || "Passenger"}
                        remotePhone={request.requesterPhone}
                        organizationId={organizationId}
                      />
                    )}
                    {request.requesterId && (
                      <DriverQuickMessage
                        passengerUserId={request.requesterId}
                        passengerName={request.requesterName}
                        driverUserId={userId}
                        organizationId={organizationId}
                        tripInfo={request.tripInfo}
                      />
                    )}
                    {request.tripInfo.pickupCoords && (
                      <NavigatorDropdown
                        label="Pickup"
                        coords={request.tripInfo.pickupCoords}
                      />
                    )}
                    {request.tripInfo.dropoffCoords && (
                      <NavigatorDropdown
                        label="Dropoff"
                        coords={request.tripInfo.dropoffCoords}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("driver.noRequests", "No pending requests")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.todaySchedule", "Today's Schedule")}</h2>
        </CardHeader>
        <CardContent>
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule
                .sort((a, b) => a.startTime - b.startTime)
                .map((schedule) => (
                  <div key={schedule._id} className="flex gap-3 p-3 sm:p-4 border rounded-lg">
                    <div className={`w-2 shrink-0 rounded-full ${schedule.status === "scheduled" ? "bg-blue-500" :
                      schedule.status === "completed" ? "bg-green-500" :
                        "bg-gray-400"
                      }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base">
                            {format(new Date(schedule.startTime), "HH:mm")} - {format(new Date(schedule.endTime), "HH:mm")}
                          </span>
                          <Badge variant={schedule.type === "trip" ? "default" : "secondary"}>
                            {schedule.type}
                          </Badge>
                        </div>
                        {schedule.type === "trip" && (schedule.status === "scheduled" || schedule.status === "in_progress") && (
                          <MessageTemplates
                            passengerName={schedule.userName}
                            passengerPhone={schedule.tripInfo?.passengerPhone}
                            passengerUserId={schedule.userId}
                            driverUserId={userId}
                            driverName={driver?.userName || "Driver"}
                            organizationId={organizationId}
                            tripInfo={schedule.tripInfo}
                          />
                        )}
                      </div>
                      {schedule.tripInfo && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {schedule.tripInfo.from} → {schedule.tripInfo.to}
                        </p>
                      )}
                      {schedule.userName && (
                        <p className="text-xs text-muted-foreground">Passenger: {schedule.userName}</p>
                      )}
                      {schedule.tripInfo?.distanceKm && (
                        <p className="text-xs text-muted-foreground">
                          Distance: {schedule.tripInfo.distanceKm} km | Duration: {schedule.tripInfo.durationMinutes} min
                        </p>
                      )}
                      {/* Navigator buttons for driver */}
                      {schedule.type === "trip" && (schedule.status === "scheduled" || schedule.status === "in_progress") && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {schedule.tripInfo?.pickupCoords && (
                            <NavigatorDropdown label="Pickup" coords={schedule.tripInfo.pickupCoords} />
                          )}
                          {schedule.tripInfo?.dropoffCoords && (
                            <NavigatorDropdown label="Dropoff" coords={schedule.tripInfo.dropoffCoords} />
                          )}

                          {/* Feature #8: Arrived / Picked Up buttons */}
                          {schedule.status === "scheduled" && !schedule.arrivedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                              onClick={async () => {
                                try {
                                  await markArrived({ scheduleId: schedule._id, userId });
                                  toast.success(t("driver.markedAsArrived", "Marked as arrived!"));
                                } catch (e: any) { toast.error(e.message); }
                              }}
                            >
                              <MapPinned className="w-3 h-3" />
                              {t("driver.arrived", "I've Arrived")}
                            </Button>
                          )}
                          {schedule.arrivedAt && !schedule.passengerPickedUpAt && (
                            <>
                              <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200">
                                <Timer className="w-3 h-3 mr-1" />
                                Waiting: {Math.round((Date.now() - schedule.arrivedAt) / 60000)} min
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700"
                                onClick={async () => {
                                  try {
                                    await markPickedUp({ scheduleId: schedule._id, userId });
                                    toast.success(t("driver.passengerPickedUp", "Passenger picked up!"));
                                  } catch (e: any) { toast.error(e.message); }
                                }}
                              >
                                <Users className="w-3 h-3" />
                                {t("driver.passengerIn", "Passenger In")}
                              </Button>
                            </>
                          )}

                          {/* Feature #9: ETA update */}
                          {schedule.status === "scheduled" && !schedule.arrivedAt && (
                            <>
                              {etaScheduleId === schedule._id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={etaValue}
                                    onChange={(e) => setEtaValue(e.target.value)}
                                    className="w-16 h-7 text-xs"
                                    placeholder="min"
                                  />
                                  <Button size="sm" className="h-7 px-2 text-xs" onClick={async () => {
                                    try {
                                      await updateETAMutation({
                                        scheduleId: schedule._id,
                                        userId,
                                        etaMinutes: parseInt(etaValue) || 10,
                                      });
                                      toast.success(t("driver.etaSent", "ETA sent!"));
                                      setEtaScheduleId(null);
                                    } catch (e: any) { toast.error(e.message); }
                                  }}>
                                    {t("driver.send", "Send")}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => setEtaScheduleId(null)}>✕</Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 h-7 px-2 text-xs"
                                  onClick={() => { setEtaScheduleId(schedule._id); setEtaValue("10"); }}
                                >
                                  <Navigation className="w-3 h-3" />
                                  {t("driver.setETA", "Set ETA")}
                                </Button>
                              )}
                            </>
                          )}

                          {/* Feature #7: Driver notes */}
                          {notesScheduleId === schedule._id ? (
                            <div className="flex items-center gap-1 w-full mt-1">
                              <Input
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                className="h-7 text-xs flex-1"
                                placeholder="Add note about trip..."
                              />
                              <Button size="sm" className="h-7 px-2 text-xs" onClick={async () => {
                                try {
                                  await addDriverNotes({ scheduleId: schedule._id, userId, notes: notesText });
                                  toast.success(t("driver.noteSaved", "Note saved!"));
                                  setNotesScheduleId(null);
                                } catch (e: any) { toast.error(e.message); }
                              }}>
                                {t("common.save", "Save")}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={() => setNotesScheduleId(null)}>✕</Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 px-2 text-xs"
                              onClick={() => { setNotesScheduleId(schedule._id); setNotesText(schedule.driverNotes || ""); }}
                            >
                              <StickyNote className="w-3 h-3" />
                              {schedule.driverNotes ? t("driver.editNote", "Edit Note") : t("driver.addNote", "Add Note")}
                            </Button>
                          )}
                          {schedule.driverNotes && notesScheduleId !== schedule._id && (
                            <span className="text-xs text-muted-foreground italic">📝 {schedule.driverNotes}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("driver.noSchedule", "No trips scheduled for today")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Calendar View */}
      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.weeklySchedule", "Weekly Schedule")}</h2>
        </CardHeader>
        <CardContent>
          <DriverCalendar driverId={driver._id} organizationId={organizationId} userId={userId} />
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.tripStatistics", "Trip Statistics")}</h2>
        </CardHeader>
        <CardContent>
          <DriverStatsCard driverId={driver._id} organizationId={organizationId} />
        </CardContent>
      </Card>

      {/* Shift History */}
      <Card className="mt-8">
        <ShiftHistory driverId={driver._id} />
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Passenger helper components for "My Requests" section
// ─────────────────────────────────────────────────────────────────────────────

const NAVIGATOR_LINKS = [
  { id: "google", name: "Google Maps", color: "#4285F4", icon: "🗺️", url: (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
  { id: "yandex", name: "Yandex Maps", color: "#FC3F1D", icon: "🧭", url: (lat: number, lng: number) => `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto` },
  { id: "2gis", name: "2GIS", color: "#1DAD4E", icon: "🏢", url: (lat: number, lng: number) => `https://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}` },
  { id: "waze", name: "Waze", color: "#33CCFF", icon: "🚗", url: (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
];

function NavigatorDropdown({ label, coords }: { label: string; coords: { lat: number; lng: number } }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <Navigation2 className="w-3 h-3" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {NAVIGATOR_LINKS.map((nav) => (
          <DropdownMenuItem key={nav.id} asChild>
            <a
              href={nav.url(coords.lat, coords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <span>{nav.icon}</span>
              <span>{t(`navigator.${nav.id}`, nav.name)}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Generic in-app call button — works for both driver→passenger and passenger→driver */
function InAppCallButton({
  callerUserId,
  callerName,
  remoteUserId,
  remoteName,
  remotePhone,
  organizationId,
  label,
}: {
  callerUserId: Id<"users">;
  callerName: string;
  remoteUserId: Id<"users">;
  remoteName: string;
  remotePhone?: string;
  organizationId: Id<"organizations">;
  label?: string;
}) {
  const { t } = useTranslation();
  const [activeCall, setActiveCall] = React.useState<ActiveCall | null>(null);
  const [calling, setCalling] = React.useState(false);
  const getOrCreateDM = useMutation(api.chat.getOrCreateDM);
  const initiateCallMutation = useMutation(api.chat.initiateCall);

  const handleCall = async () => {
    if (calling) return;
    setCalling(true);
    try {
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: callerUserId,
        targetUserId: remoteUserId,
      });
      const callId = await initiateCallMutation({
        conversationId,
        organizationId,
        initiatorId: callerUserId,
        type: "audio",
        participantIds: [callerUserId, remoteUserId],
      });
      setActiveCall({
        callId,
        conversationId,
        type: "audio",
        isInitiator: true,
        remoteUserId,
        remoteUserName: remoteName,
      });
    } catch (error: any) {
      console.error("Failed to start call:", error);
      if (remotePhone) {
        window.open(`tel:${remotePhone}`);
      } else {
        toast.error("Failed to start call");
      }
    } finally {
      setCalling(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={handleCall} disabled={calling}>
        <PhoneCall className="w-3 h-3" />
        {label || t("driver.call", "Call") + ` ${remoteName}`}
      </Button>
      {activeCall && (
        <CallModal
          call={activeCall}
          currentUserId={callerUserId}
          currentUserName={callerName}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </>
  );
}

function DriverQuickMessage({
  passengerUserId,
  passengerName,
  driverUserId,
  organizationId,
  tripInfo,
}: {
  passengerUserId: Id<"users">;
  passengerName?: string;
  driverUserId: Id<"users">;
  organizationId: Id<"organizations">;
  tripInfo: { from: string; to: string; purpose: string };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const getOrCreateDM = useMutation(api.chat.getOrCreateDM);
  const sendChatMessage = useMutation(api.chat.sendMessage);

  const DRIVER_TEMPLATES = [
    { id: "arrived", label: t("driver.templates.arrived", "I've Arrived"), message: t("driver.templates.arrivedMsg", "Hi! I've arrived at the pickup location. Ready when you are! 🚗") },
    { id: "delayed", label: t("driver.templates.delayed", "Running Late"), message: t("driver.templates.delayedMsg", "Hi! I'm running about 5 minutes late due to traffic. Apologies! ⏰") },
    { id: "waiting", label: t("driver.templates.waiting", "Waiting"), message: t("driver.templates.waitingMsg", "Hi! I'm waiting at the pickup point. Please let me know when you're ready. 👋") },
    { id: "confirming", label: t("driver.templates.confirming", "Confirming Trip"), message: t("driver.templates.confirmingMsg", "Hi! Confirming your trip from {{from}} to {{to}}. See you soon! ✅") },
    { id: "cant_find", label: t("driver.templates.cantFind", "Can't Find Location"), message: t("driver.templates.cantFindMsg", "Hi! I'm having trouble finding the pickup location. Can you provide more details? 📍") },
    { id: "completed", label: t("driver.templates.completed", "Trip Completed"), message: t("driver.templates.completedMsg", "Thank you for choosing our service! Hope you had a great trip. ⭐") },
  ];

  const handleSend = async (message: string) => {
    try {
      const msg = passengerName ? message.replace("Hi!", `Hi ${passengerName}!`) : message;
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: driverUserId,
        targetUserId: passengerUserId,
      });
      await sendChatMessage({
        conversationId,
        senderId: driverUserId,
        organizationId,
        type: "text",
        content: msg,
      });
      toast.success("Message sent to passenger");
      setOpen(false);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <MessageSquare className="w-3 h-3" />
          {t("driver.message", "Message")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {DRIVER_TEMPLATES.map((tpl) => (
          <DropdownMenuItem
            key={tpl.id}
            onClick={() => handleSend(tpl.message)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <span className="font-medium text-sm">{tpl.label}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PassengerQuickMessage({
  driverUserId,
  passengerUserId,
  organizationId,
  tripInfo,
}: {
  driverUserId: Id<"users">;
  passengerUserId: Id<"users">;
  organizationId: Id<"organizations">;
  tripInfo: { from: string; to: string; purpose: string };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const getOrCreateDM = useMutation(api.chat.getOrCreateDM);
  const sendChatMessage = useMutation(api.chat.sendMessage);

  const PASSENGER_TEMPLATES = [
    { id: "omw", label: t("driver.templates.passengerOmw", "On My Way"), message: t("driver.templates.passengerOmwMsg", "Hi! I'm on my way to the pickup point. Be there shortly! 🚶") },
    { id: "ready", label: t("driver.templates.passengerReady", "Ready"), message: t("driver.templates.passengerReadyMsg", "Hi! I'm ready at the pickup location. 📍") },
    { id: "delayed", label: t("driver.templates.passengerDelayed", "Running Late"), message: t("driver.templates.passengerDelayedMsg", "Hi! I'll be about 5 minutes late. Sorry for the wait! ⏰") },
    { id: "cancel", label: t("driver.templates.passengerCancel", "Need to Cancel"), message: t("driver.templates.passengerCancelMsg", "Hi! I need to cancel/reschedule this trip. Sorry for the inconvenience. 🙏") },
    { id: "thanks", label: t("driver.templates.passengerThanks", "Thank You"), message: t("driver.templates.passengerThanksMsg", "Thank you for the ride! Great service! ⭐") },
  ];

  const handleSend = async (message: string) => {
    try {
      const conversationId = await getOrCreateDM({
        organizationId,
        currentUserId: passengerUserId,
        targetUserId: driverUserId,
      });
      await sendChatMessage({
        conversationId,
        senderId: passengerUserId,
        organizationId,
        type: "text",
        content: message,
      });
      toast.success("Message sent to driver");
      setOpen(false);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs">
          <MessageSquare className="w-3 h-3" />
          {t("driver.messageDriver", "Message Driver")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {PASSENGER_TEMPLATES.map((tpl) => (
          <DropdownMenuItem
            key={tpl.id}
            onClick={() => handleSend(tpl.message)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <span className="font-medium text-sm">{tpl.label}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{tpl.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature #1: Rating Dialog (passenger rates driver after trip)
// ─────────────────────────────────────────────────────────────────────────────

function RatingDialog({
  open,
  onOpenChange,
  scheduleId,
  requestId,
  driverId,
  driverName,
  passengerId,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: Id<"driverSchedules">;
  requestId?: Id<"driverRequests">;
  driverId: Id<"drivers">;
  driverName?: string;
  passengerId: Id<"users">;
  organizationId: Id<"organizations">;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitRating = useMutation(api.drivers.submitPassengerRating);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitRating({
        scheduleId,
        requestId,
        passengerId,
        driverId,
        organizationId,
        rating,
        comment: comment || undefined,
      });
      toast.success(t("driver.ratingSubmitted", "Rating submitted! Thank you."));
      onOpenChange(false);
      setRating(5);
      setComment("");
    } catch (error: any) {
      toast.error(error.message || t("driver.failedToSubmitRating", "Failed to submit rating"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {t("driver.rateDriver", "Rate Your Driver")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {driverName && (
            <p className="text-sm text-muted-foreground">
              {t("driver.howWasTrip", "How was your trip with")} <strong>{driverName}</strong>?
            </p>
          )}
          {/* Star rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={`w-8 h-8 ${star <= rating
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-gray-300"
                    }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {rating === 1 && t("driver.poor", "Poor")}
            {rating === 2 && t("driver.fair", "Fair")}
            {rating === 3 && t("driver.good", "Good")}
            {rating === 4 && t("driver.veryGood", "Very Good")}
            {rating === 5 && t("driver.excellent", "Excellent")}
          </p>
          <div>
            <Label>{t("driver.comment", "Comment")} ({t("optional", "Optional")})</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("driver.commentPlaceholder", "Share your experience...")}
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "..." : t("driver.submitRating", "Submit Rating")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature #3: Reassign Driver Dialog
// ─────────────────────────────────────────────────────────────────────────────

function ReassignDriverDialog({
  open,
  onOpenChange,
  requestId,
  userId,
  organizationId,
  currentDriverId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: Id<"driverRequests">;
  userId: Id<"users">;
  organizationId: Id<"organizations">;
  currentDriverId: Id<"drivers">;
}) {
  const { t } = useTranslation();
  const [selectedNewDriver, setSelectedNewDriver] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const availableDrivers = useQuery(api.drivers.getAvailableDrivers, { organizationId });
  const reassign = useMutation(api.drivers.reassignDriverRequest);

  const otherDrivers = availableDrivers?.filter((d) => d && d._id !== currentDriverId) ?? [];

  const handleReassign = async () => {
    if (!selectedNewDriver) return;
    setSubmitting(true);
    try {
      await reassign({
        requestId,
        userId,
        newDriverId: selectedNewDriver as Id<"drivers">,
      });
      toast.success(t("driver.reassigned", "Request sent to new driver!"));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || t("driver.failedToReassign", "Failed to reassign"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            {t("driver.requestAnotherDriver", "Request Another Driver")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedNewDriver} onValueChange={setSelectedNewDriver}>
            <SelectTrigger>
              <SelectValue placeholder={t("driver.selectNewDriver", "Choose another driver")} />
            </SelectTrigger>
            <SelectContent>
              {otherDrivers.filter(Boolean).map((driver) => (
                <SelectItem key={driver!._id} value={driver!._id}>
                  <div className="flex items-center gap-2">
                    <span>{driver!.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {driver!.vehicleInfo.model} · ⭐{driver!.rating.toFixed(1)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleReassign} disabled={submitting || !selectedNewDriver}>
              {submitting ? "..." : t("driver.reassign", "Send Request")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DriversPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Debug logging
  React.useEffect(() => {
    console.log('[DriversPage] mounted:', mounted);
    console.log('[DriversPage] user:', user);
    console.log('[DriversPage] userId:', user?.id);
    console.log('[DriversPage] organizationId:', user?.organizationId);
  }, [mounted, user]);

  const [selectedDriver, setSelectedDriver] = useState<Id<"drivers"> | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Set default start/end times when modal opens
  useEffect(() => {
    if (showRequestModal) {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      
      // Format as datetime-local string (YYYY-MM-DDTHH:mm)
      const formatDateTimeLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };
      
      setStartTime(formatDateTimeLocal(now));
      setEndTime(formatDateTimeLocal(oneHourLater));
    }
  }, [showRequestModal]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarDriverId, setCalendarDriverId] = useState<Id<"drivers"> | null>(null);
  const [selectedScheduleDetail, setSelectedScheduleDetail] = useState<any>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editTripInfo, setEditTripInfo] = useState<TripInfo>({ from: "", to: "", purpose: "", passengerCount: 1, notes: "" });
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);

  // Form state
  const [tripInfo, setTripInfo] = useState<TripInfo>({
    from: "",
    to: "",
    purpose: "",
    passengerCount: 1,
    notes: "",
  });
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number; address?: string } | undefined>();
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number; address?: string } | undefined>();
  
  // Corporate features state
  const [tripPriority, setTripPriority] = useState<"P0" | "P1" | "P2" | "P3">("P2");
  const [tripCategory, setTripCategory] = useState<"client_meeting" | "airport" | "office_transfer" | "emergency" | "team_event" | "personal">("office_transfer");
  const [costCenter, setCostCenter] = useState<string>("");
  const [businessJustification, setBusinessJustification] = useState<string>("");
  const [requiresApproval, setRequiresApproval] = useState<boolean>(false);

  const handleLocationSelect = (location: { lat: number; lng: number; address?: string }, type: "pickup" | "dropoff") => {
    if (type === "pickup") {
      setPickupCoords(location);
      setTripInfo(prev => ({ ...prev, from: location.address || prev.from }));
    } else {
      setDropoffCoords(location);
      setTripInfo(prev => ({ ...prev, to: location.address || prev.to }));
    }
  };

  // Driver registration form
  const [selectedDriverUserId, setSelectedDriverUserId] = useState<Id<"users"> | "">("");
  const [vehicleInfo, setVehicleInfo] = useState({
    model: "",
    plateNumber: "",
    capacity: 4,
    color: "",
    year: new Date().getFullYear(),
  });
  const [workingHours, setWorkingHours] = useState({
    startTime: "09:00",
    endTime: "18:00",
    workingDays: [1, 2, 3, 4, 5],
  });
  const [maxTripsPerDay, setMaxTripsPerDay] = useState(3);

  // Get user IDs from auth store
  const userId = user?.id as Id<"users"> | undefined;
  const organizationId = user?.organizationId as Id<"organizations"> | undefined;

  // Get all users in organization to select driver
  const allUsers = useQuery(
    api.users.getUsersByOrganizationId,
    mounted && organizationId ? { requesterId: userId!, organizationId } : "skip"
  );

  // Get available drivers
  const availableDrivers = useQuery(
    api.drivers.getAvailableDrivers,
    mounted && organizationId ? { organizationId } : "skip"
  );

  // Get my driver requests
  const myRequests = useQuery(
    api.drivers.getMyRequests,
    mounted && userId ? { userId } : "skip"
  );

  // Calendar week range for selected driver
  const calendarWeekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.getTime();
  }, []);
  const calendarWeekEnd = useMemo(() => {
    return calendarWeekStart + 7 * 24 * 60 * 60 * 1000 - 1;
  }, [calendarWeekStart]);

  const calendarSchedule = useQuery(
    api.drivers.getDriverSchedule,
    calendarDriverId ? { driverId: calendarDriverId, startTime: calendarWeekStart, endTime: calendarWeekEnd } : "skip"
  );

  // Filter users with role 'driver' who are not yet registered
  const unregisteredDrivers = useMemo(() => {
    if (!allUsers || !availableDrivers) return [];

    const registeredUserIds = new Set(availableDrivers.filter(Boolean).map(d => d!.userId));
    return allUsers.filter(u => u.role === "driver" && !registeredUserIds.has(u._id));
  }, [allUsers, availableDrivers]);

  // Mutations - MUST be called unconditionally at top level
  const requestDriver = useMutation(api.drivers.requestDriver);
  const requestCalendarAccess = useMutation(api.drivers.requestCalendarAccess);
  const registerAsDriver = useMutation(api.drivers.registerAsDriver);
  const updateDriverRequest = useMutation(api.drivers.updateDriverRequest);
  const deleteDriverRequest = useMutation(api.drivers.deleteDriverRequest);

  // New feature mutations
  const addFavorite = useMutation(api.drivers.addFavoriteDriver);
  const removeFavorite = useMutation(api.drivers.removeFavoriteDriver);
  const createRecurring = useMutation(api.drivers.createRecurringTrip);
  const toggleRecurring = useMutation(api.drivers.toggleRecurringTrip);
  const deleteRecurring = useMutation(api.drivers.deleteRecurringTrip);
  const reassignRequest = useMutation(api.drivers.reassignDriverRequest);

  // New feature queries
  const favoriteDrivers = useQuery(
    api.drivers.getFavoriteDrivers,
    mounted && userId ? { userId } : "skip"
  );
  const recurringTrips = useQuery(
    api.drivers.getRecurringTrips,
    mounted && userId ? { userId } : "skip"
  );
  const completedTrips = useQuery(
    api.drivers.getCompletedTrips,
    mounted && userId ? { userId, limit: 50 } : "skip"
  );

  // Check if selected driver is on leave
  const driverLeaveCheck = useQuery(
    api.drivers.isDriverOnLeave,
    selectedDriver && startTime && endTime
      ? {
          driverId: selectedDriver,
          startTime: new Date(startTime).getTime(),
          endTime: new Date(endTime).getTime(),
        }
      : "skip"
  );

  const checkDriverLeave = async (args: { driverId: Id<"drivers">; startTime: number; endTime: number }) => {
    // For immediate check, we'll use the query result
    return driverLeaveCheck || { onLeave: false, leave: null };
  };

  // Feature #1: Rating dialog state
  const [ratingDialog, setRatingDialog] = useState<{
    open: boolean;
    scheduleId?: Id<"driverSchedules">;
    requestId?: Id<"driverRequests">;
    driverId?: Id<"drivers">;
    driverName?: string;
  }>({ open: false });

  // Feature #3: Reassign dialog state
  const [reassignDialog, setReassignDialog] = useState<{
    open: boolean;
    requestId?: Id<"driverRequests">;
    currentDriverId?: Id<"drivers">;
  }>({ open: false });

  // Feature #4: Filter state
  const [filterCapacity, setFilterCapacity] = useState<number>(0);
  const [filterSortBy, setFilterSortBy] = useState<string>("rating");

  // Feature #5: Recurring trip form
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [recurringStartTime, setRecurringStartTime] = useState("08:30");
  const [recurringEndTime, setRecurringEndTime] = useState("09:00");

  // Favorite driver IDs set for quick lookup
  const favoriteDriverIds = useMemo(() => {
    const ids = favoriteDrivers?.map((f: any) => f?.driver?._id).filter(Boolean) ?? [];
    return new Set<string>(ids as string[]);
  }, [favoriteDrivers]);

  // Feature #4: active tab for requests section
  const [requestsTab, setRequestsTab] = useState<string>("active");

  // Filter drivers by search + capacity + sort
  const filteredDrivers = useMemo(() => {
    if (!availableDrivers) return [];
    let result = [...availableDrivers].filter(Boolean) as NonNullable<typeof availableDrivers[number]>[];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) =>
        d!.userName.toLowerCase().includes(q) ||
        d!.vehicleInfo.model.toLowerCase().includes(q) ||
        d!.vehicleInfo.plateNumber.toLowerCase().includes(q)
      );
    }

    // Capacity filter
    if (filterCapacity > 0) {
      result = result.filter((d) => d!.vehicleInfo.capacity >= filterCapacity);
    }

    // Sort
    if (filterSortBy === "rating") {
      result.sort((a, b) => ((b?.rating ?? 0) - (a?.rating ?? 0)));
    } else if (filterSortBy === "trips") {
      result.sort((a, b) => ((b?.totalTrips ?? 0) - (a?.totalTrips ?? 0)));
    } else if (filterSortBy === "name") {
      result.sort((a, b) => (a?.userName ?? "").localeCompare(b?.userName ?? ""));
    }

    // Favorites first
    result.sort((a, b) => {
      const aFav = favoriteDriverIds.has(a?._id) ? 0 : 1;
      const bFav = favoriteDriverIds.has(b?._id) ? 0 : 1;
      return aFav - bFav;
    });

    return result;
  }, [availableDrivers, searchQuery, filterCapacity, filterSortBy, favoriteDriverIds]);

  // Handle driver request
  const handleRequestDriver = async () => {
    console.log('[RequestDriver] handleRequestDriver called', { userId, organizationId, selectedDriver, startTime, endTime });
    if (!userId || !organizationId || !selectedDriver) {
      toast.error(t("driver.pleaseSelectDriver", "Please select a driver"));
      return;
    }

    if (!startTime || !endTime) {
      toast.error(t("driver.pleaseSelectStartEnd", "Please select start and end time"));
      return;
    }

    try {
      // Parse datetime-local values correctly
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      // Validate start is before end
      if (start >= end) {
        toast.error(t("driver.startBeforeEnd", "Start time must be before end time"));
        return;
      }

      // Check if driver is on leave BEFORE submitting
      const leaveCheck = await checkDriverLeave({
        driverId: selectedDriver,
        startTime: start,
        endTime: end,
      });

      if (leaveCheck?.onLeave && leaveCheck?.leave) {
        toast.error(
          t("driver.driverOnLeaveBlock", "Невозможно заказать водителя: он находится в отпуске"),
          {
            description: `Водитель в отпуске с ${leaveCheck.leave.startDate} по ${leaveCheck.leave.endDate}. Выберите другого водителя.`,
            duration: 8000,
          }
        );
        return;
      }

      await requestDriver({
        organizationId,
        requesterId: userId,
        driverId: selectedDriver,
        startTime: start,
        endTime: end,
        tripInfo: {
          ...tripInfo,
          pickupCoords: pickupCoords ? { lat: pickupCoords.lat, lng: pickupCoords.lng } : undefined,
          dropoffCoords: dropoffCoords ? { lat: dropoffCoords.lat, lng: dropoffCoords.lng } : undefined,
        },
        // Corporate features
        priority: tripPriority,
        tripCategory,
        costCenter: costCenter || undefined,
        businessJustification: businessJustification || tripInfo.purpose,
        requiresApproval,
      });

      toast.success(t("driver.requestSubmitted", "Request submitted!"));
      setShowRequestModal(false);
      setTripInfo({
        from: "",
        to: "",
        purpose: "",
        passengerCount: 1,
        notes: "",
      });
      setPickupCoords(undefined);
      setDropoffCoords(undefined);
      // Reset corporate fields
      setTripPriority("P2");
      setTripCategory("office_transfer");
      setCostCenter("");
      setBusinessJustification("");
      setRequiresApproval(false);
    } catch (error: any) {
      console.error('[RequestDriver] Error:', error);
      toast.error(error.message || t("driver.failedToRequestDriver", "Failed to request driver"));
    }
  };

  // Handle calendar access request
  const handleRequestAccess = async (driverUserId: Id<"users">) => {
    if (!userId || !organizationId) return;

    try {
      await requestCalendarAccess({
        organizationId,
        requesterId: userId,
        driverUserId,
      });

      toast.success(t("driver.accessRequestSent", "Access request sent!"));
    } catch (error: any) {
      toast.error(error.message || t("driver.failedToRequestAccess", "Failed to request access"));
    }
  };

  // Handle driver registration
  const handleRegisterDriver = async () => {
    if (!userId || !organizationId) {
      toast.error(t("driver.pleaseLogin", "Please log in"));
      return;
    }

    if (!selectedDriverUserId || selectedDriverUserId === "none") {
      toast.error(t("driver.pleaseSelectDriverToRegister", "Please select a driver to register"));
      return;
    }

    if (!vehicleInfo.model || !vehicleInfo.plateNumber) {
      toast.error(t("driver.pleaseFillVehicleInfo", "Please fill in vehicle model and plate number"));
      return;
    }

    console.log('[DriverRegistration] Starting registration:', {
      selectedDriverUserId,
      organizationId,
      vehicleInfo,
      workingHours,
      maxTripsPerDay,
    });

    try {
      await registerAsDriver({
        organizationId,
        userId: selectedDriverUserId,
        vehicleInfo,
        workingHours,
        maxTripsPerDay,
      });

      console.log('[DriverRegistration] Success!');
      toast.success(t("driver.successfullyRegistered", "Successfully registered as driver!"));
      setShowRegisterModal(false);
      setSelectedDriverUserId("");
      // Refresh data
      setVehicleInfo({
        model: "",
        plateNumber: "",
        capacity: 4,
        color: "",
        year: new Date().getFullYear(),
      });
    } catch (error: any) {
      console.error('[DriverRegistration] Error:', error);
      toast.error(error.message || t("driver.failedToRegister", "Failed to register as driver"));
    }
  };

  // Show loading while mounting
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full">
        <ShieldLoader />
      </div>
    );
  }

  // Handle case when user is not logged in
  if (!user || !userId || !organizationId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-xl font-semibold mb-2">Please log in</h2>
          <p className="text-muted-foreground mb-4">
            User: {user ? 'Loaded' : 'Not loaded'} |
            ID: {userId || 'N/A'} |
            Org: {organizationId || 'N/A'}
          </p>
          <Button onClick={() => router.push("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  // Show driver dashboard if user is a driver
  if (user.role === "driver") {
    return <DriverDashboard userId={userId} organizationId={organizationId} />;
  }

  return (
    <div className="max-w-[1600px] mx-auto p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">{t("driver.booking", "Driver Booking")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t("driver.bookingDesc", "Book a driver for your business trips and transfers")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowRegisterModal(true)}>
            <Car className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{t("driver.registerDriver", "Register as Driver")}</span>
            <span className="sm:hidden">Register</span>
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setShowRequestModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">{t("driver.requestDriver", "Request Driver")}</span>
            <span className="sm:hidden">Request</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.availableDrivers", "Available Drivers")}</h3>
            <Car className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredDrivers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.pendingRequests", "Pending Requests")}</h3>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myRequests?.filter((r) => r.status === "pending").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.totalTrips", "Total Trips")}</h3>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myRequests?.filter((r) => r.status === "approved").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Drivers */}
      <Card className="mb-6 sm:mb-8">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <h2 className="text-lg sm:text-xl font-semibold">{t("driver.availableDrivers", "Available Drivers")}</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("driver.searchDriver", "Search driver...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
            </div>
            {/* Feature #4: Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={String(filterCapacity)} onValueChange={(v) => setFilterCapacity(Number(v))}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder={t("driver.minSeats", "Min seats")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("driver.anyCapacity", "Any capacity")}</SelectItem>
                  <SelectItem value="2">{t("driver.seats2Plus", "2+ seats")}</SelectItem>
                  <SelectItem value="4">{t("driver.seats4Plus", "4+ seats")}</SelectItem>
                  <SelectItem value="6">{t("driver.seats6Plus", "6+ seats")}</SelectItem>
                  <SelectItem value="8">{t("driver.seats8Plus", "8+ seats")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterSortBy} onValueChange={setFilterSortBy}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SortAsc className="w-3 h-3 mr-1" />
                  <SelectValue placeholder={t("driver.sortBy", "Sort by")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">{t("driver.byRating", "By Rating")}</SelectItem>
                  <SelectItem value="trips">{t("driver.byTrips", "By Trips")}</SelectItem>
                  <SelectItem value="name">{t("driver.byName", "By Name")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {availableDrivers === undefined ? (
            <div className="text-center py-8">
              <ShieldLoader />
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">{t("driver.noDriversFound", "No drivers found")}</p>
              <p className="text-sm">
                {searchQuery
                  ? t("driver.tryDifferentSearch", "Try a different search term")
                  : t("driver.registerDriverHint", "To register as a driver, go to Employees and set role to 'Driver', then add vehicle information")}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-4" onClick={() => router.push("/employees")}>
                  <Users className="w-4 h-4 mr-2" />
                  {t("driver.goToEmployees", "Go to Employees")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDrivers.map((driver) => (
                <Card key={driver._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-start gap-4">
                      <Avatar className="w-12 h-12">
                        {driver.userAvatar && <AvatarImage src={driver.userAvatar} />}
                        <AvatarFallback>
                          {driver.userName?.split(" ").map((n: string) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold">{driver.userName}</h3>
                        <p className="text-sm text-muted-foreground">{driver.userPosition}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          <span className="text-sm font-medium">{driver.rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">
                            ({driver.totalTrips} {t("driver.trips", "trips")})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span>{driver.vehicleInfo.model}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{driver.vehicleInfo.capacity} {t("driver.seats", "seats")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono">{driver.vehicleInfo.plateNumber}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedDriver(driver._id);
                          setShowRequestModal(true);
                        }}
                      >
                        {t("driver.book", "Book")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCalendarDriverId(driver._id);
                          setShowCalendarModal(true);
                        }}
                      >
                        <Calendar className="w-4 h-4" />
                      </Button>
                      {/* Feature #6: Favorite */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!userId || !organizationId) return;
                          try {
                            if (favoriteDriverIds.has(driver._id)) {
                              await removeFavorite({ userId, driverId: driver._id });
                              toast.success(t("driver.removedFromFavorites", "Removed from favorites"));
                            } else {
                              await addFavorite({ organizationId, userId, driverId: driver._id });
                              toast.success(t("driver.addedToFavorites", "Added to favorites"));
                            }
                          } catch (e: any) {
                            toast.error(e.message || t("driver.failed", "Failed"));
                          }
                        }}
                      >
                        {favoriteDriverIds.has(driver._id) ? (
                          <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                        ) : (
                          <Heart className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Requests - with tabs for Active / History / Recurring */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.myRequests", "My Driver Requests")}</h2>
        </CardHeader>
        <CardContent>
          <Tabs value={requestsTab} onValueChange={setRequestsTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="gap-1">
                <Clock className="w-3 h-3" />
                {t("driver.active", "Active")}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1">
                <History className="w-3 h-3" />
                {t("driver.history", "History")}
              </TabsTrigger>
              <TabsTrigger value="recurring" className="gap-1">
                <Repeat className="w-3 h-3" />
                {t("driver.recurring", "Recurring")}
              </TabsTrigger>
            </TabsList>

            {/* Active Requests Tab */}
            <TabsContent value="active">
              {myRequests && myRequests.length > 0 ? (
                <div className="space-y-3">
                  {myRequests.filter((r) => r.status !== "cancelled" && r.scheduleStatus !== "completed").map((request) => (
                    <div
                      key={request._id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      {editingRequestId === request._id ? (
                        /* Edit mode */
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">{t("driver.pickupLocation", "From")}</Label>
                              <PlaceAutocomplete
                                value={editTripInfo.from}
                                onChange={(val) => setEditTripInfo({ ...editTripInfo, from: val })}
                                onSelect={(place) => setEditTripInfo((prev) => ({ ...prev, from: place.address }))}
                                placeholder="From"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{t("driver.dropoffLocation", "To")}</Label>
                              <PlaceAutocomplete
                                value={editTripInfo.to}
                                onChange={(val) => setEditTripInfo({ ...editTripInfo, to: val })}
                                onSelect={(place) => setEditTripInfo((prev) => ({ ...prev, to: place.address }))}
                                placeholder="To"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">{t("driver.tripPurpose", "Purpose")}</Label>
                            <Input
                              value={editTripInfo.purpose}
                              onChange={(e) => setEditTripInfo({ ...editTripInfo, purpose: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">{t("driver.startTime", "Start")}</Label>
                              <Input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">{t("driver.endTime", "End")}</Label>
                              <Input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="h-8 text-sm" />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">{t("driver.passengerCount", "Passengers")}</Label>
                            <Input type="number" min={1} max={10} value={editTripInfo.passengerCount} onChange={(e) => setEditTripInfo({ ...editTripInfo, passengerCount: parseInt(e.target.value) || 1 })} className="h-8 text-sm w-full sm:w-1/2" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setEditingRequestId(null)}>
                              {t("cancel", "Cancel")}
                            </Button>
                            <Button size="sm" onClick={async () => {
                              if (!userId) return;
                              try {
                                await updateDriverRequest({
                                  requestId: request._id as Id<"driverRequests">,
                                  userId,
                                  startTime: new Date(editStartTime).getTime(),
                                  endTime: new Date(editEndTime).getTime(),
                                  tripInfo: editTripInfo,
                                });
                                toast.success(t("driver.requestUpdated", "Request updated"));
                                setEditingRequestId(null);
                              } catch (e: any) {
                                toast.error(e.message || "Failed to update");
                              }
                            }}>
                              {t("common.save", "Save")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-2 h-12 shrink-0 rounded-full ${request.status === "approved"
                                ? "bg-green-500"
                                : request.status === "declined"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                                }`}
                            />
                            <div className="min-w-0">
                              <h3 className="font-semibold truncate">{request.driverName}</h3>
                              <p className="text-sm text-muted-foreground break-words">
                                {request.tripInfo.from} → {request.tripInfo.to}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(request.startTime), "MMM dd, HH:mm")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 ml-5 sm:ml-0">
                            <Badge
                              variant={
                                request.status === "approved"
                                  ? "default"
                                  : request.status === "declined"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {request.status === "approved" && <CheckCircle className="w-3 h-3 mr-1" />}
                              {request.status === "declined" && <XCircle className="w-3 h-3 mr-1" />}
                              {request.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                              {t(`driver.status.${request.status}`, request.status)}
                            </Badge>

                            {/* Edit button - for pending and approved requests */}
                            {(request.status === "pending" || request.status === "approved") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditingRequestId(request._id);
                                  setEditTripInfo(request.tripInfo);
                                  setEditStartTime(new Date(request.startTime).toISOString().slice(0, 16));
                                  setEditEndTime(new Date(request.endTime).toISOString().slice(0, 16));
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                                {t("common.edit", "Edit")}
                              </Button>
                            )}

                            {/* Delete button */}
                            {deletingRequestId === request._id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-xs"
                                  onClick={async () => {
                                    if (!userId) return;
                                    try {
                                      await deleteDriverRequest({
                                        requestId: request._id as Id<"driverRequests">,
                                        userId,
                                      });
                                      toast.success(t("driver.requestDeleted", "Request deleted"));
                                      setDeletingRequestId(null);
                                    } catch (e: any) {
                                      toast.error(e.message || "Failed to delete");
                                    }
                                  }}
                                >
                                  {t("common.yes", "Yes")}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDeletingRequestId(null)}>
                                  {t("common.no", "No")}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-7 px-2 text-xs text-red-500 border-red-200 hover:bg-red-50"
                                onClick={() => setDeletingRequestId(request._id)}
                              >
                                <Trash2 className="w-3 h-3" />
                                {t("common.delete", "Delete")}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {request.status === "declined" && request.declineReason && !editingRequestId && (
                        <div className="ml-6 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {t("driver.declineReason", "Reason")}: {request.declineReason}
                          </p>
                          {/* Feature #3: Reassign to another driver */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 px-2 text-xs"
                            onClick={() => setReassignDialog({
                              open: true,
                              requestId: request._id as Id<"driverRequests">,
                              currentDriverId: request.driverId as Id<"drivers">,
                            })}
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            {t("driver.requestAnotherDriver", "Request Another Driver")}
                          </Button>
                        </div>
                      )}

                      {/* Feature #9: ETA display for approved/in_progress trips */}
                      {(request.status === "approved") && (request as any).etaMinutes != null && !editingRequestId && (
                        <div className="ml-6 flex items-center gap-2 text-sm">
                          <Navigation className="w-4 h-4 text-blue-500" />
                          <span className="text-blue-600 font-medium">
                            ETA: ~{(request as any).etaMinutes} min
                          </span>
                          {(request as any).etaUpdatedAt && (
                            <span className="text-xs text-muted-foreground">
                              (updated {format(new Date((request as any).etaUpdatedAt), "HH:mm")})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Feature #8: Wait time display */}
                      {(request as any).waitTimeMinutes != null && !editingRequestId && (
                        <div className="ml-6 flex items-center gap-2 text-sm text-muted-foreground">
                          <Timer className="w-4 h-4" />
                          <span>Wait time: {(request as any).waitTimeMinutes} min</span>
                        </div>
                      )}

                      {/* Feature #7: Driver notes display */}
                      {(request as any).driverNotes && !editingRequestId && (
                        <div className="ml-6 flex items-center gap-2 text-sm text-muted-foreground">
                          <StickyNote className="w-3 h-3" />
                          <span className="italic">{(request as any).driverNotes}</span>
                        </div>
                      )}

                      {/* Passenger actions for approved requests: contact driver + navigation */}
                      {request.status === "approved" && !editingRequestId && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 ml-5">
                          {/* Contact driver via Team Chat call */}
                          {request.driverUserId && userId && user?.organizationId && (
                            <InAppCallButton
                              callerUserId={userId}
                              callerName={user.name}
                              remoteUserId={request.driverUserId as Id<"users">}
                              remoteName={request.driverName || "Driver"}
                              remotePhone={request.driverPhone}
                              organizationId={user.organizationId as Id<"organizations">}
                            />
                          )}

                          {/* Quick message to driver */}
                          {request.driverUserId && userId && user?.organizationId && (
                            <PassengerQuickMessage
                              driverUserId={request.driverUserId as Id<"users">}
                              passengerUserId={userId}
                              organizationId={user.organizationId as Id<"organizations">}
                              tripInfo={request.tripInfo}
                            />
                          )}

                          {/* Navigator buttons for pickup/dropoff */}
                          {request.tripInfo.pickupCoords && (
                            <NavigatorDropdown
                              label="Navigate to Pickup"
                              coords={request.tripInfo.pickupCoords}
                            />
                          )}
                          {request.tripInfo.dropoffCoords && (
                            <NavigatorDropdown
                              label="Navigate to Destination"
                              coords={request.tripInfo.dropoffCoords}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clipboard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t("driver.noRequests", "No driver requests yet")}</p>
                </div>
              )}
            </TabsContent>

            {/* Feature #2: History Tab - Completed Trips */}
            <TabsContent value="history">
              {completedTrips && completedTrips.length > 0 ? (
                <div className="space-y-3">
                  {completedTrips.map((trip) => (
                    <div key={trip._id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-12 rounded-full bg-green-500" />
                          <div>
                            <h3 className="font-semibold">{trip.driverName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {trip.tripInfo.from} → {trip.tripInfo.to}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(trip.startTime), "MMM dd, HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t("driver.status.completed", "Completed")}
                          </Badge>
                        </div>
                      </div>

                      {/* Driver notes */}
                      {trip.driverNotes && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-5">
                          <StickyNote className="w-3 h-3" />
                          <span className="italic">{trip.driverNotes}</span>
                        </div>
                      )}

                      {/* Wait time */}
                      {trip.waitTimeMinutes != null && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-5">
                          <Timer className="w-3 h-3" />
                          <span>Wait time: {trip.waitTimeMinutes} min</span>
                        </div>
                      )}

                      {/* Feature #1: Rating */}
                      <div className="ml-5">
                        {trip.hasRated ? (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">Your rating:</span>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${s <= (trip.passengerRating ?? 0)
                                  ? "fill-yellow-500 text-yellow-500"
                                  : "text-gray-300"
                                  }`}
                              />
                            ))}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-xs"
                            onClick={() =>
                              setRatingDialog({
                                open: true,
                                scheduleId: trip.scheduleId as Id<"driverSchedules">,
                                requestId: trip._id as Id<"driverRequests">,
                                driverId: trip.driverId as Id<"drivers">,
                                driverName: trip.driverName,
                              })
                            }
                          >
                            <Star className="w-3 h-3" />
                            {t("driver.rateDriver", "Rate Driver")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t("driver.noCompletedTrips", "No completed trips yet")}</p>
                </div>
              )}
            </TabsContent>

            {/* Feature #5: Recurring Trips Tab */}
            <TabsContent value="recurring">
              <div className="space-y-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setShowRecurringModal(true)}
                >
                  <Plus className="w-4 h-4" />
                  {t("driver.createRecurringTrip", "Create Recurring Trip")}
                </Button>

                {recurringTrips && recurringTrips.length > 0 ? (
                  <div className="space-y-3">
                    {recurringTrips.map((trip) => (
                      <div key={trip._id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-sm">
                              {trip.tripInfo.from} → {trip.tripInfo.to}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {trip.tripInfo.purpose} · {trip.driverName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {trip.schedule.startTime} - {trip.schedule.endTime} ·{" "}
                              {trip.schedule.daysOfWeek
                                .map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                                .join(", ")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={trip.isActive}
                              onCheckedChange={async (checked) => {
                                if (!userId) return;
                                try {
                                  await toggleRecurring({
                                    recurringTripId: trip._id as any,
                                    userId,
                                    isActive: checked,
                                  });
                                  toast.success(checked ? t("driver.activated", "Activated") : t("driver.paused", "Paused"));
                                } catch (e: any) {
                                  toast.error(e.message);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500"
                              onClick={async () => {
                                if (!userId) return;
                                try {
                                  await deleteRecurring({
                                    recurringTripId: trip._id as any,
                                    userId,
                                  });
                                  toast.success(t("driver.deleted", "Deleted"));
                                } catch (e: any) {
                                  toast.error(e.message);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Repeat className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t("driver.noRecurringTrips", "No recurring trips")}</p>
                    <p className="text-sm mt-1">{t("driver.createOneForDailyCommutes", "Create one for daily commutes!")}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Feature #1: Rating Dialog */}
      {ratingDialog.scheduleId && ratingDialog.driverId && userId && organizationId && (
        <RatingDialog
          open={ratingDialog.open}
          onOpenChange={(open) => setRatingDialog((prev) => ({ ...prev, open }))}
          scheduleId={ratingDialog.scheduleId}
          requestId={ratingDialog.requestId}
          driverId={ratingDialog.driverId}
          driverName={ratingDialog.driverName}
          passengerId={userId}
          organizationId={organizationId}
        />
      )}

      {/* Feature #3: Reassign Dialog */}
      {reassignDialog.requestId && reassignDialog.currentDriverId && userId && organizationId && (
        <ReassignDriverDialog
          open={reassignDialog.open}
          onOpenChange={(open) => setReassignDialog((prev) => ({ ...prev, open }))}
          requestId={reassignDialog.requestId}
          userId={userId}
          organizationId={organizationId}
          currentDriverId={reassignDialog.currentDriverId}
        />
      )}

      {/* Feature #5: Recurring Trip Creation Modal */}
      <Dialog open={showRecurringModal} onOpenChange={setShowRecurringModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="w-5 h-5" />
              {t("driver.createRecurringTrip", "Create Recurring Trip")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("driver.selectDriver", "Select Driver")}</Label>
              <Select value={selectedDriver || ""} onValueChange={(v) => setSelectedDriver(v as Id<"drivers">)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("driver.chooseDriver", "Choose a driver")} />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers?.filter(Boolean).map((driver) => (
                    <SelectItem key={driver!._id} value={driver!._id}>
                      {driver!.userName} - {driver!.vehicleInfo.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("driver.from", "From")}</Label>
                <Input
                  value={tripInfo.from}
                  onChange={(e) => setTripInfo({ ...tripInfo, from: e.target.value })}
                  placeholder={t("driver.pickup", "Pickup")}
                />
              </div>
              <div>
                <Label>{t("driver.to", "To")}</Label>
                <Input
                  value={tripInfo.to}
                  onChange={(e) => setTripInfo({ ...tripInfo, to: e.target.value })}
                  placeholder={t("driver.dropoff", "Destination")}
                />
              </div>
            </div>
            <div>
              <Label>{t("driver.purpose", "Purpose")}</Label>
              <Input
                value={tripInfo.purpose}
                onChange={(e) => setTripInfo({ ...tripInfo, purpose: e.target.value })}
                placeholder={t("driver.purposePlaceholder", "e.g., Daily commute")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("driver.departureTime", "Departure Time")}</Label>
                <Input
                  type="time"
                  value={recurringStartTime}
                  onChange={(e) => setRecurringStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("driver.arrivalTime", "Arrival Time")}</Label>
                <Input
                  type="time"
                  value={recurringEndTime}
                  onChange={(e) => setRecurringEndTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>{t("driver.days", "Days")}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                  <Button
                    key={day}
                    size="sm"
                    variant={recurringDays.includes(idx) ? "default" : "outline"}
                    className="h-8 w-10 p-0 text-xs"
                    onClick={() =>
                      setRecurringDays((prev) =>
                        prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
                      )
                    }
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRecurringModal(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                onClick={async () => {
                  if (!userId || !organizationId || !selectedDriver) {
                    toast.error(t("driver.fillAllFields", "Please fill all fields"));
                    return;
                  }
                  try {
                    await createRecurring({
                      organizationId,
                      userId,
                      driverId: selectedDriver,
                      tripInfo: {
                        from: tripInfo.from,
                        to: tripInfo.to,
                        purpose: tripInfo.purpose,
                        passengerCount: tripInfo.passengerCount,
                        notes: tripInfo.notes,
                      },
                      schedule: {
                        daysOfWeek: recurringDays,
                        startTime: recurringStartTime,
                        endTime: recurringEndTime,
                      },
                    });
                    toast.success(t("driver.recurringTripCreated", "Recurring trip created!"));
                    setShowRecurringModal(false);
                  } catch (e: any) {
                    toast.error(e.message || t("driver.failed", "Failed"));
                  }
                }}
              >
                {t("common.create", "Create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("driver.requestDriver", "Request Driver")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("driver.selectDriver", "Select Driver")}</Label>
              <Select value={selectedDriver || ""} onValueChange={(v) => setSelectedDriver(v as Id<"drivers">)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a driver" />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers?.filter(Boolean).map((driver) => (
                    <SelectItem key={driver!._id} value={driver!._id}>
                      {driver!.userName} - {driver!.vehicleInfo.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Leave Warning Alert */}
            {driverLeaveCheck?.onLeave && driverLeaveCheck.leave && (
              <Alert variant="destructive" className="border-red-500 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">
                  ⛔ {t("driver.driverOnLeave", "Driver on leave")}
                </AlertTitle>
                <AlertDescription className="text-red-700">
                  <p className="font-semibold">
                    {t("driver.onLeaveFrom", "Driver on leave from")} {driverLeaveCheck.leave.startDate} {t("driver.to", "to")} {driverLeaveCheck.leave.endDate}
                  </p>
                  <p className="mt-2">
                    <strong>{t("driver.leaveType", "Leave type")}:</strong> {
                      driverLeaveCheck.leave.type === 'paid' ? t("leave.types.paid", "Paid") :
                      driverLeaveCheck.leave.type === 'sick' ? t("leave.types.sick", "Sick") :
                      driverLeaveCheck.leave.type === 'family' ? t("leave.types.family", "Family") :
                      driverLeaveCheck.leave.type === 'unpaid' ? t("leave.types.unpaid", "Unpaid") :
                      driverLeaveCheck.leave.type
                    }
                  </p>
                  <p className="text-sm mt-2 text-red-600">
                    💡 {t("driver.selectAnotherDriver", "Select another driver or change dates")}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>{t("driver.pickupLocation", "Pickup Location")}</Label>
                <PlaceAutocomplete
                  value={tripInfo.from}
                  onChange={(val) => {
                    setTripInfo({ ...tripInfo, from: val });
                    setPickupCoords(undefined);
                  }}
                  onSelect={(place) => {
                    setTripInfo((prev) => ({ ...prev, from: place.address }));
                    setPickupCoords({ lat: place.lat, lng: place.lng, address: place.address });
                  }}
                  placeholder={t("driver.officePlaceholder", "e.g., Office")}
                />
              </div>
              <div>
                <Label>{t("driver.dropoffLocation", "Dropoff Location")}</Label>
                <PlaceAutocomplete
                  value={tripInfo.to}
                  onChange={(val) => {
                    setTripInfo({ ...tripInfo, to: val });
                    setDropoffCoords(undefined);
                  }}
                  onSelect={(place) => {
                    setTripInfo((prev) => ({ ...prev, to: place.address }));
                    setDropoffCoords({ lat: place.lat, lng: place.lng, address: place.address });
                  }}
                  placeholder={t("driver.airportPlaceholder", "e.g., Zvartnots Airport")}
                />
              </div>
            </div>

            {/* Map for location selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t("driver.selectOnMap", "Select on Map")}
              </Label>
              <div className="h-[200px] sm:h-[300px] rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
                <DriverMap
                  pickupLocation={tripInfo.from}
                  dropoffLocation={tripInfo.to}
                  pickupCoords={pickupCoords}
                  dropoffCoords={dropoffCoords}
                  height="100%"
                  zoom={13}
                  interactive={true}
                  onLocationSelect={handleLocationSelect}
                />
              </div>
            </div>

            <div>
              <Label>{t("driver.tripPurpose", "Trip Purpose")}</Label>
              <Input
                value={tripInfo.purpose}
                onChange={(e) => setTripInfo({ ...tripInfo, purpose: e.target.value })}
                placeholder={t("driver.purposePlaceholder", "e.g., Airport transfer, Client meeting")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>{t("driver.startTime", "Start Time")}</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("driver.endTime", "End Time")}</Label>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Time validation alert */}
            <Alert variant="warning" className="border-amber-500/50 bg-amber-50 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <div className="space-y-1">
                  <p className="font-medium">
                    🇬🇧 Start time must be earlier than end time
                  </p>
                  <p className="font-medium">
                    🇷🇺 Время начала должно быть раньше времени окончания
                  </p>
                  <p className="font-medium">
                    🇦🇲 Սկսման ժամանակը պետք է ավելի վաղ լինի, քան ավարտը
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <div>
              <Label>{t("driver.passengerCount", "Passengers")}</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={tripInfo.passengerCount}
                onChange={(e) => setTripInfo({ ...tripInfo, passengerCount: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label>{t("driver.notes", "Notes")} ({t("optional", "Optional")})</Label>
              <Textarea
                value={tripInfo.notes}
                onChange={(e) => setTripInfo({ ...tripInfo, notes: e.target.value })}
                placeholder="Additional information for the driver..."
                rows={3}
              />
            </div>

            {/* Corporate Trip Fields */}
            <CorporateTripFields
              priority={tripPriority}
              tripCategory={tripCategory}
              costCenter={costCenter}
              businessJustification={businessJustification}
              requiresApproval={requiresApproval}
              onPriorityChange={setTripPriority}
              onCategoryChange={setTripCategory}
              onCostCenterChange={setCostCenter}
              onBusinessJustificationChange={setBusinessJustification}
              onRequiresApprovalChange={setRequiresApproval}
            />

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4">
              <Button variant="outline" onClick={() => setShowRequestModal(false)} type="button">
                {t("cancel", "Cancel")}
              </Button>
              <Button
                onClick={handleRequestDriver}
                type="button"
                className="relative z-10"
                disabled={driverLeaveCheck?.onLeave}
              >
                {driverLeaveCheck?.onLeave
                  ? t("driver.driverOnLeave", "Водитель в отпуске")
                  : t("driver.submitRequest", "Submit Request")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Driver Registration Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              {t("driver.registerDriver", "Register as Driver")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 border border-blue-200 rounded-lg">
              <p className="text-sm text-white-800">
                <strong>{t("common.note", "Note")}:</strong> {t("driver.selectDriverRole", 'Select an employee with the "Driver" role to register their vehicle.')}
              </p>
            </div>

            {/* Select Driver */}
            <div>
              <Label>{t("driver.selectDriver", "Select Driver")} *</Label>
              <Select value={selectedDriverUserId || undefined} onValueChange={(v) => setSelectedDriverUserId(v as Id<"users">)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("driver.chooseDriverToRegister", "Choose a driver to register")} />
                </SelectTrigger>
                <SelectContent>
                  {unregisteredDrivers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {t("driver.noUnregisteredDrivers", "No unregistered drivers")}
                    </SelectItem>
                  ) : (
                    unregisteredDrivers.map((driver) => (
                      <SelectItem key={driver._id} value={driver._id}>
                        {driver.name} ({driver.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {unregisteredDrivers.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("driver.allDriversRegistered", "All drivers are already registered or no users with 'Driver' role exist.")}
                  <Button variant="link" className="p-0 h-auto ml-1" onClick={() => router.push("/employees")}>
                    {t("driver.addDriverEmployee", "Add Driver Employee")}
                  </Button>
                </p>
              )}
            </div>

            {/* Vehicle Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Car className="w-4 h-4" />
                {t("driver.vehicleInfoTitle", "Vehicle Information")}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label>{t("driver.vehicleModel", "Vehicle Model")} *</Label>
                  <Input
                    value={vehicleInfo.model}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })}
                    placeholder={t("driver.vehicleModelPlaceholder", "e.g., Mercedes Sprinter")}
                  />
                </div>
                <div>
                  <Label>{t("driver.plateNumber", "Plate Number")} *</Label>
                  <Input
                    value={vehicleInfo.plateNumber}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, plateNumber: e.target.value })}
                    placeholder={t("driver.plateNumberPlaceholder", "e.g., 34-AB-123")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label>{t("driver.capacity", "Capacity (seats)")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={vehicleInfo.capacity}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, capacity: parseInt(e.target.value) || 4 })}
                  />
                </div>
                <div>
                  <Label>{t("driver.color", "Color")}</Label>
                  <Input
                    value={vehicleInfo.color}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, color: e.target.value })}
                    placeholder={t("driver.colorPlaceholder", "e.g., Black")}
                  />
                </div>
                <div>
                  <Label>{t("driver.year", "Year")}</Label>
                  <Input
                    type="number"
                    min={2000}
                    max={new Date().getFullYear()}
                    value={vehicleInfo.year}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  />
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("driver.workingHoursTitle", "Working Hours")}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label>{t("driver.startTime", "Start Time")}</Label>
                  <Input
                    type="time"
                    value={workingHours.startTime}
                    onChange={(e) => setWorkingHours({ ...workingHours, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("driver.endTime", "End Time")}</Label>
                  <Input
                    type="time"
                    value={workingHours.endTime}
                    onChange={(e) => setWorkingHours({ ...workingHours, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>{t("driver.maxTripsPerDay", "Max Trips Per Day")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxTripsPerDay}
                  onChange={(e) => setMaxTripsPerDay(parseInt(e.target.value) || 3)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setShowRegisterModal(false)}>
                {t("cancel", "Cancel")}
              </Button>
              <Button onClick={handleRegisterDriver}>
                {t("driver.registerDriver", "Register as Driver")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Driver Calendar Modal - REDESIGNED */}
      <Dialog open={showCalendarModal} onOpenChange={(open) => {
        setShowCalendarModal(open);
        if (!open) setCalendarDriverId(null);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <VisuallyHidden>
            <DialogTitle>{t("driver.driverScheduleCalendar", "Driver Schedule Calendar")}</DialogTitle>
          </VisuallyHidden>
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-r from-primary to-primary-dark text-primary-foreground p-6 shrink-0">
            <div className="flex items-center justify-between mr-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{t("driver.driverSchedule", "Driver Schedule")}</h2>
                  {calendarDriverId && availableDrivers && (
                    <p className="text-primary-foreground/80 text-sm">
                      {availableDrivers.filter(Boolean).find(d => d!._id === calendarDriverId)?.userName}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-primary-foreground/80 text-sm">{t("driver.weekOf", "Week of")}</p>
                <p className="font-semibold">{format(new Date(calendarWeekStart), "MMM dd")} – {format(new Date(calendarWeekEnd), "MMM dd")}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {calendarSchedule === undefined ? (
              <div className="flex items-center justify-center py-12">
                <ShieldLoader />
              </div>
            ) : calendarSchedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t("driver.noTripsScheduled", "No trips scheduled")}</h3>
                <p className="text-muted-foreground max-w-sm">{t("driver.availableForBooking", "This driver is available for booking this week")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => {
                  const dayDate = new Date(calendarWeekStart + idx * 24 * 60 * 60 * 1000);
                  const dayStart = dayDate.getTime();
                  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
                  const daySchedules = calendarSchedule.filter(
                    (s) => s.startTime >= dayStart && s.startTime <= dayEnd
                  );
                  const isToday = format(dayDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

                  return (
                    <div key={day} className={`rounded-xl border transition-all ${isToday ? 'border-primary/50 bg-primary/10 shadow-sm' : ''}`}>
                      <div className="flex items-stretch">
                        {/* Day column */}
                        <div className={`w-24 sm:w-28 p-4 flex flex-col items-center justify-center border-r ${isToday ? 'bg-primary/20' : 'bg-muted/30'}`}>
                          <span className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>{day}</span>
                          <span className={`text-2xl font-bold mt-1 ${isToday ? 'text-primary' : ''}`}>
                            {format(dayDate, "dd")}
                          </span>
                          <span className="text-xs text-muted-foreground">{format(dayDate, "MMM")}</span>
                        </div>

                        {/* Schedule column */}
                        <div className="flex-1 p-4 min-h-[80px]">
                          {daySchedules.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                {t("driver.availableAllDay", "Available all day")}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {daySchedules
                                .sort((a, b) => a.startTime - b.startTime)
                                .map((s) => (
                                  <button
                                    key={s._id}
                                    onClick={() => setSelectedScheduleDetail(s)}
                                    className={`group flex flex-wrap items-center gap-3 p-3 rounded-lg transition-all w-full text-left ${s.type === "trip"
                                      ? "bg-primary/10 hover:bg-primary/20 border border-primary/30"
                                      : "bg-warning/10 hover:bg-warning/20 border border-warning/30"
                                      }`}
                                  >
                                    <div className={`w-3 h-3 rounded-full shrink-0 ${s.type === "trip" ? "bg-green-500" : "bg-warning-500"
                                      }`} />
                                    <div className="flex items-center gap-2 font-mono text-sm font-medium">
                                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                      <span>{format(new Date(s.startTime), "HH:mm")}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span>{format(new Date(s.endTime), "HH:mm")}</span>
                                    </div>
                                    <Badge variant={s.type === "trip" ? "default" : "secondary"} className="text-xs">
                                      {s.type === "trip" ? (
                                        <><Car className="w-3 h-3 mr-1" /> {t("driver.trip", "Trip")}</>
                                      ) : (
                                        <><AlertCircle className="w-3 h-3 mr-1" /> {t("driver.blocked", "Blocked")}</>
                                      )}
                                    </Badge>
                                    {s.type === "trip" && s.tripInfo?.from && s.tripInfo?.to && (
                                      <span className="text-xs text-muted-foreground">
                                        {s.tripInfo.from} → {s.tripInfo.to}
                                      </span>
                                    )}
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Detail Modal - REDESIGNED */}
      <Dialog open={!!selectedScheduleDetail} onOpenChange={(open) => { if (!open) setSelectedScheduleDetail(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col p-0">
          <VisuallyHidden>
            <DialogTitle>Trip Details</DialogTitle>
          </VisuallyHidden>
          {/* Header */}
          <div className={`relative p-6 shrink-0 ${selectedScheduleDetail?.type === "trip"
            ? "bg-gradient-to-r from-primary to-primary-dark text-primary-foreground"
            : "bg-gradient-to-r from-warning to-destructive text-primary-foreground"
            }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
                  {selectedScheduleDetail?.type === "trip" ? (
                    <Car className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedScheduleDetail?.type === "trip" ? t("driver.tripDetailsTitle", "Trip Details") : t("driver.blockedTimeSlot", "Blocked Time Slot")}
                  </h2>
                  <p className="text-primary-foreground/80 text-sm">
                    {format(new Date(selectedScheduleDetail?.startTime || Date.now()), "EEEE, MMMM dd, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {selectedScheduleDetail?.type === "trip" ? t("driver.trip", "Trip") : t("driver.blocked", "Blocked")}
                </Badge>
                <Badge variant={selectedScheduleDetail?.status === "completed" ? "secondary" : "default"} className="bg-white/20 text-white border-0">
                  {String(t(`driver.status.${selectedScheduleDetail?.status}`, selectedScheduleDetail?.status))}
                </Badge>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {selectedScheduleDetail && (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column - Info */}
                    <div className="space-y-4">
                      {/* Time */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            {t("driver.scheduleTime", "Schedule Time")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground mb-1">{t("driver.start", "Start")}</p>
                              <p className="text-lg font-bold font-mono">
                                {format(new Date(selectedScheduleDetail.startTime), "HH:mm")}
                              </p>
                            </div>
                            <div className="flex-1 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-primary to-accent"></div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-accent to-primary"></div>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground mb-1">{t("driver.end", "End")}</p>
                              <p className="text-lg font-bold font-mono">
                                {format(new Date(selectedScheduleDetail.endTime), "HH:mm")}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            {t("driver.duration", "Duration")}: {Math.round((selectedScheduleDetail.endTime - selectedScheduleDetail.startTime) / 3600000)}h {Math.round(((selectedScheduleDetail.endTime - selectedScheduleDetail.startTime) % 3600000) / 60000)}m
                          </p>
                        </CardContent>
                      </Card>

                      {/* Passenger Info */}
                      {selectedScheduleDetail.userName && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              {t("driver.passenger", "Passenger")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-12 h-12">
                                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                                  {selectedScheduleDetail.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-semibold">{selectedScheduleDetail.userName}</p>
                                {selectedScheduleDetail.userPhone && (
                                  <p className="text-sm text-muted-foreground">{selectedScheduleDetail.userPhone}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Trip Details */}
                      {selectedScheduleDetail.tripInfo && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary" />
                              {t("driver.routeInformation", "Route Information")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
                              <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-0.5">{t("driver.pickupLabel", "Pickup")}</p>
                                <p className="font-medium break-words">{selectedScheduleDetail.tripInfo.from}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-accent/10 rounded-lg border border-accent/30">
                              <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-0.5">{t("driver.dropoffLabel", "Dropoff")}</p>
                                <p className="font-medium break-words">{selectedScheduleDetail.tripInfo.to}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm pt-2 border-t">
                              <div className="flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span>{selectedScheduleDetail.tripInfo.passengerCount} {t("driver.passengerCountLabel", "passengers")}</span>
                              </div>
                              {selectedScheduleDetail.tripInfo.distanceKm && (
                                <div className="flex items-center gap-1.5">
                                  <Navigation2 className="w-4 h-4 text-muted-foreground" />
                                  <span>{selectedScheduleDetail.tripInfo.distanceKm} {t("driver.distanceLabel", "km")}</span>
                                </div>
                              )}
                              {selectedScheduleDetail.tripInfo.durationMinutes && (
                                <div className="flex items-center gap-1.5">
                                  <Timer className="w-4 h-4 text-muted-foreground" />
                                  <span>{selectedScheduleDetail.tripInfo.durationMinutes} {t("driver.durationLabel", "min")}</span>
                                </div>
                              )}
                            </div>
                            {selectedScheduleDetail.tripInfo.purpose && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">{t("driver.purposeLabel", "Purpose")}</p>
                                <p className="text-sm">{selectedScheduleDetail.tripInfo.purpose}</p>
                              </div>
                            )}
                            {selectedScheduleDetail.tripInfo.notes && (
                              <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
                                <p className="text-xs text-warning-foreground font-medium mb-1">📝 {t("driver.notesLabel", "Notes")}</p>
                                <p className="text-sm text-warning-foreground">{selectedScheduleDetail.tripInfo.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Blocked reason */}
                      {selectedScheduleDetail.reason && (
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
                              <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-warning-foreground">{t("driver.reasonForBlocking", "Reason for blocking")}</p>
                                <p className="text-sm text-warning-foreground mt-1">{selectedScheduleDetail.reason}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Right column - Map */}
                    <div className="space-y-4">
                      {(selectedScheduleDetail.tripInfo?.pickupCoords || selectedScheduleDetail.tripInfo?.dropoffCoords) ? (
                        <Card className="h-[400px] md:h-full">
                          <CardContent className="p-0 h-full">
                            <DriverMap
                              pickupLocation={selectedScheduleDetail.tripInfo.pickupLocation}
                              dropoffLocation={selectedScheduleDetail.tripInfo.dropoffLocation}
                              pickupCoords={selectedScheduleDetail.tripInfo.pickupCoords}
                              dropoffCoords={selectedScheduleDetail.tripInfo.dropoffCoords}
                              height="100%"
                              zoom={12}
                            />
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="h-[300px] flex items-center justify-center">
                          <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                              <MapPin className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground text-sm">{t("driver.noMapAvailable", "No map available")}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* Actions */}
                      {selectedScheduleDetail.type === "trip" && selectedScheduleDetail.status === "scheduled" && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">{t("driver.quickActions", "Quick Actions")}</CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="gap-1">
                              <PhoneCall className="w-3.5 h-3.5" />
                              {t("driver.callPassenger", "Call Passenger")}
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {t("driver.sendMessage", "Send Message")}
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1">
                              <Navigation className="w-3.5 h-3.5" />
                              {t("driver.navigate", "Navigate")}
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
