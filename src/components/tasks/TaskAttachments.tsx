'use client';
import Image from 'next/image';

import { useTranslation } from 'react-i18next';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from '@/lib/cssMotion';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { uploadTaskAttachment, deleteTaskAttachmentFromCloudinary } from '@/actions/cloudinary';

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
}

interface Props {
  taskId: string;
  attachments: Attachment[];
  currentUserId: string;
  canUpload: boolean;
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'image/': '🖼️',
  'video/': '🎬',
  'audio/': '🎵',
  'text/': '📝',
  'application/zip': '🗜️',
  'application/x-zip': '🗜️',
  'application/msword': '📃',
  'application/vnd.openxmlformats': '📃',
  'application/vnd.ms-excel': '📊',
  'application/vnd.ms-powerpoint': '📊',
};

function getFileIcon(type: string): string {
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(key)) return icon;
  }
  return '📎';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachments({ taskId, attachments, currentUserId, canUpload }: Props) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const validFiles = files
      .filter((f) => {
        if (f.size > 10 * 1024 * 1024) {
          toast.error(t('toasts.fileTooLarge', { name: f.name }));
          return false;
        }
        return true;
      })
      .slice(0, 5);

    if (!validFiles.length) return;
    setUploading(true);

    try {
      const uploadedAttachments: Array<{ url: string; name: string; type: string; size: number }> = [];

      for (const file of validFiles) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const url = await uploadTaskAttachment(base64, file.name);
        uploadedAttachments.push({
          url,
          name: file.name,
          type: file.type,
          size: file.size,
        });
      }

      const res = await fetch('/api/tasks?action=update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          attachments: [...attachments, ...uploadedAttachments],
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update task attachments');
      }

      toast.success(t('toasts.uploadSuccess', { count: validFiles.length }));
      window.location.reload();
    } catch {
      toast.error(t('toasts.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (url: string, name: string) => {
    setConfirmDelete({ url, name });
  };

  const confirmRemove = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTaskAttachmentFromCloudinary(confirmDelete.url);

      const updatedAttachments = attachments.filter(
        (att) => att.url !== confirmDelete.url,
      );

      const res = await fetch('/api/tasks?action=update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          attachments: updatedAttachments,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update task attachments');
      }

      toast.success(t('toasts.removed'));
      if (preview?.url === confirmDelete.url) setPreview(null);
      setConfirmDelete(null);
      window.location.reload();
    } catch {
      toast.error(t('toasts.removeFailed'));
    }
  };

  const isImage = (type: string) => type.startsWith('image/');
  const isPdf = (type: string) => type === 'application/pdf';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-(--text-secondary)">
            📎 {t('taskAttachments.title')}
          </span>
          {attachments.length > 0 && (
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-medium">
              {attachments.length}
            </span>
          )}
        </div>
        {canUpload && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl text-white disabled:opacity-50 bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity"
          >
            {uploading ? (
              <ShieldLoader size="xs" variant="inline" />
            ) : (
              <>{t('taskAttachments.attachFile')}</>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <div
          onClick={() => canUpload && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors border-(--border) ${
            canUpload ? 'cursor-pointer hover:border-blue-400/50 hover:bg-blue-500/5' : ''
          }`}
        >
          <p className="text-2xl mb-1">📎</p>
          <p className="text-sm text-(--text-muted)">
            {canUpload ? t('taskAttachments.clickToAttach') : t('taskAttachments.noAttachments')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {attachments.map((att) => (
              <motion.div
                key={att.url}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative rounded-xl border border-(--border) overflow-hidden cursor-pointer hover:border-blue-400/50 hover:shadow-md transition-all bg-(--background-subtle)"
                onClick={() => setPreview(att)}
              >
                {/* Image thumbnail */}
                {isImage(att.type) ? (
                  <div className="h-20 bg-(--background-subtle) overflow-hidden">
                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-4xl bg-(--background-subtle)">
                    {getFileIcon(att.type)}
                  </div>
                )}

                {/* File info */}
                <div className="p-2">
                  <p
                    className="text-xs font-medium text-(--text-primary) truncate"
                    title={att.name}
                  >
                    {att.name}
                  </p>
                  <p className="text-xs text-(--text-muted)">{formatSize(att.size)}</p>
                </div>

                {/* Remove button */}
                {canUpload && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(att.url, att.name);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-(--card) border border-(--border) rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getFileIcon(preview.type)}</span>
                  <div>
                    <p className="font-semibold text-(--text-primary) text-sm">{preview.name}</p>
                    <p className="text-xs text-(--text-muted)">{formatSize(preview.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={preview.url}
                    download={preview.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-3 py-1.5 rounded-xl text-white bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⬇ {t('taskAttachments.download')}
                  </a>
                  <button
                    onClick={() => setPreview(null)}
                    className="w-8 h-8 rounded-full bg-(--background-subtle) hover:bg-(--border) flex items-center justify-center text-(--text-muted) font-bold transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-(--background-subtle) min-h-[300px]">
                {isImage(preview.type) ? (
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="max-w-full max-h-[60vh] object-contain rounded-xl shadow"
                  />
                ) : isPdf(preview.type) ? (
                  <iframe
                    src={preview.url}
                    className="w-full h-[60vh] rounded-xl"
                    title={preview.name}
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-6xl">{getFileIcon(preview.type)}</p>
                    <p className="text-(--text-secondary) font-medium">{preview.name}</p>
                    <p className="text-(--text-muted) text-sm">
                      {t('taskAttachments.previewNotAvailable')}
                    </p>
                    <a
                      href={preview.url}
                      download={preview.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl text-white bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity"
                    >
                      ⬇ {t('taskAttachments.downloadToView')}
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-(--card) border border-(--border) rounded-2xl overflow-hidden max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning header */}
              <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-2xl">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-rose-400">
                      {t('taskAttachments.confirmDeleteTitle')}
                    </h3>
                    <p className="text-sm text-rose-400/70 mt-0.5">
                      {t('taskAttachments.confirmDeleteSubtitle')}
                    </p>
                  </div>
                </div>
              </div>

              {/* File info */}
              <div className="px-6 py-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-(--background-subtle) border border-(--border)">
                  <span className="text-2xl">📎</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-(--text-primary) truncate">
                      {confirmDelete.name}
                    </p>
                    <p className="text-xs text-(--text-muted)">
                      {t('taskAttachments.confirmDeleteWarning')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) text-(--text-secondary) text-sm font-medium hover:bg-(--background-subtle) transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmRemove}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold shadow-md shadow-rose-500/20 transition-colors"
                >
                  {t('taskAttachments.deleteFile')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
