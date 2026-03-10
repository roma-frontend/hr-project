"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface DriverMapProps {
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupCoords?: Location;
  dropoffCoords?: Location;
  driverCoords?: Location;
  height?: string;
  zoom?: number;
  interactive?: boolean;
  onLocationSelect?: (location: Location, type: "pickup" | "dropoff") => void;
}

const DEFAULT_CENTER: Location = { lat: 40.7128, lng: -74.006 };

const LEAFLET_CSS_ID = "leaflet-css";

function ensureLeafletCSS() {
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  link.crossOrigin = "";
  document.head.appendChild(link);
  
  // Add custom styles for zoom controls
  const style = document.createElement("style");
  style.textContent = `
    .leaflet-control-zoom {
      border: 2px solid rgba(0,0,0,0.2) !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    }
    .leaflet-control-zoom a {
      background: white !important;
      color: #333 !important;
      width: 30px !important;
      height: 30px !important;
      line-height: 30px !important;
      font-size: 18px !important;
      font-weight: bold !important;
    }
    .leaflet-control-zoom a:hover {
      background: #f0f0f0 !important;
    }
    .leaflet-control-zoom-in {
      border-radius: 6px !important;
    }
    .leaflet-control-zoom-out {
      border-radius: 6px !important;
      border-top: 1px solid #ccc !important;
    }
  `;
  document.head.appendChild(style);
}

