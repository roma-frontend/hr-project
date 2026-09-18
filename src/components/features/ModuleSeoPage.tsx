'use client';

import { useLandingTranslation } from '@/components/landing/useLandingTranslation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import '@/i18n/config';

/**
 * Per-module SEO page — the /features/leave-types pattern generalised.
 *
 * Each module gets a real route with SSR metadata (see the page files) and this
 * client shell renders the content: hero badge + title, three proof stats, a
 * benefits grid, and a final CTA. Everything is translated through
 * `featuresPage.modules.<module>.*` so a new module page is one route + its
 * i18n block — no component changes.
 */
interface ModuleSeoPageProps {
  module: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  /** Server-detected locale, so this page SSRs translated (see PricingClient). */
  initialLanguage?: string;
}

export default function ModuleSeoPage({
  module,
  icon,
  color,
  gradient,
  initialLanguage = 'en',
}: ModuleSeoPageProps) {
  const { t, i18n } = useLandingTranslation(initialLanguage);
  const { user } = useAuthStore();

  const m = `featuresPage.modules.${module}`;

  // The module blocks in landing.json carry `title`, `description` and
  // `feature1..4`. The richer slots below (eyebrow, stat1..3, descTitle,
  // benefit1..4) are optional: when they are absent the section is omitted /
  // falls back to the basic copy. Rendering them unconditionally is what put
  // raw keys like `featuresPage.modules.attendance.eyebrow` on a live page — in
  // every language, since the keys existed in none of them.
  const has = (key: string) => i18n.exists(`${m}.${key}`);
  const featureLabel = (i: 1 | 2 | 3 | 4) =>
    t(`${m}.benefit${i}`, { defaultValue: t(`${m}.feature${i}`, { defaultValue: '' }) });
  const features = ([1, 2, 3, 4] as const)
    .map((i) => featureLabel(i))
    .filter((text) => text.length > 0);
  const stats = ([1, 2, 3] as const)
    .filter((i) => has(`stat${i}Value`))
    .map((i) => ({ value: t(`${m}.stat${i}Value`), label: t(`${m}.stat${i}`) }));

  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <Navbar initialLanguage={initialLanguage} />
      <main className="flex flex-col items-center max-w-6xl mx-auto px-3 md:px-12 pt-20 md:pt-28 pb-12">
        <Link
          href="/features"
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--landing-text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('features.backToHome')}
        </Link>

        {/* Hero */}
        <div className="text-center my-12">
          <span
            className="inline-block text-xs font-semibold px-4 py-1.5 rounded-full mb-4"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
          >
            <span className="inline-flex items-center justify-center w-4 h-4 align-middle mr-1">
              {icon}
            </span>
            {t(`${m}.eyebrow`, { defaultValue: t(`${m}.title`) })}
          </span>
          <h1
            className="text-4xl md:text-5xl font-black mb-4"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            {t(`${m}.title`)}
          </h1>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--landing-text-secondary)' }}
          >
            {t(`${m}.subtitle`, { defaultValue: t(`${m}.description`) })}
          </p>
        </div>

        {/* Stats — hidden while a module has no numbers to quote. */}
        {stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-12">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 text-center"
                style={{
                  background: 'var(--landing-card-bg)',
                  border: '1px solid var(--landing-card-border)',
                }}
              >
                <div className="text-2xl font-bold mb-1" style={{ color }}>
                  {stat.value}
                </div>
                <div className="text-sm" style={{ color: 'var(--landing-text-muted)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Description + benefits */}
        <div className="w-full rounded-3xl p-8 md:p-10 mb-4" style={{ background: gradient }}>
          {has('descTitle') && (
            <h2
              className="text-2xl md:text-3xl font-bold mb-3"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t(`${m}.descTitle`)}
            </h2>
          )}
          {/* When the hero already used the description (no `subtitle` slot),
              showing it twice reads like a bug — so it is printed once. */}
          {has('subtitle') && (
            <p
              className="text-lg leading-relaxed mb-8"
              style={{ color: 'var(--landing-text-secondary)' }}
            >
              {t(`${m}.description`)}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((text, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: 'var(--landing-card-bg)',
                  border: '1px solid var(--landing-card-border)',
                }}
              >
                <CheckCircle className="w-5 h-5 shrink-0" style={{ color }} />
                <span style={{ color: 'var(--landing-text-secondary)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {!user && (
          <div
            className="w-full mt-12 p-8 rounded-3xl text-center"
            style={{
              background: 'var(--landing-card-bg)',
              border: '1px solid var(--landing-card-border)',
            }}
          >
            <h3
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('features.readyToStart')}
            </h3>
            <p className="mb-6" style={{ color: 'var(--landing-text-secondary)' }}>
              {t('features.tryFree')}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 btn-gradient"
              >
                {t('features.getStarted')}
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-70"
                style={{
                  border: '1px solid var(--landing-card-border)',
                  color: 'var(--landing-text-primary)',
                }}
              >
                {t('features.login')}
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
