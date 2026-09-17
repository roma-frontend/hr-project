'use client';

import Link from 'next/link';
import { useLandingTranslation } from '@/components/landing/useLandingTranslation';
import { entrySeatCount, type PlanKey } from '@/lib/pricing';

/**
 * Live tariff block for /compare.
 *
 * Reads the same published plan snapshots the landing's pricing section does
 * (`api.billing.plans.getPublishedPlans`), so what a buyer sees on a comparison
 * page is the plan the platform actually enforces — not marketing copy that
 * drifted from the billing editor. Until the first publish the block renders a
 * quiet fallback pointing at /pricing (which carries the bundled tiers).
 *
 * Localization notes (the bug this fixes): the plan row in the DB holds ONE
 * language — whatever the superadmin typed. The three standard plan keys have
 * names and taglines in the `pricing.*` locale group, so those win whenever the
 * key is known; DB strings are the fallback for renamed/custom plans only.
 * The "/mo" suffix is also translated (`pricing.perMonth`).
 */

interface PublishedPlan {
  planId: string;
  version: number;
  publishedAt: number;
  plan: {
    key: string;
    name: string;
    tagline?: string | null;
    priceMonthly?: number | null;
    priceYearly?: number | null;
    currency: string;
    isPopular?: boolean;
    isCustom?: boolean;
    ctaLabel?: string | null;
  };
  modules: Array<{
    key: string;
    included: boolean;
    limits: Record<string, number | boolean> | null;
  }>;
}

const PLAN_ORDER = ['starter', 'pro', 'professional', 'enterprise'] as const;

/** Sentinel the plan editor writes for "no cap" — never show 999999 to a buyer. */
const UNLIMITED_SENTINEL = 999999;

function planAccent(key: string): { color: string } {
  if (key === 'pro' || key === 'professional') return { color: '#10b981' };
  if (key === 'enterprise') return { color: '#8b5cf6' };
  return { color: '#2c8cd5' };
}

/** i18n key for a standard plan's name, or null for renamed/custom plans. */
function planNameKey(key: string): string | null {
  if (key === 'starter') return 'pricing.starter';
  if (key === 'pro' || key === 'professional') return 'pricing.professional';
  if (key === 'enterprise') return 'pricing.enterprise';
  return null;
}

/** i18n key for a standard plan's tagline, or null. */
function planTaglineKey(key: string): string | null {
  if (key === 'starter') return 'pricing.starterDesc';
  if (key === 'pro' || key === 'professional') return 'pricing.professionalDesc';
  if (key === 'enterprise') return 'pricing.enterpriseDesc';
  return null;
}

export default function ComparePricing({
  initialLanguage = 'en',
  plans,
}: {
  initialLanguage?: string;
  plans?: PublishedPlan[];
}) {
  const { t } = useLandingTranslation(initialLanguage);

  // `plans` arrives as a prop so the page keeps everything on one useQuery;
  // `undefined` (still loading or nothing published yet) shows the fallback.
  const sorted = plans
    ? [...plans].sort(
        (a, b) =>
          (PLAN_ORDER.indexOf(a.plan.key as (typeof PLAN_ORDER)[number]) + 1 || 99) -
          (PLAN_ORDER.indexOf(b.plan.key as (typeof PLAN_ORDER)[number]) + 1 || 99),
      )
    : [];

  if (sorted.length === 0) {
    return (
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div
            className="rounded-3xl p-8 text-center"
            style={{
              background: 'var(--landing-card-bg)',
              border: '1px solid var(--landing-card-border)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--landing-text-secondary)' }}>
              {t('compare.pricing.liveFallback')}{' '}
              <Link href="/pricing" className="underline font-semibold">
                {t('compare.pricing.viewPricing')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 pb-16">
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-2xl md:text-3xl font-black mb-2"
          style={{ color: 'var(--landing-text-primary)' }}
        >
          {t('compare.pricing.liveTitle')}
        </h2>
        <p className="mb-8 max-w-3xl" style={{ color: 'var(--landing-text-secondary)' }}>
          {t('compare.pricing.liveSubtitle')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {sorted.map((p) => {
            const accent = planAccent(p.plan.key);
            const included = p.modules.filter((m) => m.included);
            const seats = included.find((m) => m.key === 'employees')?.limits?.seats;
            const apiCalls = included.find((m) => m.key === 'apiAccess')?.limits?.apiCalls;
            const isCustom = p.plan.isCustom ?? p.plan.priceMonthly === null;
            const price =
              p.plan.priceMonthly !== null && p.plan.priceMonthly !== undefined
                ? `$${p.plan.priceMonthly}`
                : null;

            const nameKey = planNameKey(p.plan.key);
            const taglineKey = planTaglineKey(p.plan.key);
            const name = nameKey ? t(nameKey, { defaultValue: p.plan.name }) : p.plan.name;
            const tagline = taglineKey
              ? t(taglineKey, { defaultValue: p.plan.tagline ?? undefined })
              : (p.plan.tagline ?? undefined);

            return (
              <div
                key={p.planId}
                className="relative rounded-3xl p-7"
                style={{
                  background: 'var(--landing-card-bg)',
                  border: p.plan.isPopular
                    ? `2px solid ${accent.color}`
                    : '1px solid var(--landing-card-border)',
                }}
              >
                {p.plan.isPopular ? (
                  <span
                    className="absolute -top-3 left-6 text-[11px] font-bold px-3 py-1 rounded-full"
                    style={{ background: accent.color, color: '#fff' }}
                  >
                    {t('compare.pricing.popular')}
                  </span>
                ) : null}

                <p className="font-bold text-lg" style={{ color: 'var(--landing-text-primary)' }}>
                  {name}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--landing-text-secondary)' }}>
                  {tagline ?? ''}
                </p>

                <p className="mt-4" style={{ color: 'var(--landing-text-primary)' }}>
                  {isCustom || price === null ? (
                    <span className="text-2xl font-black">{t('compare.pricing.customPrice')}</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black">{price}</span>
                      <span className="text-sm ml-1" style={{ color: 'var(--landing-text-muted)' }}>
                        {t('pricing.perUserMonth', { defaultValue: '/user/mo' })}
                      </span>
                    </>
                  )}
                </p>

                <ul className="mt-5 space-y-2 text-sm">
                  {!isCustom ? (
                    <li style={{ color: 'var(--landing-text-secondary)' }}>
                      {entrySeatCount(p.plan.key as PlanKey)}{' '}
                      {t('compare.pricing.minSeats', { defaultValue: 'seats minimum' })}
                    </li>
                  ) : null}
                  {typeof seats === 'number' ? (
                    <li style={{ color: 'var(--landing-text-secondary)' }}>
                      {seats >= UNLIMITED_SENTINEL
                        ? t('compare.pricing.unlimitedSeats')
                        : t('compare.pricing.seats', { n: seats })}
                    </li>
                  ) : null}
                  {typeof apiCalls === 'number' ? (
                    <li style={{ color: 'var(--landing-text-secondary)' }}>
                      {apiCalls >= UNLIMITED_SENTINEL
                        ? t('compare.pricing.unlimitedApi')
                        : t('compare.pricing.apiQuota', { n: apiCalls.toLocaleString() })}
                    </li>
                  ) : null}
                  <li style={{ color: 'var(--landing-text-secondary)' }}>
                    {t('compare.pricing.moduleCount', { n: included.length })}
                  </li>
                </ul>

                <Link
                  href="/pricing"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: accent.color }}
                >
                  {t('compare.pricing.viewPricing')}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
