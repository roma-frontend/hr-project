/**
 * Manual Conflict Check Button
 * Allows admin to manually check for leave conflicts with events
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckLeaveConflictsManual } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CheckConflictsButtonProps {
  leaveRequestId: string;
  userId: string;
  startDate: string;
  endDate: string;
  organizationId: string;
}

export function CheckConflictsButton({
  leaveRequestId,
  userId,
  startDate,
  endDate,
  organizationId,
}: CheckConflictsButtonProps) {
  const { t } = useTranslation();
  const { mutateAsync: checkConflicts } = useCheckLeaveConflictsManual();
  const [isChecking, setIsChecking] = React.useState(false);
  const [conflictCount, setConflictCount] = React.useState<number | null>(null);

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const result = await checkConflicts({
        leaveRequestId,
        userId,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        organizationId,
      }) as any;
      setConflictCount(result.conflictsFound);
    } catch (error: any) {
      console.error(t('events.conflictCheckFailed', 'Conflict check failed:'), error);
      alert(error instanceof Error ? t('events.error', { defaultValue: error.message }) : t('events.failedToCheckConflicts', 'Failed to check conflicts'));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isChecking} className="gap-2">
          {isChecking ? (
            <ShieldLoader size="xs" variant="inline" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {t('events.checkConflicts', 'Check Conflicts')}
          {conflictCount !== null && conflictCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
              {conflictCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleCheck}>{t('events.checkForThisLeave', 'Check for this leave request')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
