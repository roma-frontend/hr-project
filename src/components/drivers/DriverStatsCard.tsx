/**
 * Driver Statistics Component
 * Shows weekly/monthly stats, popular routes, and trip history
 */

"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  MapPin,
  Clock,
  Calendar,
  Download,
  FileText,
  BarChart3,
} from "lucide-react";
import { exportTripsToExcel } from "@/lib/exportDriversToExcel";
import { exportTripsToPDF } from "@/lib/exportDriversToPDF";

interface DriverStatsCardProps {
  driverId: Id<"drivers">;
  organizationId: Id<"organizations">;
}

export function DriverStatsCard({ driverId, organizationId }: DriverStatsCardProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = React.useState<"week" | "month" | "year">("month");

  const stats = useQuery(api.drivers.getDriverStats, { driverId, period });

  // Calculate time range with useMemo to prevent infinite re-renders
  const timeRange = useMemo(() => {
    const now = Date.now();
    const days = period === "week" ? 7 : period === "month" ? 30 : 365;
    return {
      startTime: now - days * 24 * 60 * 60 * 1000,
      endTime: now,
    };
  }, [period]);

  const schedules = useQuery(
    api.drivers.getDriverSchedule,
    driverId ? {
      driverId,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
    } : "skip"
  );

  const handleExportExcel = () => {
    if (!schedules) return;
    
    const trips = schedules
      .filter(s => s.type === "trip" && s.status === "completed")
      .map(s => ({
        date: new Date(s.startTime).toLocaleDateString(),
        driver: s.userName || "Unknown",
        passenger: s.userName || "Unknown",
        from: s.tripInfo?.from || "N/A",
        to: s.tripInfo?.to || "N/A",
        purpose: s.tripInfo?.purpose || "N/A",
        distanceKm: s.tripInfo?.distanceKm || 0,
        durationMin: s.tripInfo?.durationMinutes || 0,
        status: s.status,
      }));

    exportTripsToExcel(trips, `driver-trips-${period}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!schedules || !stats) return;
    
    const trips = schedules
      .filter(s => s.type === "trip" && s.status === "completed")
      .map(s => ({
        date: new Date(s.startTime).toLocaleDateString(),
        driver: s.userName || "Unknown",
        passenger: s.userName || "Unknown",
        from: s.tripInfo?.from || "N/A",
        to: s.tripInfo?.to || "N/A",
        purpose: s.tripInfo?.purpose || "N/A",
        distanceKm: s.tripInfo?.distanceKm || 0,
        durationMin: s.tripInfo?.durationMinutes || 0,
        status: s.status,
      }));

    exportTripsToPDF(trips, {
      totalTrips: stats.totalTrips,
      totalDistance: stats.totalDistanceKm,
      totalDuration: stats.totalDurationMinutes,
      period: period === "week" ? t("driver.lastWeek", "Last Week") : period === "month" ? t("driver.lastMonth", "Last Month") : t("driver.lastYear", "Last Year"),
    }, `driver-report-${period}.pdf`);
  };

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Period Selector & Export */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={period === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("week")}
          >
            {t("driver.week", "Week")}
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("month")}
          >
            {t("driver.month", "Month")}
          </Button>
          <Button
            variant={period === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("year")}
          >
            {t("driver.year", "Year")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.totalTrips", "Total Trips")}</h3>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrips}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.totalDistance", "Total Distance")}</h3>
            <MapPin className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistanceKm.toFixed(1)} km</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.totalDuration", "Total Duration")}</h3>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDurationMinutes} min</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium">{t("driver.avgPerTrip", "Avg per Trip")}</h3>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.averageDistancePerTrip).toFixed(1)} km
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Routes */}
      {stats.popularRoutes.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">{t("driver.popularRoutes", "Popular Routes")}</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.popularRoutes.map((route, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <span className="font-medium">{route.route}</span>
                  </div>
                  <Badge variant="secondary">{route.count} {t("driver.trips", "trips")}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
