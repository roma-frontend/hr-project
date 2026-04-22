'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useTranslation } from 'react-i18next';

interface ChatMessagesProps {
  messages: any[];
  typingUsers: any[];
  currentUserId: any;
  currentUserAvatar?: string;
  currentUserName: string;
  conversation: any;
  lang: string;
  onReply: (id: any, content: string, senderName: string) => void;
  onOpenThread: (id: any, content: string) => void;
  onSendMessage: (text: string) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  messagesParentRef: React.RefObject<HTMLDivElement>;
  isLoading?: boolean;
}

export function ChatMessages({
  messages,
  typingUsers,
  currentUserId,
  currentUserAvatar,
  currentUserName,
  conversation,
  lang,
  onReply,
  onOpenThread,
  onSendMessage,
  messagesEndRef,
  messagesParentRef,
  isLoading,
}: ChatMessagesProps) {
  const { t } = useTranslation();
  const dedupedMessages = React.useMemo(() => {
    const seen = new Set();
    return (messages || []).filter((msg) => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }, [messages]);
  const virtualizer = useVirtualizer({
    count: dedupedMessages.length,
    getScrollElement: () => messagesParentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse" role="status" aria-label={t('chat.loadingMessages')}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
            <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
            <div className={`space-y-1 ${i % 2 === 0 ? '' : 'items-end flex flex-col'}`}>
              <div className="h-3 w-16 rounded bg-white/5" />
              <div className="h-10 w-48 rounded-2xl bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!dedupedMessages || dedupedMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('chat.noMessagesYet')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={messagesParentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 xs:px-3 sm:px-4 py-3 xs:py-4 custom-scrollbar"
        style={{ background: 'var(--background)' }}
      >
        <div
          role="log"
          aria-label={t('chat.chatMessages')}
          aria-live="polite"
          aria-relevant="additions"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const msg = dedupedMessages[virtualRow.index];
            if (!msg) return null;

            const isOwn = msg.senderid === currentUserId;
            const prevMsg = dedupedMessages[virtualRow.index - 1];
            const isFirstOfStreak = virtualRow.index === 0 || prevMsg?.senderid !== msg.senderid;
            const isSystemAnnouncements = conversation?.name === 'System Announcements';
            const showAvatar = isFirstOfStreak && !isSystemAnnouncements;
            const showName = isSystemAnnouncements
              ? false
              : isFirstOfStreak && !isOwn && conversation?.type === 'group';

            return (
              <div
                key={msg.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  showName={!!showName}
                  currentUserId={currentUserId}
                  currentUserAvatar={currentUserAvatar}
                  currentUserName={currentUserName}
                  onReply={onReply}
                  onOpenThread={onOpenThread}
                  onSendMessage={onSendMessage}
                  lang={lang}
                />
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {typingUsers && typingUsers.length > 0 && (
        <div
          className="px-4 py-2 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
          <TypingIndicator users={typingUsers} />
        </div>
      )}
    </>
  );
}
