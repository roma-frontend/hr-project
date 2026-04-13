// Server Component — SSR renders the full landing page instantly.
// HeroSection is now a Server Component (renders without JS).
// Client islands handle interactivity (auth, theme, animations).

import {
  SoftwareApplicationJsonLd,
  OrganizationJsonLd,
  FAQPageJsonLd,
} from '@/components/seo/JsonLd';
import HeroSection from '@/components/landing/HeroSection';
import LandingBelowFold from '@/components/landing/LandingBelowFold';

export default function RootPage() {
  return (
    <main id="main-content" className="min-h-screen" style={{ maxWidth: '100vw', overflowX: 'clip' }}>
      <SoftwareApplicationJsonLd />
      <OrganizationJsonLd />
      <FAQPageJsonLd />

      {/* Hero renders immediately, no JS required */}
      <HeroSection />
      
      {/* Below-fold sections loaded with Suspense boundaries */}
      <LandingBelowFold />
    </main>
  );
}
