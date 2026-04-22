import { useMemo } from 'react';
import { useLeaves } from '@/hooks/useLeaves';
import { useOrgUsers } from '@/hooks/useUsers';
import { format } from 'date-fns';
import { LEAVE_TYPE_COLORS, DEPARTMENTS, getLeaveTypeLabel, type LeaveType } from '@/lib/types';
import type { useTranslation } from 'react-i18next';

interface LeaveRecord {
  id: string;
  status: 'approved' | 'pending' | 'rejected';
  type: LeaveType;
  days: number;
  start_date?: string;
  startDate?: string;
  userDepartment?: string;
  userName?: string;
  reason?: string;
  users?: {
    department?: string;
    name?: string;
  };
}

export function useReportsData(
  selectedOrgId: string | null,
  userId: string | null,
  t: ReturnType<typeof useTranslation>['t']
) {
  const leavesParams = selectedOrgId
    ? { organizationId: selectedOrgId }
    : userId
      ? { requesterId: userId }
      : undefined;

  const { data: leaves = [], isLoading: leavesLoading } = useLeaves({
    organizationId: leavesParams?.organizationId,
    requesterId: leavesParams?.requesterId,
    enabled: !!userId,
  });

  const { data: users = [], isLoading: usersLoading } = useOrgUsers(selectedOrgId || '');

  const isLoading = leavesLoading || (selectedOrgId && usersLoading);

  const getDepartment = (leave: LeaveRecord) => leave.userDepartment || leave.users?.department || '';
  const getName = (leave: LeaveRecord) => leave.userName || leave.users?.name || '';
  const getStartDate = (leave: LeaveRecord) => leave.startDate || leave.start_date || '';

  // KPI stats
  const totalLeaves = leaves?.length ?? 0;
  const approvedCount = leaves?.filter((r: LeaveRecord) => r.status === 'approved').length ?? 0;
  const pendingCount = leaves?.filter((r: LeaveRecord) => r.status === 'pending').length ?? 0;
  const rejectedCount = leaves?.filter((r: LeaveRecord) => r.status === 'rejected').length ?? 0;
  const approvalRate = totalLeaves > 0 ? Math.round((approvedCount / totalLeaves) * 100) : 0;
  const avgDays =
    totalLeaves > 0
      ? (leaves.reduce((s: number, r: LeaveRecord) => s + (r.days || 0), 0) / totalLeaves).toFixed(1)
      : '0';
  const staffCount = users?.filter((u: any) => u.employee_type === 'staff').length ?? 0;
  const contractorCount = users?.filter((u: any) => u.employee_type === 'contractor').length ?? 0;

  // Pie data
  const pieData = useMemo(() => {
    return (Object.keys(LEAVE_TYPE_COLORS) as LeaveType[])
      .map((key) => ({
        name: getLeaveTypeLabel(key as LeaveType, t),
        value: leaves?.filter((r: LeaveRecord) => r.type === key).length ?? 0,
        color: LEAVE_TYPE_COLORS[key as LeaveType],
      }))
      .filter((d) => d.value > 0);
  }, [leaves, t]);

  // Department breakdown
  const deptData = useMemo(() => {
    return DEPARTMENTS.map((dept) => ({
      dept: dept.slice(0, 3),
      fullName: t(`departments.${dept.toLowerCase().replace(/\s+/g, '')}`, { defaultValue: dept }),
      total: leaves?.filter((r: LeaveRecord) => getDepartment(r) === dept).length ?? 0,
      approved: leaves?.filter((r: LeaveRecord) => getDepartment(r) === dept && r.status === 'approved').length ?? 0,
      pending: leaves?.filter((r: LeaveRecord) => getDepartment(r) === dept && r.status === 'pending').length ?? 0,
    })).filter((d) => d.total > 0);
  }, [leaves, t]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: Record<string, { month: string; approved: number; pending: number; rejected: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(d, 'yyyy-MM');
      months[key] = { month: format(d, 'MMM'), approved: 0, pending: 0, rejected: 0 };
    }
    leaves?.forEach((l: LeaveRecord) => {
      const startDate = getStartDate(l);
      const key = startDate?.slice(0, 7);
      if (key && months[key]) {
        months[key][l.status]++;
      }
    });
    return Object.values(months);
  }, [leaves]);

  // Cumulative
  const cumulativeData = useMemo(() => {
    return monthlyTrend.map((m, i, arr) => ({
      month: m.month,
      cumulative: arr.slice(0, i + 1).reduce((s, x) => s + x.approved, 0),
      days: Math.round(arr.slice(0, i + 1).reduce((s, x) => s + x.approved * 1.8, 0)),
    }));
  }, [monthlyTrend]);

  return {
    leaves: leaves as LeaveRecord[],
    users,
    isLoading,
    totalLeaves,
    approvedCount,
    pendingCount,
    rejectedCount,
    approvalRate,
    avgDays,
    staffCount,
    contractorCount,
    pieData,
    deptData,
    monthlyTrend,
    cumulativeData,
    getDepartment,
    getName,
    getStartDate,
  };
}
