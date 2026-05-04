'use client';

import React, { useMemo } from 'react';
import { motion } from '@/lib/cssMotion';
import { useTranslation } from 'react-i18next';
import { Users, Clock, CheckCircle, UserCheck, Plus, CalendarDays, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { format, isSameMonth } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';
import i18n from 'i18next';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuthUser, type User } from '@/store/useAuthStore';
import { useShallow } from 'zustand/shallow';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Button } from '@/components/ui/button';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, type LeaveType } from '@/lib/types';
import { type LeaveEnriched, type Organization } from '@/lib/convex-types';
import { DashboardBanners } from '@/components/dashboard/DashboardBanners';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SecurityWidget } from '@/components/dashboard/SecurityWidget';
import { LeaveCharts } from '@/components/dashboard/LeaveCharts';
import { RecentLeavesCard } from '@/components/dashboard/RecentLeavesCard';
import { EnterpriseWidgets } from '@/components/dashboard/EnterpriseWidgets';
import LeaveStats from '@/components/dashboard/LeaveStats';
import { QuickActions } from '@/components/dashboard/QuickActions';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function getDateFnsLocale(lang?: string) {
  switch (lang) {
    case 'ru':
      return ru;
    case 'hy':
      return hy;
    default:
      return enUS;
  }
}

export default function DashboardClient() {
  const { t, i18n } = useTranslation();
  const user = useAuthUser();
  const lang = i18n.language || 'en';
  const dateFnsLocale = getDateFnsLocale(lang);

  const [mounted, setMounted] = React.useState(false);

  const selectedOrgId = useSelectedOrganization();
  const shouldUseOrgQuery = selectedOrgId && user?.id;

  const userId = user?.id as Id<'users'> | undefined;

  const organizationsList = useQuery(
    api.organizations.getOrganizationsForPicker,
    userId ? { userId } : 'skip',
  );

  const selectedOrganization = organizationsList?.find((o) => o._id === selectedOrgId);

  const leaves = useQuery(api.leaves.getAllLeaves, userId ? { requesterId: userId } : 'skip');

  const usersFromConvex = useQuery(
    api.users.queries.getAllUsers,
    userId ? { requesterId: userId } : 'skip',
  );
  const users = (usersFromConvex || []).map((u) => ({ ...u, id: u._id })) as unknown as User[];
  const organization = useQuery(
    api.organizations.getMyOrganization,
    userId ? { userId } : 'skip',
  ) as Organization | null;

  const isSuperadmin = user?.role === 'superadmin';
  const securityStats = useQuery(
    api.security.getLoginStats,
    mounted && isSuperadmin ? { hours: 24 } : 'skip',
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const filteredUsers = useMemo(() => {
    if (!selectedOrgId) return users;
    return users?.filter((u) => u.organizationId === selectedOrgId) ?? [];
  }, [users, selectedOrgId]);

  const filteredLeaves = useMemo(() => {
    if (!selectedOrgId) return leaves;
    return leaves?.filter((l) => l.organizationId === selectedOrgId) ?? [];
  }, [leaves, selectedOrgId]);

  const stats = useMemo(
    () => ({
      totalEmployees: filteredUsers?.filter((u) => u.role !== 'superadmin').length ?? 0,
      pendingRequests: filteredLeaves?.filter((r) => r.status === 'pending').length ?? 0,
      onLeaveNow:
        filteredLeaves?.filter(
          (r) => r.status === 'approved' && r.startDate <= todayStr && r.endDate >= todayStr,
        ).length ?? 0,
      approvedThisMonth:
        filteredLeaves?.filter(
          (r) => r.status === 'approved' && isSameMonth(new Date(r.startDate), today),
        ).length ?? 0,
    }),
    [filteredUsers, filteredLeaves, todayStr, today],
  );

  const recentLeaves = useMemo(() => filteredLeaves?.slice(0, 6) ?? [], [filteredLeaves]);

  const pieData = useMemo(() => {
    const data = (Object.keys(LEAVE_TYPE_COLORS) as LeaveType[]).map((key) => ({
      name: t(`leaveTypes.${key}`) || LEAVE_TYPE_LABELS[key],
      value: filteredLeaves?.filter((r) => r.type === key).length ?? 0,
      color: LEAVE_TYPE_COLORS[key],
    }));
    return data.filter((d) => d.value > 0);
  }, [filteredLeaves, t]);

  const monthlyTrend = useMemo(() => {
    const months: Record<
      string,
      { month: string; approved: number; pending: number; rejected: number }
    > = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthKey =
        ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][
          d.getMonth()
        ] ?? 'jan';
      months[key] = {
        month: t(`months.${monthKey}`),
        approved: 0,
        pending: 0,
        rejected: 0,
      };
    }

    filteredLeaves?.forEach((l) => {
      const key = l.startDate.slice(0, 7);
      if (months[key]) {
        months[key][l.status as 'approved' | 'pending' | 'rejected']++;
      }
    });
    return Object.values(months);
  }, [filteredLeaves, t, i18n?.language]);

  if (!mounted) return null;

  const isLoading = filteredLeaves === undefined || filteredUsers === undefined;
  const isError = filteredLeaves === null || filteredUsers === null;

  if (isError)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-(--text-primary)">
          {t('dashboard.convexNotDeployed')}
        </h2>
        <p className="text-(--text-muted) text-sm max-w-sm">{t('dashboard.convexNotDeployed')}</p>
      </div>
    );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 sm:space-y-6"
    >
      <h1 className="sr-only">{t('nav.dashboard', { defaultValue: 'Dashboard' })}</h1>

      <DashboardHeader
        selectedOrganization={selectedOrganization as Organization | undefined}
        userRole={user?.role}
      />

      <DashboardBanners />

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

      {user?.role === 'superadmin' && <SecurityWidget securityStats={securityStats} />}

      <LeaveCharts monthlyTrend={monthlyTrend} pieData={pieData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <RecentLeavesCard
          recentLeaves={
            recentLeaves.map((l) => ({
              ...l,
              organizationId: l.organizationId ?? ('' as Id<'organizations'>),
            })) as LeaveEnriched[]
          }
        />
        {user?.id && (
          <motion.div variants={itemVariants} data-tour="leave-balance">
            <LeaveStats userId={user.id as Id<'users'>} />
          </motion.div>
        )}
      </div>

      <motion.div variants={itemVariants} data-tour="quick-actions" className="lg:col-span-2">
        <QuickActions />
      </motion.div>

      <motion.div variants={itemVariants} data-tour="recent-activity" className="lg:col-span-1">
        {organization?.plan === 'enterprise' && <EnterpriseWidgets />}
      </motion.div>
    </motion.div>
  );
}
