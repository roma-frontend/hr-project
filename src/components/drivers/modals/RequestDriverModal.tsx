'use client';

/**
 * Request Driver Modal - Wrapper for RequestDriverWizard
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg md:text-xl">Request Driver</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <RequestDriverWizard
            userId={userId}
            onComplete={onClose}
            onCancel={onClose}
            preselectedDriverId={preselectedDriverId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
