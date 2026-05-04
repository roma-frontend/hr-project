'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/ThemeProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { logoutAction } from '@/actions/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter, usePathname } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import dynamic from 'next/dynamic';

const MobileMenu = dynamic(() => import('./MobileMenu'), {
  ssr: false,
  loading: () => null,
});

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 20);
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logoutAction();
    logout();
    router.push('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <nav
        className={`sticky top-0 z-[100] flex items-center justify-between px-4 md:px-8 lg:px-12 transition-all duration-500 ease-in-out border-b ${
          scrolled ? 'py-2 md:py-3 shadow-lg' : 'py-3 md:py-4'
        }`}
        role="navigation"
        aria-label="Main navigation"
        style={{
          borderColor: 'var(--landing-card-border)',
          willChange: 'padding, box-shadow, background-color',
          transitionProperty: 'padding, box-shadow, background-color, backdrop-filter',
        }}
      >
        <div
          className="absolute inset-0 backdrop-blur-xl border-b transition-all duration-500 ease-in-out"
          style={{
            background: scrolled
              ? 'rgba(var(--landing-navbar-bg-rgb, 15, 23, 42), 0.98)'
              : 'rgba(var(--landing-navbar-bg-rgb, 15, 23, 42), 0.7)',
            borderColor: 'var(--landing-card-border)',
            transition:
              'box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease-in-out, backdrop-filter 0.5s ease',
            backdropFilter: scrolled ? 'blur(24px) saturate(180%)' : 'blur(16px) saturate(140%)',
            WebkitBackdropFilter: scrolled
              ? 'blur(24px) saturate(180%)'
              : 'blur(16px) saturate(140%)',
            boxShadow: scrolled
              ? '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)'
              : '0 0 0 0 rgba(0, 0, 0, 0)',
          }}
        />

        <Link href="/" className="relative flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center logo-spin"
            style={{ background: 'linear-gradient(135deg, #2563eb, #93c5fd)' }}
            aria-hidden="true"
          >
            <ShieldIcon />
          </div>
          <span
            className="font-bold text-lg tracking-tight transition-colors"
            style={{ color: 'var(--landing-text-primary)' }}
          >
            HR<span style={{ color: 'var(--primary)' }}>Office</span>
          </span>
        </Link>

        <div className="relative hidden lg:flex items-center gap-6 xl:gap-8">
          {mounted &&
            [
              { name: t('landing.features'), href: '/features' },
              { name: t('landing.pricing'), href: '#pricing' },
              { name: t('landing.testimonials'), href: '#testimonials' },
              { name: t('landing.faq'), href: '#faq' },
              { name: t('nav.recruitment', 'Careers'), href: '/careers' },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href.startsWith('#') && pathname !== '/' ? `/${item.href}` : item.href}
                className="text-sm transition-colors duration-200 font-medium focus:outline-none focus:underline underline-offset-4"
                style={{ color: 'var(--landing-navbar-text)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--landing-navbar-text-hover)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--landing-navbar-text)')}
                aria-label={`Navigate to ${item.name}`}
              >
                {item.name}
              </a>
            ))}
        </div>

        <div className="relative flex items-center gap-2 md:gap-3">
          {mounted && (
            <span
              style={{ color: 'var(--landing-text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--landing-text-primary)';
              }}
            >
              <LanguageSwitcher />
            </span>
          )}

          {mounted && (
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: 'var(--landing-card-bg)',
                border: '1px solid var(--landing-card-border)',
              }}
              aria-label={
                theme === 'dark' ? t('landingExtra.switchToLight') : t('landingExtra.switchToDark')
              }
            >
              {theme === 'dark' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 md:px-3 md:py-2 transition-all outline-none focus-visible:outline-none focus:outline-none hover:bg-(--background-subtle)">
                  <Avatar className="w-7 h-7 md:w-8 md:h-8">
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                    <AvatarFallback className="text-xs bg-linear-to-br from-blue-500 to-blue-600 text-white font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left max-w-[100px] md:max-w-none">
                    <p className="text-xs font-semibold text-(--text-primary) leading-tight truncate">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-(--text-muted) capitalize hidden md:block">
                      {user.role}
                    </p>
                  </div>
                  <svg
                    className="w-3 h-3 text-(--text-muted) shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-64 rounded-2xl bg-(--card) border border-(--border)/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl max-h-[80vh] overflow-y-auto p-2"
              >
                <DropdownMenuLabel className="px-3 py-2.5 text-(--text-primary) font-semibold text-sm">
                  {t('landingExtra.myAccount')}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-(--border)/50 my-1" />
                <DropdownMenuItem
                  className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                  onClick={() => router.push('/dashboard')}
                >
                  <svg
                    className="w-5 h-5 text-(--text-muted)"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span className="font-medium">{t('nav.dashboard')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                  onClick={() => router.push('/settings')}
                >
                  <svg
                    className="w-5 h-5 text-(--text-muted)"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span className="font-medium">{t('nav.settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-(--border)/50 my-1" />
                {/* Show landing page links only when main navbar is hidden (screen < lg) */}
                {!isDesktop && (
                  <>
                    <DropdownMenuItem
                      className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                      onClick={() => router.push('/features')}
                    >
                      <svg
                        className="w-5 h-5 text-(--text-muted)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span className="font-medium">{t('landing.features')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                      onClick={() => router.push('/#pricing')}
                    >
                      <svg
                        className="w-5 h-5 text-(--text-muted)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                      <span className="font-medium">{t('landing.pricing')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                      onClick={() => router.push('/#testimonials')}
                    >
                      <svg
                        className="w-5 h-5 text-(--text-muted)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span className="font-medium">{t('landing.testimonials')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                      onClick={() => router.push('/#faq')}
                    >
                      <svg
                        className="w-5 h-5 text-(--text-muted)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span className="font-medium">{t('landing.faq')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-(--text-primary) cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-(--background-subtle) focus:bg-(--background-subtle) focus:text-(--text-primary)"
                      onClick={() => router.push('/careers')}
                    >
                      <svg
                        className="w-5 h-5 text-(--text-muted)"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span className="font-medium">{t('nav.recruitment', 'Careers')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-(--border)/50 my-1" />
                  </>
                )}
                <DropdownMenuItem
                  className="text-red-500 cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-all duration-200 hover:bg-red-500/10 focus:bg-red-500/10 hover:text-red-600 focus:text-red-600 dark:hover:text-red-400 dark:focus:text-red-400"
                  onClick={handleLogout}
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="font-medium">{t('landingExtra.logOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden lg:inline-flex text-sm transition-colors font-medium px-3 lg:px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ color: 'var(--landing-navbar-text)', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--landing-navbar-text-hover)';
                  e.currentTarget.style.backgroundColor = 'var(--landing-card-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--landing-navbar-text)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {t('landingExtra.signIn')}
              </Link>
              <Link
                href="/register"
                className="hidden lg:inline-flex items-center gap-2 text-sm font-semibold px-4 lg:px-5 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #93c5fd)',
                  color: 'var(--primary-foreground)',
                }}
              >
                {t('landingExtra.getStarted')}
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{
                  backgroundColor: 'var(--landing-card-bg)',
                  border: '1px solid var(--landing-card-border)',
                }}
                aria-label="Open mobile menu"
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: 'var(--landing-text-primary)' }}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </nav>

      {isMobileMenuOpen && (
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      )}
    </>
  );
}
