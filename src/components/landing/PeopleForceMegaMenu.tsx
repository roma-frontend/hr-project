'use client';

/**
 * Strata Platform Mega Menu — V3 "Bento Cinema"
 *
 * New layout: no old 3-pane rail/cards/preview. Instead:
 *   canvas hero (top, full-width cinematic SVG, morphs per category)
 *   bento grid (middle, 2×2 or 3×2 cards with videographic minis)
 *   command strip (bottom, quick jump)
 *
 * Each card carries its own inline SVG micro-scene that draws itself
 * on mount (stroke-dashoffset) and hovers with lift + gradient border.
 * No stock lucide grid — bespoke videographic illustration per category.
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
  Sparkles,
  Zap,
  ShieldCheck,
} from 'lucide-react';

// ── Cinematic canvas heroes — one bespoke SVG per category ─────────────────
// Each is ~320×140, hand-crafted, no image. They live in the top canvas and
// crossfade when the active category changes.

function CanvasPeople({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="cp-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#cp-g1)" />
      {/* org nodes */}
      <g fill={color} opacity="0.14">
        <circle cx="320" cy="26" r="16" />
        <circle cx="210" cy="78" r="12" />
        <circle cx="430" cy="78" r="12" />
        <circle cx="150" cy="126" r="8" />
        <circle cx="270" cy="126" r="8" />
        <circle cx="370" cy="126" r="8" />
        <circle cx="490" cy="126" r="8" />
      </g>
      <g stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.42" fill="none">
        <path d="M320 42 L210 66 M320 42 L430 66 M210 90 L150 118 M210 90 L270 118 M430 90 L370 118 M430 90 L490 118" />
      </g>
      <circle cx="320" cy="26" r="20" fill="none" stroke={color} strokeWidth="1.2" opacity="0.18" />
      <g fill="white" stroke={color} strokeWidth="1.3">
        <rect x="198" y="66" width="24" height="28" rx="7" />
        <rect x="418" y="66" width="24" height="28" rx="7" />
      </g>
      <text
        x="320"
        y="30"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill={color}
        opacity="0.9"
      >
        CEO
      </text>
    </svg>
  );
}
function CanvasOps({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="co-g1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#co-g1)" />
      <rect
        x="32"
        y="22"
        width="280"
        height="116"
        rx="16"
        fill="white"
        stroke={color}
        strokeWidth="1.2"
        opacity="0.95"
      />
      <g stroke={color} strokeWidth="0.9" opacity="0.18">
        <path d="M32 48 H312 M100 22 V138 M172 22 V138 M32 84 H312" />
      </g>
      <g>
        <rect x="44" y="58" width="52" height="18" rx="9" fill={color} opacity="0.92" />
        <rect x="108" y="58" width="52" height="18" rx="9" fill={color} opacity="0.52" />
        <rect x="172" y="58" width="52" height="18" rx="9" fill={color} opacity="0.28" />
        <rect x="44" y="94" width="52" height="18" rx="9" fill={color} opacity="0.38" />
        <rect x="108" y="94" width="52" height="18" rx="9" fill={color} opacity="0.88" />
      </g>
      <g transform="translate(420,74)">
        <circle r="34" fill="white" stroke={color} strokeWidth="1.4" />
        <circle r="46" fill="none" stroke={color} strokeWidth="1" opacity="0.12" />
        <path
          d="M-10 0 L-2 8 L14 -8"
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="420"
        y="124"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill={color}
        opacity="0.65"
      >
        APPROVED
      </text>
    </svg>
  );
}
function CanvasStrategy({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <radialGradient id="cs-g1" cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#cs-g1)" />
      <g fill="none" stroke={color} strokeWidth="1.2" opacity="0.18">
        <circle cx="320" cy="72" r="62" />
        <circle cx="320" cy="72" r="42" />
        <circle cx="320" cy="72" r="24" />
      </g>
      <circle cx="320" cy="72" r="9" fill={color} />
      <circle cx="320" cy="72" r="18" fill="none" stroke={color} strokeWidth="1.4" opacity="0.28" />
      <g fill={color}>
        <circle cx="384" cy="44" r="5" opacity="0.9" />
        <circle cx="256" cy="40" r="3.5" opacity="0.55" />
        <circle cx="272" cy="110" r="3" opacity="0.45" />
        <circle cx="408" cy="110" r="3" opacity="0.4" />
      </g>
      <path
        d="M 384 44 A 62 62 0 0 1 320 134"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.88"
      />
      <text
        x="320"
        y="148"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={color}
        opacity="0.5"
        letterSpacing="0.12em"
      >
        STRATEGY MAP
      </text>
    </svg>
  );
}
function CanvasTalent({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="ct-g1" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="50%" stopColor={color} stopOpacity="0.04" />
          <stop offset="100%" stopColor={color} stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#ct-g1)" />
      <rect
        x="40"
        y="32"
        width="560"
        height="96"
        rx="16"
        fill="white"
        stroke={color}
        strokeWidth="1.1"
        opacity="0.92"
      />
      <g stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.42">
        <path d="M110 80 H170 M230 80 H290 M350 80 H410 M470 80 H530" />
      </g>
      <g fill="white" stroke={color} strokeWidth="1.5">
        <circle cx="110" cy="80" r="16" />
        <circle cx="200" cy="80" r="16" />
        <circle cx="290" cy="80" r="16" />
        <circle cx="380" cy="80" r="16" />
        <circle cx="470" cy="80" r="16" />
        <circle cx="560" cy="80" r="16" />
      </g>
      <g
        fill={color}
        fontSize="8.5"
        fontWeight="800"
        textAnchor="middle"
        dominantBaseline="central"
      >
        <text x="110" y="81">
          1
        </text>
        <text x="200" y="81">
          2
        </text>
        <text x="290" y="81">
          3
        </text>
        <text x="380" y="81">
          4
        </text>
        <text x="470" y="81">
          5
        </text>
        <text x="560" y="81">
          ✓
        </text>
      </g>
      <text
        x="320"
        y="52"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={color}
        opacity="0.45"
        letterSpacing="0.12em"
      >
        HIRING PIPELINE
      </text>
    </svg>
  );
}
function CanvasFinance({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="cf-g1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#cf-g1)" />
      {[34, 58, 44, 72, 50, 78, 60, 92, 66, 84].map((h, i) => (
        <rect
          key={i}
          x={40 + i * 52}
          y={118 - h}
          width="22"
          height={h}
          rx="7"
          fill={color}
          opacity={0.14 + i * 0.06}
        />
      ))}
      <path
        d="M50 84 L102 64 L154 70 L206 42 L258 50 L310 30 L362 38 L414 18"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="414" cy="18" r="7" fill={color} />
      <circle cx="414" cy="18" r="13" fill="none" stroke={color} strokeWidth="1" opacity="0.22" />
      <text x="414" y="10" textAnchor="middle" fontSize="7" fontWeight="800" fill="white">
        ↗
      </text>
    </svg>
  );
}
function CanvasInsights({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="ci-g1" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.13" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#ci-g1)" />
      <path
        d="M40 84 C 80 84, 88 32, 120 52 S 160 108, 200 64 S 250 20, 300 42 S 340 84, 380 62 S 440 32, 480 48 S 540 84, 600 84"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.88"
      />
      <circle cx="200" cy="64" r="5" fill={color} />
      <circle cx="300" cy="42" r="5" fill={color} />
      <g fill={color} opacity="0.5">
        <circle cx="80" cy="84" r="2.5" />
        <circle cx="120" cy="52" r="2.5" />
        <circle cx="260" cy="72" r="2.5" />
        <circle cx="380" cy="62" r="2.5" />
      </g>
      {/* area */}
      <path
        d="M40 84 C 80 84, 88 32, 120 52 S 160 108, 200 64 S 250 20, 300 42 S 340 84, 380 62 S 440 32, 480 48 S 540 84, 600 84 L600 120 L40 120 Z"
        fill={color}
        opacity="0.06"
      />
    </svg>
  );
}
const CANVAS_MAP: Record<string, React.FC<{ color: string }>> = {
  people: CanvasPeople,
  ops: CanvasOps,
  strategy: CanvasStrategy,
  talent: CanvasTalent,
  finance: CanvasFinance,
  insights: CanvasInsights,
};

