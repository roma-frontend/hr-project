'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  CreditCard,
  ShieldCheck,
  CalendarDays,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import type { Organization } from '@/lib/convex-types';

interface DashboardHeaderProps {
  selectedOrganization: Organization | undefined;
  userRole: string | undefined;
}

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

export function DashboardHeader({ selectedOrganization, userRole }: DashboardHeaderProps) {
  const { t, i18n } = useTranslation();
  const dateFnsLocale = getDateFnsLocale(i18n.language);
  const today = new Date();

  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 mb-5 sm:mb-6">
      {/* ── editorial hero card ── */}
      <div
        className="relative overflow-hidden rounded-[18px] border border-[var(--border)] px-4 sm:px-6 lg:px-7 py-4 sm:py-5"
        style={{
          background:
            'radial-gradient(120% 140% at 85% -10%, rgba(44,140,213,0.14), transparent 58%), radial-gradient(90% 90% at -8% 120%, rgba(139,92,246,0.10), transparent 55%), linear-gradient(180deg, var(--surface-1) 0%, var(--canvas) 100%)',
          boxShadow: 'var(--elev-2), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        {/* soft top hairline */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
          }}
          aria-hidden="true"
        />

        <div className="relative flex flex-wrap flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* left — title cluster */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-quiet)] border border-[var(--brand-outline)] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--brand-text)]">
                <Sparkles className="w-3 h-3" />
                {t('nav.dashboard', { defaultValue: 'Dashboard' })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-1)] border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                <TrendingUp className="w-3 h-3" />
                {t('dashboard.live', { defaultValue: 'Live' })}
              </span>
            </div>

            <h2 className="mt-2 text-[22px] sm:text-[26px] font-bold tracking-tight leading-none text-[var(--text-primary)]">
              <span className="bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-primary)] to-[var(--brand-text)] bg-clip-text text-transparent">
                {selectedOrganization?.name ?? t('nav.dashboard', { defaultValue: 'Dashboard' })}
              </span>
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-1)] border border-[var(--border-default)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="capitalize">
                  {format(today, 'EEEE, MMMM d', { locale: dateFnsLocale })}
                </span>
              </span>
              {selectedOrganization && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-1)] border border-[var(--border-default)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                  {t('dashboard.activeOrg', { defaultValue: 'Active workspace' })}
                </span>
              )}
            </div>
          </div>

          {/* right — actions */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:shrink-0">
            {userRole === 'superadmin' && (
              <>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full hover:bg-[var(--surface-2)]"
                >
                  <Link href="/superadmin/organizations">
                    <Building2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('dashboard.manageOrgs')}</span>
                    <span className="sm:hidden">Orgs</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  style={{ color: 'var(--brand-text)' }}
                >
                  <Link href="/superadmin/create-org">
                    <Building2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('dashboard.createOrg')}</span>
                    <span className="sm:hidden">New org</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  style={{
                    borderColor: 'rgba(16,185,129,0.22)',
                    background: 'rgba(16,185,129,0.08)',
                    color: 'var(--success-text)',
                  }}
                >
                  <Link href="/superadmin/stripe-dashboard">
                    <CreditCard className="w-4 h-4" />
                    <span className="hidden lg:inline">{t('dashboard.stripeDashboard')}</span>
                    <span className="lg:hidden">Stripe</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  style={{ color: 'var(--brand-text)' }}
                >
                  <Link href="/superadmin/security">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="hidden lg:inline">{t('landingExtra.securityCenter')}</span>
                    <span className="lg:hidden">Security</span>
                  </Link>
                </Button>
              </>
            )}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full hover:bg-[var(--surface-2)]"
            >
              <Link href="/calendar">
                <CalendarDays className="w-4 h-4" />
                {t('nav.calendar')}
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full font-semibold text-white hover:opacity-95 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background:
                  'linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 60%, #5aaef0 100%)',
                boxShadow: '0 8px 18px rgba(44,140,213,0.28), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <Link href="/leaves">
                <Plus className="w-4 h-4" />
                {t('dashboard.newRequest')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
