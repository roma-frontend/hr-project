'use client';

import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CompareTable from './CompareTable';
import { useLandingTranslation } from '@/components/landing/useLandingTranslation';
import {
  COMPETITORS,
  COMPARE_VERIFIED,
  compareScore,
  type CompetitorSlug,
} from '@/lib/competitors';

/**
 * `/compare/<vendor>` — one honest head-to-head page per competitor.
 *
 * The structure is deliberate: their strengths come first (a page that only
 * lists wins reads as marketing and gets discounted), then where we win, then
 * the verdict that tells the reader which one they actually want. Losing rows
 * stay in the table — that is what makes the winning rows believable.
 */
export default function CompareDetailClient({
  slug,
  initialLanguage = 'en',
}: {
  slug: CompetitorSlug;
  initialLanguage?: string;
}) {
  const { t } = useLandingTranslation(initialLanguage);
  const competitor = COMPETITORS.find((c) => c.slug === slug);
  if (!competitor) return null;

  const score = compareScore(slug);
  const others = COMPETITORS.filter((c) => c.slug !== slug);

  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <Navbar />

      <main>
        <section className="relative overflow-hidden pt-32 pb-12 px-6">
          <div
            className="absolute -top-24 right-0 w-[460px] h-[460px] rounded-full pointer-events-none opacity-40"
            style={{
              background: 'radial-gradient(circle, var(--landing-orb-1) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div className="relative max-w-4xl mx-auto">
            <Link
              href="/compare"
              className="inline-flex items-center gap-1.5 text-sm font-medium mb-8"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              <BackIcon />
              {t('compare.detail.backToCompare')}
            </Link>

            <div className="flex items-center gap-3 mb-5">
              <span
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl text-sm font-bold"
                style={{ background: `${competitor.color}1f`, color: competitor.color }}
              >
                {competitor.monogram}
              </span>
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'var(--brand-quiet)', color: 'var(--brand-text)' }}
              >
                {t('compare.index.badge')}
              </span>
            </div>

            <h1
              className="text-4xl md:text-5xl font-black leading-tight tracking-tighter"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('compare.detail.heroTitle', { name: competitor.name })}
            </h1>
            <p className="mt-5 text-lg" style={{ color: 'var(--landing-text-secondary)' }}>
              {t(`compare.competitors.${slug}.tagline`)}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              {t('compare.detail.hqLabel')}: {t(`compare.competitors.${slug}.hq`)} ·{' '}
              <a
                href={competitor.site}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline"
              >
                {competitor.site.replace('https://', '')}
              </a>
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#0f9b74' }}
              >
                {t('compare.index.scoreOurs', { n: score.oursOnly })}
              </span>
              {score.theirsOnly > 0 ? (
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.14)', color: '#b06a00' }}
                >
                  {t('compare.index.scoreTheirs', {
                    n: score.theirsOnly,
                    name: competitor.name,
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Honest two-column trade-off ────────────────────────────────── */}
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              className="rounded-3xl p-7"
              style={{
                background: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
            >
              <h2
                className="text-xl font-bold mb-5"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {t('compare.detail.whereTheyWinTitle', { name: competitor.name })}
              </h2>
              <ul className="space-y-3.5">
                {[1, 2, 3].map((i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span
                      className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: competitor.color }}
                    />
                    <span style={{ color: 'var(--landing-text-secondary)' }}>
                      {t(`compare.competitors.${slug}.win${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="rounded-3xl p-7"
              style={{
                background: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
            >
              <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--brand-text)' }}>
                {t('compare.detail.whereWeWinTitle')}
              </h2>
              <ul className="space-y-3.5">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <CheckIcon />
                    <span style={{ color: 'var(--landing-text-secondary)' }}>
                      {t(`compare.competitors.${slug}.our${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Verdict ───────────────────────────────────────────────────── */}
        <section className="px-6 pb-16">
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-3xl p-8"
              style={{
                background: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
            >
              <h2
                className="text-xl font-bold mb-4"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {t('compare.detail.verdictTitle')}
              </h2>
              <p className="leading-relaxed" style={{ color: 'var(--landing-text-secondary)' }}>
                {t(`compare.competitors.${slug}.verdict`)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-7">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--landing-text-muted)' }}
                  >
                    {t('compare.detail.bestForTitle')}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--landing-text-secondary)' }}>
                    {t(`compare.competitors.${slug}.bestFor`)}
                  </p>
                </div>
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--landing-text-muted)' }}
                  >
                    {t('compare.detail.notForTitle')}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--landing-text-secondary)' }}>
                    {t(`compare.competitors.${slug}.notFor`)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Focused matrix ────────────────────────────────────────────── */}
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <h2
              className="text-2xl font-black mb-2"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('compare.detail.tableTitle', { name: competitor.name })}
            </h2>
            <p className="mb-7 text-sm" style={{ color: 'var(--landing-text-secondary)' }}>
              {t('compare.detail.tableSubtitle', {
                name: competitor.name,
                date: COMPARE_VERIFIED,
              })}
            </p>
            <CompareTable initialLanguage={initialLanguage} only={slug} />
          </div>
        </section>

        {/* ── Other comparisons ────────────────────────────────────────── */}
        <section className="px-6 pb-16">
          <div className="max-w-4xl mx-auto">
            <p
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              {t('compare.detail.otherTitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              {others.map((c) => (
                <Link
                  key={c.slug}
                  href={`/compare/${c.slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                  style={{
                    background: 'var(--landing-card-bg)',
                    border: '1px solid var(--landing-card-border)',
                    color: 'var(--landing-text-secondary)',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold"
                    style={{ background: `${c.color}1f`, color: c.color }}
                  >
                    {c.monogram}
                  </span>
                  {t('compare.detail.heroTitle', { name: c.name })}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────── */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-3xl p-10 text-center"
              style={{
                background: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
            >
              <h2
                className="text-3xl font-black mb-4"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {t('compare.detail.ctaTitle')}
              </h2>
              <p
                className="text-lg mb-8 max-w-xl mx-auto"
                style={{ color: 'var(--landing-text-secondary)' }}
              >
                {t('compare.detail.ctaSubtitle')}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/register"
                  className="px-8 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                  }}
                >
                  {t('compare.detail.ctaPrimary')}
                </Link>
                <Link
                  href="/pricing"
                  className="px-8 py-3.5 rounded-xl font-semibold transition-all hover:opacity-80"
                  style={{
                    color: 'var(--landing-text-primary)',
                    border: '1px solid var(--landing-card-border)',
                  }}
                >
                  {t('compare.detail.ctaSecondary')}
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

/* ── Inline icons ────────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#10b981"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BackIcon() {
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
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}
