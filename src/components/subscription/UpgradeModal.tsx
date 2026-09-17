'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { getFallbackRate } from '@/lib/currency';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Check,
  Zap,
  Building2,
  Rocket,
  Sparkles,
  ArrowRight,
  Shield,
  Crown,
  TrendingDown,
} from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useSubscription, type Plan } from '@/lib/hooks/useSubscription';
import { entrySeatCount, formatPerSeat, perSeatPrice, type PlanKey } from '@/lib/pricing';
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

// Card tiers (paid plans only). 'free' is the implicit "no paid plan" state.
type PlanType = 'starter' | 'professional' | 'enterprise';
const PLAN_ORDER: PlanType[] = ['starter', 'professional', 'enterprise'];
type PlanRelation = 'current' | 'upgrade' | 'downgrade';

// ── Plan definitions ──────────────────────────────────────────────────────────

interface PlanTier {
  id: PlanType;
  name: string;
  /** Text price for quoted plans ("Custom"). Priced tiers use the live rate. */
  price: string;
  /** USD per seat per month at this plan's entry bracket. 0 = quoted. */
  perSeatUsd: number;
  /** Seats the subscription starts at — the plan's minimum billable team. */
  entrySeats: number;
  /** Seat-pricing key behind this tier. */
  seatPlanKey: PlanKey;
  /** False for quoted plans (Enterprise): no per-seat suffix, no trial badge. */
  priced: boolean;
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

type TFunc = ReturnType<typeof useTranslation>['t'];

interface LocalProvider {
  provider: string;
  label: string;
}

/**
 * AMD amount for the PSP handshake.
 *
 * The backend never guesses FX (see `payments.createLocalPayment`), so the
 * conversion lives here: an Armenian-locale visitor already sees AMD amounts on
 * the cards and those are reused as-is; everyone else is converted at the same
 * bundled rate the pricing page uses, so the figure matches what they were
 * shown rather than a second, possibly staler, rate.
 */
function amdAmountFor(
  tier: Pick<PlanTier, 'id' | 'perSeatUsd' | 'entrySeats'>,
  currency: { currency: string; starter: { amount: number }; professional: { amount: number } },
  seats: number,
  months: number,
): number {
  // `currency.starter/professional.amount` are PER-SEAT AMD rates (useCurrency
  // converts BASE_PRICES, which is per seat), so the order total is the rate
  // times the seats being bought. Rounded once, at the end, so seats do not
  // amplify a per-seat rounding error.
  if (currency.currency === 'AMD') {
    if (tier.id === 'starter') return Math.round(currency.starter.amount * seats * months);
    if (tier.id === 'professional') {
      return Math.round(currency.professional.amount * seats * months);
    }
  }
  return Math.round(tier.perSeatUsd * seats * months * getFallbackRate('hy'));
}

/**
 * Build the three cards from the shared per-seat model.
 *
 * Each card quotes the rate for its own *entry* bracket (the cheapest way to
 * start that plan) — `perSeatPrice(key, minSeats)` is by construction the first
 * volume tier — and the seat minimum that goes to Stripe as the quantity.
 */
function buildTiers(t: TFunc): PlanTier[] {
  return [
    {
      id: 'starter',
      name: t('billing.upgradeModal.starter.name'),
      price: formatPerSeat(perSeatPrice('starter', entrySeatCount('starter'))),
      perSeatUsd: perSeatPrice('starter', entrySeatCount('starter')),
      entrySeats: entrySeatCount('starter'),
      seatPlanKey: 'starter',
      priced: true,
      description: t('billing.upgradeModal.starter.description'),
      icon: <Zap size={20} />,
      features: t('billing.upgradeModal.starter.features', {
        returnObjects: true,
      }) as string[],
      buttonText: t('billing.upgradeModal.starter.button'),
      accentFrom: '#6366f1',
      accentTo: '#8b5cf6',
      glowColor: 'rgba(99,102,241,0.2)',
      checkoutPlan: 'starter',
    },
    {
      id: 'professional',
      name: t('billing.upgradeModal.professional.name'),
      price: formatPerSeat(perSeatPrice('pro', entrySeatCount('pro'))),
      perSeatUsd: perSeatPrice('pro', entrySeatCount('pro')),
      entrySeats: entrySeatCount('pro'),
      seatPlanKey: 'pro',
      priced: true,
      description: t('billing.upgradeModal.professional.description'),
      icon: <Building2 size={20} />,
      features: t('billing.upgradeModal.professional.features', {
        returnObjects: true,
      }) as string[],
      buttonText: t('billing.upgradeModal.professional.button'),
      popular: true,
      accentFrom: '#3b82f6',
      accentTo: '#6366f1',
      glowColor: 'rgba(59,130,246,0.3)',
      checkoutPlan: 'professional',
    },
    {
      id: 'enterprise',
      name: t('billing.upgradeModal.enterprise.name'),
      price: t('billing.upgradeModal.enterprise.price'),
      perSeatUsd: 0,
      entrySeats: entrySeatCount('enterprise'),
      seatPlanKey: 'enterprise',
      priced: false,
      description: t('billing.upgradeModal.enterprise.description'),
      icon: <Rocket size={20} />,
      features: t('billing.upgradeModal.enterprise.features', {
        returnObjects: true,
      }) as string[],
      buttonText: t('billing.upgradeModal.enterprise.button'),
      accentFrom: '#0ea5e9',
      accentTo: '#06b6d4',
      glowColor: 'rgba(14,165,233,0.3)',
    },
  ];
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  tier,
  relation,
  isRecommended,
  organizationId,
  email,
  onClose,
  t,
  localProviders,
}: {
  tier: PlanTier;
  relation: PlanRelation;
  isRecommended: boolean;
  organizationId?: string;
  email?: string;
  onClose: () => void;
  t: TFunc;
  localProviders: LocalProvider[];
}) {
  const [loading, setLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState<string | null>(null);
  const router = useRouter();
  const currency = useCurrency();
  const createLocalPayment = useMutation(api.payments.createLocalPayment);

  const isCurrent = relation === 'current';
  const isDowngrade = relation === 'downgrade';
  // Highlight the recommended tier only when it's actionable (not the current plan)
  const highlight = isRecommended && !isCurrent;

  // Localized, API-rate-converted PER-SEAT price. Enterprise keeps its text
  // price (it is quoted, not sold through this flow).
  const displayPrice =
    tier.id === 'starter'
      ? currency.starter.formatted
      : tier.id === 'professional'
        ? currency.professional.formatted
        : tier.price;
  // What the plan costs the starting team each month — the figure an admin
  // actually compares, since the big number is only a rate.
  const perSeatDisplay =
    tier.id === 'starter'
      ? currency.starter.amount
      : tier.id === 'professional'
        ? currency.professional.amount
        : null;
  const entryTotalDisplay =
    tier.priced && perSeatDisplay !== null ? perSeatDisplay * tier.entrySeats : null;

  const handleCheckout = async () => {
    if (isCurrent) return;
    if (!tier.checkoutPlan) {
      router.push('/contact');
      onClose();
      return;
    }
    setLoading(true);
    try {
      const csrfRes = await fetch('/api/csrf-token', { method: 'GET' });
      if (!csrfRes.ok) throw new Error('Failed to get CSRF token');
      const csrfData = (await csrfRes.json()) as { token: string; signature: string };

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token,
          'X-CSRF-Token-Signature': csrfData.signature,
        },
        body: JSON.stringify({
          plan: tier.checkoutPlan,
          organizationId,
          email,
          // Per-seat billing: the Stripe Price is per unit, so the seat count is
          // the quantity. Start at the plan's minimum billable team, exactly
          // like the landing page's card; it can be raised as the team grows.
          seats: tier.entrySeats,
        }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch (e) {
      logger.error('[Stripe checkout]', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Drive a local-PSP checkout. The mutation records the order and returns the
   * handshake; the browser then either navigates to the PSP's hosted page or
   * POSTs the Idram field set at it. Nothing is activated until the provider's
   * webhook arrives.
   */
  const handleLocalPay = async (provider: string) => {
    if (isCurrent) return;
    setLocalLoading(provider);
    try {
      const res = await createLocalPayment({
        plan: tier.id,
        provider: provider as 'idram' | 'ameriabank' | 'ardshinbank' | 'fastbank',
        months: 1,
        seats: tier.entrySeats,
        amountAmd: amdAmountFor(tier, currency, tier.entrySeats, 1),
        origin: window.location.origin,
      });

      if (res.handshake.mode === 'redirect') {
        window.location.href = res.handshake.url;
        return;
      }

      // Idram-style: a real form POST, so the browser leaves with the order.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = res.handshake.action;
      for (const [name, value] of Object.entries(res.handshake.fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      logger.error('[Local PSP checkout]', e);
      onClose();
    } finally {
      setLocalLoading(null);
    }
  };

  // Button label reflects the relationship to the active subscription
  const ctaLabel = isCurrent
    ? t('billing.upgradeModal.currentPlanButton')
    : isDowngrade
      ? t('billing.upgradeModal.downgrade')
      : tier.buttonText;

  return (
    <div
      className={`group relative flex flex-col transform-gpu ${
        highlight ? 'sm:scale-[1.03] z-10' : 'hover:-translate-y-1'
      } ${isCurrent ? 'opacity-95' : ''}`}
      style={{
        transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Floating status badge */}
      {(isCurrent || highlight || tier.popular) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          {isCurrent ? (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-(--background-subtle) border border-(--border) text-(--text-muted) shadow-sm">
              <Check size={9} />
              {t('billing.upgradeModal.currentPlan')}
            </span>
          ) : highlight ? (
            <span
              className="flex items-center gap-1 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-md"
              style={{
                background: `linear-gradient(135deg, ${tier.accentFrom}, ${tier.accentTo})`,
              }}
            >
              <Crown size={9} fill="currentColor" />
              {t('billing.upgradeModal.recommended')}
            </span>
          ) : (
            <span
              className="flex items-center gap-1 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-md"
              style={{
                background: `linear-gradient(135deg, ${tier.accentFrom}, ${tier.accentTo})`,
              }}
            >
              <Sparkles size={9} fill="currentColor" />
              {t('billing.upgradeModal.mostPopular')}
            </span>
          )}
        </div>
      )}

      {/* Card body — overflow-hidden clips the accent gradient to rounded corners */}
      <div
        className={`flex flex-col flex-1 overflow-hidden rounded-2xl border ${
          highlight ? 'shadow-xl ring-1 ring-white/15' : ''
        }`}
        style={{
          background: highlight
            ? `linear-gradient(180deg, ${tier.accentFrom}1a, color-mix(in srgb, var(--card) 80%, transparent))`
            : 'color-mix(in srgb, var(--card) 65%, transparent)',
          borderColor: highlight
            ? `${tier.accentFrom}55`
            : 'color-mix(in srgb, var(--border) 60%, transparent)',
          boxShadow: highlight ? `0 16px 44px -14px ${tier.glowColor}` : undefined,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Top accent line */}
        <div
          className="h-1 w-full shrink-0"
          style={{ background: `linear-gradient(90deg, ${tier.accentFrom}, ${tier.accentTo})` }}
        />

        <div className="p-5 flex flex-col flex-1 gap-4">
          {/* Icon + name */}
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transform-gpu transition-transform duration-300 ease-out group-hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${tier.accentFrom}1f, ${tier.accentTo}1f)`,
                border: `1px solid ${tier.accentFrom}33`,
                color: tier.accentFrom,
              }}
            >
              {tier.icon}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-(--text-primary) leading-tight text-sm">{tier.name}</p>
              <p className="text-[11px] text-(--text-muted) leading-snug">{tier.description}</p>
            </div>
          </div>

          {/* Price — the big number is a PER-SEAT rate, never the bill. */}
          <div>
            <div className="flex items-end gap-1 min-w-0">
              <span
                className={`font-black leading-none text-(--text-primary) tracking-tight truncate ${
                  tier.priced ? 'text-3xl' : 'text-xl'
                }`}
              >
                {displayPrice}
              </span>
              {tier.priced && (
                <span className="text-xs text-(--text-muted) pb-1">
                  {t('billing.upgradeModal.perSeatMonth')}
                </span>
              )}
            </div>
            {entryTotalDisplay !== null && (
              <p className="mt-1 text-[11px] font-medium text-(--text-secondary)">
                {t('billing.upgradeModal.forSeats', {
                  seats: tier.entrySeats,
                  // Symbol comes from the locale's currency (₽ / ֏ / €), never a
                  // literal "$" in the translation.
                  total: `${currency.symbol}${entryTotalDisplay.toLocaleString()}`,
                })}
              </p>
            )}
            {tier.priced && !isCurrent && (
              <p className="text-[11px] text-(--text-muted) mt-1 flex items-center gap-1">
                <Shield size={10} className="text-(--success)" />
                {t('billing.upgradeModal.freeTrial')}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-(--border)" />

          {/* Features */}
          <ul className="space-y-2 flex-1">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-px"
                  style={{
                    background: `linear-gradient(135deg, ${tier.accentFrom}26, ${tier.accentTo}26)`,
                  }}
                >
                  <Check size={9} strokeWidth={3} style={{ color: tier.accentFrom }} />
                </span>
                <span className="text-(--text-secondary) leading-snug">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={loading || isCurrent}
            className="relative w-full p-2.5 rounded-xl font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 overflow-hidden group/btn disabled:cursor-not-allowed enabled:hover:brightness-105 enabled:active:scale-[0.98]"
            style={
              isCurrent
                ? {
                    background: 'var(--background-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }
                : isDowngrade
                  ? {
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      opacity: loading ? 0.7 : 1,
                    }
                  : highlight
                    ? {
                        background: `linear-gradient(135deg, ${tier.accentFrom}, ${tier.accentTo})`,
                        boxShadow: `0 6px 20px -6px ${tier.glowColor}`,
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
                {ctaLabel}
              </>
            ) : isDowngrade ? (
              <>
                <TrendingDown size={12} />
                {ctaLabel}
              </>
            ) : (
              <>
                <Sparkles size={12} />
                {ctaLabel}
                <ArrowRight
                  size={12}
                  className="group-hover/btn:translate-x-0.5 transition-transform"
                />
              </>
            )}
          </button>

          {/*
            Local rails (Idram / ArCa). Shown only when the superadmin has
            enabled and sealed a provider — an unconfigured provider is not a
            payment option, it is a dead button.
          */}
          {!isCurrent && localProviders.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-center text-[10px] uppercase tracking-wide text-(--text-muted)">
                {t('billing.localResult.payLocally', 'Pay locally')}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {localProviders.map((p) => (
                  <button
                    key={p.provider}
                    type="button"
                    onClick={() => void handleLocalPay(p.provider)}
                    disabled={loading || localLoading !== null}
                    className="rounded-lg border border-(--border) px-2.5 py-1.5 text-[11px] font-medium text-(--text-secondary) transition hover:bg-(--background-subtle) disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localLoading === p.provider ? (
                      <ShieldLoader size="xs" variant="inline" />
                    ) : (
                      p.label
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
  const { subscription } = useSubscription();
  const { user } = useAuthStore();
  const selectedOrgId = useSelectedOrganization();
  const organizationId = selectedOrgId ?? user?.organizationId ?? undefined;
  const email = user?.email ?? undefined;
  const currentPlan: Plan = subscription.plan;
  const tiers = buildTiers(t);
  // Only providers the superadmin has enabled appear as customer-facing options.
  const localProviders = useQuery(api.payments.listEnabledProviders) ?? [];

  const currentIndex = PLAN_ORDER.indexOf(currentPlan as PlanType);

  const relationFor = (id: PlanType): PlanRelation => {
    if (id === currentPlan) return 'current';
    // currentIndex === -1 when on the free plan → every paid tier is an upgrade
    return PLAN_ORDER.indexOf(id) > currentIndex ? 'upgrade' : 'downgrade';
  };

  if (user?.role !== 'admin') return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden gap-0 border border-white/15 bg-(--card)/80 backdrop-blur-2xl shadow-2xl">
        {/* Ambient glass glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-24 -left-16 w-72 h-72 rounded-full opacity-40 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--purple), transparent 70%)' }}
          />
          <div
            className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, var(--cyan), transparent 70%)' }}
          />
        </div>

        {/* Header */}
        <div className="relative px-6 pt-7 pb-5 border-b border-white/10 overflow-hidden">
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-(--primary)/15 border border-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-(--primary)" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold leading-tight tracking-tight">
                {featureTitle
                  ? t('billing.unlockFeature', { feature: featureTitle })
                  : t('billing.upgradeYourPlan')}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 text-(--text-muted)">
                {featureDescription ?? t('billing.upgradeDescription')}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Plan cards — all 3 tiers side by side */}
        <div className="relative p-6 pt-7 grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
          {tiers.map((tier) => (
            <PlanCard
              key={tier.id}
              tier={tier}
              relation={relationFor(tier.id)}
              isRecommended={tier.id === recommendedPlan}
              organizationId={organizationId}
              email={email}
              onClose={onClose}
              t={t}
              localProviders={localProviders}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="relative px-6 pb-5 flex items-center justify-center gap-2 text-xs text-(--text-muted)">
          <Shield size={12} className="text-(--success)" />
          {t('billing.upgradeModal.securedFooter')}
        </div>
      </DialogContent>
    </Dialog>
  );
}
