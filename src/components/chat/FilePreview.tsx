'use client';

import React from 'react';
import { X, FileText } from 'lucide-react';
import { formatFileSize } from '@/lib/stringUtils';
import { useTranslation } from 'react-i18next';

interface PendingFile {
  file: File;
  previewUrl: string | null;
  isPDF: boolean;
  uploading: boolean;
  error?: string;
}

interface FilePreviewProps {
  files: PendingFile[];
  onRemove: (index: number) => void;
}

export function FilePreview({ files, onRemove }: FilePreviewProps) {
  const { t } = useTranslation();

  if (files.length === 0) return null;

  return (
    <div
      className="px-2 xs:px-3 sm:px-4 py-2 border-t flex gap-2 flex-wrap"
      style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
    >
      {files.map((pf, idx) => (
        <div key={idx} className="relative group/pf">
          {pf.previewUrl ? (
            <div
              className="relative w-14 xs:w-16 h-14 xs:h-16 rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
            </div>
          ) : pf.isPDF ? (
            <div
              className="w-14 xs:w-16 h-14 xs:h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <FileText className="w-5 xs:w-6 h-5 xs:h-6 text-red-400" />
              <span
                className="text-[8px] xs:text-[9px] text-center px-1 truncate w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                PDF
              </span>
            </div>
          ) : (
            <div
              className="w-14 xs:w-16 h-14 xs:h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 px-1"
              style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
            >
              <span className="text-lg">📎</span>
              <span
                className="text-[7px] xs:text-[9px] text-center truncate w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                {pf.file.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute -bottom-5 left-0 right-0 text-center">
            <span
              className="text-[8px] xs:text-[9px] truncate block"
              style={{ color: 'var(--text-disabled)' }}
            >
              {formatFileSize(pf.file.size)}
            </span>
          </div>
          <button
            onClick={() => onRemove(idx)}
            className="absolute -top-1.5 -right-1.5 w-4 xs:w-4.5 h-4 xs:h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/pf:opacity-100 transition-opacity"
          >
            <X className="w-2.5 xs:w-3 h-2.5 xs:h-3" />
          </button>
        </div>
      ))}
      <p
        className="w-full text-[9px] xs:text-[10px] mt-5"
        style={{ color: 'var(--text-disabled)' }}
      >
        {files.length} {files.length > 1 ? t('chat.filesReadyToSend') : t('chat.fileReadyToSend')}
      </p>
    </div>
  );
}
