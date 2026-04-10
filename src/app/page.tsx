// Server Component — HTML skeleton streams immediately.
// Client components are automatically split into separate chunks by Next.js.

import dynamic from 'next/dynamic';
import { LoadingProvider } from '@/components/ui/LoadingProvider';
import {
  SoftwareApplicationJsonLd,
  OrganizationJsonLd,
  FAQPageJsonLd,
} from '@/components/seo/JsonLd';

// Separate chunk for LandingClient. While downloading, show a hero-like skeleton.
const LandingClient = dynamic(() => import('@/components/landing/LandingClient'), {
  loading: () => (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--landing-bg)' }}
    >
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl" style={{ background: 'var(--primary)', opacity: 0.3 }} />
        <div className="h-8 w-64 rounded-lg" style={{ background: 'var(--border)' }} />
        <div className="h-4 w-48 rounded" style={{ background: 'var(--border)' }} />
        <div className="flex gap-4 mt-4">
          <div className="h-12 w-40 rounded-xl" style={{ background: 'var(--primary)', opacity: 0.2 }} />
          <div className="h-12 w-40 rounded-xl" style={{ background: 'var(--border)' }} />
        </div>
      </div>
    </div>
  ),
});

// Separate chunks for minor client components (no ssr: false in Server Components)
const ScrollToTop = dynamic(() => import('@/components/landing/ScrollToTop'));
const CookieBanner = dynamic(() => import('@/components/CookieBanner'));

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
