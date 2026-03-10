/**
 * Driver Request Modal
 * 
 * Allows users to request a driver for a specific date/time
 * from the calendar view
 */

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Car, MapPin, Clock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DriverMap } from "@/components/drivers/DriverMap";
import { Badge } from "@/components/ui/badge";

interface DriverRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
}

export function DriverRequestModal({
  open,
  onOpenChange,
  selectedDate,
}: DriverRequestModalProps) {
  const { t } = useTranslation();
  const currentUser = useQuery(api.users.getCurrentUser, { email: undefined });
  const userId = currentUser?._id as Id<"users"> | undefined;
  const organizationId = currentUser?.organizationId as Id<"organizations"> | undefined;

  const availableDrivers = useQuery(
    api.drivers.getAvailableDrivers,
    organizationId ? { organizationId } : "skip"
  );

  const requestDriver = useMutation(api.drivers.requestDriver);

  const [selectedDriver, setSelectedDriver] = useState<Id<"drivers"> | "">("");
  const [tripInfo, setTripInfo] = useState({
    from: "",
    to: "",
    purpose: "",
    passengerCount: 1,
    notes: "",
  });
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number; address?: string } | undefined>();
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number; address?: string } | undefined>();
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // Geocode search state
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropoffQuery, setDropoffQuery] = useState("");
  const [pickupResults, setPickupResults] = useState<{ lat: number; lng: number; display_name: string }[]>([]);
  const [dropoffResults, setDropoffResults] = useState<{ lat: number; lng: number; display_name: string }[]>([]);
  const [showPickupResults, setShowPickupResults] = useState(false);
  const [showDropoffResults, setShowDropoffResults] = useState(false);
  const pickupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geocodeSearch = useCallback(async (query: string): Promise<{ lat: number; lng: number; display_name: string }[]> => {
    if (query.length < 3) {
      console.log("[geocode] Query too short:", query);
      return [];
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
      console.log("[geocode] Searching:", url);
      const res = await fetch(url, {
        headers: { "Accept-Language": "en,ru" },
      });
      if (!res.ok) {
        console.error("[geocode] HTTP error:", res.status);
        return [];
      }
      const data = await res.json();
      console.log("[geocode] Results:", data.length, data);
      if (data.length === 0) {
        console.log("[geocode] No results found");
        return [];
      }
      return data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        display_name: item.display_name,
      }));
    } catch (err) {
      console.error("[geocode] Error:", err);
      return [];
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-geocode-input]')) {
        setShowPickupResults(false);
        setShowDropoffResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePickupInputChange = (value: string) => {
    setPickupQuery(value);
    setTripInfo(prev => ({ ...prev, from: value }));
    setPickupCoords(undefined);
    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
    if (value.length >= 3) {
      pickupTimerRef.current = setTimeout(async () => {
        const results = await geocodeSearch(value);
        setPickupResults(results);
        setShowPickupResults(results.length > 0);
      }, 400);
    } else {
      setPickupResults([]);
      setShowPickupResults(false);
    }
  };

  const handleDropoffInputChange = (value: string) => {
    setDropoffQuery(value);
    setTripInfo(prev => ({ ...prev, to: value }));
    setDropoffCoords(undefined);
    if (dropoffTimerRef.current) clearTimeout(dropoffTimerRef.current);
    if (value.length >= 3) {
      dropoffTimerRef.current = setTimeout(async () => {
        const results = await geocodeSearch(value);
        setDropoffResults(results);
        setShowDropoffResults(results.length > 0);
      }, 400);
    } else {
      setDropoffResults([]);
      setShowDropoffResults(false);
    }
  };

  const selectPickupResult = (result: { lat: number; lng: number; display_name: string }) => {
    console.log("[selectPickupResult]", result);
    setPickupCoords({ lat: result.lat, lng: result.lng, address: result.display_name });
    setTripInfo(prev => ({ ...prev, from: result.display_name }));
    setPickupQuery(result.display_name);
    setPickupResults([]);
    setShowPickupResults(false);
    // Map will auto-center via DriverMap useEffect when pickupCoords changes
  };

  const selectDropoffResult = (result: { lat: number; lng: number; display_name: string }) => {
    console.log("[selectDropoffResult]", result);
    setDropoffCoords({ lat: result.lat, lng: result.lng, address: result.display_name });
    setTripInfo(prev => ({ ...prev, to: result.display_name }));
    setDropoffQuery(result.display_name);
    setDropoffResults([]);
    setShowDropoffResults(false);
    // Map will auto-center via DriverMap useEffect when dropoffCoords changes
  };

  // Handle location selection from map
  const handleLocationSelect = (location: { lat: number; lng: number; address?: string }, type: "pickup" | "dropoff") => {
    if (type === "pickup") {
      setPickupCoords(location);
      setTripInfo(prev => ({ ...prev, from: location.address || prev.from }));
      setPickupQuery(location.address || "");
      setShowPickupResults(false);
    } else {
      setDropoffCoords(location);
      setTripInfo(prev => ({ ...prev, to: location.address || prev.to }));
      setDropoffQuery(location.address || "");
      setShowDropoffResults(false);
    }
  };

  // Pre-fill time when selectedDate changes
  React.useEffect(() => {
    if (selectedDate && open) {
      // Set start time to 9:00 AM on selected date
      const start = new Date(selectedDate);
      start.setHours(9, 0, 0, 0);
      
      // Set end time to 6:00 PM on selected date
      const end = new Date(selectedDate);
      end.setHours(18, 0, 0, 0);

      setStartTime(start.toISOString().slice(0, 16));
      setEndTime(end.toISOString().slice(0, 16));
    }
  }, [selectedDate, open]);

  const handleSubmit = async () => {
    if (!userId || !organizationId) {
      toast.error("Please login to request a driver");
      return;
    }

    if (!selectedDriver) {
      toast.error("Please select a driver");
      return;
    }

    if (!startTime || !endTime) {
      toast.error("Please select start and end time");
      return;
    }

    if (!tripInfo.from || !tripInfo.to) {
      toast.error("Please fill in pickup and dropoff locations");
      return;
    }

    try {
      await requestDriver({
        organizationId,
        requesterId: userId,
        driverId: selectedDriver as Id<"drivers">,
        startTime: new Date(startTime).getTime(),
        endTime: new Date(endTime).getTime(),
        tripInfo: {
          ...tripInfo,
          pickupCoords: pickupCoords ? { lat: pickupCoords.lat, lng: pickupCoords.lng } : undefined,
          dropoffCoords: dropoffCoords ? { lat: dropoffCoords.lat, lng: dropoffCoords.lng } : undefined,
        },
      });

      toast.success(t("driver.requestSubmitted", "Driver request submitted!"));
      onOpenChange(false);

      // Reset form
      setSelectedDriver("");
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

  if (!currentUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            {t("driver.requestDriver", "Request Driver")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4" style={{ overflow: "visible" }}>
          {/* Select Driver */}
          <div>
            <Label>{t("driver.selectDriver", "Select Driver")}</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger>
                <SelectValue placeholder={t("driver.chooseDriver", "Choose a driver")} />
              </SelectTrigger>
              <SelectContent>
                {availableDrivers?.map((driver) => (
                  <SelectItem key={driver._id} value={driver._id}>
                    {driver.userName} - {driver.vehicleInfo.model} ({driver.vehicleInfo.plateNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableDrivers && availableDrivers.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {t("driver.noDriversFound", "No drivers available")}
              </p>
            )}
          </div>

          {/* Trip Details */}
          <div className="space-y-3">
            {/* Pickup */}
            <div className="relative">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                {t("driver.pickupLocation", "Pickup Location")}
              </Label>
              <Input
                value={pickupQuery || tripInfo.from}
                onChange={(e) => handlePickupInputChange(e.target.value)}
                placeholder={t("driver.fromPlaceholder", "e.g., Office")}
                autoComplete="off"
                className="pr-8"
                data-geocode-input
              />
              {pickupResults.length > 0 && showPickupResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                  {pickupResults.map((r, i) => (
                    <div
                      key={i}
                      className="px-3 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-gray-700 border-b last:border-b-0 border-gray-100 dark:border-gray-700 cursor-pointer flex items-start gap-2 transition-colors"
                      onClick={() => selectPickupResult(r)}
                    >
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                      <span className="flex-1">{r.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dropoff */}
            <div className="relative">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-500" />
                {t("driver.dropoffLocation", "Dropoff Location")}
              </Label>
              <Input
                value={dropoffQuery || tripInfo.to}
                onChange={(e) => handleDropoffInputChange(e.target.value)}
                placeholder={t("driver.toPlaceholder", "e.g., Airport")}
                autoComplete="off"
                className="pr-8"
                data-geocode-input
              />
              {dropoffResults.length > 0 && showDropoffResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                  {dropoffResults.map((r, i) => (
                    <div
                      key={i}
                      className="px-3 py-2.5 text-sm hover:bg-red-50 dark:hover:bg-gray-700 border-b last:border-b-0 border-gray-100 dark:border-gray-700 cursor-pointer flex items-start gap-2 transition-colors"
                      onClick={() => selectDropoffResult(r)}
                    >
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                      <span className="flex-1">{r.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map for location selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t("driver.selectOnMap", "Select on Map")}
              </Label>
              <Badge variant="secondary" className="text-xs">
                Click to pick location
              </Badge>
            </div>
            <div className="rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
              <DriverMap
                pickupLocation={tripInfo.from}
                dropoffLocation={tripInfo.to}
                pickupCoords={pickupCoords}
                dropoffCoords={dropoffCoords}
                height="300px"
                zoom={13}
                interactive={true}
                onLocationSelect={handleLocationSelect}
              />
            </div>
          </div>

          {/* Purpose */}
          <div>
            <Label>{t("driver.tripPurpose", "Trip Purpose")}</Label>
            <Input
              value={tripInfo.purpose}
              onChange={(e) => setTripInfo({ ...tripInfo, purpose: e.target.value })}
              placeholder={t("driver.purposePlaceholder", "e.g., Airport transfer, Client meeting")}
            />
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("driver.startTime", "Start Time")}
              </Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t("driver.endTime", "End Time")}
              </Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Passengers */}
          <div>
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("driver.passengerCount", "Passengers")}
            </Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={tripInfo.passengerCount}
              onChange={(e) => setTripInfo({ ...tripInfo, passengerCount: parseInt(e.target.value) || 1 })}
            />
          </div>

          {/* Notes */}
          <div>
            <Label>{t("driver.notes", "Notes")} ({t("optional", "Optional")})</Label>
            <Textarea
              value={tripInfo.notes}
              onChange={(e) => setTripInfo({ ...tripInfo, notes: e.target.value })}
              placeholder={t("driver.notesPlaceholder", "Additional information for the driver...")}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleSubmit}>
              {t("driver.submitRequest", "Submit Request")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
