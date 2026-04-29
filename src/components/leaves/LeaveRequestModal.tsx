/**
 * Leave Request Modal — Modal wrapper for LeaveRequestWizard
 * Used in Calendar and Leaves page
 */

'use client';

import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LeaveRequestWizard } from './LeaveRequestWizard';
import { useAuthStore } from '@/store/useAuthStore';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import type { Id } from '@/convex/_generated/dataModel';

interface LeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  preselectedStartDate?: string;
  preselectedEndDate?: string;
}

export function LeaveRequestModal({
  open,
  onClose,
  preselectedStartDate,
  preselectedEndDate,
}: LeaveRequestModalProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const selectedOrgId = useSelectedOrganization();

  const isSuperadmin = user?.role === 'superadmin' || false;
  const userId = user?.id as Id<'users'> | undefined;
  const orgId = user?.organizationId as Id<'organizations'> | undefined;

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-(--border)">
          <DialogTitle className="text-xl font-bold text-(--text-primary)">
            🏖️ {t('leaveRequest.newLeaveRequest', 'New Leave Request')}
          </DialogTitle>
          <DialogDescription className="text-sm text-(--text-muted)">
            {isSuperadmin
              ? t('leaveRequest.adminDesc', 'Submit a leave request for an employee')
              : t('leaveRequest.selfDesc', 'Submit a leave request for yourself')}
          </DialogDescription>
        </DialogHeader>
        <LeaveRequestWizard
          userId={userId}
          orgId={orgId}
          isSuperadmin={isSuperadmin || false}
          selectedOrgId={selectedOrgId as Id<'organizations'> | undefined}
          onComplete={onClose}
          onCancel={onClose}
          preselectedStartDate={preselectedStartDate}
          preselectedEndDate={preselectedEndDate}
        />
      </DialogContent>
    </Dialog>
  );
}
