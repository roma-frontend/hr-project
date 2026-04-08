'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { motion } from '@/lib/cssMotion';
import {
  Zap,
  Activity,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Play,
  Pause,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Isolate Convex API refs to avoid infinite type instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getStatsApi: any = api.automation.getStats;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getRecentTasksApi: any = api.automation.getRecentTasks;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getActiveWorkflowsApi: any = api.automation.getActiveWorkflows;

export default function AutomationPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [isRunning, setIsRunning] = useState(false);

  // Only superadmin can access
  if (user?.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {t('common.accessDenied') || 'Access Denied'}
          </h2>
          <p className="text-[var(--text-muted)]">
            {t('common.onlySuperadminAccess') || 'Only superadmin can access this page'}
          </p>
        </div>
      </div>
    );
  }

  // Fetch automation stats
  const stats = useQuery(getStatsApi);
  const recentTasks = useQuery(getRecentTasksApi, {});
  const activeWorkflows = useQuery(getActiveWorkflowsApi);

  // Mutations
  const runAutomationAction = useAction(api.automationActions.runAutomation);
  const toggleWorkflow = useMutation(api.automationMutations.toggleWorkflow);

  const handleRunAutomation = async () => {
    setIsRunning(true);
    try {
      await runAutomationAction();
      toast.success(t('automation.runSuccess') || 'Automation started successfully');
    } catch (error) {
      toast.error(t('automation.runError') || 'Failed to run automation');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            {t('superadmin.automation.title') || 'Automation Dashboard'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('superadmin.automation.description') ||
              'Monitor and manage your automation workflows'}
          </p>
        </div>
        <Button onClick={handleRunAutomation} disabled={isRunning} className="gap-2">
          {isRunning ? <ShieldLoader size="xs" variant="inline" /> : <Play className="w-4 h-4" />}
          {isRunning
            ? t('automation.running') || 'Running...'
            : t('automation.runNow') || 'Run Now'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('automation.stats.totalTasks') || 'Total Tasks'}
          value={stats?.totalTasks ?? 0}
          icon={<Activity className="w-5 h-5" />}
          color="blue"
          trend={stats?.tasksTrend ?? 0}
        />
        <StatsCard
          title={t('automation.stats.completed') || 'Completed'}
          value={stats?.completedTasks ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          trend={stats?.completedTrend ?? 0}
        />
        <StatsCard
          title={t('automation.stats.pending') || 'Pending'}
          value={stats?.pendingTasks ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
          trend={stats?.pendingTrend ?? 0}
        />
        <StatsCard
          title={t('automation.stats.failed') || 'Failed'}
          value={stats?.failedTasks ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          trend={stats?.failedTrend ?? 0}
        />
      </div>

      {/* Active Workflows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            {t('automation.activeWorkflows') || 'Active Workflows'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeWorkflows && activeWorkflows.length > 0 ? (
            <div className="space-y-3">
              {activeWorkflows.map((workflow: any) => (
                <div
                  key={workflow._id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        workflow.isActive ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{workflow.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{workflow.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleWorkflow({ workflowId: workflow._id })}
                  >
                    {workflow.isActive ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              {t('automation.noWorkflows') || 'No active workflows'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            {t('automation.recentTasks') || 'Recent Tasks'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks && recentTasks.length > 0 ? (
            <div className="space-y-2">
              {recentTasks.map((task: any) => (
                <div
                  key={task._id}
                  className="flex items-center justify-between p-2 rounded hover:bg-[var(--background-subtle)]"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={task.status} />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{task.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(task.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      task.status === 'completed'
                        ? 'success'
                        : task.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {String(t(`automation.status.${task.status}`, task.status))}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              {t('automation.noTasks') || 'No recent tasks'}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  color,
  trend,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend: number;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
    red: 'bg-red-500/10 text-red-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-muted)]">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
            {trend !== 0 && (
              <div
                className={`flex items-center gap-1 mt-1 text-xs ${
                  trend > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
                {Math.abs(trend)}%
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-yellow-500" />;
  }
}
