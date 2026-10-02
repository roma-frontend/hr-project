'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useLandingTranslation } from './useLandingTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { logoutAction } from '@/actions/auth';
import { signOut } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { hardRedirect } from '@/lib/hardRedirect';
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
import { motion, AnimatePresence } from '@/lib/cssMotion';
import dynamic from 'next/dynamic';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useHydrated } from '@/hooks/useHydrated';
import { useCommandPaletteStore } from '@/store/useCommandPaletteStore';

const MobileMenu = dynamic(() => import('./MobileMenu'), {
  ssr: false,
  loading: () => null,
});

const PlatformMegaMenu = dynamic(() => import('./PeopleForceMegaMenu'), {
  ssr: false,
  loading: () => null,
});

const ResourcesMenu = dynamic(() => import('./SolutionMenus').then((m) => m.ResourcesMenu), {
  ssr: false,
  loading: () => null,
});

const SolutionsMenu = dynamic(() => import('./SolutionMenus').then((m) => m.SolutionsMenu), {
  ssr: false,
  loading: () => null,
});

const WhyMenu = dynamic(() => import('./SolutionMenus').then((m) => m.WhyMenu), {
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

export default function Navbar({
  embedded = false,
  initialLanguage = 'en',
}: {
  embedded?: boolean;
  initialLanguage?: string;
}) {
  const { t } = useLandingTranslation(initialLanguage);
  const { user, logout, beginSignOut } = useAuthStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const openPalette = useCommandPaletteStore((s) => s.openPalette);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mounted = useHydrated();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const hideAccum = useRef(0);
  const showAccum = useRef(0);
  const [dirDown, setDirDown] = useState(false);

  const pathname = usePathname();
  const sectionIds = useMemo(
    () => (pathname === '/' ? ['home', 'pricing', 'testimonials', 'faq'] : []),
    [pathname],
  );

  const activeSection = useActiveSection(sectionIds);

  // scroll lock is handled per-menu via useScrollLock (reference counted)
  // in PeopleForceMegaMenu + SolutionMenus — no central lock here

  const navRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement | Window | null>(null);
  const lastY = useRef(0);

  useEffect(() => {
    if (!embedded) return;
    let el: HTMLElement | null = navRef.current?.parentElement ?? null;
    while (el) {
      const s = getComputedStyle(el);
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
        scrollContainerRef.current = el;
        return;
      }
      el = el.parentElement;
    }
    scrollContainerRef.current = window;
  }, [embedded]);

  useEffect(() => {
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
        const container = embedded ? (scrollContainerRef.current ?? window) : window;
        const top = container === window ? window.scrollY : (container as HTMLElement).scrollTop;
        setScrolled(top > 18);
        const max =
          container === window
            ? document.documentElement.scrollHeight - window.innerHeight
            : (container as HTMLElement).scrollHeight - (container as HTMLElement).clientHeight;
        setScrollProgress(max > 0 ? Math.min(100, (top / max) * 100) : 0);
        // dirDown gates the compact "island" — it flips to true at the very first
        // downward pixel so the island can't flash and then hide.
        // hidden uses accumulators (hysteresis) so it needs ~40px sustained down.
        const megaOpen = document.body.style.overflow === 'hidden';
        if (!embedded && window.innerWidth >= 1024 && !megaOpen) {
          const delta = top - lastY.current;
          if (Math.abs(delta) < 1) {
            // hold
          } else if (delta > 0) {
            setDirDown(true);
            showAccum.current = 0;
            if (top > 120 && Math.abs(delta) >= 2) {
              hideAccum.current += delta;
              if (hideAccum.current > 40) {
                hideAccum.current = 0;
                setHidden(true);
              }
            }
          } else {
            hideAccum.current = 0;
            showAccum.current += Math.abs(delta);
            if (showAccum.current > 16) {
              showAccum.current = 0;
              setHidden(false);
              setDirDown(false);
            }
          }
        } else if (top <= 8) {
          hideAccum.current = 0;
          showAccum.current = 0;
          setHidden(false);
          setDirDown(false);
        }
        lastY.current = top;
        ticking = false;
      });
    };
    const container = embedded ? (scrollContainerRef.current ?? window) : window;
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [embedded]);

  const handleLogout = async () => {
    beginSignOut();
    try {
      document.cookie = 'hr-auth-token=; path=/; max-age=0';
      await logoutAction();
      await signOut({ redirect: false });
    } catch (error) {
      logger.error('Logout error:', error);
    } finally {
      logout();
      hardRedirect('/api/clear-session?redirect=/');
    }
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

  // Island (compact pill) only on scroll-UP or when still near the top.
  // On scroll-DOWN we never morph to island — we stay full-bleed and just
  // translate the whole nav away. Requirement: "not appear after disappearance,
  // only on reverse scroll" — so dirDown gates the island.
  const isIsland = !embedded && scrolled && !hidden && !dirDown;

  return (
    <>
      <nav
        ref={navRef}
        className={`${embedded ? 'sticky top-0 z-10' : 'fixed left-0 right-0 z-[100]'} ${hidden ? '-translate-y-[calc(100%+14px)]' : 'translate-y-0'} ${embedded ? 'px-0 py-0' : isIsland ? 'px-4 md:px-6 py-3 md:py-4' : 'px-0 py-0'}`}
        style={{
          willChange: 'transform',
          // symmetric premium spring — same curve both ways, no snap on either edge
          transition: 'transform 620ms cubic-bezier(0.32,0.72,0,1)',
          pointerEvents: hidden ? 'none' : 'auto',
        }}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={hidden ? true : undefined}
      >
        <div
          className={`relative mx-auto flex items-center justify-between gap-3 ${embedded ? 'max-w-none rounded-none' : isIsland ? 'max-w-[1140px] rounded-[20px]' : 'max-w-none rounded-none'}`}
          style={{
            padding: isIsland ? '10px 14px' : embedded ? '12px 16px' : '14px 20px',
            overflow: 'visible' as const,
            ...(hidden
              ? ({
                  transition: 'none' as const,
                } as const)
              : ({
                  transition:
                    'padding 520ms cubic-bezier(0.22,1,0.36,1), background-color 360ms ease, backdrop-filter 360ms ease, border-radius 420ms cubic-bezier(0.22,1,0.36,1), max-width 520ms cubic-bezier(0.22,1,0.36,1)',
                } as const)),
            // Keep clip inside the card so the progress hairline respects the
            // pill rounding — but use background-clip/border rounding, NOT
            // overflow:hidden on the card itself (that would clip the hover
            // mega-menus on laptops where they are wide).
            ...(isIsland
              ? {
                  background: 'var(--glass-surface-strong)',
                  border: '1px solid var(--border-default)',
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                }
              : embedded
                ? {
                    background: 'rgba(var(--landing-navbar-bg-rgb, 255,255,255), 0.82)',
                    borderBottom: '1px solid var(--landing-card-border)',
                    backdropFilter: 'blur(16px) saturate(130%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(130%)',
                  }
                : {
                    background: scrolled
                      ? 'rgba(var(--landing-navbar-bg-rgb, 255,255,255), 0.72)'
                      : 'rgba(255,255,255,0.0)',
                    borderBottom: scrolled
                      ? '1px solid var(--landing-card-border)'
                      : '1px solid transparent',
                    backdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'blur(0px)',
                    WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'blur(0px)',
                  }),
          }}
        >
          {isIsland && (
            <div
              className="pointer-events-none absolute inset-x-[1px] top-[1px] h-[1px] rounded-t-[20px] opacity-60"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
              }}
              aria-hidden="true"
            />
          )}

          {/* progress hairline — clipped to the CARD, not the viewport.
              Card must stay overflow:visible for fixed mega-panels, so we
              can't use overflow:hidden on the card. Instead the track itself
              is inset + rounded to the pill so the fill never leaks outside
              even on full-bleed it stays flush to the bottom edge. */}
          <div
            className="pointer-events-none absolute h-[2px] overflow-hidden"
            style={{
              left: isIsland ? '1px' : 0,
              right: isIsland ? '1px' : 0,
              bottom: isIsland ? '1px' : 0,
              borderBottomLeftRadius: isIsland ? 20 : 0,
              borderBottomRightRadius: isIsland ? 20 : 0,
              opacity: scrolled ? 1 : 0,
              zIndex: 2,
            }}
            aria-hidden="true"
          >
            <div
              className="h-full"
              style={{
                width: `${scrollProgress}%`,
                background:
                  'linear-gradient(90deg, var(--brand), var(--brand-hover), var(--violet-500))',
                boxShadow: '0 0 10px rgba(44,140,213,0.45)',
                transition: 'width 0.12s linear',
                borderRadius: isIsland ? 999 : 0,
              }}
            />
          </div>

          <Link
            href="/"
            className="relative flex items-center gap-3 group shrink-0"
            title={t('landingExtra.logoTooltip')}
          >
            <div
              className="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-[1.04] group-hover:rotate-[-2deg]"
              style={{
                background:
                  'linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 55%, #5aaef0 100%)',
                boxShadow:
                  '0 6px 18px rgba(44,140,213,0.28), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.08)',
              }}
              aria-hidden="true"
            >
              <div className="absolute inset-[1px] rounded-[12px] bg-white/10 pointer-events-none" />
              <ShieldIcon />
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white shadow-sm animate-pulse"
                aria-hidden="true"
              />
            </div>
            <span className="hidden sm:flex flex-col leading-none">
              <span
                className="font-bold text-[17px] tracking-tight"
                style={{ color: isIsland ? 'var(--text-primary)' : 'var(--landing-text-primary)' }}
              >
                Strata
              </span>
              <span
                className="text-[10px] font-semibold tracking-[0.14em] uppercase -mt-0.5"
                style={{ color: 'var(--text-muted)', opacity: 0.75 }}
              >
                HR OS
              </span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1 xl:gap-1">
            {mounted && (
              <span className="flex items-center gap-1">
                <span className="contents">
                  <PlatformMegaMenu />
                </span>
                <span className="contents">
                  <SolutionsMenu />
                </span>
                <span className="contents">
                  <WhyMenu />
                </span>
                <span className="contents">
                  <ResourcesMenu activeSection={activeSection} />
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {/* command palette — opens overlay, not a page (landing has no /dashboard search) */}
            <button
              type="button"
              onClick={() => {
                // Dashboard shell mounts CommandPalette; landing does not — but the
                // store still toggles the open state, so navigating to dashboard
                // will show it already open. Try the store first.
                try {
                  openPalette();
                } catch {}
                // If we are still on the landing (no palette mounted), go where
                // search actually works — dashboard will open with palette open.
                if (pathname !== '/dashboard' && !pathname.startsWith('/dashboard/')) {
                  // Small delay so the store flag survives the navigation.
                  setTimeout(() => {
                    if (!document.querySelector('.command-panel')) router.push('/dashboard');
                  }, 80);
                }
              }}
              className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-colors"
              title="Search — ⌘K"
              aria-label="Open command palette"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span className="hidden 2xl:inline">Search</span>
              <kbd className="ml-1 hidden 2xl:inline-flex items-center gap-0.5 rounded border border-[var(--border-default)] bg-[var(--surface-2)] px-1 py-0.5 text-[10px] leading-none">
                ⌘K
              </kbd>
            </button>

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
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all hover:scale-[1.06] active:scale-[0.97] shrink-0"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
                aria-label={
                  theme === 'dark'
                    ? t('landingExtra.switchToLight')
                    : t('landingExtra.switchToDark')
                }
              >
                <span className="relative w-[18px] h-[18px] flex items-center justify-center">
                  {theme === 'dark' ? (
                    <svg
                      width="16"
                      height="16"
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
                      width="16"
                      height="16"
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
                </span>
              </button>
            )}

            {mounted && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 md:pl-1.5 md:pr-3 md:py-1.5 transition-all outline-none hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-default)]">
                    <Avatar className="w-8 h-8 md:w-8 md:h-8 ring-2 ring-white shadow-sm">
                      {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                      <AvatarFallback className="text-xs bg-gradient-to-br from-[var(--brand)] to-[#5aaef0] text-white font-semibold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className="hidden md:block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                      aria-hidden="true"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} asChild>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -8 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="z-[9999] w-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-2xl"
                  >
                    <DropdownMenuLabel className="px-3 py-2.5 text-[var(--text-primary)] font-semibold text-sm">
                      {t('landingExtra.myAccount')}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[var(--border)]/60 my-1" />
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18, delay: 0.04, ease: 'easeOut' }}
                      >
                        <DropdownMenuItem
                          className="text-[var(--text-primary)] cursor-pointer rounded-xl px-3 py-2.5 gap-3 transition-colors hover:bg-[var(--surface-2)] focus:bg-[var(--surface-2)]"
                          onClick={() => router.push('/dashboard')}
                        >
                          <span className="w-8 h-8 rounded-lg bg-[var(--brand-quiet)] text-[var(--brand-text)] flex items-center justify-center">
                            <svg
                              width="16"
                              height="16"
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
                          </span>
                          <span className="font-medium">{t('nav.dashboard')}</span>
                        </DropdownMenuItem>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18, delay: 0.08, ease: 'easeOut' }}
                      >
                        <DropdownMenuItem
                          className="text-[var(--text-primary)] cursor-pointer rounded-xl px-3 py-2.5 gap-3 hover:bg-[var(--surface-2)] focus:bg-[var(--surface-2)]"
                          onClick={() => router.push('/settings')}
                        >
                          <span className="w-8 h-8 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] flex items-center justify-center">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="3" />
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                          </span>
                          <span className="font-medium">{t('nav.settings')}</span>
                        </DropdownMenuItem>
                      </motion.div>
                    </AnimatePresence>
                    <DropdownMenuSeparator className="bg-[var(--border)]/60 my-1" />
                    {!isDesktop && (
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <DropdownMenuItem
                            className="text-[var(--text-primary)] cursor-pointer rounded-xl px-3 py-2.5 gap-3 hover:bg-[var(--surface-2)]"
                            onClick={() => router.push('/features')}
                          >
                            <span className="font-medium">{t('landing.features')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-[var(--text-primary)] cursor-pointer rounded-xl px-3 py-2.5 gap-3 hover:bg-[var(--surface-2)]"
                            onClick={() => router.push(pathname === '/' ? '/#pricing' : '/pricing')}
                          >
                            <span className="font-medium">{t('landing.pricing')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-[var(--text-primary)] cursor-pointer rounded-xl px-3 py-2.5 gap-3 hover:bg-[var(--surface-2)]"
                            onClick={() => router.push('/compare')}
                          >
                            <span className="font-medium">{t('landingExtra.compare')}</span>
                          </DropdownMenuItem>
                        </motion.div>
                      </AnimatePresence>
                    )}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, delay: 0.12 }}
                    >
                      <DropdownMenuItem
                        className="text-[var(--danger-text)] cursor-pointer rounded-xl px-3 py-2.5 gap-3 hover:bg-[var(--danger-quiet)] focus:bg-[var(--danger-quiet)]"
                        onClick={handleLogout}
                      >
                        <span className="font-medium">{t('landingExtra.logOut')}</span>
                      </DropdownMenuItem>
                    </motion.div>
                  </motion.div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden lg:inline-flex items-center text-sm font-medium px-3.5 py-2 rounded-full transition-all hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-default)]"
                  style={{
                    color: isIsland ? 'var(--text-secondary)' : 'var(--landing-navbar-text)',
                  }}
                >
                  {mounted ? t('landingExtra.signIn') : 'Sign In'}
                </Link>
                <Link
                  href="/register"
                  className="hidden lg:inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:shadow-[rgba(44,140,213,0.22)] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
                    color: 'white',
                    boxShadow:
                      '0 6px 16px rgba(44,140,213,0.28), inset 0 1px 0 rgba(255,255,255,0.35)',
                  }}
                >
                  {mounted ? t('landingExtra.getStarted') : 'Get Started'}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--surface-2)] border border-[var(--border-default)] bg-[var(--surface-1)]"
                  aria-label="Open mobile menu"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          activeSection={activeSection}
        />
      )}
    </>
  );
}
