import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  createdBy: string;
  creatorName: string;
  organizationId?: string;
  organizationName?: string;
  assignedTo?: string;
  chatId?: string;
  chatActivated?: boolean;
  isOverdue: boolean;
  createdAt: number;
  updatedAt: number;
  comments?: TicketComment[];
  commentCount?: number;
}

export interface TicketComment {
  id: string;
  message: string;
  isInternal: boolean;
  authorId: string;
  authorName: string;
  createdAt: number;
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  closed: number;
  critical: number;
  overdue: number;
  avgResponseTime: number;
}

export interface TicketChatStatus {
  hasChat: boolean;
  chatId?: string;
  chatActivated: boolean;
}

export function useAllTickets() {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['tickets', 'all'],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ action: 'get-all-tickets' });
        const res = await fetch(`/api/tickets?${params}`);
        if (!res.ok) throw new Error(t('hooks.tickets.failedToFetchTickets', 'Failed to fetch tickets'));
        const json = await res.json();
        return json.data as Ticket[];
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch tickets');
      }
    },
  });
}

export function useTicketStats() {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['tickets', 'stats'],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ action: 'get-ticket-stats' });
        const res = await fetch(`/api/tickets?${params}`);
        if (!res.ok) throw new Error(t('hooks.tickets.failedToFetchStats', 'Failed to fetch ticket stats'));
        const json = await res.json();
        return json.data as TicketStats;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch ticket stats');
      }
    },
  });
}

export function useTicketById(ticketId: string | null) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['tickets', ticketId],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ action: 'get-ticket-by-id', ticketId: ticketId ?? '' });
        const res = await fetch(`/api/tickets?${params}`);
        if (!res.ok) throw new Error(t('hooks.tickets.failedToFetchTicket', 'Failed to fetch ticket'));
        const json = await res.json();
        return json.data as Ticket;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch ticket');
      }
    },
    enabled: !!ticketId,
  });
}

export function useTicketChatStatus(ticketId: string | null) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['tickets', 'chat-status', ticketId],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ action: 'get-ticket-chat-status', ticketId: ticketId ?? '' });
        const res = await fetch(`/api/tickets?${params}`);
        if (!res.ok) throw new Error(t('hooks.tickets.failedToFetchChatStatus', 'Failed to fetch chat status'));
        const json = await res.json();
        return json.data as TicketChatStatus;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch chat status');
      }
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      organizationId?: string;
      createdBy: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      category: 'technical' | 'billing' | 'access' | 'feature_request' | 'bug' | 'other';
    }) => {
      try {
        const params = new URLSearchParams({ action: 'create-ticket' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToCreateTicket', 'Failed to create ticket'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to create ticket');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { ticketId: string; status: string; userId: string }) => {
      try {
        const params = new URLSearchParams({ action: 'update-ticket-status' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToUpdateTicketStatus', 'Failed to update ticket status'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to update ticket status');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { ticketId: string; assignedTo: string }) => {
      try {
        const params = new URLSearchParams({ action: 'assign-ticket' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToAssignTicket', 'Failed to assign ticket'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to assign ticket');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useAddTicketComment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: {
      ticketId: string;
      authorId: string;
      message: string;
      isInternal: boolean;
    }) => {
      try {
        const params = new URLSearchParams({ action: 'add-ticket-comment' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToAddComment', 'Failed to add comment'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to add comment');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
    },
  });
}

export function useResolveTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { ticketId: string; resolution: string; userId: string }) => {
      try {
        const params = new URLSearchParams({ action: 'resolve-ticket' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToResolveTicket', 'Failed to resolve ticket'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to resolve ticket');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useCreateTicketChat() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { ticketId: string; superadminId: string }) => {
      try {
        const params = new URLSearchParams({ action: 'create-ticket-chat' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToCreateChat', 'Failed to create chat'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to create chat');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'chat-status', variables.ticketId] });
    },
  });
}

export function useActivateTicketChat() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: { ticketId: string; superadminId: string; message: string }) => {
      try {
        const params = new URLSearchParams({ action: 'activate-ticket-chat' });
        const res = await fetch(`/api/tickets?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(t('hooks.tickets.failedToActivateChat', 'Failed to activate chat'));
        const json = await res.json();
        return json.data;
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to activate chat');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'chat-status', variables.ticketId] });
    },
  });
}

export function useMyTickets(userId: string, organizationId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['tickets', 'my-tickets', userId, organizationId],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ 
          action: 'get-my-tickets', 
          userId, 
          organizationId 
        });
        const res = await fetch(`/api/tickets?${params}`);
        if (!res.ok) throw new Error(t('hooks.tickets.failedToFetchTickets', 'Failed to fetch tickets'));
        const json = await res.json();
        return json.data as Ticket[];
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch tickets');
      }
    },
    enabled: !!userId && !!organizationId,
  });
}
