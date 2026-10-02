'use client';

/**
 * Landing mega-menus: Solutions, Why Strata, Resources — V3 Bento Cinema.
 *
 * Each menu now has a cinematic SVG canvas on top (like Platform),
 * a bento card grid in the middle, and a consistent spring entrance.
 * No more flat lists — every card has a videographic accent and the
 * hover is a soft lift (translate + shadow), not a harsh snap.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Briefcase,
  Building2,
  Crown,
  Rocket,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  Puzzle,
  Heart,
  Play,
  BookOpen,
  FileText,
  GraduationCap,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Zap,
  Layers,
  Factory,
} from 'lucide-react';

// ── Cinematic canvases ────────────────────────────────────────────────────

function CanvasByTeam({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="csol-team" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#csol-team)" />
      {/* three role cards */}
      <g>
        <rect
          x="56"
          y="32"
          width="150"
          height="96"
          rx="14"
          fill="white"
          stroke={color}
          strokeWidth="1.2"
          opacity="0.92"
        />
        <rect
          x="244"
          y="32"
          width="150"
          height="96"
          rx="14"
          fill="white"
          stroke={color}
          strokeWidth="1.2"
          opacity="0.92"
        />
        <rect
          x="432"
          y="32"
          width="150"
          height="96"
          rx="14"
          fill="white"
          stroke={color}
          strokeWidth="1.2"
          opacity="0.92"
        />
      </g>
      <g fill={color} opacity="0.12">
        <circle cx="131" cy="56" r="10" />
        <circle cx="319" cy="56" r="10" />
        <circle cx="507" cy="56" r="10" />
      </g>
      <g
        fill={color}
        fontSize="8"
        fontWeight="800"
        textAnchor="middle"
        dominantBaseline="central"
        opacity="0.9"
      >
        <text x="131" y="60">
          HR
        </text>
        <text x="319" y="60">
          OPS
        </text>
        <text x="507" y="60">
          $$
        </text>
      </g>
      <g stroke={color} strokeWidth="1.1" opacity="0.22">
        <path d="M206 80 H244 M394 80 H432" strokeDasharray="4 4" />
      </g>
    </svg>
  );
}
function CanvasBySize({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="csol-size" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#csol-size)" />
      {[28, 52, 40, 76, 56, 92].map((h, i) => (
        <rect
          key={i}
          x={80 + i * 72}
          y={118 - h}
          width="36"
          height={h}
          rx="10"
          fill={color}
          opacity={0.16 + i * 0.09}
        />
      ))}
      <text
        x="116"
        y="142"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={color}
        opacity="0.45"
      >
        5
      </text>
      <text
        x="260"
        y="142"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={color}
        opacity="0.55"
      >
        50
      </text>
      <text
        x="404"
        y="142"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={color}
        opacity="0.75"
      >
        300
      </text>
    </svg>
  );
}
function CanvasByIndustry({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="csol-ind" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#csol-ind)" />
      <g fill="var(--surface-1)" stroke={color} strokeWidth="1.1" opacity="0.92">
        <rect x="60" y="34" width="120" height="92" rx="14" />
        <rect x="220" y="34" width="120" height="92" rx="14" />
        <rect x="380" y="34" width="120" height="92" rx="14" />
      </g>
      <g fill={color} opacity="0.18">
        <rect x="76" y="54" width="88" height="6" rx="3" />
        <rect x="76" y="68" width="64" height="6" rx="3" />
        <rect x="236" y="54" width="88" height="6" rx="3" />
        <rect x="236" y="68" width="64" height="6" rx="3" />
        <rect x="396" y="54" width="88" height="6" rx="3" />
        <rect x="396" y="68" width="64" height="6" rx="3" />
      </g>
    </svg>
  );
}
function CanvasWhy({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <radialGradient id="cwhy" cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#cwhy)" />
      <g fill="none" stroke={color} strokeWidth="1.3" opacity="0.22">
        <path
          d="M80 120 L180 40 L260 90 L360 30 L440 80 L560 36"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g fill={color}>
        <circle cx="180" cy="40" r="5" opacity="0.9" />
        <circle cx="360" cy="30" r="5" opacity="0.9" />
        <circle cx="560" cy="36" r="5" opacity="0.9" />
        <circle cx="260" cy="90" r="3" opacity="0.45" />
        <circle cx="440" cy="80" r="3" opacity="0.45" />
      </g>
      <circle cx="360" cy="30" r="12" fill="none" stroke={color} strokeWidth="1" opacity="0.18" />
    </svg>
  );
}
function CanvasResources({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 160" className="w-full h-[148px]" aria-hidden="true">
      <defs>
        <linearGradient id="cres" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.13" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="640" height="160" rx="20" fill="url(#cres)" />
      <g fill="var(--surface-1)" stroke={color} strokeWidth="1.1" opacity="0.92">
        <rect x="48" y="28" width="150" height="104" rx="12" />
        <rect x="220" y="28" width="150" height="104" rx="12" />
        <rect x="392" y="28" width="150" height="104" rx="12" />
      </g>
      <g fill={color} opacity="0.14">
        <rect x="64" y="48" width="118" height="8" rx="4" />
        <rect x="64" y="66" width="88" height="6" rx="3" />
        <rect x="236" y="48" width="118" height="8" rx="4" />
        <rect x="236" y="66" width="88" height="6" rx="3" />
        <rect x="408" y="48" width="118" height="8" rx="4" />
        <rect x="408" y="66" width="88" height="6" rx="3" />
      </g>
      <g fill={color} opacity="0.55">
        <circle cx="64" cy="92" r="6" />
        <circle cx="236" cy="92" r="6" />
        <circle cx="408" cy="92" r="6" />
      </g>
    </svg>
  );
}

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
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current !== open) {
      window.dispatchEvent(new CustomEvent('strata:mega-open', { detail: open }));
      prevOpen.current = open;
    }
  }, [open]);
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

