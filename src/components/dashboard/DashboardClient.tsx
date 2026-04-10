'use client';

import React, { useMemo } from 'react';
import { motion } from '@/lib/cssMotion';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Clock,
  CheckCircle,
  UserCheck,
  Plus,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  Building2,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Activity,
  XCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import Link from 'next/link';
import { format, isSameMonth } from 'date-fns';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuthUser, type User } from '@/store/useAuthStore';
import { useShallow } from 'zustand/shallow';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  type LeaveType,
  type LeaveStatus,
} from '@/lib/types';
import { type LeaveEnriched, type Organization } from '@/lib/convex-types';
import dynamic from 'next/dynamic';
import { PlanGate } from '@/components/subscription/PlanGate';
import { DashboardBanners } from '@/components/dashboard/DashboardBanners';
import LeaveStats from '@/components/dashboard/LeaveStats';
import { QuickActions } from '@/components/dashboard/QuickActions';

// Lazy load admin components — SSR отключен
const HolidayCalendarSync = dynamic(() => import('@/components/admin/HolidayCalendarSync'), {
  ssr: false,
});
const CostAnalysis = dynamic(() => import('@/components/admin/CostAnalysis'), { ssr: false });
const ConflictDetection = dynamic(() => import('@/components/admin/ConflictDetection'), {
  ssr: false,
});
const SmartSuggestions = dynamic(() => import('@/components/admin/SmartSuggestions'), {
  ssr: false,
});
const ResponseTimeSLA = dynamic(() => import('@/components/admin/ResponseTimeSLA'), { ssr: false });
const WeeklyDigestWidget = dynamic(() => import('@/components/ai/WeeklyDigestWidget'), {
  ssr: false,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function StatusBadge({ status }: { status: LeaveStatus }) {
  const variants: Record<LeaveStatus, 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive',
  };
  return (
    <Badge variant={variants[status]} className="capitalize">
      {status}
    </Badge>
  );
}

function formatDate(dateStr: string | undefined | null, fmt: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt);
}

