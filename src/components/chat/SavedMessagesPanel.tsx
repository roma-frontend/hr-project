'use client';

import React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { X, Bookmark, MessageCircle } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

interface Props {
  userId: Id<'users'>;
  organizationId?: Id<'organizations'>;
  onClose: () => void;
  onSelectMessage: (conversationId: Id<'chatConversations'>, messageId: Id<'chatMessages'>) => void;
}

export function SavedMessagesPanel({ userId, organizationId, onClose, onSelectMessage }: Props) {
  const { t, i18n } = useTranslation();
  // TODO: Implement saved messages feature
  const { user } = useAuthStore();

  // For now, using pinned messages as placeholder
  const savedMessages = useQuery(api.chat.queries.getPinnedMessages, {
    conversationId: undefined as any,
  });
  const unsaveMessage = useMutation(api.chat.mutations.togglePin);

  const handleUnsave = async (e: React.MouseEvent, messageId: Id<'chatMessages'>) => {
    e.stopPropagation();
    if (!user?.id) return;
    await unsaveMessage({ conversationId: messageId as any, userId: user.id as Id<'users'> });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-(--background) rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-6 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary)/10 flex items-center justify-center">
              <Bookmark className="w-5 h-5 text-(--primary)" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('chat.savedMessages')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {savedMessages?.length ?? 0} {savedMessages?.length === 1 ? 'message' : 'messages'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-(--background-subtle) transition-colors"
          >
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {savedMessages === undefined ? (
            <div className="flex items-center justify-center h-40">
              <ShieldLoader size="xs" variant="inline" />
            </div>
          ) : savedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Bookmark className="w-12 h-12 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('chat.noSavedMessages')}
              </p>
            </div>
          ) : (
            savedMessages?.map((saved: any) => {
              if (!saved) return null;
              const isOwn = saved.senderId === userId;

              return (
                <div
                  key={saved._id}
                  onClick={() =>
                    onSelectMessage(
                      saved.conversationId as Id<'chatConversations'>,
                      saved._id as Id<'chatMessages'>,
                    )
                  }
                  className="group relative p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--background-subtle)',
                  }}
                >
                  {/* Conversation badge */}
                  {saved.conversation && (
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        {saved.conversation.name ||
                          (saved.conversation.type === 'direct' ? 'Direct Message' : 'Group')}
                      </span>
                    </div>
                  )}

                  {/* Message content */}
                  <MessageBubble
                    message={saved}
                    isOwn={isOwn}
                    showAvatar={true}
                    showName={!isOwn}
                    currentUserId={userId}
                    onReply={() => {}}
                    onOpenThread={() => {}}
                    onSendMessage={async () => {}}
                  />

                  {/* Unsave button */}
                  <button
                    onClick={(e) => handleUnsave(e, saved._id as Id<'chatMessages'>)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-(--background)"
                    title="Remove from saved"
                  >
                    <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>

                  {/* Saved timestamp */}
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-disabled)' }}>
                    {t('chat.messages')}{' '}
                    {new Date(saved.savedAt).toLocaleDateString(
                      i18n.language === 'ru' ? 'ru-RU' : i18n.language === 'hy' ? 'hy-AM' : 'en-US',
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
