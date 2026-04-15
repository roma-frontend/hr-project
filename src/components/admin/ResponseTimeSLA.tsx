'use client';

import { useTranslation } from 'react-i18next';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from '@/lib/dynamic-imports';

interface SLAStatsProps {
  startDate?: number;
  endDate?: number;
}

export function ResponseTimeSLA({ startDate, endDate }: SLAStatsProps) {
  const { t } = useTranslation();
  const stats = useQuery(api.sla.getSLAStats, { startDate, endDate });
  const trend = useQuery(api.sla.getSLATrend, { days: 30 });
  const pendingWithSLA = useQuery(api.sla.getPendingWithSLA, {});

  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i: any) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const complianceColor =
    stats.complianceRate >= 95
      ? 'text-green-600'
      : stats.complianceRate >= 80
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Compliance Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('responseSLA.compliance')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${complianceColor}`}>{stats.complianceRate}%</div>
            <p className="text-xs text-muted-foreground">Target: 95%</p>
            <Progress value={stats.complianceRate} className="mt-2" />
          </CardContent>
        </Card>

        {/* Average Response Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('responseSLA.avgResponseTime')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime}h</div>
            <p className="text-xs text-muted-foreground">Target: {stats.targetResponseTime}h</p>
            <Progress
              value={(stats.avgResponseTime / stats.targetResponseTime) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {/* SLA Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('responseSLA.avgScore')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSLAScore}/100</div>
            <p className="text-xs text-muted-foreground">
              {stats.onTime} on-time, {stats.breached} breached
            </p>
            <Progress value={stats.avgSLAScore} className="mt-2" />
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('responseSLA.activeAlerts')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('responseSLA.critical')}</span>
                <Badge variant="destructive">{stats.criticalCount}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('responseSLA.warning')}</span>
                <Badge variant="secondary">{stats.warningCount}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {trend && trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SLA Performance Trend (Last 30 Days)</CardTitle>
            <CardDescription>Response time and compliance rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgResponseTime"
                  stroke="#8884d8"
                  name={t('responseSLA.avgResponseTime')}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="complianceRate"
                  stroke="#82ca9d"
                  name="Compliance Rate (%)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* On-Time vs Breached Chart */}
      {trend && trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('responseSLA.slaStatusDistribution')}</CardTitle>
            <CardDescription>On-time vs breached requests by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <Bar dataKey="onTime" fill="#10b981" name="On Time" stackId="a" />
                <Bar dataKey="breached" fill="#ef4444" name="Breached" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Pending Requests with SLA Status */}
      {pendingWithSLA && pendingWithSLA.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('responseSLA.pendingRequests')}</CardTitle>
            <CardDescription>{pendingWithSLA.length} requests awaiting response</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingWithSLA.map((request: any) => {
                const statusConfig = {
                  normal: { color: 'bg-green-100 text-green-800', icon: Activity, label: 'Normal' },
                  warning: {
                    color: 'bg-yellow-100 text-yellow-800',
                    icon: Clock,
                    label: 'Warning',
                  },
                  critical: {
                    color: 'bg-orange-100 text-orange-800',
                    icon: AlertTriangle,
                    label: 'Critical',
                  },
                  breached: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Breached' },
                } as const;

                const config = statusConfig[request.sla.status as keyof typeof statusConfig];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={request._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-full ${config.color}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{request.userName}</p>
                          <Badge variant="outline">{request.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.startDate} в†’ {request.endDate} ({request.days} days)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {request.sla.elapsedHours}h / {request.sla.targetHours}h
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.sla.remainingHours > 0
                            ? `${request.sla.remainingHours}h remaining`
                            : `${Math.abs(request.sla.remainingHours)}h overdue`}
                        </p>
                      </div>
                      <div className="w-24">
                        <Progress value={request.sla.progressPercent} />
                      </div>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">вњ… On Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.onTime}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0}%{' '}
              {t('responseSLA.ofTotal')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">вЏі Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%{' '}
              {t('responseSLA.ofTotal')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">вќЊ Breached</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.breached}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.breached / stats.total) * 100) : 0}%{' '}
              {t('responseSLA.ofTotal')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ResponseTimeSLA;
