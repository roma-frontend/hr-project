'use client';

import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

interface LeavesTrendChartProps {
  leaves: Array<{
    startDate: string;
    endDate: string;
    days: number;
    status: string;
  }>;
}

export function LeavesTrendChart({ leaves }: LeavesTrendChartProps) {
  const { t } = useTranslation();
  // Generate last 6 months
  const now = new Date();
  const months = eachMonthOfInterval({
    start: subMonths(now, 5),
    end: now,
  });

  // Count leaves per month
  const data = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const monthLeaves = leaves.filter((leave) => {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      return (
        (leaveStart >= monthStart && leaveStart <= monthEnd) ||
        (leaveEnd >= monthStart && leaveEnd <= monthEnd) ||
        (leaveStart <= monthStart && leaveEnd >= monthEnd)
      );
    });

    const approved = monthLeaves.filter((l) => l.status === 'approved').length;
    const pending = monthLeaves.filter((l) => l.status === 'pending').length;
    const rejected = monthLeaves.filter((l) => l.status === 'rejected').length;

    return {
      month: format(month, 'MMM yyyy'),
      approved,
      pending,
      rejected,
      total: monthLeaves.length,
    };
  });

  return (
    <div className="bg-[var(--background)] rounded-2xl p-6 shadow-lg border border-[var(--border)]">
      <h3 className="text-xl font-bold mb-4 text-[var(--text-primary)]">
        📈 {t('leaveRequestsTrend.title')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" opacity={0.3} />
          <XAxis
            dataKey="month"
            className="fill-[var(--text-muted)]"
            style={{ fontSize: '12px' }}
          />
          <YAxis className="fill-[var(--text-muted)]" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--background-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
            labelStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
          <Line
            type="monotone"
            dataKey="approved"
            stroke="#10B981"
            strokeWidth={2}
            name={t('leaveRequestsTrend.approved')}
          />
          <Line
            type="monotone"
            dataKey="pending"
            stroke="#F59E0B"
            strokeWidth={2}
            name={t('leaveRequestsTrend.pending')}
          />
          <Line
            type="monotone"
            dataKey="rejected"
            stroke="#EF4444"
            strokeWidth={2}
            name={t('leaveRequestsTrend.rejected')}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LeavesTrendChart;
