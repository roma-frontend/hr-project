'use client';

/**
 * Request Driver — slide-over Sheet hosting the multi-step wizard.
 *
 * A centred modal hides exactly the list the user clicked from, which is why
 * every other detail view in the app is a right-side sheet; this wrapper exists
 * so the wizard itself stays presentation-agnostic (it is also embedded
 * elsewhere). Radix's Dialog primitive already locks body scroll while open —
 * an earlier version re-implemented that by hand and leaked the lock on unmount.
 */

import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle } from '@/components/ui/sheet';
import { RequestDriverWizard } from '../RequestDriverWizard';
import type { Id } from '@/convex/_generated/dataModel';

interface RequestDriverModalProps {
  open: boolean;
  onClose: () => void;
  userId: Id<'users'>;
  preselectedDriverId?: string;
}

export function RequestDriverModal({
  open,
  onClose,
  userId,
  preselectedDriverId,
}: RequestDriverModalProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="lg" closeLabel={t('common.close', 'Close')}>
        <SheetHeader>
          <SheetTitle className="text-lg md:text-xl">
            {t('driver.requestDriver', 'Request Driver')}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <RequestDriverWizard
            userId={userId}
            onComplete={onClose}
            onCancel={onClose}
            preselectedDriverId={preselectedDriverId}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
