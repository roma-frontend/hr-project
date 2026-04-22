'use client';

import React, { useState, useMemo } from 'react';
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
  Play,
  Pause,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  useAutomationStats,
  useRecentTasks,
  useActiveWorkflows,
  useRunAutomation,
  useToggleWorkflow,
} from '@/hooks/useAutomation';

interface AutomationStats {
  totalTasks: number;
  tasksTrend: number;
  completedTasks: number;
  completedTrend: number;
  pendingTasks: number;
  pendingTrend: number;
  failedTasks: number;
  failedTrend: number;
}

interface Workflow {
  id: string;
  is_active: boolean;
  name: string;
  description: string;
}

interface Task {
  id: string;
  status: string;
  name: string;
  created_at: number;
}

export default function AutomationPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [isRunning, setIsRunning] = useState(false);

  const { data: stats } = useAutomationStats();
  const { data: recentTasks } = useRecentTasks();
  const { data: activeWorkflows } = useActiveWorkflows();

  const runAutomation = useRunAutomation();
  const toggleWorkflow = useToggleWorkflow();

  const isSuperadmin = user?.role === 'superadmin';

  const handleRunAutomation = async () => {
    setIsRunning(true);
    try {
      await runAutomation.mutateAsync();
    } catch (_error) {
      toast.error(t('superadmin.automation.runError') || 'Failed to run automation');
    } finally {
      setIsRunning(false);
    }
  };

  const denialUI = useMemo(
    () => (
      <div className="flex items-center justify-center h-full min-h-100">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-(--text-primary) mb-2">
            {t('common.accessDenied') || 'Access Denied'}
          </h2>
          <p className="text-(--text-muted)">
            {t('common.onlySuperadminAccess') || 'Only superadmin can access this page'}
          </p>
        </div>
      </div>
    ),
    [t],
  );

  if (!isSuperadmin) {
    return denialUI;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-(--background)/95 backdrop-blur supports-[backdrop-filter]:bg-(--background)/60 border-b border-(--border)">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-(--text-primary)">
              {t('superadmin.automation.title') || 'Automation Dashboard'}
            </h1>
            <p className="text-sm text-(--text-muted) mt-1">
              {t('superadmin.automation.description') ||
                'Monitor and manage your automation workflows'}
            </p>
          </div>
          <Button
            onClick={handleRunAutomation}
            disabled={isRunning}
            className="flex items-center gap-2 w-full sm:w-auto justify-center bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity text-white font-medium shadow-md hover:shadow-lg"
          >
            {isRunning ? <ShieldLoader size="xs" variant="inline" /> : <Play className="w-4 h-4" />}
            {isRunning
              ? t('superadmin.automation.running') || 'Running...'
              : t('superadmin.automation.runNow') || 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('superadmin.automation.stats.totalTasks') || 'Total Tasks'}
          value={stats?.totalTasks ?? 0}
          icon={<Activity className="w-5 h-5" />}
          color="blue"
          trend={stats?.tasksTrend ?? 0}
        />
        <StatsCard
          title={t('superadmin.automation.stats.completed') || 'Completed'}
          value={stats?.completedTasks ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          trend={stats?.completedTrend ?? 0}
        />
        <StatsCard
          title={t('superadmin.automation.stats.pending') || 'Pending'}
          value={stats?.pendingTasks ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
          trend={stats?.pendingTrend ?? 0}
        />
        <StatsCard
          title={t('superadmin.automation.stats.failed') || 'Failed'}
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
            {t('superadmin.automation.activeWorkflows') || 'Active Workflows'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeWorkflows && activeWorkflows.length > 0 ? (
            <div className="space-y-3">
              {activeWorkflows?.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-(--border)"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        workflow.is_active ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <p className="font-medium text-(--text-primary)">{workflow.name}</p>
                      <p className="text-xs text-(--text-muted)">{workflow.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleWorkflow.mutate({ workflowId: workflow.id })
                    }
                  >
                    {workflow.is_active ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-(--text-muted) text-center py-4">
              {t('superadmin.automation.noWorkflows') || 'No active workflows'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            {t('superadmin.automation.recentTasks') || 'Recent Tasks'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks && recentTasks.length > 0 ? (
            <div className="space-y-2">
              {recentTasks?.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-(--background-subtle)"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={task.status} />
                    <div>
                      <p className="text-sm font-medium text-(--text-primary)">{task.name}</p>
                      <p className="text-xs text-(--text-muted)">
                        {new Date(task.created_at).toLocaleString(i18n.language)}
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
            <p className="text-sm text-(--text-muted) text-center py-4">
              {t('superadmin.automation.noTasks') || 'No recent tasks'}
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
            <p className="text-xs text-(--text-muted)">{title}</p>
            <p className="text-2xl font-bold text-(--text-primary) mt-1">{value}</p>
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
