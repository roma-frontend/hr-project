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
import NavbarWrapper from '@/components/landing/NavbarWrapper';

export default function RootPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--landing-bg)' }}>
      <SoftwareApplicationJsonLd />
      <OrganizationJsonLd />
      <FAQPageJsonLd />

      {/* Navigation — sticky at top */}
      <NavbarWrapper />

      {/* Hero renders immediately, no JS required */}
      <HeroSection />

      {/* Below-fold sections loaded with Suspense boundaries */}
      <LandingBelowFold />
    </div>
  );
}
