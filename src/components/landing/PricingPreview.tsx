'use client';

import { useRef, useEffect, useState } from 'react';
import { useLandingTranslation } from './useLandingTranslation';
import { useQuery } from 'convex/react';
import { toast } from 'sonner';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrency } from '@/hooks/useCurrency';
import { applyRatePrecise } from '@/lib/currency';
import { entrySeatCount, perSeatPrice, seatCap, type PlanKey } from '@/lib/pricing';
import { resolvePlanCta, resolvePlanName, resolvePlanTagline } from '@/lib/planPresentation';
import { api } from '@/convex/_generated/api';
import { logger } from '@/lib/logger';
// The card itself is shared with the tariff editor's live preview, so the
// public page and /superadmin/plans can never drift apart.
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckCircleIcon,
  CheckIcon,
  PLAN_CARD_ACCENTS,
  RocketIcon,
  PlanCard,
  ShieldIcon,
  StarIcon,
  ZapIcon,
  groupFeaturesByCategory,
  type PlanCardModel,
} from '@/components/landing/PlanCard';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PricingTier {
  id: string;
  nameKey: string;
  priceKey: string;
  priceMonthly?: number;
  priceYearly?: number;
  /** Currency the numeric prices above are authored in. Defaults to USD — the
   *  base every exchange rate is quoted against. */
  priceCurrency?: string;
  descriptionKey: string;
  /**
   * Plan whose seat cap heads the feature list. The "Up to N employees" bullet
   * is computed from the pricing model, not translated: the locale strings
   * spelled the caps out and every one of them went stale when the plans gained
   * seat limits. `null`-capped plans (Enterprise) read "Unlimited".
   */
  seatCapPlan?: PlanKey;
  icon: React.ReactNode;
  featureKeys: string[];
  /** Direct values win when the tier comes from live billing data. */
  nameText?: string;
  descriptionText?: string;
  featureTexts?: string[];
  /** Category-grouped features (data-driven tiers) — rendered as smoothly
   *  collapsible sections, like the sidebar's sub-items. */
  featureGroups?: Array<{ category: string; items: string[] }>;
  ctaText?: string;
  buttonTextKey: string;
  popular?: boolean;
  badgeKey?: string;
  accentFrom: string;
  accentTo: string;
  glowColor: string;
  trialEligible?: boolean;
}

// Feature grouping, the category navigator, the icons and the card markup all
// live in `@/components/landing/PlanCard` — shared with the tariff editor's
// preview. See that module's header.

// ── Plans ─────────────────────────────────────────────────────────────────────
const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    nameKey: 'pricing.starter',
    priceKey: 'pricing.starterPrice',
    priceMonthly: 4,
    priceYearly: 3.2,
    descriptionKey: 'pricing.starterDesc',
    icon: <ZapIcon size={22} />,
    seatCapPlan: 'starter',
    featureKeys: [
      'pricing.basicLeaveManagement',
      'pricing.timeTracking',
      'pricing.employeeProfiles',
      'pricing.emailNotifications',
      'pricing.communitySupport',
    ],
    buttonTextKey: 'pricing.startFreeTrial',
    accentFrom: '#10b981',
    accentTo: '#059669',
    glowColor: 'rgba(16,185,129,0.35)',
    trialEligible: true,
  },
  {
    id: 'professional',
    nameKey: 'pricing.professional',
    priceKey: 'pricing.professionalPrice',
    priceMonthly: 8,
    priceYearly: 6.4,
    descriptionKey: 'pricing.professionalDesc',
    icon: <BuildingIcon size={22} />,
    seatCapPlan: 'pro',
    featureKeys: [
      'pricing.everythingInStarter',
      'pricing.aiPoweredInsights',
      'pricing.customReports',
      'pricing.prioritySupport',
      'pricing.calendarIntegrations',
    ],
    buttonTextKey: 'pricing.startFreeTrial',
    popular: true,
    badgeKey: 'pricing.mostPopular',
    accentFrom: '#3b82f6',
    accentTo: '#2563eb',
    glowColor: 'rgba(59,130,246,0.4)',
    trialEligible: true,
  },
  {
    id: 'enterprise',
    nameKey: 'pricing.enterprise',
    priceKey: 'pricing.custom',
    descriptionKey: 'pricing.enterpriseDesc',
    icon: <RocketIcon size={22} />,
    seatCapPlan: 'enterprise',
    featureKeys: [
      'pricing.everythingInProfessional',
      'pricing.dedicatedSupport',
      'pricing.slaAgreement',
      'pricing.advancedSecurity',
      'pricing.prioritySupport',
      'pricing.priorityProcessing',
      'pricing.automatedBackups',
    ],
    buttonTextKey: 'pricing.contactSales',
    accentFrom: '#0ea5e9',
    accentTo: '#06b6d4',
    glowColor: 'rgba(14,165,233,0.35)',
  },
];

