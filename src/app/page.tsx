'use client';

import LandingClient from "@/components/landing/LandingClient";
import ScrollToTop from "@/components/landing/ScrollToTop";

export default function RootPage() {
  return (
    <div className="min-h-screen" style={{ maxWidth: '100vw', overflowX: 'clip' }}>
      <LandingClient />
      <ScrollToTop />
    </div>
  );
}
