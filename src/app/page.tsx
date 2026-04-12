// Server Component — SSR renders the full landing page instantly.
// Client islands handle interactivity (auth, theme, animations).

import {
  SoftwareApplicationJsonLd,
  OrganizationJsonLd,
  FAQPageJsonLd,
} from '@/components/seo/JsonLd';
import LandingClient from '@/components/landing/LandingClient';

export default function RootPage() {
  return (
    <main id="main-content" className="min-h-screen" style={{ maxWidth: '100vw', overflowX: 'clip' }}>
      <SoftwareApplicationJsonLd />
      <OrganizationJsonLd />
      <FAQPageJsonLd />

      <LandingClient />
    </main>
  );
}
