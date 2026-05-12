'use client';

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeProvider';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/lib/dynamic-imports';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';

interface LeavesTrendChartProps {
  leaves: Array<{
    startDate: string;
    endDate: string;
    days: number;
    status: string;
  }>;
}

export function LeavesTrendChart({ leaves }: LeavesTrendChartProps) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(0, 0, 0, 0.1)';
  const tooltipColor = isDark ? '#ffffff' : '#0f172a';
  const tooltipShadow = isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.1)';
  const textColor = isDark ? '#ffffff' : '#0f172a';
  const gridStroke = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const axisTickFill = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  const dfLocale = i18n.language === 'ru' ? ru : i18n.language === 'hy' ? hy : enUS;
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
      month: format(month, 'MMM yyyy', { locale: dfLocale }),
      approved,
      pending,
      rejected,
      total: monthLeaves.length,
    };
  });

  return (
    <div className="bg-(--background-subtle) rounded-2xl p-6 shadow-lg border border-(--border)">
      <h3 className="text-xl font-bold mb-4 text-(--text-primary)">
        📈 {t('leaveRequestsTrend.title')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
          <XAxis dataKey="month" tick={{ fill: axisTickFill, fontSize: 12 }} />
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
