'use client';

import dynamic from 'next/dynamic';
import Navbar from './Navbar';
import FloatingParticlesClient from './FloatingParticlesClient';
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

// Pure CSS gradient orbs - no JS needed
function GradientOrbs() {
  return (
    <>
      <div
        className="fixed top-[-10%] left-[-5%] w-[700px] h-[700px] rounded-full pointer-events-none orb-pulse-1"
        style={{
          background: 'radial-gradient(circle, var(--landing-orb-1) 0%, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          willChange: 'transform',
        }}
      />
      <div
        className="fixed top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none orb-pulse-2"
        style={{
          background: 'radial-gradient(circle, var(--landing-orb-2) 0%, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          willChange: 'transform',
        }}
      />
      <div
        className="fixed bottom-[10%] left-[20%] w-[500px] h-[500px] rounded-full pointer-events-none orb-pulse-3"
        style={{
          background: 'radial-gradient(circle, var(--landing-orb-3) 0%, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
          willChange: 'transform',
        }}
      />
    </>
  );
}

export default function LandingBelowFold() {
  return (
    <>
      {/* Background layers */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <GradientOrbs />
        <FloatingParticlesClient />
      </div>

      {/* Navigation */}
      <Navbar />

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