// ── Reveal hook ───────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 500) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(from + (target - from) * eased));
      if (p < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return count;
}

// ── Reveal hook ───────────────────────────────────────────────────────────────
function useReveal(delay = '0s') {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '-30px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return {
    ref,
    style: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(48px) scale(0.97)',
      transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}`,
    },
  };
}

// ── PricingCard ───────────────────────────────────────────────────────────────
function PricingCard({
  tier,
  delay,
  currentPlan,
  displayPrice,
  priceAmount,
  billing,
  symbol,
  initialLanguage,
}: {
  tier: PricingTier;
  delay: number;
  currentPlan?: string;
  displayPrice: string;
  /** Numeric price in the current currency, null for custom-priced plans. */
  priceAmount: number | null;
  billing: 'monthly' | 'annual';
  /** Currency symbol, passed down so it can never lag behind `priceAmount`. */
  symbol: string;
  /** Server-detected locale so the card SSRs translated (see PricingClient). */
  initialLanguage: string;
}) {
  const { ref, style } = useReveal(`${delay}s`);
  const { t } = useLandingTranslation(initialLanguage);
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  // Per-seat model: the big number is the per-seat price; the line below shows
  // what the smallest billable team costs on this plan.
  const seatPlan = resolveSeatPlan(tier.id);
  const entrySeats = seatPlan ? entrySeatCount(seatPlan) : null;
  const entryTotal =
    entrySeats !== null && priceAmount !== null ? Math.round(priceAmount * entrySeats) : null;
  // Legacy subscriptions use 'professional' while the editor's plan key is
  // 'pro' — treat them as the same tier so the CTA shows "Current plan".
  const isCurrentPlan =
    currentPlan === tier.id || (tier.id === 'pro' && currentPlan === 'professional');
  const router = useRouter();

  // Count-up the digits when the plan or billing period changes — the price
  // is alive, not a static label, so switching Monthly ↔ Annual reads as
  // the number actually dropping.
  const animatedAmount = useCountUp(priceAmount ?? 0);
  const priceLabel =
    priceAmount === null ? displayPrice : `${symbol}${animatedAmount.toLocaleString()}`;

  const handleCheckout = async () => {
    if (tier.id === 'enterprise') {
      router.push('/contact');
      return;
    }
    // If not logged in, redirect to login first
    if (!user) {
      router.push('/login?next=%23pricing');
      return;
    }
    setLoading(true);
    try {
      const csrfRes = await fetch('/api/csrf-token', { method: 'GET' });
      if (!csrfRes.ok) throw new Error('Failed to get CSRF token');
      const csrfData = (await csrfRes.json()) as { token?: string; signature?: string };

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token ?? '',
          'X-CSRF-Token-Signature': csrfData.signature ?? '',
        },
        body: JSON.stringify({
          plan: tier.id,
          email: user?.email || undefined,
          organizationId: user?.organizationId || undefined,
          // Per-seat billing: charge for the minimum billable team of this
          // plan. The subscription quantity can be raised later as the team grows.
          seats: entrySeats ?? undefined,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        logger.error('[Stripe checkout error]', data.error, data.message);
        if (res.status === 401) {
          toast.error(
            t(
              'pricing.permissionDenied',
              'You do not have permission to change the plan. Contact your administrator.',
            ),
          );
        } else {
          toast.error(t('pricing.checkoutError', 'Failed to start checkout. Please try again.'));
        }
      }
    } catch (e: unknown) {
      logger.error('[Stripe checkout error]', e);
      toast.error(t('pricing.checkoutError', 'Failed to start checkout. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Everything the shared card renders, resolved here: strings in the display
  // currency, features already translated. Same model the tariff editor's
  // preview builds from its draft.
  const seatCapLabel = (planKey: PlanKey): string => {
    const cap = seatCap(planKey);
    return cap === null
      ? t('pricing.unlimitedEmployees', 'Unlimited employees')
      : t('pricing.seatCap', { n: cap, defaultValue: 'Up to {{n}} employees' });
  };

  const model: PlanCardModel = {
    accentFrom: tier.accentFrom,
    accentTo: tier.accentTo,
    glowColor: tier.glowColor,
    icon: tier.icon,
    name: tier.nameText ?? t(tier.nameKey),
    tagline: tier.descriptionText ?? t(tier.descriptionKey),
    priceLabel,
    priced: tier.priceMonthly !== undefined && tier.priceMonthly >= 0,
    priceSuffix: t('pricing.perUserMonth'),
    seatsLine:
      entrySeats !== null && entryTotal !== null
        ? t('pricing.forTeam', {
            seats: entrySeats,
            total: `${symbol}${entryTotal.toLocaleString()}`,
          })
        : undefined,
    strikeLabel:
      billing === 'annual'
        ? `${symbol}${Math.round((priceAmount ?? 0) / 0.8).toLocaleString()}`
        : undefined,
    billingLabel: t(billing === 'annual' ? 'pricing.billedAnnually' : 'pricing.billedMonthly'),
    trialLabel: tier.trialEligible ? t('pricing.freeTrial') : undefined,
    featureTexts: tier.featureTexts ?? [
      ...(tier.seatCapPlan ? [seatCapLabel(tier.seatCapPlan)] : []),
      ...tier.featureKeys.map((k) => t(k)),
    ],
    featureGroups: tier.featureGroups,
    popular: tier.popular,
    badgeLabel: tier.badgeKey ? t(tier.badgeKey) : undefined,
  };

  return (
    <div
      ref={ref}
      style={style}
      className={`relative group flex flex-col ${tier.popular ? 'md:-mt-4 md:mb-4' : ''}`}
    >
      <PlanCard
        model={model}
        cta={
          <button
            onClick={handleCheckout}
            disabled={loading || isCurrentPlan}
            className={`relative w-full p-3 sm:p-4 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group/btn
              ${loading || isCurrentPlan ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
            `}
            style={
              tier.popular || isCurrentPlan
                ? {
                    background: `linear-gradient(135deg, ${tier.accentFrom}, ${tier.accentTo})`,
                    boxShadow: `0 8px 32px ${tier.glowColor}`,
                    color: '#ffffff',
                  }
                : {
                    background: `${tier.accentFrom}15`,
                    border: `1px solid ${tier.accentFrom}55`,
                    color: 'var(--landing-text-primary)',
                  }
            }
          >
            {/* Shimmer effect */}
            {!loading && !isCurrentPlan && (
              <div
                className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            )}
            {loading ? (
              <ShieldLoader size="xs" variant="inline" />
            ) : isCurrentPlan ? (
              <>
                <CheckCircleIcon size={15} />
                {t('pricing.currentPlan')}
              </>
            ) : (
              <>
                {tier.ctaText ?? t(tier.buttonTextKey)}
                <ArrowRightIcon
                  size={15}
                  className="group-hover/btn:translate-x-0.5 transition-transform"
                />
              </>
            )}
          </button>
        }
      />
    </div>
  );
}

// ── Savings calculator ────────────────────────────────────────────────────────
/**
 * Live ROI slider: pick a team size, see what replacing the typical 3-tool HR
 * stack (HRIS + time tracking + spreadsheets) with Strata saves per year.
 *
 * The numbers are deliberately conservative and derived from a single per-seat
 * assumption so the calculator stays honest: legacy tooling ≈ $12/seat/mo, HR
 * time saved ≈ 30 min/seat/mo at $30/hr, and Strata Pro read straight from the
 * volume-tier model at the slider's team size (so the saving grows as the team
 * crosses a bracket). The legacy and time figures are converted through the
 * active FX rate so the result matches the pricing cards above.
 */
function SavingsCalculator({
  symbol,
  rate,
  initialLanguage,
}: {
  symbol: string;
  rate: number;
  initialLanguage: string;
}) {
  const { t } = useLandingTranslation(initialLanguage);
  const { ref, style } = useReveal('0.1s');
  const [employees, setEmployees] = useState(50);

  // Conservative per-seat assumptions in USD, converted through the active FX
  // rate so the calculator matches the card prices in every locale:
  //   - the legacy stack (an HRIS + a time tool + spreadsheets) ≈ $12/seat/mo;
  //   - HR time saved = 30 min/seat/mo at $30/hr = $15/seat/mo;
  //   - Strata Pro, priced from the shared volume-tier model, so the saving
  //     grows as the team crosses each bracket.
  // Per-seat figures, so cents are kept: rounding $5.50 to $6 overstated the
  // Pro rate and with it the saving this calculator claims.
  const localize = (usd: number) => applyRatePrecise(usd, rate);
  const legacyPerSeat = localize(12);
  const strataPerSeat = localize(perSeatPrice('pro', employees));
  const timePerSeat = localize(15);
  const monthlySavings = (legacyPerSeat + timePerSeat - strataPerSeat) * employees;
  const annualSavings = Math.round(monthlySavings * 12);
  const animatedSavings = useCountUp(annualSavings, 700);

  // Slider fill — the track highlights from left to right as the team grows.
  const min = 10;
  const max = 500;
  const pct = ((employees - min) / (max - min)) * 100;

  return (
    <div ref={ref} style={style} className="max-w-4xl mx-auto mt-16">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'var(--landing-card-bg)',
          border: '1px solid var(--landing-card-border)',
          boxShadow: '0 24px 64px -24px rgba(12, 26, 46, 0.25)',
          backdropFilter: 'blur(14px)',
        }}
      >
        {/* Top accent */}
        <div
          className="h-[2px] w-full"
          style={{ background: 'linear-gradient(90deg, transparent, var(--brand), transparent)' }}
        />

        <div className="p-6 sm:p-10 grid md:grid-cols-2 gap-8 items-center">
          {/* Left: slider */}
          <div>
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--brand)' }}
            >
              {t('pricing.calculatorEyebrow')}
            </span>
            <h3
              className="mt-2 text-2xl sm:text-3xl font-black leading-tight tracking-tighter"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('pricing.calculatorTitle')}
            </h3>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--landing-text-secondary)' }}
            >
              {t('pricing.calculatorSubtitle')}
            </p>

            {/* Team size readout */}
            <div className="mt-6 flex items-end gap-2">
              <span
                className="num text-4xl font-black tabular-nums leading-none"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {employees}
              </span>
              <span
                className="text-sm font-semibold pb-0.5"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                {t('pricing.calculatorEmployees')}
              </span>
            </div>

            {/* Slider */}
            <div className="relative mt-4">
              <input
                type="range"
                min={min}
                max={max}
                step={10}
                value={employees}
                onChange={(e) => setEmployees(Number(e.target.value))}
                aria-label={t('pricing.calculatorEmployees')}
                className="w-full h-2 rounded-full appearance-none cursor-pointer calculator-range"
                style={{
                  background: `linear-gradient(to right, var(--brand) 0%, var(--brand) ${pct}%, var(--muted) ${pct}%, var(--muted) 100%)`,
                }}
              />
              <div
                className="flex justify-between mt-1.5 text-[10px] font-medium"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                <span>{min}</span>
                <span>{(min + max) / 2}</span>
                <span>{max}</span>
              </div>
            </div>

            {/* Breakdown rows */}
            <div className="mt-6 space-y-2.5">
              {[
                {
                  label: t('pricing.calculatorLegacy'),
                  value: legacyPerSeat * 12,
                  color: 'var(--danger-solid)',
                },
                {
                  label: t('pricing.calculatorTime'),
                  value: timePerSeat * 12,
                  color: 'var(--warning-solid)',
                },
                {
                  label: t('pricing.calculatorStrata'),
                  value: -strataPerSeat * 12,
                  color: 'var(--success-solid)',
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span
                    className="flex items-center gap-2 font-medium"
                    style={{ color: 'var(--landing-text-secondary)' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    {label}
                  </span>
                  <span
                    className="num font-bold tabular-nums"
                    style={{
                      color: value < 0 ? 'var(--success-text)' : 'var(--landing-text-primary)',
                    }}
                  >
                    {value < 0 ? '−' : ''}
                    {symbol}
                    {Math.round(Math.abs(value)).toLocaleString()}
                    <span
                      className="text-[10px] font-medium ml-0.5"
                      style={{ color: 'var(--landing-text-muted)' }}
                    >
                      {t('pricing.perYear')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: big animated savings number */}
          <div
            className="relative rounded-2xl p-6 sm:p-8 text-center overflow-hidden"
            style={{
              border: '1px solid rgb(var(--green-500-ch) / 25%)',
              background: 'rgb(var(--green-500-ch) / 7%)',
            }}
          >
            <div
              className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgb(var(--green-500-ch) / 18%) 0%, transparent 70%)',
                filter: 'blur(30px)',
              }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--success-text)' }}
            >
              {t('pricing.calculatorSavingsLabel')}
            </span>
            <div className="mt-3 flex items-baseline justify-center gap-1.5">
              <span
                className="num text-5xl sm:text-6xl font-black tabular-nums leading-none"
                style={{ color: 'var(--success-text)' }}
              >
                {symbol}
                {animatedSavings.toLocaleString()}
              </span>
            </div>
            <span
              className="mt-1.5 block text-xs font-semibold"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              {t('pricing.calculatorPerYear')}
            </span>
            <div
              className="mt-5 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgb(var(--green-500-ch) / 12%)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, (employees / max) * 100)}%`,
                  background: 'var(--success-solid)',
                }}
              />
            </div>
            <p
              className="mt-4 text-[11px] leading-relaxed"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              {t('pricing.calculatorFootnote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
/** Map a pricing-tier id to a seat-pricing plan key ('professional' → 'pro'). */
function resolveSeatPlan(id: string): PlanKey | null {
  const key = id === 'professional' ? 'pro' : id;
  return key === 'starter' || key === 'pro' || key === 'enterprise' ? key : null;
}

export default function PricingPreview({ initialLanguage = 'en' }: { initialLanguage?: string }) {
  const { ref, style } = useReveal();
  const { t } = useLandingTranslation(initialLanguage);
  const { user } = useAuthStore();
  const { plan } = useSubscription();
  const currency = useCurrency();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  // Live tariffs from the plan editor: the superadmin publishes plans in
  // /superadmin/plans and this section re-renders within ~100ms (Convex live
  // query). Falls back to the bundled hardcoded tiers until the first publish.
  const publishedPlans = useQuery(api.billing.plans.getPublishedPlans);

  const dataTiers: PricingTier[] = (publishedPlans ?? []).map((p, i) => {
    const accent = PLAN_CARD_ACCENTS[i % PLAN_CARD_ACCENTS.length] ?? PLAN_CARD_ACCENTS[0]!;
    const isCustom = p.plan.isCustom;
    // Name and tagline: a superadmin rename / hand-written tagline wins in every
    // language; an untouched seeded one falls back to the visitor's locale.
    // Shared with the tariff editor's preview (src/lib/planPresentation.ts) so
    // the two can never disagree.
    const name = resolvePlanName({ planKey: p.plan.key, name: p.plan.name, t });
    const tagline = resolvePlanTagline({
      planKey: p.plan.key,
      tagline: p.plan.tagline,
      t,
    });
    return {
      id: p.plan.key,
      nameKey: 'pricing.starter',
      priceKey: 'pricing.starterPrice',
      priceMonthly: p.plan.priceMonthly ?? undefined,
      priceYearly: p.plan.priceYearly ?? undefined,
      priceCurrency: p.plan.currency,
      descriptionKey: 'pricing.starterDesc',
      featureKeys: [],
      nameText: name,
      descriptionText: tagline,
      featureTexts: p.modules.map((m) => t(`billing.modules.${m.key}`, m.name)),
      featureGroups: groupFeaturesByCategory(
        p.modules.map((m) => ({
          key: m.key,
          name: t(`billing.modules.${m.key}`, m.name),
          category: m.category,
        })),
      ),
      // The seeded `ctaLabel` is English text, so it has to go through the
      // locale resolver — otherwise a Russian visitor reads "Start free trial"
      // in the middle of a translated pricing card.
      ctaText: resolvePlanCta({
        planKey: p.plan.key,
        ctaLabel: p.plan.ctaLabel,
        isCustom,
        t,
      }),
      buttonTextKey: 'pricing.startFreeTrial',
      popular: p.plan.isPopular,
      badgeKey: 'pricing.mostPopular',
      icon: accent.icon,
      accentFrom: accent.accentFrom,
      accentTo: accent.accentTo,
      glowColor: accent.glowColor,
      trialEligible: !isCustom,
    };
  });

  const tiers = dataTiers.length > 0 ? dataTiers : pricingTiers;

  // Only show current plan if user is logged in
  const currentPlan = user ? plan : undefined;

  // Numeric amounts (in the current currency) for the count-up animation and
  // the savings calculator. Data-driven tiers prefer their explicit yearly
  // price; bundled tiers apply the 20% annual discount. Custom plans are null.
  //
  // Plan prices — both the bundled tiers and the ones published from
  // /superadmin/plans — are authored in USD (convex/billing/defaults.ts), so
  // every amount goes through the active rate. Skipping this is what made the
  // language switch move only the symbol and leave the digits in dollars
  // (₽29 instead of ₽2,610). A plan explicitly published in another currency is
  // shown as authored rather than converted twice.
  const localize = (amount: number, priceCurrency?: string) =>
    (priceCurrency ?? 'USD').toUpperCase() === 'USD'
      ? applyRatePrecise(amount, currency.rate)
      : Math.round(amount);

  const priceAmounts: Record<string, number | null> = Object.fromEntries(
    tiers.map((tier) => {
      const base =
        billing === 'annual'
          ? (tier.priceYearly ??
            (tier.priceMonthly !== undefined ? tier.priceMonthly * 0.8 : undefined))
          : tier.priceMonthly;
      return [tier.id, base === undefined ? null : localize(base, tier.priceCurrency)];
    }),
  );

  // Build price strings from the numeric amount so annual pricing survives
  // currency formatting with thousand separators (₽2,610 → ₽2,090).
  const fmtPrice = (amount: number) => `${currency.symbol}${amount.toLocaleString()}`;
  const priceMap: Record<string, string> = Object.fromEntries(
    tiers.map((tier) => [
      tier.id,
      priceAmounts[tier.id] === null
        ? t('pricing.custom', 'Custom')
        : fmtPrice(priceAmounts[tier.id]!),
    ]),
  );

  return (
    <section id="pricing" className="relative z-10 px-6 md:px-12 py-12 md:py-24 overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-(--purple-quiet) rounded-full blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-(--brand-quiet) rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div ref={ref} className="text-center mb-20" style={style}>
        <span className="section-eyebrow">{t('pricing.eyebrow')}</span>
        <h2
          className="mt-3 text-3xl md:text-5xl font-black leading-tight"
          style={{ color: 'var(--landing-text-primary)' }}
        >
          {t('pricing.headingStart')}{' '}
          <span className="heading-gradient">{t('pricing.headingHighlight')}</span>
        </h2>
        <p
          className="mt-4 max-w-2xl mx-auto text-lg"
          style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
        >
          {t('pricing.subtitle')}{' '}
          <span style={{ color: 'var(--landing-text-muted)' }}>{t('pricing.allPlansInclude')}</span>
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          {[
            { icon: <ShieldIcon size={14} />, textKey: 'pricing.sslSecured' },
            { icon: <CheckIcon size={14} />, textKey: 'pricing.noSetupFees' },
            { icon: <ZapIcon size={14} />, textKey: 'pricing.cancelAnytime' },
            { icon: <StarIcon size={14} />, textKey: 'pricing.gdprCompliant' },
          ].map(({ icon, textKey }) => (
            <div
              key={textKey}
              className="flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
            >
              <span style={{ color: 'var(--primary)' }}>{icon}</span>
              {t(textKey)}
            </div>
          ))}
        </div>

        {/* Billing toggle — monthly vs annual, with the annual discount. */}
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full mt-8"
          style={{
            background: 'var(--landing-card-bg)',
            border: '1px solid var(--landing-card-border)',
          }}
        >
          {(['monthly', 'annual'] as const).map((period) => {
            const isActive = billing === period;
            return (
              <button
                key={period}
                type="button"
                onClick={() => setBilling(period)}
                aria-pressed={isActive}
                className="relative px-5 py-2 rounded-full text-sm font-bold transition-all duration-300"
                style={
                  isActive
                    ? {
                        background: 'var(--primary)',
                        color: '#fff',
                        boxShadow: '0 4px 16px rgb(var(--brand-600-ch) / 35%)',
                      }
                    : { color: 'var(--landing-text-secondary)' }
                }
              >
                {t(period === 'annual' ? 'pricing.annually' : 'pricing.monthly')}
                {period === 'annual' && (
                  <span
                    className="ml-1.5 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                    style={
                      isActive
                        ? { background: 'rgba(255,255,255,0.22)', color: '#fff' }
                        : {
                            background: 'rgb(var(--green-500-ch) / 14%)',
                            color: 'var(--success-text)',
                          }
                    }
                  >
                    {t('pricing.save')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto items-start pt-6">
        {tiers.map((tier, i) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            delay={i * 0.12}
            currentPlan={currentPlan}
            displayPrice={priceMap[tier.id] ?? '$0'}
            priceAmount={priceAmounts[tier.id] ?? null}
            billing={billing}
            symbol={currency.symbol}
            initialLanguage={initialLanguage}
          />
        ))}
      </div>

      {/* Savings calculator — team size → annual savings, live and animated */}
      <SavingsCalculator
        symbol={currency.symbol}
        rate={currency.rate}
        initialLanguage={initialLanguage}
      />

      {/* Compare link — /compare is the page that ranks for "<vendor> alternative";
       *  it reads the same live plan data, so the loop closes on real numbers. */}
      <div className="max-w-6xl mx-auto mt-6 flex justify-center">
        <Link
          href="/compare"
          className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all hover:gap-3"
          style={{
            color: 'var(--landing-text-secondary)',
            border: '1px solid var(--landing-card-border)',
            background: 'var(--landing-card-bg)',
          }}
        >
          {t('compare.compareWithCompetitors')}
          <ArrowRightIcon />
        </Link>
      </div>

      {/* Footer note */}
      <p
        className="text-center text-sm mt-14 flex items-center justify-center gap-2"
        style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
      >
        <ShieldIcon size={13} style={{ color: 'var(--primary)' }} />
        {t('pricing.footerNote')}{' '}
        <span className="font-semibold" style={{ color: 'var(--landing-text-muted)' }}>
          Stripe
        </span>
        .
      </p>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </section>
  );
}
