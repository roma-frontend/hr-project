import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface AutomationStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  failedTasks: number;
  tasksTrend: number;
  completedTrend: number;
  pendingTrend: number;
  failedTrend: number;
  activeWorkflows: number;
}

export interface AutomationTask {
  id: string;
  name: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  config?: any;
}

export function useAutomationStats() {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['automation', 'stats'],
    queryFn: async () => {
      const params = new URLSearchParams({ action: 'get-stats' });
      const res = await fetch(`/api/automation?${params}`);
      if (!res.ok) throw new Error(t('hooks.automation.failedToFetchStats', 'Failed to fetch automation stats'));
      const json = await res.json();
      return json.data as AutomationStats;
    },
  });
}

export function useRecentTasks(limit = 10) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['automation', 'recent-tasks', limit],
    queryFn: async () => {
      const params = new URLSearchParams({ action: 'get-recent-tasks', limit: String(limit) });
      const res = await fetch(`/api/automation?${params}`);
      if (!res.ok) throw new Error(t('hooks.automation.failedToFetchRecentTasks', 'Failed to fetch recent tasks'));
      const json = await res.json();
      return json.data as AutomationTask[];
    },
  });
}

export function useActiveWorkflows() {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ['automation', 'active-workflows'],
    queryFn: async () => {
      const params = new URLSearchParams({ action: 'get-active-workflows' });
      const res = await fetch(`/api/automation?${params}`);
      if (!res.ok) throw new Error(t('hooks.automation.failedToFetchActiveWorkflows', 'Failed to fetch active workflows'));
      const json = await res.json();
      return json.data as AutomationWorkflow[];
    },
  });
}

export function useRunAutomation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ action: 'run-automation' });
      const res = await fetch(`/api/automation?${params}`, { method: 'POST' });
      if (!res.ok) throw new Error(t('hooks.automation.failedToRun', 'Failed to run automation'));
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      toast.success(t('automation.started', 'Automation started successfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('automation.runFailed', 'Failed to run automation'));
    },
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ workflowId }: { workflowId: string }) => {
      const params = new URLSearchParams({ action: 'toggle-workflow' });
      const res = await fetch(`/api/automation?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId }),
      });
      if (!res.ok) throw new Error(t('hooks.automation.failedToToggleWorkflow', 'Failed to toggle workflow'));
      const json = await res.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation', 'active-workflows'] });
    },
    onError: (error: any) => {
      toast.error(error.message || t('automation.toggleFailed', 'Failed to toggle workflow'));
    },
  });
}
