'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Timer,
} from 'lucide-react';
import { useSLAStats, useSLAConfig } from '@/hooks/useAdmin';

export function SLADashboard() {
  const { t } = useTranslation();
  const { data: slaMetrics } = useSLAStats();
  const { data: slaConfig } = useSLAConfig();

  const stats = slaMetrics;

  const totalMetrics = stats?.total ?? 0;
  const pendingMetrics = stats?.pending ?? 0;
  const onTimeMetrics = stats?.onTime ?? 0;
  const breachedMetrics = stats?.breached ?? 0;

  const avgResponseTime = stats?.avgResponseTime ?? 0;

  const complianceRate = stats?.complianceRate ?? 100;

  const warningCount = stats?.warningCount ?? 0;
  const criticalCount = stats?.criticalCount ?? 0;

  const isImproving = true;
  const trend = 0;

  const targetHours = slaConfig?.targetResponseTimeHours || 24;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Average Response Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sla.dashboard.avgResponseTime')}</CardTitle>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgResponseTime.toFixed(1)}h</div>
          <p className="text-xs text-muted-foreground">Target: {targetHours}h</p>
          {avgResponseTime <= targetHours ? (
            <div className="flex items-center text-green-600 text-xs mt-1">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('sla.dashboard.withinTarget')}
            </div>
          ) : (
            <div className="flex items-center text-red-600 text-xs mt-1">
              <AlertCircle className="h-3 w-3 mr-1" />
              {t('sla.dashboard.aboveTarget')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SLA Compliance Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sla.dashboard.slaCompliance')}</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{complianceRate.toFixed(1)}%</div>
          <Progress value={complianceRate} className="mt-2" />
          <div
            className={`flex items-center text-xs mt-1 ${isImproving ? 'text-green-600' : 'text-red-600'}`}
          >
            {isImproving ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(trend).toFixed(1)}% {t('sla.dashboard.vsLastWeek', 'vs last week')}
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sla.dashboard.pendingRequests')}</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingMetrics}</div>
          <p className="text-xs text-muted-foreground">
            {onTimeMetrics} {t('sla.dashboard.onTime')}, {breachedMetrics} {t('sla.dashboard.breached')}
          </p>
          {pendingMetrics > 0 && (
            <Badge variant="secondary" className="mt-2">
              {t('sla.dashboard.needsAttention')}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('sla.dashboard.alerts')}</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
              <p className="text-xs text-muted-foreground">{t('sla.dashboard.warnings')}</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
              <p className="text-xs text-muted-foreground">{t('sla.dashboard.critical')}</p>
            </div>
          </div>
          {(warningCount > 0 || criticalCount > 0) && (
            <Badge variant="destructive" className="mt-2">
              {t('sla.dashboard.actionRequired')}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Detailed SLA Breakdown */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle>{t('sla.dashboard.performanceBreakdown')}</CardTitle>
          <CardDescription>{t('sla.dashboard.responseTimeDistribution')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* On-time requests */}
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm font-medium">{t('sla.dashboard.onTime')}</div>
              <div className="flex-1">
                <Progress value={complianceRate} className="h-2" />
              </div>
              <div className="w-20 text-right text-sm">
                {onTimeMetrics} ({complianceRate.toFixed(0)}%)
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>

            {/* Breached requests */}
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm font-medium">{t('sla.dashboard.breached')}</div>
              <div className="flex-1">
                <Progress value={100 - complianceRate} className="h-2 [&>div]:bg-destructive" />
              </div>
              <div className="w-20 text-right text-sm">
                {breachedMetrics} ({(100 - complianceRate).toFixed(0)}%)
              </div>
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>

            {/* Pending requests */}
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm font-medium">{t('sla.dashboard.pendingRequests')}</div>
              <div className="flex-1">
                <Progress
                  value={(pendingMetrics / totalMetrics) * 100}
                  className="h-2 [&>div]:bg-muted-foreground"
                />
              </div>
              <div className="w-20 text-right text-sm">
                {pendingMetrics} (
                {totalMetrics > 0 ? ((pendingMetrics / totalMetrics) * 100).toFixed(0) : 0}%)
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {/* SLA Config Info */}
          {slaConfig && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('sla.dashboard.slaConfiguration')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('sla.dashboard.targetResponseTime')}: {slaConfig.targetResponseTimeHours}h
                  </p>
                </div>
                <Badge variant="outline">{t('sla.dashboard.available247', '24/7')}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
