'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PollCreatorProps {
  pollQuestion: string;
  setPollQuestion: (question: string) => void;
  pollOptions: string[];
  setPollOptions: (options: string[]) => void;
  onSend: () => void;
  onClose: () => void;
  sending: boolean;
}

export function PollCreator({
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
  onSend,
  onClose,
  sending,
}: PollCreatorProps) {
  const { t } = useTranslation();

  return (
    <div
      className="px-2 xs:px-3 sm:px-4 py-3 border-t animate-slide-up"
      style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[10px] xs:text-xs font-semibold flex items-center gap-1"
          style={{ color: 'var(--text-primary)' }}
        >
          <BarChart2 className="w-3 xs:w-3.5 h-3 xs:h-3.5" style={{ color: 'var(--primary)' }} />{' '}
          {t('chat.createPoll')}
        </p>
        <button
          onClick={onClose}
          className="text-[9px] hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          ✕
        </button>
      </div>
      <input
        value={pollQuestion}
        onChange={(e) => setPollQuestion(e.target.value)}
        placeholder={t('chat.pollQuestion')}
        className="w-full px-2.5 xs:px-3 py-1.5 text-[10px] xs:text-xs rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] outline-none mb-2"
      />
      {pollOptions.map((opt, i) => (
        <div key={i} className="flex items-center gap-1 mb-1">
          <input
            value={opt}
            onChange={(e) => {
              const o = [...pollOptions];
              o[i] = e.target.value;
              setPollOptions(o);
            }}
            placeholder={`${t('chat.option')} ${i + 1}`}
            className="flex-1 px-2.5 xs:px-3 py-1.5 text-[10px] xs:text-xs rounded-lg border border-[var(--input-border)] bg-[var(--input)] text-[var(--text-primary)] outline-none"
          />
          {pollOptions.length > 2 && (
            <button
              onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
              className="text-red-400 hover:opacity-70 px-1"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {pollOptions.length < 5 && (
          <button
            onClick={() => setPollOptions([...pollOptions, ''])}
            className="text-[10px] xs:text-[11px] hover:opacity-70"
            style={{ color: 'var(--primary)' }}
          >
            {t('chat.addOption')}
          </button>
        )}
        <button
          onClick={onSend}
          disabled={!pollQuestion.trim() || pollOptions.filter(Boolean).length < 2 || sending}
          className="ml-auto px-2.5 xs:px-3 py-1 rounded-lg text-[10px] xs:text-xs font-medium text-white transition-all hover:opacity-80 disabled:opacity-40 min-h-8"
          style={{
            background:
              'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
          }}
        >
          {t('chat.sendPoll')}
        </button>
      </div>
    </div>
  );
}