/* ── Solutions ─────────────────────────────────────────────────────────── */

type SolutionGroup = {
  key: string;
  color: string;
  bgColor: string;
  Canvas: React.FC<{ color: string }>;
  items: Array<{ key: string; href: string }>;
};

const SOLUTION_GROUPS: SolutionGroup[] = [
  {
    key: 'byTeam',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
    Canvas: CanvasByTeam,
    items: [
      { key: 'hr', href: '/features' },
      { key: 'ops', href: '/features' },
      { key: 'finance', href: '/#pricing' },
      { key: 'executives', href: '/#story' },
    ],
  },
  {
    key: 'bySize',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.10)',
    Canvas: CanvasBySize,
    items: [
      { key: 'startup', href: '/#pricing' },
      { key: 'growth', href: '/#pricing' },
      { key: 'enterprise', href: '/features' },
    ],
  },
  {
    key: 'byIndustry',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.10)',
    Canvas: CanvasByIndustry,
    items: [
      { key: 'retail', href: '/features' },
      { key: 'healthcare', href: '/features' },
      { key: 'logistics', href: '/features' },
      { key: 'professional', href: '/features' },
    ],
  },
];

const TEAM_ICONS: Record<string, React.ReactNode> = {
  hr: <Users className="w-4 h-4" />,
  ops: <Briefcase className="w-4 h-4" />,
  finance: <CreditCard className="w-4 h-4" />,
  executives: <Crown className="w-4 h-4" />,
  startup: <Rocket className="w-4 h-4" />,
  growth: <TrendingUp className="w-4 h-4" />,
  enterprise: <Building2 className="w-4 h-4" />,
  retail: <Layers className="w-4 h-4" />,
  healthcare: <Heart className="w-4 h-4" />,
  logistics: <Factory className="w-4 h-4" />,
  professional: <Building2 className="w-4 h-4" />,
};

