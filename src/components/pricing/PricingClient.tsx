'use client';

import '@/i18n/config';
import { useLandingTranslation } from '@/components/landing/useLandingTranslation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import PricingPreview from '@/components/landing/PricingPreview';
import FAQSection from '@/components/landing/FAQSection';

/**
 * /pricing — a real page instead of an anchor on the landing. Reuses the exact
 * pricing cards + savings calculator from the landing (single source of truth),
 * then adds the FAQ block and a final CTA so deep links and SEO traffic land on
 * a complete conversion page.
 */
export default function PricingClient({ initialLanguage = 'en' }: { initialLanguage?: string }) {
  // Server-render in the visitor's language (the landing namespaces are bundled
  // for every locale), so the first paint is translated and hydration matches:
  // with the live `t` alone the server emitted English and React reported a
  // text mismatch on every non-English visit.
  const { t } = useLandingTranslation(initialLanguage);

  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <Navbar initialLanguage={initialLanguage} />
      {/* The pricing section below carries `py-12 md:py-24` of its own, which is
          enough on desktop but only 48px on mobile — less than the fixed
          navbar, so the eyebrow slid under it. `pt-10 md:pt-0` tops mobile up
          without double-padding desktop. */}
      <main className="pt-10 md:pt-0">
        {/* The pricing section itself — same component as the landing anchor. */}
        <PricingPreview initialLanguage={initialLanguage} />
        {/* FAQ */}
        <FAQSection initialLanguage={initialLanguage} />
        {/* Final CTA */}
        <section className="relative px-6 md:px-12 py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -bottom-40 left-1/3 w-[560px] h-[560px] rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--landing-orb-1) 0%, transparent 70%)',
                filter: 'blur(80px)',
              }}
            />
          </div>
          <div className="relative max-w-3xl mx-auto text-center">
            <h2
              className="text-3xl md:text-5xl font-black leading-tight tracking-tighter"
              style={{ color: 'var(--landing-text-primary)' }}
            >
              {t('pricing.pageCtaTitle')}
            </h2>
            <p
              className="mt-4 text-lg"
              style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
            >
              {t('pricing.pageCtaSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href="/register"
                className="px-8 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))' }}
              >
                {t('pricing.pageCtaPrimary')}
              </a>
              <a
                href="/contact"
                className="px-8 py-3.5 rounded-xl font-semibold transition-all hover:opacity-80"
                style={{
                  color: 'var(--landing-text-primary)',
                  border: '1px solid var(--landing-card-border)',
                }}
              >
                {t('pricing.pageCtaSecondary')}
              </a>
            </div>
            <p className="mt-6 text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              {t('pricing.pageCtaNote')}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
