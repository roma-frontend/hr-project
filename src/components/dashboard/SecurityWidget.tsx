'use client';

import React from 'react';
import { motion } from '@/lib/cssMotion';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldAlert, Activity, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
interface SecurityStats {
  total: number;
  failed: number;
  blocked: number;
  highRisk: number;
  byMethod: Record<string, number>;
  suspicious: Array<{
    _id: string;
    _creationTime: number;
    createdAt: number;
    userId?: string;
    email?: string;
    method: string;
    success: boolean;
    riskScore?: number;
    blockedReason?: string;
    ip?: string;
    userAgent?: string;
  }>;
}

interface SecurityWidgetProps {
  securityStats: SecurityStats | undefined;
}

export function SecurityWidget({ securityStats }: SecurityWidgetProps) {
  const { t } = useTranslation();
  const highRisk = securityStats?.highRisk ?? 0;
  const failed = securityStats?.failed ?? 0;
  const total = securityStats?.total ?? 0;

  const threatLevel =
    highRisk >= 10
      ? {
          label: t('landingExtra.securityCritical'),
          borderColor: 'rgba(239,68,68,0.4)',
          bg: 'rgba(239,68,68,0.12)',
          badgeBg: 'rgba(239,68,68,0.15)',
          badgeColor: 'var(--destructive)',
          iconColor: 'var(--destructive)',
        }
      : highRisk >= 3
        ? {
            label: t('landingExtra.securityElevated'),
            borderColor: 'rgba(245,158,11,0.4)',
            bg: 'rgba(245,158,11,0.12)',
            badgeBg: 'rgba(245,158,11,0.15)',
            badgeColor: 'var(--warning)',
            iconColor: 'var(--warning)',
          }
        : {
            label:
              failed >= 20 ? t('landingExtra.securityModerate') : t('landingExtra.securityNormal'),
            borderColor: 'var(--border)',
            bg: 'rgba(16,185,129,0.12)',
            badgeBg: 'rgba(16,185,129,0.15)',
            badgeColor: 'var(--success)',
            iconColor: 'var(--success)',
          };

  return (
    <motion.div variants={itemVariants}>
      <Link href="/superadmin/security" className="block group">
        <div
          className="rounded-lg sm:rounded-2xl border p-3 sm:p-4 flex items-center gap-3 sm:gap-4 transition-all duration-200 group-hover:shadow-md"
          style={{
            background: 'var(--card)',
            borderColor: threatLevel.borderColor,
          }}
        >
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
            style={{ background: threatLevel.bg }}
          >
            {highRisk >= 10 ? (
              <ShieldAlert
                className="w-4 h-4 sm:w-5 sm:h-5"
                style={{ color: threatLevel.iconColor }}
              />
            ) : highRisk >= 3 ? (
              <ShieldAlert
                className="w-4 h-4 sm:w-5 sm:h-5"
                style={{ color: threatLevel.iconColor }}
              />
            ) : (
              <ShieldCheck
                className="w-4 h-4 sm:w-5 sm:h-5"
                style={{ color: threatLevel.iconColor }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
              <span
                className="text-xs sm:text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('landingExtra.securityCenter')}
              </span>
              <span
                className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full"
                style={{
                  background: threatLevel.badgeBg,
                  color: threatLevel.badgeColor,
                }}
              >
                {threatLevel.label}
              </span>
            </div>
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[10px] sm:text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {total} {t('landingExtra.logins24h')}
                </span>
                <span className="sm:hidden">
                  {total} {t('landingExtra.loginsShort')}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <XCircle
                  className="w-3 h-3"
                  style={{ color: failed ? 'var(--destructive)' : 'var(--text-muted)' }}
                />
                {failed} {t('landingExtra.failedLogins')}
              </span>
              <span className="flex items-center gap-1">
                <ShieldAlert
                  className="w-3 h-3"
                  style={{ color: highRisk ? 'var(--warning)' : 'var(--text-muted)' }}
                />
                {highRisk} {t('landingExtra.highRiskAlerts')}
              </span>
            </div>
          </div>

          <ArrowRight
            className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </Link>
    </motion.div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
