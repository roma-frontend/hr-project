"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Clock, TrendingUp, CheckCircle, Coffee } from "lucide-react";
import { format } from "date-fns";

interface ShiftHistoryProps {
  driverId: Id<"drivers">;
}

export function ShiftHistory({ driverId }: ShiftHistoryProps) {
  const { t } = useTranslation();
  const shifts = useQuery(api.drivers.getShiftHistory, { driverId, limit: 10 });

  if (!shifts) return null;

  const formatDuration = (hours: number | null) => {
    if (!hours) return "-";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      completed: "default",
      active: "default",
      paused: "secondary",
      overtime: "outline",
    };

    const labels: Record<string, string> = {
      completed: t("driver.shift.completed", "Completed"),
      active: t("driver.shift.active", "Active"),
      paused: t("driver.shift.paused", "Paused"),
      overtime: t("driver.shift.overtime", "Overtime"),
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
        {status === "active" && <span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />}
        {status === "paused" && <Coffee className="w-3 h-3 mr-1" />}
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          {t("driver.shift.history", "Shift History")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("driver.shift.noHistory", "No shift history yet")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => (
              <div
                key={shift._id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {format(shift.startTime, "MMM dd, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(shift.startTime, "HH:mm")} - {shift.endTime ? format(shift.endTime, "HH:mm") : "Now"}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(shift.status)}
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("driver.shift.duration", "Duration")}</p>
                    <p className="font-medium">{formatDuration(shift.duration)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("driver.shift.trips", "Trips")}</p>
                    <p className="font-medium">{shift.tripsCompleted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("driver.shift.distance", "Distance")}</p>
                    <p className="font-medium">{(shift.totalDistance || 0).toFixed(1)} km</p>
                  </div>
                  {shift.overtimeHours && shift.overtimeHours > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t("driver.shift.overtime", "Overtime")}</p>
                      <p className="font-medium text-orange-600">{shift.overtimeHours.toFixed(1)}h</p>
                    </div>
                  )}
                </div>

                {shift.driverNotes && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                    <p className="text-xs text-muted-foreground mb-1">📝 {t("driver.shift.notes", "Notes")}</p>
                    <p>{shift.driverNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
