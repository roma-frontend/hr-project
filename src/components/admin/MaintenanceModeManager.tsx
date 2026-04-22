'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useMaintenanceMode, useDisableMaintenanceMode } from '@/hooks/useAdmin';

interface MaintenanceModeManagerProps {
  organizationId?: string;
  userId?: string;
}

export function MaintenanceModeManager({ organizationId, userId }: MaintenanceModeManagerProps) {
  const { t, i18n } = useTranslation();
  const [disabling, setDisabling] = useState(false);
  const { data: maintenance, isLoading } = useMaintenanceMode(organizationId || '');
  const disableMaintenanceModeMutation = useDisableMaintenanceMode();

  if (isLoading || maintenance === undefined) {
    return null; // Loading
  }

  if (!maintenance?.isActive) {
    return null; // No active maintenance
  }

  const handleDisable = async () => {
    if (!organizationId || !userId) return;
    setDisabling(true);
    try {
      await disableMaintenanceModeMutation.mutateAsync({
        organizationId,
        userId,
      });
    } finally {
      setDisabling(false);
    }
  };

  const startTime = new Date(maintenance.startTime);
  const endTime = maintenance.endTime ? new Date(maintenance.endTime) : null;

  return (
    <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <CardTitle className="text-red-700 dark:text-red-300">{t('admin.maintenance.siteUnderMaintenance', 'Site Under Maintenance')}</CardTitle>
              <CardDescription>{maintenance.title}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Message */}
        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200">{maintenance.message}</p>
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{t('admin.maintenance.startTime', 'Maintenance Start')}</p>
            <p className="text-sm font-semibold">{startTime.toLocaleString(i18n.language || 'en-GB')}</p>
          </div>

          {maintenance.estimatedDuration && (
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('admin.maintenance.estimatedDuration', 'Estimated Duration')}</p>
              <p className="text-sm font-semibold">{maintenance.estimatedDuration}</p>
            </div>
          )}

          {endTime && (
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('admin.maintenance.expectedEnd', 'Expected End')}</p>
              <p className="text-sm font-semibold">{endTime.toLocaleString(i18n.language || 'en-GB')}</p>
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            {t('admin.maintenance.warningText', '⚠️ The site is currently unavailable to all users except SuperAdmin.')}
          </p>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleDisable}
          disabled={disabling}
          className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white gap-2"
        >
          {disabling ? (
            <>
              <ShieldLoader size="xs" variant="inline" />
              {t('admin.maintenance.enablingSite', 'Enabling site...')}
            </>
          ) : (
            <>
              <PowerOff className="w-4 h-4" />{t('admin.maintenance.enableSite', 'Enable Site')}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {t('admin.maintenance.helperText', 'The site will become available to all users again')}
        </p>
      </CardContent>
    </Card>
  );
}