/* ── Types ───────────────────────────────────────────────────────────────── */

interface MegaMenuItem {
  key: string;
  appHref: string;
  descKey?: string;
}
interface MegaMenuCategory {
  key: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  items: MegaMenuItem[];
  featured?: { href: string };
}

const CATEGORIES: MegaMenuCategory[] = [
  {
    key: 'people',
    icon: <Users className="w-[18px] h-[18px]" />,
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.10)',
    items: [
      { key: 'directory', appHref: '/employees' },
      { key: 'orgchart', appHref: '/org-chart' },
      { key: 'documents', appHref: '/documents' },
      { key: 'esign', appHref: '/signatures' },
    ],
    featured: { href: '/employees' },
  },
  {
    key: 'ops',
    icon: <ClipboardList className="w-[18px] h-[18px]" />,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.10)',
    items: [
      { key: 'leave', appHref: '/leaves' },
      { key: 'attendance', appHref: '/attendance' },
      { key: 'tasks', appHref: '/tasks' },
      { key: 'calendar', appHref: '/calendar' },
      { key: 'rooms', appHref: '/rooms' },
    ],
    featured: { href: '/leaves' },
  },
  {
    key: 'strategy',
    icon: <Target className="w-[18px] h-[18px]" />,
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.10)',
    items: [
      { key: 'okr', appHref: '/goals' },
      { key: 'strategyMaps', appHref: '/strategy' },
      { key: 'performance', appHref: '/performance' },
      { key: 'recognition', appHref: '/recognition' },
    ],
    featured: { href: '/goals' },
  },
  {
    key: 'talent',
    icon: <Briefcase className="w-[18px] h-[18px]" />,
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.10)',
    items: [
      { key: 'ats', appHref: '/recruitment' },
      { key: 'onboarding', appHref: '/onboarding' },
      { key: 'learning', appHref: '/learning' },
      { key: 'surveys', appHref: '/surveys' },
    ],
    featured: { href: '/recruitment' },
  },
  {
    key: 'finance',
    icon: <Wallet className="w-[18px] h-[18px]" />,
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.10)',
    items: [
      { key: 'payroll', appHref: '/payroll' },
      { key: 'compensation', appHref: '/compensation' },
      { key: 'expenses', appHref: '/expenses' },
    ],
    featured: { href: '/payroll' },
  },
  {
    key: 'insights',
    icon: <BarChart3 className="w-[18px] h-[18px]" />,
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.10)',
    items: [
      { key: 'reports', appHref: '/reports' },
      { key: 'analytics', appHref: '/analytics' },
      { key: 'compliance', appHref: '/compliance' },
      { key: 'automation', appHref: '/superadmin/automation' },
    ],
    featured: { href: '/analytics' },
  },
];

