import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface ChatUser {
  id: string;
  name: string;
  avatarUrl?: string;
  department?: string;
  position?: string;
  presenceStatus?: string;
  organizationId?: string;
}

export interface ChatMember {
  userId: string;
  user?: ChatUser | null;
  role?: string;
  unreadCount?: number;
  isMuted?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export interface ChatConversation {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  lastMessageAt?: number;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  membership: {
    unreadCount: number;
    isMuted: boolean;
    isDeleted?: boolean;
    isArchived?: boolean;
  };
  otherUser?: ChatUser | null;
  memberCount?: number;
  members?: ChatMember[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  type: string;
  content: string;
  createdAt: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  isServiceBroadcast?: boolean;
  broadcastIcon?: string;
  broadcastTitle?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  reactions?: Record<string, string[]>;
  attachments?: Array<{ url: string; name: string; type: string; size: number }>;
  readBy?: Array<{ userId: string; readAt: number }>;
  poll?: {
    question: string;
    options: Array<{ id: string; text: string; votes: string[] }>;
    closedAt?: number;
  };
  threadCount?: number;
  threadLastAt?: number;
  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  };
  callType?: string;
  callStatus?: string;
  callDuration?: number;
  sender?: ChatUser | null;
}

export function useChatConversations(userId: string, organizationId?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-conversations', userId, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-my-conversations',
        userId,
        organizationId: organizationId || '',
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchConversations', 'Failed to fetch conversations'));
      const json = await res.json();
      return json.data as ChatConversation[];
    },
    enabled: !!userId,
    refetchInterval: 10000,
  });
}

export function useChatMessages(conversationId: string, userId: string, limit = 200) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-messages', conversationId, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-messages',
        conversationId,
        userId,
        limit: limit.toString(),
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchMessages', 'Failed to fetch messages'));
      const json = await res.json();
      return json.data as ChatMessage[];
    },
    enabled: !!conversationId && !!userId,
    refetchInterval: 5000,
  });
}

export function useChatMembers(conversationId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-members', conversationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-conversation-members',
        conversationId,
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchMembers', 'Failed to fetch members'));
      const json = await res.json();
      return json.data as ChatMember[];
    },
    enabled: !!conversationId,
  });
}

export function usePinnedMessages(conversationId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-pinned-messages', conversationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-pinned-messages',
        conversationId,
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchPinnedMessages', 'Failed to fetch pinned messages'));
      const json = await res.json();
      return json.data as ChatMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useTypingUsers(conversationId: string, currentUserId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-typing', conversationId, currentUserId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-typing-users',
        conversationId,
        currentUserId,
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchTypingUsers', 'Failed to fetch typing users'));
      const json = await res.json();
      return json.data as ChatUser[];
    },
    enabled: !!conversationId && !!currentUserId,
    refetchInterval: 3000,
  });
}

export function useThreadReplies(parentMessageId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-thread-replies', parentMessageId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-thread-replies',
        parentMessageId,
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchThreadReplies', 'Failed to fetch thread replies'));
      const json = await res.json();
      return json.data as ChatMessage[];
    },
    enabled: !!parentMessageId,
  });
}

export function useSearchMessages(conversationId: string, userId: string, query: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-search-messages', conversationId, query],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'search-messages',
        conversationId,
        userId,
        query,
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToSearchMessages', 'Failed to search messages'));
      const json = await res.json();
      return json.data as ChatMessage[];
    },
    enabled: !!conversationId && !!userId && query.length > 1,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      conversationId: string;
      senderId: string;
      organizationId?: string;
      type: string;
      content: string;
      attachments?: Array<{ url: string; name: string; type: string; size: number }>;
      replyToId?: string;
      mentionedUserIds?: string[];
      audioDuration?: number;
      poll?: any;
    }) => {
      const res = await fetch('/api/chat?action=send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.chat.failedToSendMessage', 'Failed to send message'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
    onError: (error) => {
      toast.error(t('chat.sendMessageFailed', 'Failed to send message'));
      console.error('Send message error:', error);
    },
  });
}

export function useMarkAsRead() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { conversationId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=mark-as-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToMarkAsRead', 'Failed to mark as read'));
      return res.json();
    },
  });
}

export function useSetTyping() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      conversationId: string;
      userId: string;
      organizationId?: string;
      isTyping: boolean;
    }) => {
      const res = await fetch('/api/chat?action=set-typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToSetTyping', 'Failed to set typing'));
      return res.json();
    },
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string; emoji: string }) => {
      const res = await fetch('/api/chat?action=react-to-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToToggleReaction', 'Failed to toggle reaction'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string; content: string }) => {
      const res = await fetch('/api/chat?action=edit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToEditMessage', 'Failed to edit message'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToDeleteMessage', 'Failed to delete message'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useDeleteMessageForMe() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=delete-message-for-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToDeleteMessageForMe', 'Failed to delete message for me'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function usePinMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string; pin: boolean }) => {
      const action = data.pin ? 'pin-message' : 'unpin-message';
      const res = await fetch(`/api/chat?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToPinUnpinMessage', 'Failed to pin/unpin message'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-pinned-messages'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useVotePoll() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string; optionId: string }) => {
      const res = await fetch('/api/chat?action=vote-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToVotePoll', 'Failed to vote in poll'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { messageId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=close-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToClosePoll', 'Failed to close poll'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useSendThreadReply() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      parentMessageId: string;
      conversationId: string;
      senderId: string;
      organizationId?: string;
      content: string;
    }) => {
      const res = await fetch('/api/chat?action=send-thread-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToSendThreadReply', 'Failed to send thread reply'));
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-thread-replies', variables.parentMessageId] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });
}

export function useScheduleMessage() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      conversationId: string;
      senderId: string;
      organizationId?: string;
      content: string;
      scheduledFor: number;
    }) => {
      const res = await fetch('/api/chat?action=schedule-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToScheduleMessage', 'Failed to schedule message'));
      return res.json();
    },
  });
}

export function useTogglePinConversation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=toggle-pin-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToTogglePin', 'Failed to toggle pin'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=delete-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToDeleteConversation', 'Failed to delete conversation'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

export function useRestoreConversation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=restore-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToRestoreConversation', 'Failed to restore conversation'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

export function useToggleArchive() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=toggle-archive-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToToggleArchive', 'Failed to toggle archive'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

export function useToggleMute() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; userId: string }) => {
      const res = await fetch('/api/chat?action=toggle-mute-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToToggleMute', 'Failed to toggle mute'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

export function useCreateGroup() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      createdBy: string;
      name: string;
      memberIds: string[];
    }) => {
      const res = await fetch('/api/chat?action=create-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToCreateGroup', 'Failed to create group'));
      return res.json();
    },
  });
}

export function useGetOrCreateDM() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      currentUserId: string;
      targetUserId: string;
    }) => {
      const res = await fetch('/api/chat?action=get-or-create-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(t('hooks.chat.failedToGetOrCreateDM', 'Failed to get or create DM'));
      return res.json();
    },
  });
}

export function useTotalUnreadCount(userId?: string, organizationId?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['chat-total-unread', userId, organizationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-total-unread',
        userId: userId || '',
        organizationId: organizationId || '',
      });
      const res = await fetch(`/api/chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.chat.failedToFetchTotalUnread', 'Failed to fetch total unread count'));
      const json = await res.json();
      return json.data?.totalUnread || 0;
    },
    enabled: !!userId && !!organizationId,
  });
}
