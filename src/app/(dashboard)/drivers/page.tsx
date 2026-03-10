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

import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Car,
  Calendar,
  Clock,
  MapPin,
  Users,
  Star,
  CheckCircle,
  XCircle,
  AlertCircle,
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { DriverStatsCard } from "@/components/drivers/DriverStatsCard";
import { DriverCalendar } from "@/components/drivers/DriverCalendar";
import { MessageTemplates } from "@/components/drivers/MessageTemplates";
import { DriverMap } from "@/components/drivers/DriverMap";

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
      toast.success(approved ? "Request approved!" : "Request declined");
    } catch (error: any) {
      toast.error(error.message || "Failed to respond");
    }
  };

  const handleToggleAvailability = async (checked: boolean) => {
    if (!driver) return;
    try {
      await updateAvailability({ driverId: driver._id, isAvailable: checked });
      toast.success(checked ? "You are now available" : "You are now unavailable");
    } catch (error: any) {
      toast.error(error.message || "Failed to update availability");
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
            {driver.isAvailable ? "Available" : "Unavailable"}
          </span>
          <Switch checked={driver.isAvailable} onCheckedChange={handleToggleAvailability} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
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

      {/* Pending Requests */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.pendingRequests", "Pending Requests")}</h2>
        </CardHeader>
        <CardContent>
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-10 h-10">
                      {request.requesterAvatar && <AvatarImage src={request.requesterAvatar} />}
                      <AvatarFallback>
                        {request.requesterName?.split(" ").map((n: string) => n[0]).join("") ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{request.requesterName ?? "Unknown"}</h3>
                      <p className="text-sm text-muted-foreground">
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
                  <div className="flex gap-2">
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
                  <div key={schedule._id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className={`w-2 h-12 rounded-full ${
                      schedule.status === "scheduled" ? "bg-blue-500" :
                      schedule.status === "completed" ? "bg-green-500" :
                      "bg-gray-400"
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {format(new Date(schedule.startTime), "HH:mm")} - {format(new Date(schedule.endTime), "HH:mm")}
                          </span>
                          <Badge variant={schedule.type === "trip" ? "default" : "secondary"}>
                            {schedule.type}
                          </Badge>
                        </div>
                        {schedule.type === "trip" && schedule.status === "scheduled" && (
                          <MessageTemplates
                            passengerName={schedule.userName}
                            passengerPhone={schedule.tripInfo?.passengerPhone}
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
    </div>
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
    
    const registeredUserIds = new Set(availableDrivers.map(d => d.userId));
    return allUsers.filter(u => u.role === "driver" && !registeredUserIds.has(u._id));
  }, [allUsers, availableDrivers]);

  // Mutations - MUST be called unconditionally at top level
  const requestDriver = useMutation(api.drivers.requestDriver);
  const requestCalendarAccess = useMutation(api.drivers.requestCalendarAccess);
  const registerAsDriver = useMutation(api.drivers.registerAsDriver);
  const updateDriverRequest = useMutation(api.drivers.updateDriverRequest);
  const deleteDriverRequest = useMutation(api.drivers.deleteDriverRequest);

  // Filter drivers by search
  const filteredDrivers = useMemo(() => {
    if (!availableDrivers) return [];
    if (!searchQuery) return availableDrivers;

    const query = searchQuery.toLowerCase();
    return availableDrivers.filter((d) =>
      d.userName.toLowerCase().includes(query) ||
      d.vehicleInfo.model.toLowerCase().includes(query) ||
      d.vehicleInfo.plateNumber.toLowerCase().includes(query)
    );
  }, [availableDrivers, searchQuery]);

  // Handle driver request
  const handleRequestDriver = async () => {
    if (!userId || !organizationId || !selectedDriver) {
      toast.error("Please select a driver");
      return;
    }

    if (!startTime || !endTime) {
      toast.error("Please select start and end time");
      return;
    }

    try {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

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
    } catch (error: any) {
      toast.error(error.message || "Failed to request driver");
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

      toast.success(t("driver.calendar.requestSent", "Access request sent!"));
    } catch (error: any) {
      toast.error(error.message || "Failed to request access");
    }
  };

  // Handle driver registration
  const handleRegisterDriver = async () => {
    if (!userId || !organizationId) {
      toast.error("Please log in");
      return;
    }

    if (!selectedDriverUserId || selectedDriverUserId === "none") {
      toast.error("Please select a driver to register");
      return;
    }

    if (!vehicleInfo.model || !vehicleInfo.plateNumber) {
      toast.error("Please fill in vehicle model and plate number");
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
      toast.success("Successfully registered as driver!");
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
      toast.error(error.message || "Failed to register as driver");
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
      <div className="flex flex-col xs:flex-row items-start xs:items-center gap-4 justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("driver.booking", "Driver Booking")}</h1>
          <p className="text-muted-foreground">
            {t("driver.bookingDesc", "Book a driver for your business trips and transfers")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRegisterModal(true)}>
            <Car className="w-4 h-4 mr-2" />
            {t("driver.registerDriver", "Register as Driver")}
          </Button>
          <Button onClick={() => setShowRequestModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("driver.requestDriver", "Request Driver")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
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
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t("driver.availableDrivers", "Available Drivers")}</h2>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("driver.searchDriver", "Search driver...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDrivers.map((driver) => (
                <Card key={driver._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Requests */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">{t("driver.myRequests", "My Driver Requests")}</h2>
        </CardHeader>
        <CardContent>
          {myRequests && myRequests.length > 0 ? (
            <div className="space-y-3">
              {myRequests.map((request) => (
                <div
                  key={request._id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  {editingRequestId === request._id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{t("driver.pickupLocation", "From")}</Label>
                          <Input
                            value={editTripInfo.from}
                            onChange={(e) => setEditTripInfo({ ...editTripInfo, from: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("driver.dropoffLocation", "To")}</Label>
                          <Input
                            value={editTripInfo.to}
                            onChange={(e) => setEditTripInfo({ ...editTripInfo, to: e.target.value })}
                            className="h-8 text-sm"
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{t("driver.startTime", "Start")}</Label>
                          <Input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{t("driver.endTime", "End")}</Label>
                          <Input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="h-8 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{t("driver.passengerCount", "Passengers")}</Label>
                          <Input type="number" min={1} max={10} value={editTripInfo.passengerCount} onChange={(e) => setEditTripInfo({ ...editTripInfo, passengerCount: parseInt(e.target.value) || 1 })} className="h-8 text-sm" />
                        </div>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-2 h-12 rounded-full ${
                            request.status === "approved"
                              ? "bg-green-500"
                              : request.status === "declined"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        <div>
                          <h3 className="font-semibold">{request.driverName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {request.tripInfo.from} → {request.tripInfo.to}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.startTime), "MMM dd, HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                    <p className="text-xs text-muted-foreground ml-6">
                      {t("driver.declineReason", "Reason")}: {request.declineReason}
                    </p>
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
        </CardContent>
      </Card>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  {availableDrivers?.map((driver) => (
                    <SelectItem key={driver._id} value={driver._id}>
                      {driver.userName} - {driver.vehicleInfo.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("driver.pickupLocation", "Pickup Location")}</Label>
                <Input
                  value={tripInfo.from}
                  onChange={(e) => {
                    setTripInfo({ ...tripInfo, from: e.target.value });
                    setPickupCoords(undefined);
                  }}
                  placeholder={t("driver.officePlaceholder", "e.g., Office")}
                />
              </div>
              <div>
                <Label>{t("driver.dropoffLocation", "Dropoff Location")}</Label>
                <Input
                  value={tripInfo.to}
                  onChange={(e) => {
                    setTripInfo({ ...tripInfo, to: e.target.value });
                    setDropoffCoords(undefined);
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
              <div className="h-[300px] rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRequestModal(false)}>
                {t("cancel", "Cancel")}
              </Button>
              <Button onClick={handleRequestDriver}>
                {t("driver.submitRequest", "Submit Request")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Driver Registration Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Select value={selectedDriverUserId || undefined} onValueChange={(v) => setSelectedDriverUserId(v || "")}>
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-3 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
            <div className="flex gap-2 justify-end">
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

      {/* Driver Calendar Modal */}
      <Dialog open={showCalendarModal} onOpenChange={(open) => {
        setShowCalendarModal(open);
        if (!open) setCalendarDriverId(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t("driver.driverSchedule", "Driver Schedule")}
              {calendarDriverId && availableDrivers && (
                <span className="font-normal text-muted-foreground">
                  — {availableDrivers.find(d => d._id === calendarDriverId)?.userName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("driver.calendar.weekOf", "Week of")} {format(new Date(calendarWeekStart), "MMM dd")} – {format(new Date(calendarWeekEnd), "MMM dd, yyyy")}
            </p>
            {calendarSchedule === undefined ? (
              <div className="text-center py-8"><ShieldLoader /></div>
            ) : calendarSchedule.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("driver.calendar.noSchedule", "No trips scheduled this week")}</p>
                <p className="text-sm mt-1">{t("driver.calendar.available", "This driver is available for booking")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => {
                  const dayDate = new Date(calendarWeekStart + idx * 24 * 60 * 60 * 1000);
                  const dayStart = dayDate.getTime();
                  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
                  const daySchedules = calendarSchedule.filter(
                    (s) => s.startTime >= dayStart && s.startTime <= dayEnd
                  );

                  return (
                    <div key={day} className="flex gap-3 items-start">
                      <div className="w-20 pt-2 text-sm font-medium shrink-0">
                        <div>{day}</div>
                        <div className="text-xs text-muted-foreground">{format(dayDate, "MMM dd")}</div>
                      </div>
                      <div className="flex-1 min-h-[40px] border-l pl-3">
                        {daySchedules.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">{t("driver.calendar.free", "Free")}</p>
                        ) : (
                          <div className="space-y-1">
                            {daySchedules
                              .sort((a, b) => a.startTime - b.startTime)
                              .map((s) => (
                                <button
                                  key={s._id}
                                  onClick={() => setSelectedScheduleDetail(s)}
                                  className="flex items-center gap-2 py-1.5 px-2 -ml-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left"
                                >
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    s.type === "trip" ? "bg-blue-500" : "bg-orange-500"
                                  }`} />
                                  <span className="text-sm font-mono">
                                    {format(new Date(s.startTime), "HH:mm")}–{format(new Date(s.endTime), "HH:mm")}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {s.type === "trip" ? (s.tripInfo?.from && s.tripInfo?.to ? `${s.tripInfo.from} → ${s.tripInfo.to}` : "Trip") : "Blocked"}
                                  </Badge>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Detail Modal */}
      <Dialog open={!!selectedScheduleDetail} onOpenChange={(open) => { if (!open) setSelectedScheduleDetail(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedScheduleDetail?.type === "trip" ? (
                <><Car className="w-5 h-5 text-blue-500" /> {t("driver.tripDetails", "Trip Details")}</>
              ) : (
                <><AlertCircle className="w-5 h-5 text-orange-500" /> {selectedScheduleDetail?.type === "blocked" ? t("driver.blockedSlot", "Blocked Slot") : t("driver.maintenance", "Maintenance")}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedScheduleDetail && (
            <div className="space-y-4">
              {/* Time */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {format(new Date(selectedScheduleDetail.startTime), "MMM d, h:mm a")} – {format(new Date(selectedScheduleDetail.endTime), "h:mm a")}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant={selectedScheduleDetail.status === "scheduled" ? "default" : selectedScheduleDetail.status === "completed" ? "outline" : "secondary"}>
                  {selectedScheduleDetail.status}
                </Badge>
                <Badge variant="secondary">{selectedScheduleDetail.type}</Badge>
              </div>

              {/* Booked by */}
              {selectedScheduleDetail.userName && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{t("driver.bookedBy", "Booked by")} {selectedScheduleDetail.userName}</span>
                </div>
              )}

              {/* Trip info */}
              {selectedScheduleDetail.tripInfo && (
                <div className="space-y-3">
                  {/* Map */}
                  {(selectedScheduleDetail.tripInfo.pickupCoords || selectedScheduleDetail.tripInfo.dropoffCoords) ? (
                    <div className="h-[250px]">
                      <DriverMap
                        pickupLocation={selectedScheduleDetail.tripInfo.from}
                        dropoffLocation={selectedScheduleDetail.tripInfo.to}
                        pickupCoords={selectedScheduleDetail.tripInfo.pickupCoords}
                        dropoffCoords={selectedScheduleDetail.tripInfo.dropoffCoords}
                        height="100%"
                        zoom={13}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                      <div className="flex gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{selectedScheduleDetail.tripInfo.from} → {selectedScheduleDetail.tripInfo.to}</p>
                          <p className="text-muted-foreground text-xs">{selectedScheduleDetail.tripInfo.purpose}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedScheduleDetail.tripInfo.passengerCount} {t("driver.passengers", "passengers")}</span>
                      </div>
                      {selectedScheduleDetail.tripInfo.notes && (
                        <p className="text-sm text-muted-foreground italic">{selectedScheduleDetail.tripInfo.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Blocked reason */}
              {selectedScheduleDetail.reason && (
                <div className="text-sm">
                  <span className="font-medium">{t("driver.reason", "Reason")}:</span> {selectedScheduleDetail.reason}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
