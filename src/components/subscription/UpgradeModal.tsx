'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Check, Zap, Building2, Rocket, Sparkles, ArrowRight, Shield, Star } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_LABELS, type PlanType } from '@/hooks/usePlanFeatures';

// ── Plan definitions ──────────────────────────────────────────────────────────

interface PlanTier {
  id: PlanType;
  name: string;
  price: string;
  priceMonthly?: number;
  description: string;
  icon: React.ReactNode;
  features: string[];
  buttonText: string;
  popular?: boolean;
  accentFrom: string;
  accentTo: string;
  glowColor: string;
  checkoutPlan?: string;
}

const ALL_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'billing.starter.name',
    price: '$29',
    priceMonthly: 29,
    description: 'billing.starter.description',
    icon: <Zap size={20} />,
    features: [
      'billing.starter.features.upTo10Employees',
      'billing.starter.features.basicLeaveTracking',
      'billing.starter.features.emailNotifications',
      'billing.starter.features.mobileAppAccess',
      'billing.starter.features.standardSupport',
    ],
    buttonText: 'billing.starter.buttonText',
    accentFrom: '#6366f1',
    accentTo: '#8b5cf6',
    glowColor: 'rgba(99,102,241,0.2)',
    checkoutPlan: 'starter',
  },
  {
    id: 'professional',
    name: 'billing.professional.name',
    price: '$79',
    priceMonthly: 79,
    description: 'billing.professional.description',
    icon: <Building2 size={20} />,
    features: [
      'billing.professional.features.upTo50Employees',
      'billing.professional.features.advancedAnalyticsReports',
      'billing.professional.features.aiLeaveAssistantInsights',
      'billing.professional.features.slaManagement',
      'billing.professional.features.calendarSync',
      'billing.professional.features.prioritySupport',
      'billing.professional.features.csvExport',
    ],
    buttonText: 'billing.professional.buttonText',
    popular: true,
    accentFrom: '#3b82f6',
    accentTo: '#6366f1',
    glowColor: 'rgba(59,130,246,0.3)',
    checkoutPlan: 'professional',
  },
  {
    id: 'enterprise',
    name: 'billing.enterprise.name',
    price: 'Custom',
    description: 'billing.enterprise.description',
    icon: <Rocket size={20} />,
    features: [
      'billing.enterprise.features.over100Employees',
      'billing.enterprise.features.everythingInProfessional',
      'billing.enterprise.features.customIntegrationsApi',
      'billing.enterprise.features.whiteLabelSolution',
      'billing.enterprise.features.dedicatedAccountManager',
      'billing.enterprise.features.phoneSupportSla',
      'billing.enterprise.features.onPremiseOption',
    ],
    buttonText: 'billing.enterprise.buttonText',
    accentFrom: '#0ea5e9',
    accentTo: '#06b6d4',
    glowColor: 'rgba(14,165,233,0.3)',
  },
];

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  tier,
  isCurrent,
  onClose,
}: {
  tier: PlanTier;
  isCurrent: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (isCurrent) return;
    if (!tier.checkoutPlan) {
      window.location.href = '/contact';
      onClose();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: tier.checkoutPlan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error('[Stripe checkout]', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 ${
        isCurrent
          ? 'border-(--border) bg-(--background-subtle) opacity-80'
          : 'border-(--border) bg-(--background-subtle) hover:border-(--primary)/40'
      }`}
    >
      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider z-10 bg-(--background-subtle) border border-(--border) text-(--text-muted)">
          {t('billing.currentPlan')}
        </div>
      )}

      {/* Popular badge */}
      {tier.popular && !isCurrent && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider z-10"
          style={{ background: `linear-gradient(135deg, ${tier.accentFrom}, ${tier.accentTo})` }}
        >
          <Star size={9} fill="currentColor" />
          {t('billing.mostPopular')}
        </div>
      )}

      {/* Top accent line */}
      <div
        className="h-0.75 w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${tier.accentFrom}, ${tier.accentTo})` }}
      />

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Icon + name */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${tier.accentFrom}1a`,
              border: `1px solid ${tier.accentFrom}33`,
              color: tier.accentFrom,
            }}
          >
            {tier.icon}
          </div>
          <div>
            <p className="font-bold text-(--text-primary) leading-tight text-sm">
              {t(tier.name)}
            </p>
            <p className="text-[11px] text-(--text-muted)">{t(tier.description)}</p>
          </div>
        </div>

        {/* Price */}
        <div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-black leading-none text-(--text-primary)">
              {tier.price}
            </span>
            {tier.priceMonthly && (
              <span className="text-xs text-(--text-muted) pb-0.5">{t('billing.perMonth')}</span>
            )}
          </div>
          {tier.priceMonthly && (
            <p className="text-[11px] text-(--text-muted) mt-0.5 flex items-center gap-1">
              <Shield size={9} />
              {t('billing.freeTrialDays')}
            </p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-1.5 flex-1">
          {tier.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-xs">
              <div
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: `${tier.accentFrom}1a`,
                  border: `1px solid ${tier.accentFrom}33`,
                }}
              >
                <Check size={8} style={{ color: tier.accentFrom }} />
              </div>
              <span className="text-(--text-secondary)">{t(feature)}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={handleCheckout}
          disabled={loading || isCurrent}
          className="relative w-full py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 overflow-hidden group/btn disabled:cursor-not-allowed"
          style={
            isCurrent
              ? {
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }
              : tier.popular
                ? {
                    background: `linear-gradient(135deg, ${tier.accentFrom}, ${tier.accentTo})`,
                    boxShadow: `0 4px 16px ${tier.glowColor}`,
                    color: '#fff',
                    opacity: loading ? 0.7 : 1,
                  }
                : {
                    background: `${tier.accentFrom}15`,
                    border: `1px solid ${tier.accentFrom}33`,
                    color: tier.accentFrom,
                    opacity: loading ? 0.7 : 1,
                  }
          }
        >
          {loading ? (
            <ShieldLoader size="xs" variant="inline" />
          ) : isCurrent ? (
            <>
              <Check size={12} />
              {t(tier.buttonText)}
            </>
          ) : (
            <>
              <Sparkles size={12} />
              {t(tier.buttonText)}
              <ArrowRight
                size={12}
                className="group-hover/btn:translate-x-0.5 transition-transform"
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Feature name shown in the header (e.g. "Advanced Analytics") */
  featureTitle?: string;
  /** Short description shown below the title */
  featureDescription?: string;
  /** Highlight a specific plan */
  recommendedPlan?: Exclude<PlanType, 'starter'>;
}

export function UpgradeModal({
  open,
  onClose,
  featureTitle,
  featureDescription,
  recommendedPlan = 'professional',
}: UpgradeModalProps) {
  const { t } = useTranslation();
  const { plan: currentPlan } = useSubscription();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-(--border)">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-(--primary)/10 border border-(--primary)/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-(--primary)" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold leading-tight">
                {featureTitle ? t('billing.unlockFeature', { feature: featureTitle }) : t('billing.upgradeYourPlan')}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {featureDescription ?? t('billing.upgradeDescription')}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Plan cards — all 3 tiers side by side */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ALL_TIERS.map((tier) => (
            <PlanCard
              key={tier.id}
              tier={tier}
              isCurrent={tier.id === currentPlan}
              onClose={onClose}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-center gap-2 text-xs text-(--text-muted)">
          <Shield size={11} />
          {t('billing.footerSecurity')}
        </div>
      </DialogContent>
    </Dialog>
  );
}
