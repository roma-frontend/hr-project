import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface AiConversation {
  id: string;
  organizationId: string | null;
  userid: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
}

export interface AiMessage {
  id: string;
  conversationid: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: number;
}

export interface AiFullContext {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
  };
  organization: {
    name: string;
    plan: string;
  } | null;
  leaves: Array<{
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    status: string;
    reason: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: number | null;
  }>;
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
  }>;
  attendance: Array<{
    id: string;
    date: string;
    checkIn: number;
    checkOut: number | null;
    status: string;
  }>;
}

const AI_CHAT_QUERY_KEYS = {
  conversations: (userId: string) => ['ai-conversations', userId],
  messages: (conversationId: string) => ['ai-messages', conversationId],
  fullContext: (userId: string) => ['ai-full-context', userId],
};

// ═══════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════

export function useAiConversations(userId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: AI_CHAT_QUERY_KEYS.conversations(userId),
    queryFn: async () => {
      const params = new URLSearchParams({ action: 'get-conversations' });
      const res = await fetch(`/api/ai-chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.aichat.failedToFetchConversations', 'Failed to fetch AI conversations'));
      const json = await res.json();
      return json.data as AiConversation[];
    },
    enabled: !!userId,
  });
}

export function useAiMessages(conversationId: string | null) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: AI_CHAT_QUERY_KEYS.messages(conversationId || ''),
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-messages',
        conversationId: conversationId || '',
      });
      const res = await fetch(`/api/ai-chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.aichat.failedToFetchMessages', 'Failed to fetch AI messages'));
      const json = await res.json();
      return json.data as AiMessage[];
    },
    enabled: !!conversationId,
  });
}

export function useAiFullContext(userId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: AI_CHAT_QUERY_KEYS.fullContext(userId),
    queryFn: async () => {
      const params = new URLSearchParams({ action: 'get-full-context' });
      const res = await fetch(`/api/ai-chat?${params}`);
      if (!res.ok) throw new Error(t('hooks.aichat.failedToFetchFullContext', 'Failed to fetch AI full context'));
      const json = await res.json();
      return json.data as AiFullContext;
    },
    enabled: !!userId,
  });
}

// ═══════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════

export function useCreateAiConversation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { userId: string; title: string; model?: string; organizationId?: string }) => {
      const res = await fetch('/api/ai-chat?action=create-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToCreateConversation', 'Failed to create conversation'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: AI_CHAT_QUERY_KEYS.conversations(variables.userId) });
    },
    onError: () => {
      toast.error(t('aiChat.createFailed', 'Failed to create chat'));
    },
  });
}

export function useUpdateAiConversationTitle() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; title: string }) => {
      const res = await fetch('/api/ai-chat?action=update-conversation-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToUpdateTitle', 'Failed to update title'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
    onError: () => {
      toast.error(t('aiChat.updateTitleFailed', 'Failed to update title'));
    },
  });
}

export function useDeleteAiConversation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string }) => {
      const res = await fetch('/api/ai-chat?action=delete-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToDeleteConversation', 'Failed to delete conversation'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      queryClient.removeQueries({ queryKey: AI_CHAT_QUERY_KEYS.messages(variables.conversationId) });
    },
    onError: () => {
      toast.error(t('aiChat.deleteFailed', 'Failed to delete chat'));
    },
  });
}

export function useAddAiMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; role: 'user' | 'assistant'; content: string }) => {
      const res = await fetch('/api/ai-chat?action=add-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToAddMessage', 'Failed to add message'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: AI_CHAT_QUERY_KEYS.messages(variables.conversationId) });
    },
  });
}

export function useAutoRenameAiConversation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { conversationId: string; firstMessage: string }) => {
      const res = await fetch('/api/ai-chat?action=auto-rename-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToAutoRename', 'Failed to auto-rename conversation'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });
}

export function useAiCreateLeaveRequest() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      requesterId: string;
      organizationId: string;
      type: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      const res = await fetch('/api/ai-chat?action=create-leave-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToCreateLeaveRequest', 'Failed to create leave request'));
      }
      return res.json();
    },
  });
}

export function useAiCreateTask() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      assigneeId: string;
      assignerId: string;
      organizationId: string;
      title: string;
      description?: string;
      deadline?: number;
      priority: string;
    }) => {
      const res = await fetch('/api/ai-chat?action=create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.aichat.failedToCreateTask', 'Failed to create task'));
      }
      return res.json();
    },
  });
}
