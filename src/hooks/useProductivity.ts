import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const PRODUCTIVITY_QUERY_KEYS = {
  todayStats: (userId: string) => ['productivity', 'today-stats', userId],
  todayTasks: (userId: string) => ['productivity', 'today-tasks', userId],
  teamPresence: (organizationId: string) => ['productivity', 'team-presence', organizationId],
  activePomodoro: (userId: string) => ['productivity', 'active-pomodoro', userId],
};

export interface TodayStats {
  hoursWorkedToday: number;
  hoursWorkedWeek: number;
  completedTasksToday: number;
  completedTasksWeek: number;
  totalTasksWeek: number;
  todayDeadlines: number;
  weeklyGoalProgress: number;
  isClockedIn: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
  presenceStatus: string;
  department?: string;
  role?: string;
}

export interface PomodoroSession {
  id: string;
  userid: string;
  taskid?: string;
  start_time: number;
  end_time: number;
  duration: number;
  completed: boolean;
  interrupted: boolean;
  actual_end_time?: number;
}

export function useTodayStats(userId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: PRODUCTIVITY_QUERY_KEYS.todayStats(userId),
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-today-stats',
        userId,
      });
      const res = await fetch(`/api/productivity?${params}`);
      if (!res.ok) throw new Error(t('productivity.fetchTodayStatsFailed'));
      const json = await res.json();
      return json.data as TodayStats;
    },
    enabled: enabled && !!userId,
    refetchInterval: 30000,
  });
}

export function useTodayTasks(userId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: PRODUCTIVITY_QUERY_KEYS.todayTasks(userId),
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-today-tasks',
        userId,
      });
      const res = await fetch(`/api/productivity?${params}`);
      if (!res.ok) throw new Error(t('productivity.fetchTodayTasksFailed'));
      const json = await res.json();
      return json.data as any[];
    },
    enabled: enabled && !!userId,
    refetchInterval: 10000,
  });
}

export function useTeamPresence(organizationId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: PRODUCTIVITY_QUERY_KEYS.teamPresence(organizationId),
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-team-presence',
        organizationId,
      });
      const res = await fetch(`/api/productivity?${params}`);
      if (!res.ok) throw new Error(t('productivity.fetchTeamPresenceFailed'));
      const json = await res.json();
      return json.data as TeamMember[];
    },
    enabled: enabled && !!organizationId,
    refetchInterval: 10000,
  });
}

export function useActivePomodoro(userId: string, enabled = true) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: PRODUCTIVITY_QUERY_KEYS.activePomodoro(userId),
    queryFn: async () => {
      const params = new URLSearchParams({
        action: 'get-active-pomodoro',
        userId,
      });
      const res = await fetch(`/api/productivity?${params}`);
      if (!res.ok) throw new Error(t('productivity.fetchActivePomodoroFailed'));
      const json = await res.json();
      return json.data as PomodoroSession | null;
    },
    enabled: enabled && !!userId,
    refetchInterval: 5000,
  });
}

export function useStartPomodoro() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { userId: string; duration: number; taskId?: string }) => {
      const res = await fetch('/api/productivity?action=start-pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to start pomodoro session');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: PRODUCTIVITY_QUERY_KEYS.activePomodoro(variables.userId),
      });
      toast.success(t('productivity.pomodoroStarted', 'Pomodoro session started'));
    },
    onError: (error) => {
      toast.error(t('productivity.pomodoroStartFailed', 'Failed to start pomodoro session'));
      console.error('Start pomodoro error:', error);
    },
  });
}

export function useCompletePomodoro() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      const res = await fetch('/api/productivity?action=complete-pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to complete pomodoro session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      toast.success(t('productivity.pomodoroCompleted', 'Pomodoro session completed'));
    },
    onError: (error) => {
      toast.error(t('productivity.pomodoroCompleteFailed', 'Failed to complete pomodoro session'));
      console.error('Complete pomodoro error:', error);
    },
  });
}

export function useInterruptPomodoro() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { sessionId: string }) => {
      const res = await fetch('/api/productivity?action=interrupt-pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to interrupt pomodoro session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      toast.info(t('productivity.pomodoroInterrupted', 'Pomodoro session interrupted'));
    },
    onError: (error) => {
      toast.error(t('productivity.pomodoroInterruptFailed', 'Failed to interrupt pomodoro session'));
      console.error('Interrupt pomodoro error:', error);
    },
  });
}

export function useUpdatePresence() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { userId: string; presenceStatus: string }) => {
      const res = await fetch('/api/productivity?action=update-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update presence');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      queryClient.invalidateQueries({ queryKey: ['org-users'] });
    },
    onError: (error) => {
      toast.error(t('productivity.updatePresenceFailed', 'Failed to update presence status'));
      console.error('Update presence error:', error);
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: { taskId: string; status: string; userId: string }) => {
      const res = await fetch('/api/tasks?action=update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: data.taskId,
          status: data.status,
        }),
      });
      if (!res.ok) throw new Error('Failed to update task status');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['productivity'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['org-tasks'] });
    },
    onError: (error) => {
      toast.error(t('productivity.updateTaskStatusFailed', 'Failed to update task status'));
      console.error('Update task status error:', error);
    },
  });
}
