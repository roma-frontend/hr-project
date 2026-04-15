'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

interface ReplyPreviewProps {
  replyTo: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  onCancel: () => void;
}

export function ReplyPreview({ replyTo, onCancel }: ReplyPreviewProps) {
  const { t } = useTranslation();

  if (!replyTo) return null;

  return (
    <div
      className="px-2 xs:px-3 sm:px-4 py-2 border-t flex items-center gap-2"
      style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
    >
      <div className="w-0.5 h-8 rounded-full" style={{ background: 'var(--primary)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] xs:text-[11px] font-medium" style={{ color: 'var(--primary)' }}>
          {t('chat.replyingTo')} {replyTo.senderName}
        </p>
        <p className="text-[9px] xs:text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {replyTo.content}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="w-5 h-5 flex items-center justify-center rounded-full hover:opacity-70 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
