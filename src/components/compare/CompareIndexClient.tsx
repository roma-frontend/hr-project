'use client';

import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CompareTable, { COMPARE_ROW_COUNT } from './CompareTable';
import ComparePricing from './ComparePricing';
import { useLandingTranslation } from '@/components/landing/useLandingTranslation';
import {
  COMPARE_VERIFIED,
  compareScore,
  competitorsByRegion,
  type CompetitorRegion,
} from '@/lib/competitors';

const COMPARE_SECTIONS: CompetitorRegion[] = ['global', 'local'];

/**
 * `/compare` — the hub. Two jobs: give a buyer the full matrix in one screen,
 * and hand search engines a page that links every head-to-head comparison
 * ("Strata vs <vendor>" is how Rippling and BambooHR win their non-brand
 * traffic; we previously had nothing to rank).
 */
export default function CompareIndexClient({
  initialLanguage = 'en',
}: {
  initialLanguage?: string;
}) {
  const { t } = useLandingTranslation(initialLanguage);
  // Same published snapshots the pricing section renders — the comparison page
  // must never quote numbers the billing system does not enforce.
  const publishedPlans = useQuery(api.billing.plans.getPublishedPlans);

  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <Navbar initialLanguage={initialLanguage} />

      <main>
        <section className="relative overflow-hidden pt-32 pb-14 px-6">
          <div
            className="absolute -top-32 right-0 w-[520px] h-[520px] rounded-full pointer-events-none opacity-40"
            style={{
              background: 'radial-gradient(circle, var(--landing-orb-1) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div className="relative max-w-4xl mx-auto text-center">
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full mb-6"
              style={{ background: 'var(--brand-quiet)', color: 'var(--brand-text)' }}
            >
              {t('compare.index.badge')}
            </span>
            <h1
              className="text-4xl md:text-5xl font-black leading-tight tracking-tighter"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('compare.index.heroTitle')}
            </h1>
            <p
              className="mt-5 text-lg max-w-2xl mx-auto"
              style={{ color: 'var(--landing-text-secondary)' }}
            >
              {t('compare.index.heroSubtitle')}
            </p>
            <p className="mt-6 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              {t('compare.index.verifiedNote', { date: COMPARE_VERIFIED, n: COMPARE_ROW_COUNT })}
            </p>
          </div>
        </section>

        {/* ── Head-to-head cards ─────────────────────────────────────────── */}
        <section className="px-6 pb-16">
          <div className="max-w-6xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-black text-center mb-2"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('compare.index.cardsTitle')}
            </h2>
            <p
              className="text-center mb-10 max-w-2xl mx-auto"
              style={{ color: 'var(--landing-text-secondary)' }}
            >
              {t('compare.index.cardsSubtitle')}
            </p>

            {COMPARE_SECTIONS.map((region) => (
              <div key={region} className="mb-12 last:mb-0">
                <h3
                  className="text-sm font-bold uppercase tracking-wider mb-4"
                  style={{ color: 'var(--landing-text-muted)' }}
                >
                  {t(
                    region === 'global' ? 'compare.index.globalTitle' : 'compare.index.localTitle',
                  )}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {competitorsByRegion(region).map((c) => {
                    const score = compareScore(c.slug);
                    return (
                      <Link
                        key={c.slug}
                        href={`/compare/${c.slug}`}
                        className="group rounded-3xl p-6 transition-all duration-200 hover:shadow-lg"
                        style={{
                          background: 'var(--landing-card-bg)',
                          border: '1px solid var(--landing-card-border)',
                        }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <span
                            className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-sm font-bold"
                            style={{ background: `${c.color}1f`, color: c.color }}
                          >
                            {c.monogram}
                          </span>
                          <span
                            className="font-bold"
                            style={{ color: 'var(--landing-text-primary)' }}
                          >
                            {c.name}
                          </span>
                        </div>
                        <p
                          className="text-sm leading-relaxed mb-5 min-h-[60px]"
                          style={{ color: 'var(--landing-text-secondary)' }}
                        >
                          {t(`compare.competitors.${c.slug}.tagline`)}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#0f9b74' }}
                          >
                            {t('compare.index.scoreOurs', { n: score.oursOnly })}
                          </span>
                          {score.theirsOnly > 0 ? (
                            <span
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(245,158,11,0.14)', color: '#b06a00' }}
                            >
                              {t('compare.index.scoreTheirs', {
                                n: score.theirsOnly,
                                name: c.name,
                              })}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5"
                          style={{ color: 'var(--brand-text)' }}
                        >
                          {t('compare.index.viewComparison')}
                          <ArrowIcon />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Live tariffs from billing ────────────────────────────────── */}
        <ComparePricing initialLanguage={initialLanguage} plans={publishedPlans} />

        {/* ── Full matrix ───────────────────────────────────────────────── */}
        <section className="px-6 pb-20">
          <div className="max-w-6xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-black mb-2"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('compare.index.tableTitle')}
            </h2>
            <p className="mb-8 max-w-3xl" style={{ color: 'var(--landing-text-secondary)' }}>
              {t('compare.index.tableSubtitle')}
            </p>
            {COMPARE_SECTIONS.map((region) => (
              <div key={region} className="mb-10 last:mb-0">
                <h3
                  className="text-sm font-bold uppercase tracking-wider mb-4"
                  style={{ color: 'var(--landing-text-muted)' }}
                >
                  {t(
                    region === 'global' ? 'compare.index.globalTitle' : 'compare.index.localTitle',
                  )}
                </h3>
                <CompareTable initialLanguage={initialLanguage} region={region} />
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <div
              className="relative rounded-3xl p-10 md:p-12 text-center overflow-hidden"
              style={{
                background: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
            >
              <h2
                className="text-3xl font-black mb-4"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {t('compare.index.ctaTitle')}
              </h2>
              <p
                className="text-lg mb-8 max-w-xl mx-auto"
                style={{ color: 'var(--landing-text-secondary)' }}
              >
                {t('compare.index.ctaSubtitle')}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/register"
                  className="px-8 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                  }}
                >
                  {t('compare.index.ctaPrimary')}
                </Link>
                <Link
                  href="/contact"
                  className="px-8 py-3.5 rounded-xl font-semibold transition-all hover:opacity-80"
                  style={{
                    color: 'var(--landing-text-primary)',
                    border: '1px solid var(--landing-card-border)',
                  }}
                >
                  {t('compare.index.ctaSecondary')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer initialLanguage={initialLanguage} />
    </div>
  );
}

export function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
