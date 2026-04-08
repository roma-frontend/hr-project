/**
 * DriverStatsGrid - Stats for driver dashboard
 */

'use client';

import React, { memo } from 'react';
import { StatCard } from './StatCard';
import { Calendar, Clock, TrendingUp, Star } from 'lucide-react';

interface DriverStatsGridProps {
  todayTrips: number;
  pendingRequests: number;
  totalCompleted: number;
  rating: number;
}

export const DriverStatsGrid = memo(function DriverStatsGrid({
  todayTrips,
  pendingRequests,
  totalCompleted,
  rating,
}: DriverStatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-8 drivers-stagger">
      <StatCard
        label="Today's Trips"
        value={todayTrips}
        icon={Calendar}
        gradientFrom="#3b82f6"
        gradientTo="#2563eb"
        iconBgColor="rgba(59, 130, 246, 0.1)"
      />
      <StatCard
        label="Pending Requests"
        value={pendingRequests}
        icon={Clock}
        gradientFrom="#f59e0b"
        gradientTo="#d97706"
        iconBgColor="rgba(245, 158, 11, 0.1)"
      />
      <StatCard
        label="Total Completed"
        value={totalCompleted}
        icon={TrendingUp}
        gradientFrom="#22c55e"
        gradientTo="#16a34a"
        iconBgColor="rgba(34, 197, 94, 0.1)"
      />
      <StatCard
        label="Rating"
        value={rating.toFixed(1)}
        icon={Star}
        gradientFrom="#eab308"
        gradientTo="#ca8a04"
        iconBgColor="rgba(234, 179, 8, 0.1)"
      />
    </div>
  );
});
