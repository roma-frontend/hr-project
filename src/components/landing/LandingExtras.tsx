'use client';

import dynamic from 'next/dynamic';

// These components use window/document APIs, so they must be client-only
const ScrollToTop = dynamic(() => import('./ScrollToTop'), {
  ssr: false,
  loading: () => null,
});

const CookieBanner = dynamic(() => import('@/components/CookieBanner'), {
  ssr: false,
  loading: () => null,
});

export default function LandingClientExtras() {
  return (
    <>
      <ScrollToTop />
      <CookieBanner />
    </>
  );
}
