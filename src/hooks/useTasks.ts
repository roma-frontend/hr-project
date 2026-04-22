import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface TaskUser {
  id: string;
  name: string;
  avatar_url?: string;
  department?: string;
  position?: string;
}

export interface TaskAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedBy?: string;
  uploadedAt?: number;
}

export interface TaskComment {
  id: string;
  taskid: string;
  authorid: string;
  content: string;
  createdat: number;
  author?: TaskUser | null;
}

export interface Task {
  id: string;
  organizationid: string;
  title: string;
  description?: string | null;
  assignedto: string;
  assignedby: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: number | null;
  completedat?: number | null;
  tags?: string[];
  attachmenturl?: string | null;
  attachments?: TaskAttachment[];
  createdat: number;
  updatedat: number;
  assigned_to?: TaskUser | null;
  assigned_by?: TaskUser | null;
}

export function useMyTasks(userId: string, organizationId?: string, status?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['my-tasks', userId, organizationId, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-my-tasks',
        userId,
        organizationId: organizationId || '',
      });
      if (status) {
        params.append('status', status);
      }
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error(t('hooks.tasks.failedToFetchTasks', 'Failed to fetch tasks'));
      const json = await res.json();
      return json.data as Task[];
    },
    enabled: !!userId && !!organizationId,
    refetchInterval: 10000,
  });
}

export function useOrgTasks(organizationId: string, status?: string, assignedTo?: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['org-tasks', organizationId, status, assignedTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-org-tasks',
        organizationId,
      });
      if (status) {
        params.append('status', status);
      }
      if (assignedTo) {
        params.append('assignedTo', assignedTo);
      }
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error(t('hooks.tasks.failedToFetchOrgTasks', 'Failed to fetch org tasks'));
      const json = await res.json();
      return json.data as Task[];
    },
    enabled: !!organizationId,
    refetchInterval: 10000,
  });
}

export function useTaskById(taskId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['task-by-id', taskId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-task-by-id',
        taskId,
      });
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error(t('hooks.tasks.failedToFetchTask', 'Failed to fetch task'));
      const json = await res.json();
      return json.data as Task | null;
    },
    enabled: !!taskId,
  });
}

export function useTaskComments(taskId: string) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-task-comments',
        taskId,
      });
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error(t('hooks.tasks.failedToFetchComments', 'Failed to fetch comments'));
      const json = await res.json();
      return json.data as TaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      title: string;
      description?: string;
      assignedTo: string;
      assignedBy: string;
      status?: string;
      priority?: string;
      deadline?: number;
      tags?: string[];
      attachments?: TaskAttachment[];
    }) => {
      const res = await fetch('/api/tasks?action=create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.tasks.failedToCreateTask', 'Failed to create task'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks', variables.assignedTo, variables.organizationId] });
      queryClient.invalidateQueries({ queryKey: ['org-tasks', variables.organizationId] });
      toast.success(t('toasts.taskCreated'));
    },
    onError: (error) => {
      toast.error(t('toasts.taskCreateFailed'));
      console.error('Create task error:', error);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      title?: string;
      description?: string;
      assignedTo?: string;
      status?: string;
      priority?: string;
      deadline?: number;
      tags?: string[];
      attachments?: TaskAttachment[];
    }) => {
      const res = await fetch('/api/tasks?action=update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.tasks.failedToUpdateTask', 'Failed to update task'));
      }
      return res.json();
    },
    onSuccess: (data) => {
      const task = data.data;
      queryClient.invalidateQueries({ queryKey: ['task-by-id', task.id] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['org-tasks'] });
      toast.success(t('toasts.taskUpdated'));
    },
    onError: (error) => {
      toast.error(t('toasts.taskUpdateFailed'));
      console.error('Update task error:', error);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { taskId: string }) => {
      const res = await fetch('/api/tasks?action=delete-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.tasks.failedToDeleteTask', 'Failed to delete task'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['org-tasks'] });
      toast.success(t('toasts.taskDeleted'));
    },
    onError: (error) => {
      toast.error(t('toasts.taskDeleteFailed'));
      console.error('Delete task error:', error);
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: {
      taskId: string;
      authorId: string;
      content: string;
    }) => {
      const res = await fetch('/api/tasks?action=add-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.tasks.failedToAddComment', 'Failed to add comment'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.taskId] });
      toast.success(t('toasts.commentAdded'));
    },
    onError: (error) => {
      toast.error(t('toasts.commentAddFailed'));
      console.error('Add comment error:', error);
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { commentId: string }) => {
      const res = await fetch('/api/tasks?action=delete-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t('hooks.tasks.failedToDeleteComment', 'Failed to delete comment'));
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments'] });
      toast.success(t('toasts.commentDeleted'));
    },
    onError: (error) => {
      toast.error(t('toasts.commentDeleteFailed'));
      console.error('Delete comment error:', error);
    },
  });
}
