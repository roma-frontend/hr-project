/**
 * Driver Statistics Component
 * Shows weekly/monthly stats, popular routes, and trip history
 */

'use client';

import React, { useMemo } from 'react';
import { useDriverSchedules } from '@/hooks/useDrivers';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, MapPin, Clock, Download, FileText, BarChart3 } from 'lucide-react';
import { exportTripsToExcel } from '@/lib/exportDriversToExcel';
import { exportTripsToPDF } from '@/lib/exportDriversToPDF';
import { format } from 'date-fns';
import { enUS, ru, hy, type Locale } from 'date-fns/locale';

interface DriverStatsCardProps {
  driverId: string;
  organizationId: string;
}

export function DriverStatsCard({ driverId, organizationId }: DriverStatsCardProps) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = React.useState<'week' | 'month' | 'year'>('month');

  const dateFnsLocale: Locale = {
    en: enUS,
    ru: ru,
    hy: hy,
  }[i18n.language] || enUS;

  const timeRange = useMemo(() => {
    const now = Date.now();
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    return {
      startTime: now - days * 24 * 60 * 60 * 1000,
      endTime: now,
    };
  }, [period]);

  const { data: schedules } = useDriverSchedules(driverId, timeRange.startTime, timeRange.endTime);

  const stats = useMemo(() => {
    if (!schedules) return { totalTrips: 0, totalWorkedHours: 0 };
    const trips = schedules.filter((s: any) => s.type === 'trip' && s.status === 'completed');
    const totalWorkedHours = trips.reduce((acc: number, trip: any) => {
      const duration = (trip.endTime - trip.startTime) / (1000 * 60 * 60);
      return acc + duration;
    }, 0);
    return { totalTrips: trips.length, totalWorkedHours };
  }, [schedules]);

  const handleExportExcel = () => {
    if (!schedules) return;

    const trips = schedules
      .filter((s: any) => s.type === 'trip' && s.status === 'completed')
      .map((s: any) => ({
        date: format(new Date(s.startTime), 'PPP', { locale: dateFnsLocale }),
        driver: s.userName || t('driver.unknown', 'Unknown'),
        passenger: s.userName || t('driver.unknown', 'Unknown'),
        from: s.tripInfo?.from || t('common.na', 'N/A'),
        to: s.tripInfo?.to || t('common.na', 'N/A'),
        purpose: s.tripInfo?.purpose || t('common.na', 'N/A'),
        distanceKm: s.tripInfo?.distanceKm || 0,
        durationMin: s.tripInfo?.durationMinutes || 0,
        status: s.status,
      }));

    exportTripsToExcel(trips, `driver-trips-${period}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!schedules) return;

    const trips = schedules
      .filter((s: any) => s.type === 'trip' && s.status === 'completed')
      .map((s: any) => ({
        date: format(new Date(s.startTime), 'PPP', { locale: dateFnsLocale }),
        driver: s.userName || t('driver.unknown', 'Unknown'),
        passenger: s.userName || t('driver.unknown', 'Unknown'),
        from: s.tripInfo?.from || t('common.na', 'N/A'),
        to: s.tripInfo?.to || t('common.na', 'N/A'),
        purpose: s.tripInfo?.purpose || t('common.na', 'N/A'),
        distanceKm: s.tripInfo?.distanceKm || 0,
        durationMin: s.tripInfo?.durationMinutes || 0,
        status: s.status,
      }));

    exportTripsToPDF(
      trips,
      {
        totalTrips: stats.totalTrips,
        totalDistance: 0,
        totalDuration: stats.totalWorkedHours * 60,
        period:
          period === 'week'
            ? t('driver.lastWeek', 'Last Week')
            : period === 'month'
              ? t('driver.lastMonth', 'Last Month')
              : t('driver.lastYear', 'Last Year'),
      },
      `driver-report-${period}.pdf`,
    );
  };

  if (!schedules) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant={period === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('week')}
            className="flex-1 sm:flex-none text-xs"
          >
            {t('driver.week', 'Week')}
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('month')}
            className="flex-1 sm:flex-none text-xs"
          >
            {t('driver.month', 'Month')}
          </Button>
          <Button
            variant={period === 'year' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('year')}
            className="flex-1 sm:flex-none text-xs"
          >
            {t('driver.year', 'Year')}
          </Button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none text-xs"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            {t('driver.stats.exportExcel', 'Excel')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none text-xs"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            {t('driver.stats.exportPdf', 'PDF')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 py-2">
            <h3 className="text-xs sm:text-sm font-medium text-(--text-muted)">
              {t('driver.totalTrips', 'Total Trips')}
            </h3>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-(--primary)" />
          </CardHeader>
          <CardContent className="px-3 py-2 pb-3">
            <div className="text-xl sm:text-2xl font-bold text-(--text-primary)">
              {stats.totalTrips}
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 py-2">
            <h3 className="text-xs sm:text-sm font-medium text-(--text-muted)">
              {t('driver.totalDistance', 'Total Distance')}
            </h3>
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-(--warning)" />
          </CardHeader>
          <CardContent className="px-3 py-2 pb-3">
            <div className="text-xl sm:text-2xl font-bold text-(--text-primary)">{t('common.na', 'N/A')}</div>
            <p className="text-[10px] sm:text-xs text-(--text-muted) mt-1">
              {t('driver.stats.distanceComingSoon', 'Distance tracking coming soon')}
            </p>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 py-2">
            <h3 className="text-xs sm:text-sm font-medium text-(--text-muted)">
              {t('driver.totalDuration', 'Total Duration')}
            </h3>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-(--success)" />
          </CardHeader>
          <CardContent className="px-3 py-2 pb-3">
            <div className="text-xl sm:text-2xl font-bold text-(--text-primary)">
              {Math.round(stats.totalWorkedHours * 60)} {t('driver.stats.minutes', 'min')}
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 py-2">
            <h3 className="text-xs sm:text-sm font-medium text-(--text-muted)">
              {t('driver.avgPerTrip', 'Avg per Trip')}
            </h3>
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-(--info)" />
          </CardHeader>
          <CardContent className="px-3 py-2 pb-3">
            <div className="text-xl sm:text-2xl font-bold text-(--text-primary)">
              {stats.totalTrips > 0
                ? ((stats.totalWorkedHours * 60) / stats.totalTrips).toFixed(0)
                : 0}{' '}
              {t('driver.stats.minutes', 'min')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
