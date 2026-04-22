'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useThreadReplies, useSendThreadReply } from '@/hooks/useChat';

interface Props {
  parentMessageId: string;
  parentContent: string;
  currentUserId: string;
  conversationId: string;
  organizationId?: string;
  onClose: () => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n: any) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadPanel({
  parentMessageId,
  parentContent,
  currentUserId,
  conversationId,
  organizationId,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: replies } = useThreadReplies(parentMessageId);
  const sendReplyMutation = useSendThreadReply();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies?.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendReplyMutation.mutateAsync({
        parentMessageId,
        conversationId,
        senderId: currentUserId,
        organizationId,
        content: input.trim(),
      });
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full border-l animate-slide-in-right"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--background)',
        width: 320,
        minWidth: 280,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('chat.thread.title', 'Thread')}
          </h3>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {t('chat.thread.replies', { count: replies?.length ?? 0 })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent message */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
      >
        <p className="text-xs italic line-clamp-3" style={{ color: 'var(--text-muted)' }}>
          "{parentContent}"
        </p>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {replies === undefined && (
          <div className="flex items-center justify-center py-8">
            <ShieldLoader size="xs" variant="inline" />
          </div>
        )}
        {replies?.map((r: any) => {
          const isOwn = r.senderid === currentUserId;
          return (
            <div
              key={r.id}
              className={`flex gap-2 animate-fade-in ${isOwn ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="sm:w-6 w-8 sm:h-6 h-8 shrink-0 mt-0.5">
                {r.sender?.avatarUrl && <AvatarImage src={r.sender.avatarUrl} />}
                <AvatarFallback
                  className="sm:text-[8px] text-[10px] font-bold text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))',
                  }}
                >
                  {getInitials(r.sender?.name ?? '?')}
                </AvatarFallback>
              </Avatar>
              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
                <span
                  className="sm:text-[10px] text-xs font-medium sm:mb-0.5 mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isOwn ? t('chat.thread.you', 'You') : r.sender?.name}
                </span>
                <div
                  className="sm:px-3 px-3.5 sm:py-1.5 py-2 rounded-xl sm:text-xs text-sm break-words"
                  style={{
                    background: isOwn
                      ? 'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))'
                      : 'var(--background-subtle)',
                    color: isOwn ? 'white' : 'var(--text-primary)',
                  }}
                >
                  {r.content}
                </div>
                <span
                  className="sm:text-[9px] text-xs mt-1 opacity-50"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {format(new Date(r.created_at), 'HH:mm')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--background-subtle)' }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('thread.replyInThread', 'Reply in thread…')}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:scale-110 disabled:opacity-30"
            style={{
              background: input.trim()
                ? 'linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)))'
                : 'var(--border)',
            }}
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
