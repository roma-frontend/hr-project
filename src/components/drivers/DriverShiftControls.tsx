'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Play, Square, Pause, Coffee, History, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DriverShiftControlsProps {
  driverId: Id<'drivers'>;
  userId: Id<'users'>;
  organizationId: Id<'organizations'>;
}

export function DriverShiftControls({
  driverId,
  userId,
  organizationId,
}: DriverShiftControlsProps) {
  const { t } = useTranslation();
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [breakTime, setBreakTime] = useState('');
  const [driverNotes, setDriverNotes] = useState('');

  // Get current shift
  const currentShift = useQuery(api.drivers.requests_queries.getCurrentShift, { driverId });

  // Get driver info
  const driver = useQuery(api.drivers.queries.getDriverById, { driverId });

  // Mutations
  const startShiftMutation = useMutation(api.drivers.shifts_mutations.startShift);
  const endShiftMutation = useMutation(api.drivers.shifts_mutations.endShift);
  const pauseShiftMutation = useMutation(api.drivers.shifts_mutations.pauseShift);
  const resumeShiftMutation = useMutation(api.drivers.shifts_mutations.resumeShift);

  const handleStartShift = async () => {
    try {
      await startShiftMutation({
        driverId,
        userId,
        organizationId,
        scheduledStartTime: driver?.workingHours?.startTime
          ? Date.now() // Could parse workingHours.startTime to set scheduled time
          : undefined,
        scheduledEndTime: driver?.workingHours?.endTime
          ? Date.now() // Could parse workingHours.endTime to set scheduled time
          : undefined,
      });
      toast.success(t('driver.shift.started', 'Shift started successfully!'));
    } catch (error: any) {
      toast.error(error.message || t('driver.shift.startFailed', 'Failed to start shift'));
    }
  };

  const handleEndShift = async () => {
    try {
      await endShiftMutation({
        driverId,
        userId,
        breakTime: breakTime ? parseInt(breakTime) : undefined,
        driverNotes: driverNotes || undefined,
      });
      toast.success(t('driver.shift.ended', 'Shift ended successfully!'));
      setShowEndShiftModal(false);
      setBreakTime('');
      setDriverNotes('');
    } catch (error: any) {
      toast.error(error.message || t('driver.shift.endFailed', 'Failed to end shift'));
    }
  };

  const handlePauseShift = async () => {
    try {
      await pauseShiftMutation({ driverId, userId });
      toast.success(t('driver.shift.paused', 'Shift paused'));
    } catch (error: any) {
      toast.error(error.message || t('driver.shift.pauseFailed', 'Failed to pause shift'));
    }
  };

  const handleResumeShift = async () => {
    try {
      await resumeShiftMutation({ driverId, userId });
      toast.success(t('driver.shift.resumed', 'Shift resumed'));
    } catch (error: any) {
      toast.error(error.message || t('driver.shift.resumeFailed', 'Failed to resume shift'));
    }
  };

  // Format shift duration (input in milliseconds)
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (!driver) return null;

  return (
    <>
      {/* Shift Status Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('driver.shift.currentShift', 'Current Shift')}
            </CardTitle>
            {currentShift ? (
              <Badge variant={currentShift.status === 'active' ? 'success' : 'warning'}>
                {currentShift.status === 'active' && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-(--success) animate-pulse" />
                    {t('driver.shift.active', 'Active')}
                  </span>
                )}
                {currentShift.status === 'paused' && (
                  <span className="flex items-center gap-1">
                    <Pause className="w-3 h-3" />
                    {t('driver.shift.paused', 'Paused')}
                  </span>
                )}
              </Badge>
            ) : (
              <Badge variant="outline">{t('driver.shift.offShift', 'Off Shift')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentShift ? (
            <div className="space-y-4">
              {/* Shift Timer */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-(--background-subtle) border border-(--border)">
                <div>
                  <p className="text-sm text-(--text-muted)">
                    {t('driver.shift.duration', 'Duration')}
                  </p>
                  <p className="text-2xl font-bold font-mono text-(--text-primary)">
                    {formatDuration(
                      currentShift.endTime
                        ? currentShift.endTime - currentShift.startTime
                        : Date.now() - currentShift.startTime,
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-(--text-muted)">
                    {t('driver.shift.startedAt', 'Started')}
                  </p>
                  <p className="text-sm font-medium text-(--text-primary)">
                    {format(currentShift.startTime, 'HH:mm')}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-lg bg-(--background-subtle) border border-(--border)">
                  <p className="text-xs text-(--text-muted)">{t('driver.shift.trips', 'Trips')}</p>
                  <p className="text-lg font-semibold text-(--text-primary)">
                    {currentShift.tripsCompleted}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-(--background-subtle) border border-(--border)">
                  <p className="text-xs text-(--text-muted)">
                    {t('driver.shift.distance', 'Distance')}
                  </p>
                  <p className="text-lg font-semibold text-(--text-primary)">
                    {(currentShift.totalDistance || 0).toFixed(1)} km
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-(--background-subtle) border border-(--border)">
                  <p className="text-xs text-(--text-muted)">
                    {t('driver.shift.duration', 'Duration')}
                  </p>
                  <p className="text-lg font-semibold text-(--text-primary)">
                    {currentShift.totalDuration || 0} min
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {currentShift.status === 'active' ? (
                  <Button variant="warning" size="sm" onClick={handlePauseShift} className="flex-1">
                    <Pause className="w-4 h-4 mr-2" />
                    {t('driver.shift.pause', 'Pause')}
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleResumeShift}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {t('driver.shift.resume', 'Resume')}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowEndShiftModal(true)}
                  className="flex-1"
                >
                  <Square className="w-4 h-4 mr-2" />
                  {t('driver.shift.end', 'End Shift')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-(--text-muted) opacity-50" />
              <p className="text-(--text-muted) mb-4">
                {t('driver.shift.notStarted', 'No active shift')}
              </p>
              <Button onClick={handleStartShift} size="sm">
                <Play className="w-4 h-4 mr-2" />
                {t('driver.shift.start', 'Start Shift')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* End Shift Modal */}
      <Dialog open={showEndShiftModal} onOpenChange={setShowEndShiftModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5" />
              {t('driver.shift.endShift', 'End Shift')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('driver.shift.breakTime', 'Break Time (minutes)')}</Label>
              <Input
                type="number"
                min="0"
                max="480"
                value={breakTime}
                onChange={(e) => setBreakTime(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>
                {t('driver.shift.notesLabel', 'Notes')} ({t('common.optional', 'Optional')})
              </Label>
              <Textarea
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                placeholder={t('driver.shift.notesPlaceholder', 'Any notes about this shift...')}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEndShiftModal(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleEndShift}>{t('driver.shift.endConfirm', 'End Shift')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
