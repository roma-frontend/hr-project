'use client';

import React from 'react';
import { motion } from '@/lib/cssMotion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeProvider';
import { TrendingUp, CalendarDays } from 'lucide-react';
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from '@/lib/dynamic-imports';
import { Cell, Tooltip as RechartsTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LeaveChartsProps {
  monthlyTrend: Array<{ month: string; approved: number; pending: number; rejected: number }>;
  pieData: Array<{ name: string; value: number; color: string }>;
}

export function LeaveCharts({ monthlyTrend, pieData }: LeaveChartsProps) {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
      <motion.div variants={itemVariants} className="lg:col-span-3">
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <div className="flex items-center justify-between">
              <CardTitle
                as="h2"
                className="text-xs sm:text-sm font-semibold text-(--text-muted) uppercase tracking-wider"
              >
                {t('dashboard.monthlyLeaveTrend')}
              </CardTitle>
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-(--text-muted)" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <ResponsiveContainer width="100%" height={180} className="sm:!h-[220px]">
              <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: axisTickFill, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisTickFill, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '8px',
                    color: tooltipColor,
                    boxShadow: tooltipShadow,
                  }}
                  itemStyle={{ color: tooltipColor }}
                  labelStyle={{ color: tooltipColor }}
                  cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: textColor }} />
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
              className="text-sm font-semibold text-(--text-muted) uppercase tracking-wider"
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
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      background: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: '8px',
                      color: tooltipColor,
                      boxShadow: tooltipShadow,
                    }}
                    itemStyle={{ color: tooltipColor }}
                    labelStyle={{ color: tooltipColor }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <CalendarDays className="w-6 h-6 text-(--text-muted)" />
                <p className="text-sm text-(--text-muted)">{t('dashboard.noLeaveData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
