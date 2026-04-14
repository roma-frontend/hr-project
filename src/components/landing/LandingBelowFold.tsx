'use client';

import dynamic from 'next/dynamic';
import LandingExtras from './LandingExtras';

// Below-fold sections - lazy loaded for performance with SSR
const TestimonialsSection = dynamic(() => import('./TestimonialsSection'), {
  loading: () => (
    <div className="h-96 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--landing-card-bg)' }} />
  ),
  ssr: true,
});

const FAQSection = dynamic(() => import('./FAQSection'), {
  loading: () => (
    <div className="h-96 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--landing-card-bg)' }} />
  ),
  ssr: true,
});

const NewsletterSection = dynamic(() => import('./NewsletterSection'), {
  loading: () => (
    <div className="h-64 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--landing-card-bg)' }} />
  ),
  ssr: true,
});

const PricingPreview = dynamic(() => import('./PricingPreview'), {
  loading: () => (
    <div className="h-96 animate-pulse rounded-3xl" style={{ backgroundColor: 'var(--landing-card-bg)' }} />
  ),
  ssr: false, // Uses Convex useQuery hook — can't SSR before ConvexProvider activates
});

const SocialProof = dynamic(() => import('./SocialProof'), {
  loading: () => (
    <div className="h-32 animate-pulse" style={{ backgroundColor: 'var(--landing-card-bg)' }} />
  ),
  ssr: true,
});

// StatsSection, FeaturesSection, CTABanner are statically imported (render synchronously)
import StatsSection from './StatsSection';
import FeaturesSection from './FeaturesSection';
import CTABanner from './CTABanner';
import Footer from './Footer';

export default function LandingBelowFold() {
  return (
    <>
      {/* Page content */}
      <main className="relative">
        <div className="section-lazy"><SocialProof /></div>
        <div className="section-lazy"><StatsSection /></div>
        <div className="section-lazy"><FeaturesSection /></div>
        <div className="section-lazy"><PricingPreview /></div>
        <section id="testimonials" className="section-lazy"><TestimonialsSection /></section>
        <div className="section-lazy"><FAQSection /></div>
        <div className="section-lazy"><NewsletterSection /></div>
        <div className="section-lazy"><CTABanner /></div>
      </main>

      <Footer />
      <LandingExtras />
    </>
  );
}
