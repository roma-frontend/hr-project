'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SchedulePickerProps {
  scheduledFor: string;
  setScheduledFor: (value: string) => void;
  showSchedule: boolean;
  setShowSchedule: (show: boolean) => void;
}

export function SchedulePicker({
  scheduledFor,
  setScheduledFor,
  showSchedule,
  setShowSchedule,
}: SchedulePickerProps) {
  const { t } = useTranslation();

  if (!showSchedule) return null;

  return (
    <div
      className="px-2 xs:px-3 sm:px-4 py-2 border-t flex items-center gap-2 animate-slide-up flex-wrap"
      style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
    >
      <Clock className="w-3 xs:w-3.5 h-3 xs:h-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
      <input
        type="datetime-local"
        value={scheduledFor}
        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
        onChange={(e) => setScheduledFor(e.target.value)}
        className="flex-1 text-[9px] xs:text-xs px-2 xs:px-2.5 py-1 rounded-lg border outline-none"
        style={{
          background: 'var(--background)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
      />
      <button
        onClick={() => {
          setShowSchedule(false);
          setScheduledFor('');
        }}
        className="text-[9px] hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        ✕
      </button>
    </div>
  );
}