const CLOSE_DELAY_MS = 160;
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
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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
        transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */

export function PlatformMegaMenuV2() {
  const { t } = useTranslation('landing');
  const router = useRouter();
  const { isAuthenticated } = useAuthStoreShallow();
  const { open, setOpen, rootRef, cancelClose, scheduleClose } = useHoverMenu();
  const [activeCategory, setActiveCategory] = useState<string>(() => CATEGORIES[0]!.key);
  const [panelTop, setPanelTop] = useState<number>(76);
  const measureTop = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    return rect ? rect.bottom + 10 : 76;
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
  const tCat = (key: string) => t(`landing.megaMenu.groups.${key}`, key);
  const tItem = (key: string) => t(`landing.megaMenu.items.${key}`, key);
  const tDesc = (key: string) => t(`landing.megaMenu.desc.${key}`, '');

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory) ?? CATEGORIES[0]!;
  const ActiveCanvas = CANVAS_MAP[activeCat.key] ?? CanvasPeople;

  return (
    <div ref={rootRef} className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button
        type="button"
        className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 focus:outline-none"
        style={{
          color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: open ? 'var(--surface-2)' : 'transparent',
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

      <div
        className="fixed left-1/2 z-[110]"
        style={{
          top: panelTop,
          opacity: open ? 1 : 0,
          transform: open
            ? 'translateX(-50%) translateY(0) scale(1)'
            : 'translateX(-50%) translateY(-8px) scale(0.98)',
          pointerEvents: open ? 'auto' : 'none',
          transition:
            'opacity 0.24s cubic-bezier(0.22,1,0.36,1), transform 0.34s cubic-bezier(0.22,1,0.36,1)',
        }}
        role="menu"
        aria-hidden={!open}
      >
        <div
          className="w-[min(1280px,calc(100vw-2rem))] rounded-[24px] border overflow-hidden bg-[var(--card)]"
          style={{
            borderColor: 'var(--border-default)',
            boxShadow:
              '0 1px 2px rgba(12,26,46,0.06), 0 32px 80px -16px rgba(12,26,46,0.24), 0 0 0 1px rgba(255,255,255,0.7) inset',
          }}
        >
          {/* ── Cinematic canvas — full-width hero, morphs per category */}
          <div
            className="relative overflow-hidden border-b border-[var(--border)]"
            style={{
              background: `radial-gradient(120% 100% at 50% 0%, ${activeCat.bgColor}, transparent 70%)`,
            }}
          >
            <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-6">
              <div className="shrink-0">
                <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: activeCat.color }}
                  />{' '}
                  Platform · {tCat(activeCat.key)}
                </p>
                <p className="mt-1 text-[17px] font-bold tracking-tight text-[var(--text-primary)]">
                  {tCat(activeCat.key)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[280px] leading-snug">
                  {tDesc(activeCat.items[0]?.key ?? '')}
                </p>
              </div>
              <div className="flex-1 max-w-[560px] rounded-2xl overflow-hidden border border-[var(--border)] bg-white shadow-sm">
                <div
                  key={activeCat.key}
                  className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)]"
                >
                  <ActiveCanvas color={activeCat.color} />
                </div>
              </div>
            </div>
            {/* category tabs — pill rail */}
            <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    tabIndex={open ? 0 : -1}
                    onMouseEnter={() => setActiveCategory(cat.key)}
                    onClick={() => setActiveCategory(cat.key)}
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0"
                    style={{
                      background: isActive ? cat.color : 'var(--surface-1)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${isActive ? cat.color : 'var(--border-default)'}`,
                      boxShadow: isActive ? `0 4px 14px ${cat.color}38` : 'none',
                      transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.22)' : cat.bgColor,
                        color: isActive ? '#fff' : cat.color,
                      }}
                    >
                      {cat.icon}
                    </span>
                    {tCat(cat.key)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Bento grid — 2 rows, dense */}
          <div className="p-4 grid grid-cols-3 gap-3">
            {activeCat.items.map((item, idx) => (
              <button
                key={item.key}
                type="button"
                tabIndex={open ? 0 : -1}
                className="group/item relative text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 flex flex-col gap-2 overflow-hidden transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-lg hover:-translate-y-[2px] hover:bg-white"
                style={{
                  animation: open
                    ? `fade-up 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 60}ms both`
                    : undefined,
                }}
                onClick={() => navigate(item.appHref)}
              >
                <span
                  className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full scale-x-0 group-hover/item:scale-x-100 transition-transform duration-300 origin-left"
                  style={{ background: activeCat.color }}
                  aria-hidden="true"
                />
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover/item:scale-110 group-hover/item:rotate-[-6deg]"
                    style={{ background: activeCat.bgColor, color: activeCat.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: activeCat.color }}
                    />
                  </span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)] leading-tight">
                    {tItem(item.key)}
                  </span>
                </span>
                <span className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                  {tDesc(item.key) || tItem(item.key)}
                </span>
                <span
                  className="mt-auto inline-flex items-center gap-1 text-xs font-bold opacity-0 group-hover/item:opacity-100 translate-y-1 group-hover/item:translate-y-0 transition-all duration-200"
                  style={{ color: activeCat.color }}
                >
                  Open <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
            {/* CTA bento cell — fills remaining grid */}
            <div
              className="rounded-2xl p-4 flex flex-col justify-between min-h-[120px] border border-[var(--border)]"
              style={{ background: `linear-gradient(135deg, ${activeCat.bgColor}, transparent)` }}
            >
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" style={{ color: activeCat.color }} /> Explore{' '}
                  {tCat(activeCat.key)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Jump straight into the workspace.
                </p>
              </div>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] w-full"
                style={{
                  background: activeCat.color,
                  boxShadow: `0 8px 18px ${activeCat.color}33`,
                }}
                onClick={() => navigate(activeCat.items[0]?.appHref ?? '/dashboard')}
              >
                Go to {tCat(activeCat.key)} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Bottom strip */}
          <div
            className="flex items-center gap-5 px-6 py-3 border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)] flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Quick jump
            </span>
            {[
              { labelKey: 'landing.megaMenu.bottom.reporting', href: '/reports' },
              { labelKey: 'landing.megaMenu.bottom.integrations', href: '/settings' },
              { labelKey: 'landing.megaMenu.bottom.mobile', href: '/dashboard' },
              { labelKey: 'landing.megaMenu.bottom.trust', href: '/compliance' },
            ].map((link) => (
              <button
                key={link.labelKey}
                type="button"
                className="group/b inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => navigate(link.href)}
              >
                {t(link.labelKey, link.labelKey.split('.').pop()!)}
                <ArrowRight className="w-3 h-3 opacity-50 group-hover/b:opacity-100 group-hover/b:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlatformMegaMenuV2;