const LeaveTypeBadge = React.memo(({ type }: { type: LeaveType }) => {
  const colorMap: Record<LeaveType, string> = {
    paid: 'bg-[#2563eb]/20 text-[#2563eb] border-[#2563eb]/30',
    unpaid: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30',
    sick: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30',
    family: 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30',
    doctor: 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorMap[type]}`}
    >
      {LEAVE_TYPE_LABELS[type]}
    </span>
  );
});
LeaveTypeBadge.displayName = 'LeaveTypeBadge';

const StatusBadgeMemo = React.memo(({ status }: { status: LeaveStatus }) => {
  const variants: Record<LeaveStatus, 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive',
  };
  return (
    <Badge variant={variants[status]} className="capitalize">
      {status}
    </Badge>
  );
});
StatusBadgeMemo.displayName = 'StatusBadgeMemo';

export default function DashboardClient() {
  const { t } = useTranslation();
  const user = useAuthUser();

  // ═══════════════════════════════════════════════════════════════
  // HOOKS MUST BE CALLED IN THE SAME ORDER EVERY RENDER
  // ═══════════════════════════════════════════════════════════════
  const [mounted, setMounted] = React.useState(false);

  // Convex useQuery arguments - properly typed
  const userId = user?.id as Id<'users'> | undefined;
  const leaves = useQuery(api.leaves.getAllLeaves, userId ? { requesterId: userId } : 'skip') ?? [];
  const usersFromConvex =
    useQuery(api.users.queries.getAllUsers, userId ? { requesterId: userId } : 'skip') ?? [];
  // Convert Convex _id to id for User type compatibility
  const users = usersFromConvex.map((u) => ({ ...u, id: u._id })) as unknown as User[];
  const organization = useQuery(
    api.organizations.getMyOrganization,
    userId ? { userId } : 'skip',
  ) as Organization | null;

  // Security stats — only for superadmin (always call, condition is in arguments)
  const isSuperadmin = user?.role === 'superadmin';
  const securityStats = useQuery(
    api.security.getLoginStats,
    mounted && isSuperadmin ? { hours: 24 } : 'skip',
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Non-hook values (can be conditional)
  // ═══════════════════════════════════════════════════════════════
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // ═══════════════════════════════════════════════════════════════
  // OPTIMIZED: Memoize all data transformations
  // ═══════════════════════════════════════════════════════════════
  const stats = useMemo(
    () => ({
      totalEmployees: users?.filter((u) => u.role !== 'superadmin').length ?? 0,
      pendingRequests: leaves?.filter((r) => r.status === 'pending').length ?? 0,
      onLeaveNow:
        leaves?.filter(
          (r) => r.status === 'approved' && r.startDate <= todayStr && r.endDate >= todayStr,
        ).length ?? 0,
      approvedThisMonth:
        leaves?.filter((r) => r.status === 'approved' && isSameMonth(new Date(r.startDate), today))
          .length ?? 0,
    }),
    [users, leaves, todayStr, today],
  );

  const recentLeaves = useMemo(() => leaves?.slice(0, 6) ?? [], [leaves]);

  const pieData = useMemo(() => {
    const data = (Object.keys(LEAVE_TYPE_COLORS) as LeaveType[]).map((key) => ({
      name: LEAVE_TYPE_LABELS[key],
      value: leaves?.filter((r) => r.type === key).length ?? 0,
      color: LEAVE_TYPE_COLORS[key],
    }));
    return data.filter((d) => d.value > 0);
  }, [leaves]);

  const monthlyTrend = useMemo(() => {
    const months: Record<
      string,
      { month: string; approved: number; pending: number; rejected: number }
    > = {};
    const now = new Date();
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = {
        month: monthNames[d.getMonth()] ?? 'Unknown',
        approved: 0,
        pending: 0,
        rejected: 0,
      };
    }

    leaves?.forEach((l) => {
      const key = l.startDate.slice(0, 7);
      if (months[key]) {
        months[key][l.status as 'approved' | 'pending' | 'rejected']++;
      }
    });
    return Object.values(months);
  }, [leaves]);

  if (!mounted) return null;

  const isLoading = leaves === undefined || users === undefined;
  const isError = leaves === null || users === null;

  if (isError)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {t('dashboard.convexNotDeployed')}
        </h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm">
          {t('dashboard.convexNotDeployed')}
        </p>
      </div>
    );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 sm:space-y-6"
    >
      {/* Page title for accessibility — proper heading order h1 → h2 → h3 */}
      <h1 className="sr-only">{t('nav.dashboard', { defaultValue: 'Dashboard' })}</h1>
      {/* Smart Banners - only render if there are active banners */}
      <DashboardBanners />

      {/* Welcome header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
      >
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-[var(--text-muted)] text-xs sm:text-sm"
          >
            {format(today, 'EEEE, MMMM d, yyyy')}
          </motion.p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {user?.role === 'superadmin' && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/superadmin/organizations">
                  <Building2 className="w-4 h-4" />
                  {t('dashboard.manageOrgs')}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                style={{
                  borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
                  background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                  color: 'var(--primary)',
                }}
              >
                <Link href="/superadmin/create-org">
                  <Building2 className="w-4 h-4" />
                  {t('dashboard.createOrg')}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                style={{
                  borderColor: 'color-mix(in srgb, var(--success) 25%, transparent)',
                  background: 'color-mix(in srgb, var(--success) 6%, transparent)',
                  color: 'var(--success)',
                }}
              >
                <Link href="/superadmin/stripe-dashboard">
                  <CreditCard className="w-4 h-4" />
                  {t('dashboard.stripeDashboard')}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                style={{
                  borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                  color: 'var(--primary)',
                }}
              >
                <Link href="/superadmin/security">
                  <ShieldCheck className="w-4 h-4" />
                  Security Center
                </Link>
              </Button>
            </>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/calendar">
              <CalendarDays className="w-4 h-4" />
              {t('nav.calendar')}
            </Link>
          </Button>
          <Button asChild size="sm" variant="default" className="flex items-center gap-2 w-full sm:w-auto justify-center bg-linear-to-r from-(--primary) to-(--primary-dark,var(--primary)) hover:opacity-90 transition-opacity text-white font-medium shadow-md hover:shadow-lg">
            <Link href="/leaves">
              <Plus className="w-4 h-4" />
              {t('dashboard.newRequest')}
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants}>
        <div
          data-tour="quick-stats"
          className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4"
        >
          <StatsCard
            title={t('titles.totalEmployees')}
            value={isLoading ? '—' : stats.totalEmployees}
            icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
            color="blue"
            index={0}
          />
          <StatsCard
            title={t('titles.pendingRequests')}
            value={isLoading ? '—' : stats.pendingRequests}
            icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
            color="yellow"
            index={1}
          />
          <StatsCard
            title={t('titles.approvedThisMonth')}
            value={isLoading ? '—' : stats.approvedThisMonth}
            icon={<CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
            color="green"
            index={2}
          />
          <StatsCard
            title={t('titles.onLeaveNow')}
            value={isLoading ? '—' : stats.onLeaveNow}
            icon={<UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
            color="purple"
            index={3}
          />
        </div>
      </motion.div>

      {/* Security Widget — superadmin only */}
      {user?.role === 'superadmin' && (
        <motion.div variants={itemVariants}>
          <Link href="/superadmin/security" className="block group">
            <div
              className="rounded-lg sm:rounded-2xl border p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all duration-200 group-hover:shadow-md"
              style={{
                background: 'var(--card)',
                borderColor:
                  (securityStats?.highRisk ?? 0) >= 10
                    ? 'rgba(239,68,68,0.4)'
                    : (securityStats?.highRisk ?? 0) >= 3
                      ? 'rgba(245,158,11,0.4)'
                      : 'var(--border)',
              }}
            >
              {/* Icon */}
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    (securityStats?.highRisk ?? 0) >= 10
                      ? 'rgba(239,68,68,0.12)'
                      : (securityStats?.highRisk ?? 0) >= 3
                        ? 'rgba(245,158,11,0.12)'
                        : 'rgba(16,185,129,0.12)',
                }}
              >
                {(securityStats?.highRisk ?? 0) >= 10 ? (
                  <ShieldAlert
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    style={{ color: 'var(--destructive)' }}
                  />
                ) : (securityStats?.highRisk ?? 0) >= 3 ? (
                  <ShieldAlert
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    style={{ color: 'var(--warning)' }}
                  />
                ) : (
                  <ShieldCheck
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    style={{ color: 'var(--success)' }}
                  />
                )}
              </div>

              {/* Title + threat level */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                  <span
                    className="text-xs sm:text-sm font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Security Center
                  </span>
                  <span
                    className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        (securityStats?.highRisk ?? 0) >= 10
                          ? 'rgba(239,68,68,0.15)'
                          : (securityStats?.highRisk ?? 0) >= 3
                            ? 'rgba(245,158,11,0.15)'
                            : 'rgba(16,185,129,0.15)',
                      color:
                        (securityStats?.highRisk ?? 0) >= 10
                          ? 'var(--destructive)'
                          : (securityStats?.highRisk ?? 0) >= 3
                            ? 'var(--warning)'
                            : 'var(--success)',
                    }}
                  >
                    {(securityStats?.highRisk ?? 0) >= 10
                      ? '⚠ Critical'
                      : (securityStats?.highRisk ?? 0) >= 3
                        ? '⚠ Elevated'
                        : (securityStats?.failed ?? 0) >= 20
                          ? '⚠ Moderate'
                          : '✓ Normal'}
                  </span>
                </div>
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[10px] sm:text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span className="hidden sm:inline">
                      {securityStats?.total ?? 0} logins (24h)
                    </span>
                    <span className="sm:hidden">{securityStats?.total ?? 0} logins</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle
                      className="w-3 h-3"
                      style={{
                        color: securityStats?.failed ? 'var(--destructive)' : 'var(--text-muted)',
                      }}
                    />
                    {securityStats?.failed ?? 0} failed
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldAlert
                      className="w-3 h-3"
                      style={{
                        color: securityStats?.highRisk ? 'var(--warning)' : 'var(--text-muted)',
                      }}
                    />
                    {securityStats?.highRisk ?? 0} high risk
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight
                className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>
          </Link>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle
                  as="h2"
                  className="text-xs sm:text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                >
                  {t('dashboard.monthlyLeaveTrend')}
                </CardTitle>
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-[var(--text-muted)]" />
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <ResponsiveContainer width="100%" height={180} className="sm:!h-[220px]">
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                  <Bar
                    dataKey="approved"
                    name={t('statuses.approved')}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    name={t('statuses.pending')}
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="rejected"
                    name={t('statuses.rejected')}
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle
                as="h2"
                className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider"
              >
                {t('dashboard.leaveDistribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                      }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <CalendarDays className="w-6 h-6 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">{t('dashboard.noLeaveData')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Leaves & Admin Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {t('dashboard.recentLeaves')}
                </CardTitle>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </CardHeader>
            <CardContent>
              {recentLeaves.length > 0 ? (
                <ul className="space-y-3">
                  {recentLeaves.map((leave) => (
                    <li key={leave._id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{leave.userName}</p>
                        <p className="text-[var(--text-muted)]">
                          {formatDate(leave.startDate, 'MMM d')} -{' '}
                          {formatDate(leave.endDate, 'MMM d')}
                        </p>
                      </div>
                      <StatusBadgeMemo status={leave.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Clock className="w-6 h-6 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('dashboard.noRecentLeaves')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        {user?.id && (
          <motion.div variants={itemVariants} data-tour="leave-balance">
            <LeaveStats userId={user.id as Id<'users'>} />
          </motion.div>
        )}
      </div>
      {/* ═══════════════════════════════════════════════════════════════
          PERSONAL LEAVE STATS — For all users
          ═══════════════════════════════════════════════════════════════ */}

      {/* Quick Actions */}
      <motion.div variants={itemVariants} data-tour="quick-actions" className="lg:col-span-2">
        <QuickActions />
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} data-tour="recent-activity" className="lg:col-span-1">
        {organization?.plan === 'enterprise' && (
          <>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <PlanGate feature="slaSettings">
                <ResponseTimeSLA />
              </PlanGate>
            </motion.div>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <PlanGate feature="advancedAnalytics">
                <ConflictDetection />
              </PlanGate>
            </motion.div>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <PlanGate feature="analytics">
                <CostAnalysis />
              </PlanGate>
            </motion.div>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <PlanGate feature="calendarSync">
                <HolidayCalendarSync />
              </PlanGate>
            </motion.div>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <PlanGate feature="aiInsights">
                <SmartSuggestions />
              </PlanGate>
            </motion.div>
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <PlanGate feature="aiChat">
                <WeeklyDigestWidget />
              </PlanGate>
            </motion.div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
