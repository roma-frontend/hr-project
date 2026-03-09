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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ShieldLoader } from "@/components/ui/ShieldLoader";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

interface TripInfo {
  from: string;
  to: string;
  purpose: string;
  passengerCount: number;
  notes?: string;
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
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
        tripInfo,
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

    if (!selectedDriverUserId) {
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("driver.booking", "Driver Booking")}</h1>
          <p className="text-muted-foreground">
            {t("driver.bookingDesc", "Book a driver for your business trips and transfers")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRegisterModal(true)}>
            <Car className="w-4 h-4 mr-2" />
            Register as Driver
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
                  ? "Try a different search term"
                  : "To register as a driver, go to Employees and set role to 'Driver', then add vehicle information"}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-4" onClick={() => router.push("/employees")}>
                  <Users className="w-4 h-4 mr-2" />
                  Go to Employees
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
                          // Would open calendar view
                          toast.info("Calendar view coming soon");
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
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
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
                    {request.status === "declined" && request.declineReason && (
                      <p className="text-xs text-muted-foreground ml-2">
                        {request.declineReason}
                      </p>
                    )}
                  </div>
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
        <DialogContent className="max-w-2xl">
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
                  onChange={(e) => setTripInfo({ ...tripInfo, from: e.target.value })}
                  placeholder="e.g., Office"
                />
              </div>
              <div>
                <Label>{t("driver.dropoffLocation", "Dropoff Location")}</Label>
                <Input
                  value={tripInfo.to}
                  onChange={(e) => setTripInfo({ ...tripInfo, to: e.target.value })}
                  placeholder="e.g., Zvartnots Airport"
                />
              </div>
            </div>

            <div>
              <Label>{t("driver.tripPurpose", "Trip Purpose")}</Label>
              <Input
                value={tripInfo.purpose}
                onChange={(e) => setTripInfo({ ...tripInfo, purpose: e.target.value })}
                placeholder="e.g., Airport transfer, Client meeting"
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
              Register as Driver
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 border border-blue-200 rounded-lg">
              <p className="text-sm text-white-800">
                <strong>Note:</strong> Select an employee with the "Driver" role to register their vehicle.
              </p>
            </div>

            {/* Select Driver */}
            <div>
              <Label>Select Driver *</Label>
              <Select value={selectedDriverUserId} onValueChange={setSelectedDriverUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a driver to register" />
                </SelectTrigger>
                <SelectContent>
                  {unregisteredDrivers.length === 0 ? (
                    <SelectItem value="" disabled>No unregistered drivers</SelectItem>
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
                  All drivers are already registered or no users with "Driver" role exist. 
                  <Button variant="link" className="p-0 h-auto ml-1" onClick={() => router.push("/employees")}>
                    Add Driver Employee
                  </Button>
                </p>
              )}
            </div>

            {/* Vehicle Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Car className="w-4 h-4" />
                Vehicle Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vehicle Model *</Label>
                  <Input
                    value={vehicleInfo.model}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })}
                    placeholder="e.g., Mercedes Sprinter"
                  />
                </div>
                <div>
                  <Label>Plate Number *</Label>
                  <Input
                    value={vehicleInfo.plateNumber}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, plateNumber: e.target.value })}
                    placeholder="e.g., 34-AB-123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Capacity (seats)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={vehicleInfo.capacity}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, capacity: parseInt(e.target.value) || 4 })}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    value={vehicleInfo.color}
                    onChange={(e) => setVehicleInfo({ ...vehicleInfo, color: e.target.value })}
                    placeholder="e.g., Black"
                  />
                </div>
                <div>
                  <Label>Year</Label>
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
                Working Hours
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={workingHours.startTime}
                    onChange={(e) => setWorkingHours({ ...workingHours, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={workingHours.endTime}
                    onChange={(e) => setWorkingHours({ ...workingHours, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Max Trips Per Day</Label>
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
                Register as Driver
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