export function SolutionsMenu() {
  const { t } = useTranslation('landing');
  const { open, setOpen, rootRef, cancelClose, scheduleClose } = useHoverMenu();
  const [activeGroup, setActiveGroup] = useState<string>(SOLUTION_GROUPS[0]!.key);
  const active = SOLUTION_GROUPS.find((g) => g.key === activeGroup) ?? SOLUTION_GROUPS[0]!;
  const ActiveCanvas = active.Canvas;
  const tGroup = (key: string) => t(`landing.solutionsMenu.${key}`, key);
  const tItem = (key: string) => t(`landing.solutionsMenu.items.${key}`, key);
  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 focus:outline-none"
        style={{
          color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: open ? 'var(--surface-2)' : 'transparent',
        }}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {t('landing.solutionsMenu.title', 'Solutions')}
        <span
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDownIcon open={open} />
        </span>
      </button>
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-[110]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
          pointerEvents: open ? 'auto' : 'none',
          transition:
            'opacity 0.26s cubic-bezier(0.22,1,0.36,1), transform 0.36s cubic-bezier(0.22,1,0.36,1)',
        }}
        role="menu"
        aria-hidden={!open}
      >
        <div
          className="w-[min(980px,calc(100vw-2rem))] rounded-[24px] border overflow-hidden bg-[var(--card)]"
          style={{
            borderColor: 'var(--border-default)',
            boxShadow:
              '0 1px 2px rgba(12,26,46,0.06), 0 32px 80px -16px rgba(12,26,46,0.22), 0 0 0 1px rgba(255,255,255,0.65) inset',
          }}
        >
          {/* canvas */}
          <div
            className="relative overflow-hidden border-b border-[var(--border)]"
            style={{
              background: `radial-gradient(120% 100% at 50% 0%, ${active.bgColor}, transparent 70%)`,
            }}
          >
            <div className="px-6 pt-4 flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--text-muted)]">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: active.color }}
                  />{' '}
                  Solutions · {tGroup(active.key)}
                </p>
                <p className="mt-1 text-[16px] font-bold tracking-tight text-[var(--text-primary)]">
                  {tGroup(active.key)}
                </p>
              </div>
              <div className="flex-1 max-w-[520px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-1)] shadow-sm dark:bg-[var(--surface-2)]">
                <div
                  key={active.key}
                  className="animate-[fade-up_0.45s_cubic-bezier(0.22,1,0.36,1)]"
                >
                  <ActiveCanvas color={active.color} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-4 pb-3 pt-1 overflow-x-auto scrollbar-none">
              {SOLUTION_GROUPS.map((g) => {
                const isActive = activeGroup === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    tabIndex={open ? 0 : -1}
                    onMouseEnter={() => setActiveGroup(g.key)}
                    onClick={() => setActiveGroup(g.key)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0"
                    style={{
                      background: isActive ? g.color : 'var(--surface-1)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${isActive ? g.color : 'var(--border)'}`,
                      boxShadow: isActive ? `0 4px 14px ${g.color}33` : 'var(--elev-1)',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.22)' : g.bgColor,
                        color: isActive ? '#fff' : g.color,
                      }}
                    >
                      {g.key === 'byTeam' ? (
                        <Users className="w-3.5 h-3.5" />
                      ) : g.key === 'bySize' ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <Factory className="w-3.5 h-3.5" />
                      )}
                    </span>
                    {tGroup(g.key)}
                  </button>
                );
              })}
            </div>
          </div>
          {/* bento grid — soft lift, not harsh snap */}
          <div className="p-4 grid grid-cols-2 gap-3">
            {active.items.map((item, idx) => (
              <Link
                key={item.key}
                href={item.href}
                className="group/item relative text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 flex items-start gap-3 overflow-hidden will-change-transform transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--border-strong)] hover:bg-[var(--card-hover)]"
                style={{
                  animation: open
                    ? `fade-up 0.42s cubic-bezier(0.22,1,0.36,1) ${idx * 55}ms both`
                    : undefined,
                }}
                onClick={() => setOpen(false)}
              >
                <span
                  className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full scale-x-0 group-hover/item:scale-x-100 transition-transform duration-300 origin-left"
                  style={{ background: active.color }}
                  aria-hidden="true"
                />
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/item:scale-[1.08] group-hover/item:rotate-[-5deg]"
                  style={{ background: active.bgColor, color: active.color }}
                >
                  {TEAM_ICONS[item.key] ?? <Briefcase className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[var(--text-primary)] leading-tight">
                    {tItem(item.key)}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)] mt-1 leading-snug">
                    Discover tailored workflows.
                  </span>
                </span>
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 self-center opacity-0 group-hover/item:opacity-100 will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] translate-x-1 group-hover/item:translate-x-0"
                  style={{ background: active.color, color: '#fff' }}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
          <div className="px-4 pb-4">
            <Link
              href="/features"
              className="inline-flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-2.5 rounded-xl text-white will-change-transform transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: active.color, boxShadow: `0 8px 18px ${active.color}33` }}
              onClick={() => setOpen(false)}
            >
              <Sparkles className="w-4 h-4" /> Explore {tGroup(active.key)}{' '}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Why ─────────────────────────────────────────────────────────────────── */

type WhyItem = { key: string; href: string; icon: React.ReactNode; color: string; bgColor: string };
const WHY_ITEMS: WhyItem[] = [
  {
    key: 'security',
    href: '/privacy',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.10)',
  },
  {
    key: 'pricing',
    href: '/#pricing',
    icon: <CreditCard className="w-5 h-5" />,
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
  },
  {
    key: 'integrations',
    href: '/features',
    icon: <Puzzle className="w-5 h-5" />,
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.10)',
  },
  {
    key: 'customers',
    href: '/#testimonials',
    icon: <Heart className="w-5 h-5" />,
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.10)',
  },
  {
    key: 'tour',
    href: '/#story',
    icon: <Play className="w-5 h-5" />,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.10)',
  },
];
export function WhyMenu() {
  const { t } = useTranslation('landing');
  const { open, setOpen, rootRef, cancelClose, scheduleClose } = useHoverMenu();
  const tItemTitle = (key: string) => t(`landing.whyMenu.items.${key}.title`, key);
  const tItemDesc = (key: string) => t(`landing.whyMenu.items.${key}.desc`, '');
  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 focus:outline-none"
        style={{
          color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: open ? 'var(--surface-2)' : 'transparent',
        }}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {t('landing.whyMenu.title', 'Why Strata')}
        <span
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDownIcon open={open} />
        </span>
      </button>
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-[110]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
          pointerEvents: open ? 'auto' : 'none',
          transition:
            'opacity 0.26s cubic-bezier(0.22,1,0.36,1), transform 0.36s cubic-bezier(0.22,1,0.36,1)',
        }}
        role="menu"
        aria-hidden={!open}
      >
        <div
          className="w-[min(760px,calc(100vw-2rem))] rounded-[24px] border overflow-hidden bg-[var(--card)]"
          style={{
            borderColor: 'var(--border-default)',
            boxShadow:
              '0 1px 2px rgba(12,26,46,0.06), 0 32px 80px -16px rgba(12,26,46,0.22), 0 0 0 1px rgba(255,255,255,0.65) inset',
          }}
        >
          <div
            className="relative overflow-hidden border-b border-[var(--border)] p-4"
            style={{
              background:
                'radial-gradient(120% 100% at 50% 0%, rgba(59,130,246,0.10), transparent 70%)',
            }}
          >
            <CanvasWhy color="#3b82f6" />
            <div className="absolute inset-0 flex flex-col justify-end p-4 pointer-events-none">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/90">
                Why Strata
              </p>
              <p className="text-[15px] font-bold text-white mt-1">
                The HR OS teams actually enjoy
              </p>
            </div>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2.5">
            {WHY_ITEMS.map((item, idx) => (
              <Link
                key={item.key}
                href={item.href}
                className="group/item relative text-left rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 flex gap-3 overflow-hidden will-change-transform transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--border-strong)] hover:bg-[var(--card-hover)]"
                style={{
                  animation: open
                    ? `fade-up 0.42s cubic-bezier(0.22,1,0.36,1) ${idx * 50}ms both`
                    : undefined,
                }}
                onClick={() => setOpen(false)}
              >
                <span
                  className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full scale-x-0 group-hover/item:scale-x-100 transition-transform duration-300 origin-left"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/item:scale-[1.08] group-hover/item:rotate-[-5deg]"
                  style={{ background: item.bgColor, color: item.color }}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[var(--text-primary)] leading-tight">
                    {tItemTitle(item.key)}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)] mt-1 leading-snug line-clamp-2">
                    {tItemDesc(item.key)}
                  </span>
                </span>
                <span
                  className="w-7 h-7 rounded-full hidden sm:flex items-center justify-center shrink-0 self-center opacity-0 group-hover/item:opacity-100 will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] translate-x-1 group-hover/item:translate-x-0"
                  style={{ background: item.color, color: '#fff' }}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Resources ───────────────────────────────────────────────────────────── */

type ResourceItem = {
  key: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
};
const RESOURCE_ITEMS: ResourceItem[] = [
  {
    key: 'story',
    href: '/#story',
    icon: <Play className="w-5 h-5" />,
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
  },
  {
    key: 'features',
    href: '/features',
    icon: <FileText className="w-5 h-5" />,
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.10)',
  },
  {
    key: 'testimonials',
    href: '/#testimonials',
    icon: <Heart className="w-5 h-5" />,
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.10)',
  },
  {
    key: 'faq',
    href: '/#faq',
    icon: <HelpCircle className="w-5 h-5" />,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.10)',
  },
  {
    key: 'careers',
    href: '/careers',
    icon: <GraduationCap className="w-5 h-5" />,
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.10)',
  },
  {
    key: 'contact',
    href: '/contact',
    icon: <BookOpen className="w-5 h-5" />,
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.10)',
  },
];
export function ResourcesMenu({ activeSection = null }: { activeSection?: string | null }) {
  const { t } = useTranslation('landing');
  const { open, setOpen, rootRef, cancelClose, scheduleClose } = useHoverMenu();
  const tItemTitle = (key: string) => {
    const val = t(`landing.megaMenu.resourcesMenu.items.${key}`, '');
    return val || t(`landing.${key}`, key);
  };
  const DESCRIPTIONS: Record<string, string> = {
    story: 'landing.megaMenu.resourcesMenu.descs.story',
    features: 'landing.megaMenu.resourcesMenu.descs.features',
    testimonials: 'landing.megaMenu.resourcesMenu.descs.testimonials',
    faq: 'landing.megaMenu.resourcesMenu.descs.faq',
    careers: 'landing.megaMenu.resourcesMenu.descs.careers',
    contact: 'landing.megaMenu.resourcesMenu.descs.contact',
  };
  const tDesc = (key: string) => {
    const k = DESCRIPTIONS[key];
    return k ? t(k, '') : '';
  };
  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 focus:outline-none"
        style={{
          color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: open ? 'var(--surface-2)' : 'transparent',
        }}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {t('landing.megaMenu.resources', 'Resources')}
        <span
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDownIcon open={open} />
        </span>
      </button>
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-[110]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.98)',
          pointerEvents: open ? 'auto' : 'none',
          transition:
            'opacity 0.26s cubic-bezier(0.22,1,0.36,1), transform 0.36s cubic-bezier(0.22,1,0.36,1)',
        }}
        role="menu"
        aria-hidden={!open}
      >
        <div
          className="w-[min(820px,calc(100vw-2rem))] rounded-[24px] border overflow-hidden bg-[var(--card)]"
          style={{
            borderColor: 'var(--border-default)',
            boxShadow:
              '0 1px 2px rgba(12,26,46,0.06), 0 32px 80px -16px rgba(12,26,46,0.22), 0 0 0 1px rgba(255,255,255,0.65) inset',
          }}
        >
          <div
            className="relative overflow-hidden border-b border-[var(--border)]"
            style={{
              background:
                'radial-gradient(120% 100% at 50% 0%, rgba(6,182,212,0.12), transparent 70%)',
            }}
          >
            <CanvasResources color="#06b6d4" />
            <div className="absolute inset-0 flex flex-col justify-end p-4 pointer-events-none">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/90">
                Resources
              </p>
              <p className="text-[15px] font-bold text-white mt-1">Guides, stories & help</p>
            </div>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2.5">
            {RESOURCE_ITEMS.map((item, idx) => {
              const isActive = activeSection === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group/item relative text-left rounded-2xl border bg-[var(--surface-1)] p-4 flex gap-3 overflow-hidden will-change-transform transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-lg hover:bg-[var(--card-hover)]"
                  style={{
                    borderColor: isActive ? item.color : 'var(--border)',
                    background: isActive ? `${item.color}0d` : 'var(--surface-1)',
                    animation: open
                      ? `fade-up 0.42s cubic-bezier(0.22,1,0.36,1) ${idx * 50}ms both`
                      : undefined,
                  }}
                  onClick={() => setOpen(false)}
                >
                  <span
                    className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full scale-x-0 group-hover/item:scale-x-100 transition-transform duration-300 origin-left"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/item:scale-[1.08] group-hover/item:rotate-[-5deg]"
                    style={{ background: item.bgColor, color: item.color }}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[13px] font-bold leading-tight"
                      style={{ color: isActive ? item.color : 'var(--text-primary)' }}
                    >
                      {tItemTitle(item.key)}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)] mt-1 leading-snug line-clamp-2">
                      {tDesc(item.key)}
                    </span>
                  </span>
                  <span
                    className="w-7 h-7 rounded-full hidden sm:flex items-center justify-center shrink-0 self-center opacity-0 group-hover/item:opacity-100 will-change-transform transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] translate-x-1 group-hover/item:translate-x-0"
                    style={{ background: item.color, color: '#fff' }}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