export function DriverMap({
  pickupLocation,
  dropoffLocation,
  pickupCoords,
  dropoffCoords,
  driverCoords,
  height = "400px",
  zoom = 13,
  interactive = false,
  onLocationSelect,
}: DriverMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const LRef = useRef<any>(null);

  // Get user's current location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log("[DriverMap] Geolocation not supported");
      return;
    }

    console.log("[DriverMap] Requesting user location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log("[DriverMap] User location:", loc);
        setUserLocation(loc);
      },
      (error) => {
        console.warn("[DriverMap] Location error:", error.code, error.message);
        // Use default location on error
        setUserLocation(DEFAULT_CENTER);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, []);

  // Latest props in refs for stable callbacks
  const pickupCoordsRef = useRef(pickupCoords);
  pickupCoordsRef.current = pickupCoords;
  const onLocationSelectRef = useRef(onLocationSelect);
  onLocationSelectRef.current = onLocationSelect;

  // Load Leaflet + CSS
  useEffect(() => {
    let cancelled = false;
    ensureLeafletCSS();

    import("leaflet").then((L) => {
      if (cancelled) return;
      LRef.current = L.default || L;
      setReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  // Reverse geocode
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string | undefined> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      return data.display_name || undefined;
    } catch {
      return undefined;
    }
  }, []);

  // Init map
  useEffect(() => {
    const el = mapDivRef.current;
    if (!ready || !el) return;

    // Already initialized
    if (mapInstanceRef.current) return;

    // Ensure container has dimensions
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("[DriverMap] Container has no dimensions, waiting...");
      const timeout = setTimeout(() => {
        console.log("[DriverMap] Retrying initialization...");
        // Force re-render by toggling ready
        setReady(false);
        setTimeout(() => setReady(true), 50);
      }, 100);
      return () => clearTimeout(timeout);
    }

    const L = LRef.current;

    console.log("[DriverMap] Initializing map...", { width: rect.width, height: rect.height });

    // Fix marker icons
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // Use user location if no coords provided
    const center = userLocation || driverCoords || pickupCoords || dropoffCoords || DEFAULT_CENTER;
    console.log("[DriverMap] Center:", center);
    
    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom: userLocation ? 14 : 13,
      scrollWheelZoom: false,
      dragging: true,
      zoomControl: false, // We'll add custom zoom control
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      fadeAnimation: true,
      zoomAnimation: true,
      minZoom: 3,
      maxZoom: 19,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control in bottom-right corner
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Force resize after dialog opens
    const timeouts = [100, 300, 600, 1000, 1500, 2000].map(delay => 
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          console.log("[DriverMap] Invalidated size at", delay, "ms");
        }
      }, delay)
    );

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    ro.observe(el);

    // Click handler for interactive mode
    if (interactive) {
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        const cb = onLocationSelectRef.current;
        if (!cb) return;
        const address = await reverseGeocode(lat, lng);
        cb({ lat, lng, address }, !pickupCoordsRef.current ? "pickup" : "dropoff");
      });
    }

    console.log("[DriverMap] Map initialized successfully");

    return () => {
      timeouts.forEach(clearTimeout);
      ro.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn("[DriverMap] Error removing map:", e);
        }
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userLocation]);

  // Update markers and center map
  useEffect(() => {
    if (!mapInstanceRef.current || !ready) return;

    const L = LRef.current;
    const map = mapInstanceRef.current;

    // Check if map container still exists
    if (!map || !map._container) {
      console.warn("[DriverMap] Map container not found, skipping update");
      return;
    }

    console.log("[DriverMap] Updating markers:", { pickupCoords, dropoffCoords, driverCoords });

    // Clear existing
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const icon = (color: string) =>
      L.divIcon({
        className: "",
        html: `<div style="width:42px;height:42px;border-radius:50%;background:${color};border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:16px;height:16px;border-radius:50%;background:white;opacity:0.3"></div></div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

    const bounds: [number, number][] = [];

    if (pickupCoords) {
      const m = L.marker([pickupCoords.lat, pickupCoords.lng], { icon: icon("#10B981") })
        .addTo(map)
        .bindPopup(`<b>${t("driver.pickup", "Pickup")}</b><br/>${pickupCoords.address || pickupLocation || ""}`);
      markersRef.current.push(m);
      bounds.push([pickupCoords.lat, pickupCoords.lng]);
    }

    if (dropoffCoords) {
      const m = L.marker([dropoffCoords.lat, dropoffCoords.lng], { icon: icon("#EF4444") })
        .addTo(map)
        .bindPopup(`<b>${t("driver.dropoff", "Dropoff")}</b><br/>${dropoffCoords.address || dropoffLocation || ""}`);
      markersRef.current.push(m);
      bounds.push([dropoffCoords.lat, dropoffCoords.lng]);
    }

    if (driverCoords) {
      const m = L.marker([driverCoords.lat, driverCoords.lng], { icon: icon("#3B82F6") })
        .addTo(map)
        .bindPopup(`<b>${t("driver.driver", "Driver")}</b>`);
      markersRef.current.push(m);
      bounds.push([driverCoords.lat, driverCoords.lng]);
    }

    if (pickupCoords && dropoffCoords) {
      polylineRef.current = L.polyline(
        [[pickupCoords.lat, pickupCoords.lng], [dropoffCoords.lat, dropoffCoords.lng]],
        { color: "#3B82F6", weight: 3, opacity: 0.7, dashArray: "8,8" }
      ).addTo(map);
    }

    // Center map on all markers
    if (bounds.length >= 2) {
      console.log("[DriverMap] Fitting bounds:", bounds);
      // Use fitBounds with constraints to prevent over-zooming
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 16,
        minZoom: 10
      });
    } else if (bounds.length === 1) {
      console.log("[DriverMap] Setting view:", bounds[0]);
      map.setView(bounds[0], 14);
    }
  }, [pickupCoords, dropoffCoords, driverCoords, ready, pickupLocation, dropoffLocation, t, zoom, userLocation]);

  // Center map on user location when it becomes available
  useEffect(() => {
    if (!mapInstanceRef.current || !ready || !userLocation) return;
    if (pickupCoords || dropoffCoords || driverCoords) return; // Don't center if we already have coords

    console.log("[DriverMap] Centering on user location:", userLocation);
    mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14);
  }, [userLocation, ready, pickupCoords, dropoffCoords, driverCoords]);

  // Update click handler when pickupCoords changes
  useEffect(() => {
    if (!mapInstanceRef.current || !interactive) return;
    const map = mapInstanceRef.current;
    map.off("click");
    map.on("click", async (e: any) => {
      const { lat, lng } = e.latlng;
      const cb = onLocationSelectRef.current;
      if (!cb) return;
      const address = await reverseGeocode(lat, lng);
      cb({ lat, lng, address }, !pickupCoordsRef.current ? "pickup" : "dropoff");
    });
  }, [pickupCoords, interactive, reverseGeocode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden"
      style={{ height, minHeight: "300px", position: "relative" }}
    >
      {!ready ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div
          ref={mapDivRef}
          className="w-full h-full"
          style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}

      {/* Legend */}
      {(pickupCoords || dropoffCoords || driverCoords) && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-lg p-2.5 space-y-1.5 pointer-events-none">
          {pickupCoords && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">{t("driver.pickup", "Pickup")}</span>
            </div>
          )}
          {dropoffCoords && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">{t("driver.dropoff", "Dropoff")}</span>
            </div>
          )}
          {driverCoords && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">{t("driver.driver", "Driver")}</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive hint */}
      {interactive && ready && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-lg px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 pointer-events-none">
          {!pickupCoords
            ? t("driver.clickPickup", "Click to set pickup")
            : !dropoffCoords
              ? t("driver.clickDropoff", "Click to set dropoff")
              : t("driver.clickToChange", "Click to change dropoff")}
        </div>
      )}
    </div>
  );
}
