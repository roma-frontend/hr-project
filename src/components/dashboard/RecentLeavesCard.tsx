'use client';

import React from 'react';
import { motion } from '@/lib/cssMotion';
import { useTranslation } from 'react-i18next';
import { Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LeaveEnriched } from '@/lib/convex-types';
import type { LeaveStatus } from '@/lib/types';

interface RecentLeavesCardProps {
  recentLeaves: LeaveEnriched[];
}

function formatDate(dateStr: string | undefined | null, fmt: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return format(d, fmt);
}

const StatusBadgeMemo = React.memo(({ status, label }: { status: LeaveStatus; label: string }) => {
  const variants: Record<LeaveStatus, 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'destructive',
  };
  return (
    <Badge variant={variants[status]} className="capitalize">
      {label}
    </Badge>
  );
});
StatusBadgeMemo.displayName = 'StatusBadgeMemo';

export function RecentLeavesCard({ recentLeaves }: RecentLeavesCardProps) {
  const { t } = useTranslation();

  return (
    <motion.div variants={itemVariants} className="lg:col-span-1">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-(--text-muted) uppercase tracking-wider">
              {t('dashboard.recentLeaves')}
            </CardTitle>
            <ArrowRight className="w-4 h-4 text-(--text-muted)" />
          </div>
        </CardHeader>
        <CardContent>
          {recentLeaves.length > 0 ? (
            <ul className="space-y-3">
              {recentLeaves.map((leave) => (
                <li key={leave._id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-(--text-primary)">{leave.userName}</p>
                    <p className="text-(--text-muted)">
                      {formatDate(leave.startDate, 'MMM d')} - {formatDate(leave.endDate, 'MMM d')}
                    </p>
                  </div>
                  <StatusBadgeMemo
                    status={leave.status}
                    label={
                      leave.status === 'approved'
                        ? t('titles.leaveStatus.approved')
                        : leave.status === 'pending'
                          ? t('titles.leaveStatus.pending')
                          : t('titles.leaveStatus.rejected')
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Clock className="w-6 h-6 text-(--text-muted)" />
              <p className="text-sm text-(--text-muted)">{t('dashboard.noRecentLeaves')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
