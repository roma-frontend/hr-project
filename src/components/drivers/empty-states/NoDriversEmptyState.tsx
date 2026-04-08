/**
 * NoDriversEmptyState - Empty state when no drivers available
 */

'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Car, Plus } from 'lucide-react';

interface NoDriversEmptyStateProps {
  title?: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const NoDriversEmptyState = memo(function NoDriversEmptyState({
  title = 'No Drivers Available',
  description = 'There are no drivers available right now. Try again later.',
  onAction,
  actionLabel = 'Request Driver',
}: NoDriversEmptyStateProps) {
  return (
    <div
      className="text-center py-12"
      style={{
        padding: '3rem 2rem',
        borderRadius: '1.5rem',
        background: 'var(--background-subtle)',
        border: '2px dashed var(--border)',
      }}
    >
      <Car className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">{description}</p>
      {onAction && (
        <Button onClick={onAction} className="gap-2">
          <Plus className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
});
