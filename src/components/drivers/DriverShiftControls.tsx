'use client';

import React, { useState } from 'react';
import { useDriverShifts, useCreateShift, useEndShift } from '@/hooks/useDrivers';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Play, Square, Pause, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import { format, type Locale } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';

interface DriverShiftControlsProps {
  driverId: string;
  userId: string;
  organizationId: string;
}

export function DriverShiftControls({
  driverId,
  userId,
  organizationId,
}: DriverShiftControlsProps) {
  const { t, i18n } = useTranslation();
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [breakTime, setBreakTime] = useState('');
  const [driverNotes, setDriverNotes] = useState('');

  const dateFnsLocale: Locale = {
    en: enUS,
    ru: ru,
    hy: hy,
  }[i18n.language] || enUS;

  const { data: shifts } = useDriverShifts(organizationId, driverId);
  const currentShift = shifts?.[0];

  const startShiftMutation = useCreateShift();
  const endShiftMutation = useEndShift();

  const handleStartShift = async () => {
    try {
      await startShiftMutation.mutateAsync({
        driverId,
        organizationId,
        startTime: Date.now(),
      });
      toast.success(t('driver.shift.started', 'Shift started successfully!'));
    } catch (error: any) {
      toast.error(error instanceof Error ? t('driver.error', { defaultValue: error.message }) : t('driver.shift.startFailed', 'Failed to start shift'));
    }
  };

  const handleEndShift = async () => {
    try {
      if (!currentShift) return;
      await endShiftMutation.mutateAsync({
        shiftId: currentShift.id,
        endTime: new Date().toISOString(),
      });
      toast.success(t('driver.shift.ended', 'Shift ended successfully!'));
      setShowEndShiftModal(false);
      setBreakTime('');
      setDriverNotes('');
    } catch (error: any) {
      toast.error(error instanceof Error ? t('driver.error', { defaultValue: error.message }) : t('driver.shift.endFailed', 'Failed to end shift'));
    }
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}${t('driver.shift.hourUnit', 'h')} ${m}${t('driver.shift.minUnit', 'm')}`;
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              {t('driver.shift.currentShift', 'Current Shift')}
            </CardTitle>
            {currentShift ? (
              <Badge
                variant={currentShift.isActive ? 'success' : 'warning'}
                className="text-[10px] sm:text-xs"
              >
                {currentShift.isActive && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-(--success) animate-pulse" />
                    {t('driver.shift.active', 'Active')}
                  </span>
                )}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] sm:text-xs">
                {t('driver.shift.offShift', 'Off Shift')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
          {currentShift ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-(--background-subtle) border border-(--border)">
                <div>
                  <p className="text-xs sm:text-sm text-(--text-muted)">
                    {t('driver.shift.duration', 'Duration')}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-(--text-primary)">
                    {formatDuration(
                      currentShift.endTime
                        ? currentShift.endTime - currentShift.startTime
                        : Date.now() - currentShift.startTime,
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs sm:text-sm text-(--text-muted)">
                    {t('driver.shift.startedAt', 'Started')}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-(--text-primary)">
                    {format(currentShift.startTime, 'HH:mm', { locale: dateFnsLocale })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-(--background-subtle) border border-(--border)">
                  <p className="text-[10px] sm:text-xs text-(--text-muted)">
                    {t('driver.shift.trips', 'Trips')}
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-(--text-primary)">
                    {currentShift.tripsCompleted || 0}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-(--background-subtle) border border-(--border)">
                  <p className="text-[10px] sm:text-xs text-(--text-muted)">
                    {t('driver.shift.distance', 'Distance')}
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-(--text-primary)">
                    {(currentShift.totalDistance || 0).toFixed(1)} {t('driver.shift.kmUnit', 'km')}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-(--background-subtle) border border-(--border)">
                  <p className="text-[10px] sm:text-xs text-(--text-muted)">
                    {t('driver.shift.duration', 'Duration')}
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-(--text-primary)">
                    {currentShift.totalDuration || 0} {t('driver.shift.minutes', 'min')}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowEndShiftModal(true)}
                  className="flex-1 sm:flex-none text-xs"
                >
                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {t('driver.shift.end', 'End Shift')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-(--text-muted) opacity-50" />
              <p className="text-xs sm:text-sm text-(--text-muted) mb-4">
                {t('driver.shift.notStarted', 'No active shift')}
              </p>
              <Button onClick={handleStartShift} size="sm" className="text-xs">
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                {t('driver.shift.start', 'Start Shift')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEndShiftModal} onOpenChange={setShowEndShiftModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-(--border)">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-(--destructive)/10 shrink-0">
                <Square className="w-4 h-4 sm:w-5 sm:h-5 text-(--destructive)" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-(--text-primary)">
                  {t('driver.shift.endShift', 'End Shift')}
                </h2>
                <p className="text-xs sm:text-sm text-(--text-muted) mt-0.5">
                  {t('driver.shift.endShiftDesc', 'Complete your shift and submit final details')}
                </p>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
            <div>
              <Label className="text-xs sm:text-sm font-medium text-(--text-primary) flex items-center gap-2">
                <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-(--warning)" />
                {t('driver.shift.breakTime', 'Break Time (minutes)')}
              </Label>
              <Input
                type="number"
                min="0"
                max="480"
                value={breakTime}
                onChange={(e) => setBreakTime(e.target.value)}
                placeholder={t('placeholders.zero', '0')}
                className="mt-2 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm font-medium text-(--text-primary) flex items-center gap-2">
                {t('driver.shift.notesLabel', 'Notes')} ({t('common.optional', 'Optional')})
              </Label>
              <Textarea
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                placeholder={t('driver.shift.notesPlaceholder', 'Any notes about this shift...')}
                rows={3}
                className="mt-2 resize-none text-sm"
              />
            </div>
          </div>
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-(--border) flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowEndShiftModal(false)}
              className="w-full sm:w-auto text-xs"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndShift}
              className="w-full sm:w-auto text-xs"
            >
              <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              {t('driver.shift.endConfirm', 'End Shift')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
