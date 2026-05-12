'use client';

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeProvider';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/lib/dynamic-imports';

export interface User {
  department?: string;
  paidLeaveBalance: number;
  sickLeaveBalance: number;
  familyLeaveBalance: number;
}

interface DepartmentStatsProps {
  users: User[];
}

interface DepartmentStatsData {
  department: string;
  employees: number;
  usedPaid: number;
  usedSick: number;
  usedFamily: number;
}

export function DepartmentStats({ users }: DepartmentStatsProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(0, 0, 0, 0.1)';
  const tooltipColor = isDark ? '#ffffff' : '#0f172a';
  const tooltipShadow = isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.1)';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridStroke = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const axisTickFill = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
  // Default balances (what employees start with)
  const DEFAULT_PAID = 24;
  const DEFAULT_SICK = 10;
  const DEFAULT_FAMILY = 5;

  // Group by department and calculate USED days (not remaining balance)
  const departments = users.reduce(
    (acc, user) => {
      const dept = user.department || 'Unassigned';
      if (!acc[dept]) {
        acc[dept] = {
          department: dept,
          employees: 0,
          usedPaid: 0,
          usedSick: 0,
          usedFamily: 0,
        };
      }
      acc[dept].employees += 1;
      // Calculate used days = default - current balance
      acc[dept].usedPaid += DEFAULT_PAID - user.paidLeaveBalance;
      acc[dept].usedSick += DEFAULT_SICK - user.sickLeaveBalance;
      acc[dept].usedFamily += DEFAULT_FAMILY - user.familyLeaveBalance;
      return acc;
    },
    {} as Record<string, DepartmentStatsData>,
  );

  const data = Object.values(departments).map((dept) => ({
    department: dept.department,
    avgPaid: Math.round((dept.usedPaid / dept.employees) * 10) / 10,
    avgSick: Math.round((dept.usedSick / dept.employees) * 10) / 10,
    avgFamily: Math.round((dept.usedFamily / dept.employees) * 10) / 10,
    employees: dept.employees,
  }));

  return (
    <div className="bg-(--background-subtle) rounded-2xl p-6 shadow-lg border border-(--border)">
      <h3 className="text-xl font-bold mb-4 text-(--text-primary)">
        🏢 {t('departmentStats.title')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
          <XAxis dataKey="department" tick={{ fill: axisTickFill, fontSize: 12 }} />
          <YAxis tick={{ fill: axisTickFill, fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '8px',
              color: tooltipColor,
              boxShadow: tooltipShadow,
            }}
            itemStyle={{ color: tooltipColor, fontWeight: 500 }}
            labelStyle={{ color: tooltipColor, fontWeight: 700, fontSize: '14px' }}
          />
          <Legend
            wrapperStyle={{ color: textColor, fontSize: '13px' }}
            formatter={(value: string) => (
              <span style={{ color: textColor, fontWeight: 500 }}>{value}</span>
            )}
          />
          <Bar dataKey="avgPaid" fill="#2563eb" name={t('departmentStats.paidLeave')} />
          <Bar dataKey="avgSick" fill="#0ea5e9" name={t('departmentStats.sickLeave')} />
          <Bar dataKey="avgFamily" fill="#EC4899" name={t('departmentStats.familyLeave')} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DepartmentStats;
