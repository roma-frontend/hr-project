'use client';

import dynamic from 'next/dynamic';

// Client navbar — needs auth, theme, i18n
const Navbar = dynamic(() => import('@/components/landing/Navbar'), {
  ssr: false,
  loading: () => (
    <div className="sticky top-0 z-[100] h-16 backdrop-blur-xl" style={{ backgroundColor: 'rgba(var(--landing-navbar-bg-rgb, 15, 23, 42), 0.7)' }} />
  ),
});

export default function NavbarWrapper() {
  return <Navbar />;
}
