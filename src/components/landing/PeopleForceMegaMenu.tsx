'use client';

/**
 * PeopleForce-style mega-menu for the landing page navbar.
 *
 * Layout:
 *  - Left column: category items with colored icons
 *  - Center column: sub-items for the hovered category
 *  - Right column: promotional content
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStoreShallow } from '@/store/useAuthStore';
import {
  Users,
  ClipboardList,
  Target,
  Briefcase,
  Wallet,
  BarChart3,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { DashboardScreen, AnalyticsScreen, ChatScreen, CalendarScreen } from './HeroDemo';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface MegaMenuItem {
  key: string;
  appHref: string;
}

interface MegaMenuCategory {
  key: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  items: MegaMenuItem[];
  featured?: { href: string };
  screen?: 'dashboard' | 'analytics' | 'chat' | 'calendar';
}

/* ── Categories ──────────────────────────────────────────────────────────── */

const CATEGORIES: MegaMenuCategory[] = [
  {
    key: 'people',
    icon: <Users className="w-5 h-5" />,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    items: [
      { key: 'directory', appHref: '/employees' },
      { key: 'orgchart', appHref: '/org-chart' },
      { key: 'documents', appHref: '/documents' },
      { key: 'esign', appHref: '/signatures' },
    ],
    featured: { href: '/employees' },
    screen: 'dashboard',
  },
  {
    key: 'ops',
    icon: <ClipboardList className="w-5 h-5" />,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    items: [
      { key: 'leave', appHref: '/leaves' },
      { key: 'attendance', appHref: '/attendance' },
      { key: 'tasks', appHref: '/tasks' },
      { key: 'calendar', appHref: '/calendar' },
      { key: 'rooms', appHref: '/rooms' },
    ],
    featured: { href: '/leaves' },
    screen: 'calendar',
  },
  {
    key: 'strategy',
    icon: <Target className="w-5 h-5" />,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    items: [
      { key: 'okr', appHref: '/goals' },
      { key: 'strategyMaps', appHref: '/strategy' },
      { key: 'performance', appHref: '/performance' },
      { key: 'recognition', appHref: '/recognition' },
    ],
    featured: { href: '/goals' },
    screen: 'analytics',
  },
  {
    key: 'talent',
    icon: <Briefcase className="w-5 h-5" />,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    items: [
      { key: 'ats', appHref: '/recruitment' },
      { key: 'onboarding', appHref: '/onboarding' },
      { key: 'learning', appHref: '/learning' },
      { key: 'surveys', appHref: '/surveys' },
    ],
    featured: { href: '/recruitment' },
    screen: 'chat',
  },
  {
    key: 'finance',
    icon: <Wallet className="w-5 h-5" />,
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.1)',
    items: [
      { key: 'payroll', appHref: '/payroll' },
      { key: 'compensation', appHref: '/compensation' },
      { key: 'expenses', appHref: '/expenses' },
    ],
    featured: { href: '/payroll' },
    screen: 'dashboard',
  },
  {
    key: 'insights',
    icon: <BarChart3 className="w-5 h-5" />,
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    items: [
      { key: 'reports', appHref: '/reports' },
      { key: 'analytics', appHref: '/analytics' },
      { key: 'compliance', appHref: '/compliance' },
      { key: 'automation', appHref: '/superadmin/automation' },
    ],
    featured: { href: '/analytics' },
    screen: 'analytics',
  },
];

/* ── Shared hover-menu behaviour ─────────────────────────────────────────── */

const CLOSE_DELAY_MS = 180;

function useHoverMenu() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  useEffect(() => cancelClose, [cancelClose]);

  return { open, setOpen, rootRef, cancelClose, scheduleClose };
}

