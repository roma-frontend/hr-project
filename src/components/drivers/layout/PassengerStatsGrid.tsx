'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from './StatCard';
import { Car, Clock, CheckCircle } from 'lucide-react';

interface PassengerStatsGridProps {
  availableDrivers: number;
  pendingRequests: number;
  totalTrips: number;
}

export const PassengerStatsGrid = memo(function PassengerStatsGrid({
  availableDrivers,
  pendingRequests,
  totalTrips,
}: PassengerStatsGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 mb-6 sm:mb-8 drivers-stagger">
      <StatCard
        label={t('driver.availableDrivers', 'Available Drivers')}
        value={availableDrivers}
        icon={Car}
        gradientFrom="#22c55e"
        gradientTo="#16a34a"
        iconBgColor="rgba(34, 197, 94, 0.1)"
      />
      <StatCard
        label={t('driver.pendingRequests', 'Pending Requests')}
        value={pendingRequests}
        icon={Clock}
        gradientFrom="#f59e0b"
        gradientTo="#d97706"
        iconBgColor="rgba(245, 158, 11, 0.1)"
      />
      <StatCard
        label={t('driver.totalTrips', 'Total Trips')}
        value={totalTrips}
        icon={CheckCircle}
        gradientFrom="#3b82f6"
        gradientTo="#2563eb"
        iconBgColor="rgba(59, 130, 246, 0.1)"
      />
    </div>
  );
});
