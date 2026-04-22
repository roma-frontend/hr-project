'use client';

import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Download, ExternalLink, CheckCircle2, Lock } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { toast } from 'sonner';
import {
  generateICalendar,
  downloadICalFile,
  getGoogleCalendarAuthUrl,
  getOutlookAuthUrl,
} from '@/lib/calendar-sync';
import { useUpgradeModal } from '@/components/subscription/PlanGate';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useCalendarExportData } from '@/hooks/useAdmin';

export default function HolidayCalendarSync() {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isSyncingOutlook, setIsSyncingOutlook] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const { data: calendarData, isLoading } = useCalendarExportData();

  // Plan gating
  const { canAccess } = usePlanFeatures();
  const hasCalendarSync = canAccess('calendarSync');
  const { openModal, modal: upgradeModal } = useUpgradeModal();

  // Check connection status on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_calendar') === 'connected') {
      setGoogleConnected(true);
      toast.success(t('calendarSync.googleSuccess'));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('outlook_calendar') === 'connected') {
      setOutlookConnected(true);
      toast.success(t('calendarSync.outlookSuccess'));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')) {
      toast.error(t('calendarSync.connectionFailed', 'Failed to connect to calendar'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleExportICS = async () => {
    if (!calendarData) return;

    setIsExporting(true);
    try {
      const icsContent = generateICalendar(calendarData);
      const filename = `company-leaves-${new Date().toISOString().split('T')[0]}.ics`;
      downloadICalFile(icsContent, filename);
      toast.success(t('calendarSync.icalDownloadSuccess', 'iCal file downloaded successfully'));
    } catch (error) {
      console.error(t('calendarSync.exportError', 'Export error:'), error);
      toast.error(t('calendarSync.exportFailed', 'Failed to export calendar'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleGoogleCalendar = async () => {
    if (googleConnected) {
      // Already connected, sync events
      if (!calendarData || calendarData.length === 0) {
        toast.info(t('calendarSync.noEventsToSync', 'No events to sync'));
        return;
      }

      setIsSyncingGoogle(true);
      try {
        const response = await fetch('/api/calendar/google/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: calendarData }),
        });

        if (!response.ok) {
          throw new Error(t('calendarSync.syncFailed', 'Sync failed'));
        }

        const result = await response.json();
        toast.success(t('calendarSync.syncSuccess', { defaultValue: result.message }));
      } catch (error) {
        console.error(t('calendarSync.googleSyncError', 'Google sync error:'), error);
        toast.error(t('calendarSync.googleSyncFailed', 'Failed to sync with Google Calendar'));
        setGoogleConnected(false);
      } finally {
        setIsSyncingGoogle(false);
      }
    } else {
      // Need to authenticate
      try {
        const redirectUri = `${window.location.origin}/api/calendar/google/callback`;
        const authUrl = getGoogleCalendarAuthUrl(redirectUri);
        window.location.href = authUrl;
      } catch (error) {
        console.error(t('calendarSync.googleAuthError', 'Google auth error:'), error);
        toast.error(t('calendarSync.googleNotConfigured', 'Google Calendar is not configured'));
      }
    }
  };

  const handleOutlook = async () => {
    if (outlookConnected) {
      // Already connected, sync events
      if (!calendarData || calendarData.length === 0) {
        toast.info(t('calendarSync.noEventsToSync', 'No events to sync'));
        return;
      }

      setIsSyncingOutlook(true);
      try {
        const response = await fetch('/api/calendar/outlook/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: calendarData }),
        });

        if (!response.ok) {
          throw new Error(t('calendarSync.syncFailed', 'Sync failed'));
        }

        const result = await response.json();
        toast.success(t('calendarSync.syncSuccess', { defaultValue: result.message }));
      } catch (error) {
        console.error(t('calendarSync.outlookSyncError', 'Outlook sync error:'), error);
        toast.error(t('calendarSync.outlookSyncFailed', 'Failed to sync with Outlook Calendar'));
        setOutlookConnected(false);
      } finally {
        setIsSyncingOutlook(false);
      }
    } else {
      // Need to authenticate
      try {
        const redirectUri = `${window.location.origin}/api/calendar/outlook/callback`;
        const authUrl = getOutlookAuthUrl(redirectUri);
        window.location.href = authUrl;
      } catch (error) {
        console.error(t('calendarSync.outlookAuthError', 'Outlook auth error:'), error);
        toast.error(t('calendarSync.outlookNotConfigured', 'Outlook Calendar is not configured'));
      }
    }
  };

  if (isLoading || !calendarData) {
    return (
      <Card className="border-(--border)">
        <CardContent className="flex items-center justify-center p-8">
          <ShieldLoader size="lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {upgradeModal}
      <Card className="border-(--border)">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            {t('admin.calendarSync.title', 'Calendar Sync')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="rounded-lg bg-linear-to-br from-blue-500/10 to-cyan-500/10 p-4">
            <p className="text-sm text-(--text-secondary)">
              {t('calendarSync.upcomingLeaves')}
            </p>
            <p className="text-3xl font-bold text-(--text-primary)">{calendarData.length}</p>
          </div>

          {/* Export Options */}
          <div className="space-y-2">
            <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">
              {t('admin.calendarSync.exportCalendar', 'Export Calendar')}
            </h4>

            <Button
              onClick={handleExportICS}
              disabled={isExporting || calendarData.length === 0}
              className="w-full justify-start"
              variant="outline"
            >
              {isExporting ? (
                <ShieldLoader size="xs" variant="inline" className="mr-2" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t('admin.calendarSync.downloadIcal', 'Download iCal (.ics)')}
            </Button>

            <div className="relative">
              <Button
                onClick={() => {
                  if (!hasCalendarSync) {
                    openModal({
                      featureTitle: t('admin.calendarSync.googleCalendarSync', 'Google Calendar Sync'),
                      featureDescription:
                        t('admin.calendarSync.googleCalendarSyncDesc', 'Sync leave schedules with Google Calendar. Available on Professional plan and above.'),
                      recommendedPlan: 'professional',
                    });
                    return;
                  }
                  handleGoogleCalendar();
                }}
                className="w-full justify-start"
                variant="outline"
                disabled={isSyncingGoogle || calendarData.length === 0}
              >
                {isSyncingGoogle ? (
                  <ShieldLoader size="xs" variant="inline" className="mr-2" />
                ) : !hasCalendarSync ? (
                  <Lock className="mr-2 h-4 w-4 text-(--text-muted)" />
                ) : googleConnected ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                {googleConnected && hasCalendarSync
                  ? t('calendarSync.syncWithGoogle')
                  : t('calendarSync.connectGoogle')}
              </Button>
              {googleConnected && hasCalendarSync && (
                <Badge
                  variant="secondary"
                  className="absolute -right-2 -top-2 bg-green-500 text-white"
                >
                  {t('admin.calendarSync.connected', 'Connected')}
                </Badge>
              )}
              {!hasCalendarSync && (
                <Badge
                  variant="secondary"
                  className="absolute -right-2 -top-2 bg-linear-to-r from-amber-500 to-orange-500 text-white text-[10px]"
                >
                  {t('admin.calendarSync.pro', 'Pro')}
                </Badge>
              )}
            </div>

            <div className="relative">
              <Button
                onClick={() => {
                  if (!hasCalendarSync) {
                    openModal({
                      featureTitle: t('admin.calendarSync.outlookCalendarSync', 'Outlook Calendar Sync'),
                      featureDescription:
                        t('admin.calendarSync.outlookCalendarSyncDesc', 'Sync leave schedules with Outlook Calendar. Available on Professional plan and above.'),
                      recommendedPlan: 'professional',
                    });
                    return;
                  }
                  handleOutlook();
                }}
                className="w-full justify-start"
                variant="outline"
                disabled={isSyncingOutlook || calendarData.length === 0}
              >
                {isSyncingOutlook ? (
                  <ShieldLoader size="xs" variant="inline" className="mr-2" />
                ) : !hasCalendarSync ? (
                  <Lock className="mr-2 h-4 w-4 text-(--text-muted)" />
                ) : outlookConnected ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                {outlookConnected && hasCalendarSync
                  ? t('calendarSync.syncWithOutlook')
                  : t('calendarSync.connectOutlook')}
              </Button>
              {outlookConnected && hasCalendarSync && (
                <Badge
                  variant="secondary"
                  className="absolute -right-2 -top-2 bg-green-500 text-white"
                >
                  {t('admin.calendarSync.connected', 'Connected')}
                </Badge>
              )}
              {!hasCalendarSync && (
                <Badge
                  variant="secondary"
                  className="absolute -right-2 -top-2 bg-linear-to-r from-amber-500 to-orange-500 text-white text-[10px]"
                >
                  {t('admin.calendarSync.pro', 'Pro')}
                </Badge>
              )}
            </div>
          </div>

          {calendarData.length === 0 && (
            <p className="text-center text-sm text-(--text-secondary)">
              {t('calendarSync.noUpcoming')}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