/* ── Chevron icon ────────────────────────────────────────────────────────── */

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function PlatformMegaMenuV2() {
  const { t } = useTranslation('landing');
  const router = useRouter();
  const { isAuthenticated } = useAuthStoreShallow();
  const { open, setOpen, rootRef, cancelClose, scheduleClose } = useHoverMenu();
  const [activeCategory, setActiveCategory] = useState<string>(() => CATEGORIES[0]!.key);
  const [panelTop, setPanelTop] = useState<number>(76);

  const measureTop = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    return rect ? rect.bottom + 12 : 76;
  }, [rootRef]);

  const openMenu = useCallback(() => {
    cancelClose();
    setPanelTop(measureTop());
    setOpen(true);
  }, [cancelClose, measureTop, setOpen]);

  useEffect(() => {
    if (!open) return;
    const sync = () => setPanelTop(measureTop());
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [open, measureTop]);

  const navigate = useCallback(
    (appHref: string) => {
      setOpen(false);
      router.push(isAuthenticated ? appHref : '/login');
    },
    [isAuthenticated, router, setOpen],
  );

  // All labels use t() — no hardcoded English fallbacks
  const tCat = (key: string) => t(`landing.megaMenu.groups.${key}`, key);
  const tItem = (key: string) => t(`landing.megaMenu.items.${key}`, key);
  const tDesc = (key: string) => t(`landing.megaMenu.desc.${key}`, '');

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory) ?? CATEGORIES[0]!;

  return (
    <div ref={rootRef} className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      {/* Trigger — pill with breathing room, animated chevron */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 focus:outline-none border"
        style={{
          color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: open ? 'var(--surface-2)' : 'transparent',
          borderColor: open ? 'var(--border-default)' : 'transparent',
          boxShadow: open ? '0 1px 6px rgba(0,0,0,0.06)' : 'none',
        }}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {t('landing.megaMenu.platform', 'Platform')}
        <span
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDownIcon open={open} />
        </span>
      </button>

      {/* Panel */}
      <div
        className="fixed left-1/2 z-[110]"
        style={{
          top: panelTop,
          opacity: open ? 1 : 0,
          transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-6px)',
          pointerEvents: open ? 'auto' : 'none',
          transition:
            'opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        role="menu"
        aria-hidden={!open}
      >
        <div
          className="w-[min(1360px,calc(100vw-2rem))] rounded-2xl border overflow-hidden backdrop-blur-2xl"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--landing-card-border)',
            boxShadow: '0 1px 2px rgba(12, 26, 46, 0.06), 0 24px 64px -12px rgba(12, 26, 46, 0.28)',
          }}
        >
          <div className="grid grid-cols-[300px_1fr_460px] min-h-[420px]">
            {/* ── Left: Categories — icon morph on active */}
            <div className="border-r border-(--border) p-3 space-y-0.5">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    tabIndex={open ? 0 : -1}
                    className={`group/cat w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${isActive ? 'bg-[var(--surface-2)] shadow-sm' : 'hover:bg-[var(--surface-2)]/60'}`}
                    onMouseEnter={() => setActiveCategory(cat.key)}
                    onClick={() => cat.items[0] && navigate(cat.items[0].appHref)}
                  >
                    <span
                      className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-300"
                      style={{
                        background: isActive ? cat.color : cat.bgColor,
                        color: isActive ? '#fff' : cat.color,
                        transform: isActive ? 'scale(1.05) rotate(-3deg)' : 'scale(1) rotate(0deg)',
                        boxShadow: isActive ? `0 4px 12px ${cat.color}33` : 'none',
                      }}
                    >
                      {cat.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold leading-tight transition-colors duration-200"
                        style={{
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {tCat(cat.key)}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] leading-tight truncate">
                        {cat.items.length} modules
                      </p>
                    </div>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{
                        background: isActive ? cat.color : 'transparent',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        opacity: isActive ? 1 : 0,
                        transform: isActive
                          ? 'translateX(0) scale(1)'
                          : 'translateX(-6px) scale(0.85)',
                      }}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Center: Sub-items — stagger entrance */}
            <div className="flex-1 p-5">
              <p
                className="text-xs font-bold uppercase tracking-[0.12em] mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-muted)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: activeCat.color }}
                />
                {tCat(activeCat.key)}
              </p>
              <div className="space-y-1">
                {activeCat.items.map((item, idx) => (
                  <button
                    key={item.key}
                    type="button"
                    tabIndex={open ? 0 : -1}
                    className="group/item w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-[var(--surface-2)] hover:translate-x-[2px]"
                    style={{
                      animation: open
                        ? `fade-up 0.35s cubic-bezier(0.22,1,0.36,1) ${idx * 45}ms both`
                        : undefined,
                    }}
                    onClick={() => navigate(item.appHref)}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/item:scale-110 group-hover/item:rotate-[-4deg]"
                        style={{ background: activeCat.bgColor, color: activeCat.color }}
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          {/* dot accent for each item */}
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: activeCat.color }}
                          />
                        </span>
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                          {tItem(item.key)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{tDesc(item.key)}</p>
                      </div>
                    </div>
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 opacity-0 group-hover/item:opacity-100 transition-all duration-200 group-hover/item:translate-x-0 -translate-x-1"
                      style={{ background: activeCat.color, color: '#fff' }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
              {activeCat.featured && (
                <button
                  type="button"
                  className="mt-4 flex items-center gap-2 text-sm font-semibold transition-colors duration-150 hover:underline"
                  style={{ color: activeCat.color }}
                  onClick={() => navigate(activeCat.featured!.href)}
                >
                  {t('landing.megaMenu.featured.learnMore', 'Learn more')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* ── Right: Live product demo (same as hero) ── */}
            <div
              className="w-[430px] shrink-0 flex flex-col"
              style={{
                background: `linear-gradient(180deg, ${activeCat.bgColor} 0%, transparent 100%)`,
              }}
            >
              <div className="relative flex-1 rounded-xl overflow-hidden border border-(--border) bg-(--card) shadow-lg m-3">
                {/* App chrome */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-(--border) bg-(--background-subtle)">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="flex-1 text-center text-[9px] font-medium text-(--text-muted)">
                    Strata HR
                  </span>
                </div>
                {/* Render the actual animated screen */}
                <div className="overflow-hidden" style={{ minHeight: 280 }}>
                  {activeCat.screen === 'dashboard' && <DashboardScreen t={t} />}
                  {activeCat.screen === 'analytics' && <AnalyticsScreen t={t} />}
                  {activeCat.screen === 'chat' && <ChatScreen t={t} />}
                  {activeCat.screen === 'calendar' && <CalendarScreen t={t} />}
                </div>
              </div>
              <button
                type="button"
                className="mx-3 mb-3 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 w-full justify-center"
                style={{ background: activeCat.color, color: '#ffffff' }}
                onClick={() => navigate(activeCat.items[0]?.appHref ?? '/dashboard')}
              >
                {t('landing.megaMenu.explore', 'Explore')}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Bottom strip: quick links ── */}
          <div
            className="flex items-center gap-6 px-6 py-3.5 border-t"
            style={{
              borderColor: 'var(--landing-card-border)',
              background: 'var(--background-subtle)',
            }}
          >
            {[
              { labelKey: 'landing.megaMenu.bottom.reporting', href: '/reports' },
              { labelKey: 'landing.megaMenu.bottom.integrations', href: '/settings' },
              { labelKey: 'landing.megaMenu.bottom.mobile', href: '/dashboard' },
              { labelKey: 'landing.megaMenu.bottom.trust', href: '/compliance' },
            ].map((link) => (
              <button
                key={link.labelKey}
                type="button"
                className="flex items-center gap-1 text-xs font-semibold transition-colors duration-150 hover:underline"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => navigate(link.href)}
              >
                {t(link.labelKey, link.labelKey.split('.').pop()!)}
                <ArrowRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlatformMegaMenuV2;
