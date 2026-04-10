'use client';

import { LoadingProvider } from '@/components/ui/LoadingProvider';
import LandingClient from '@/components/landing/LandingClient';
import ScrollToTop from '@/components/landing/ScrollToTop';
import CookieBanner from '@/components/CookieBanner';
import {
  SoftwareApplicationJsonLd,
  OrganizationJsonLd,
  FAQPageJsonLd,
} from '@/components/seo/JsonLd';

export default function RootPage() {
  return (
    <LoadingProvider cookieBanner={<CookieBanner />}>
      <div className="min-h-screen" style={{ maxWidth: '100vw', overflowX: 'clip' }}>
        {/* JSON-LD Structured Data for SEO */}
        <SoftwareApplicationJsonLd />
        <OrganizationJsonLd />
        <FAQPageJsonLd />

        <LandingClient />
        <ScrollToTop />
      </div>
    </LoadingProvider>
  );
}
