'use client';

/**
 * The public pricing card, extracted from the landing page.
 *
 * `/superadmin/plans` has to show the superadmin what a published plan will look
 * like *on the public page* — and the only way a preview stays honest is if it
 * is the same component. A second copy of this markup would drift within one
 * sprint, so the card body lives here and both callers render it:
 *   - `PricingPreview` (the landing `/pricing` section) passes the checkout CTA;
 *   - `PlansClient` (the tariff editor) passes the live draft values and an
 *     inert CTA, so the price-per-seat reads exactly as the visitor will see it.
 *
 * The card is purely presentational: prices arrive already formatted in the
 * display currency, features already translated. Only the hover state (glow,
 * border highlight) is internal, because that is part of how the card looks.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Inline SVG icons to eliminate lucide-react import overhead
export function CheckIcon({
  size = 10,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ZapIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function BuildingIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01" />
    </svg>
  );
}

export function RocketIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function ShieldIcon({
  size = 11,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function StarIcon({ size = 11, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      className={className}
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

// ── Feature list ──────────────────────────────────────────────────────────────

// Category display order for the grouped feature list — mirrors the billing
// catalog (convex/billing/modules.ts) without pulling it into the landing
// bundle. Categories not listed here sort after these, alphabetically.
export const FEATURE_CATEGORY_ORDER = [
  'people',
  'time',
  'performance',
  'talent',
  'finance',
  'communication',
  'documents',
  'platform',
  'ai',
  'security',
  'future',
] as const;

export interface PlanCardFeatureGroup {
  category: string;
  items: string[];
}

export function groupFeaturesByCategory(
  modules: Array<{ key: string; name: string; category: string }>,
): PlanCardFeatureGroup[] {
  const byCategory = new Map<string, string[]>();
  for (const m of modules) {
    const list = byCategory.get(m.category) ?? [];
    list.push(m.name);
    byCategory.set(m.category, list);
  }
  const order = new Map<string, number>(FEATURE_CATEGORY_ORDER.map((c, i) => [c, i]));
  return [...byCategory.entries()]
    .sort((a, b) => {
      const ai = order.get(a[0]);
      const bi = order.get(b[0]);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([category, items]) => ({ category, items }));
}

/**
 * Sidebar-style feature navigator: the plan's categories are listed as rows
 * (like main sidebar items); clicking one slides a sub-menu in from the right
 * (back button + that category's features), exactly like the sidebar's sub-nav
 * — same springy cubic-bezier, staggered items, and no scroll: the panel is
 * exactly as tall as its content.
 */
export function FeatureNavigator({
  groups,
  accentFrom,
}: {
  groups: PlanCardFeatureGroup[];
  accentFrom: string;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  const activeGroup = groups.find((g) => g.category === active) ?? null;

  return (
    <div className="relative overflow-hidden">
      <div className="grid" style={{ gridTemplateAreas: "'stack'" }}>
        {/* Master view — category rows */}
        <div
          style={{
            gridArea: 'stack',
            opacity: activeGroup ? 0 : 1,
            transform: activeGroup ? 'translateX(-24px)' : 'translateX(0)',
            transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: activeGroup ? 'none' : 'auto',
          }}
        >
          {groups.map((group, i) => (
            <button
              key={group.category}
              type="button"
              onClick={() => setActive(group.category)}
              className="group w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all duration-200 hover:bg-(--landing-card-border)/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)/40"
              style={{
                opacity: activeGroup ? 0 : 1,
                transform: activeGroup ? 'translateX(-20px)' : 'translateX(0)',
                transition: `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.02}s`,
              }}
            >
              <span
                className="flex-1 min-w-0 text-xs sm:text-sm truncate"
                style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
              >
                {t(`billing.categories.${group.category}`, group.category)}
              </span>
              <span
                className="shrink-0 min-w-5 text-center text-[10px] tabular-nums px-1.5 py-0.5 rounded-full"
                style={{
                  color: accentFrom,
                  background: `${accentFrom}14`,
                  border: `1px solid ${accentFrom}33`,
                }}
              >
                {group.items.length}
              </span>
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 transition-transform duration-300 group-hover:translate-x-0.5"
                style={{ color: 'var(--landing-text-muted)' }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>

        {/* Detail view — one category's features, slides in from the right */}
        <div
          style={{
            gridArea: 'stack',
            transform: activeGroup ? 'translateX(0) scale(1)' : 'translateX(100%) scale(0.95)',
            opacity: activeGroup ? 1 : 0,
            pointerEvents: activeGroup ? 'auto' : 'none',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="group/back w-full flex items-center gap-2 px-2.5 py-2 mb-1 rounded-xl transition-all duration-300 hover:bg-(--landing-card-border)/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)/40"
            style={{
              opacity: activeGroup ? 1 : 0,
              transform: activeGroup ? 'translateX(0)' : 'translateX(20px)',
              transition: `all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${activeGroup ? '0.1s' : '0ms'}`,
            }}
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform duration-300 group-hover/back:-translate-x-0.5"
              style={{ color: 'var(--landing-text-muted)' }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span
              className="text-xs sm:text-sm truncate"
              style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
            >
              {activeGroup
                ? t(`billing.categories.${activeGroup.category}`, activeGroup.category)
                : ''}
            </span>
          </button>

          <ul className="space-y-2 py-1">
            {(activeGroup?.items ?? []).map((feature, i) => (
              <li
                key={`${activeGroup?.category}-${i}`}
                className="flex items-start gap-2 sm:gap-2.5 px-1"
                style={{
                  opacity: activeGroup ? 1 : 0,
                  transform: activeGroup ? 'translateX(0)' : 'translateX(30px)',
                  transition: `all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${
                    activeGroup ? 0.15 + i * 0.05 : 0
                  }s`,
                }}
              >
                <div
                  className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: `${accentFrom}22`,
                    border: `1px solid ${accentFrom}44`,
                  }}
                >
                  <CheckIcon
                    size={10}
                    className="sm:w-[11px] sm:h-[11px]"
                    style={{ color: accentFrom }}
                  />
                </div>
                <span
                  className="text-xs sm:text-sm flex-1 leading-relaxed"
                  style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
                >
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Accents ───────────────────────────────────────────────────────────────────

/** Accent palettes for the three plan columns (data-driven tiers reuse these). */
export const PLAN_CARD_ACCENTS: Array<{
  accentFrom: string;
  accentTo: string;
  glowColor: string;
  icon: React.ReactNode;
}> = [
  {
    accentFrom: '#10b981',
    accentTo: '#059669',
    glowColor: 'rgba(16,185,129,0.35)',
    icon: <ZapIcon size={22} />,
  },
  {
    accentFrom: '#3b82f6',
    accentTo: '#2563eb',
    glowColor: 'rgba(59,130,246,0.4)',
    icon: <BuildingIcon size={22} />,
  },
  {
    accentFrom: '#8b5cf6',
    accentTo: '#6d28d9',
    glowColor: 'rgba(139,92,246,0.35)',
    icon: <RocketIcon size={22} />,
  },
];

/**
 * Everything the card renders. Prices are strings in the display currency and
 * features are already translated, so the editor can drive this from its draft
 * state without re-implementing any of the pricing or i18n logic.
 */
export interface PlanCardModel {
  accentFrom: string;
  accentTo: string;
  glowColor: string;
  icon: React.ReactNode;
  name: string;
  tagline?: string;
  /** Big number, already formatted in the display currency. */
  priceLabel: string;
  /** False for quoted plans (Enterprise): the label shows, the suffix does not. */
  priced: boolean;
  /** Small text next to the price, e.g. "per user / month". */
  priceSuffix?: string;
  /** Line under the price, e.g. "For 10 seats: $60". */
  seatsLine?: string;
  /** Struck-through pre-discount price, annual billing only. */
  strikeLabel?: string;
  /** "Billed annually" / "Billed monthly". */
  billingLabel?: string;
  /** Trial caption under the billing line. */
  trialLabel?: string;
  featureTexts?: string[];
  featureGroups?: PlanCardFeatureGroup[];
  popular?: boolean;
  /** Caption for the popular ribbon. */
  badgeLabel?: string;
}

/**
 * The card itself — glow, border, popular ribbon and body.
 *
 * `cta` is a slot: the landing passes its real checkout button, the editor an
 * inert one. Callers own the outer reveal/hover wrapper so the landing can
 * animate the column while the editor renders it statically.
 */
export function PlanCard({ model, cta }: { model: PlanCardModel; cta: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex h-full flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Popular badge */}
      {model.popular && (
        <div className="absolute -top-5 inset-x-0 flex justify-center z-20">
          <div
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg"
            style={{
              background: `linear-gradient(90deg, ${model.accentFrom}, ${model.accentTo})`,
              boxShadow: `0 4px 20px ${model.glowColor}`,
              color: '#ffffff',
            }}
          >
            <StarIcon size={11} />
            {model.badgeLabel}
          </div>
        </div>
      )}

      {/* Glow effect */}
      <div
        className="absolute -inset-px rounded-3xl transition-opacity duration-500 -z-10 blur-2xl"
        style={{
          background: `radial-gradient(ellipse at center, ${model.glowColor}, transparent 70%)`,
          opacity: hovered ? 1 : 0,
        }}
      />

      {/* Card border gradient */}
      <div
        className="absolute -inset-px rounded-3xl -z-[1] transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${model.accentFrom}55, ${model.accentTo}22, transparent)`,
          opacity: hovered || model.popular ? 1 : 0.4,
        }}
      />

      {/* Main card */}
      <div
        className={`relative h-full rounded-3xl flex flex-col overflow-hidden backdrop-blur-xl
          ${hovered ? '-translate-y-2' : 'translate-y-0'}
        `}
        style={{
          /* Tailwind v4's -translate-y-2 compiles to the native CSS `translate`
             property, not `transform` — the transition must watch `translate`
             or the hover lift snaps instantly instead of easing. */
          transition:
            'translate 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
          borderColor: model.popular ? model.accentFrom : 'var(--landing-card-border)',
          borderWidth: model.popular ? '2px' : '1px',
          backgroundColor: 'var(--landing-card-bg)',
          boxShadow: model.popular ? `0 0 30px ${model.glowColor}` : 'none',
        }}
      >
        {/* Top accent line */}
        <div
          className="h-[2px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${model.accentFrom}, ${model.accentTo}, transparent)`,
          }}
        />

        <div className="p-5 sm:p-6 md:p-8 flex flex-col flex-1">
          {/* Icon + name */}
          <div className="flex items-start justify-between mb-4 sm:mb-6">
            <div>
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${model.accentFrom}33, ${model.accentTo}22)`,
                  border: `1px solid ${model.accentFrom}44`,
                  boxShadow: `0 8px 24px ${model.glowColor}`,
                  color: model.accentFrom,
                }}
              >
                {model.icon}
              </div>
              <h3
                className="text-lg sm:text-xl font-bold"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {model.name}
              </h3>
              <p
                className="text-xs sm:text-sm mt-1"
                style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
              >
                {model.tagline}
              </p>
            </div>
          </div>

          {/* Price — callers animate the digits before handing the string over */}
          <div className="mb-6">
            <div className="flex items-end gap-2">
              <span
                className="text-3xl font-black leading-none tabular-nums"
                style={{ color: 'var(--landing-text-primary)' }}
              >
                {model.priceLabel}
              </span>
              {model.priced && (
                <span
                  className="text-sm pb-1.5"
                  style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
                >
                  {model.priceSuffix}
                </span>
              )}
            </div>
            {model.priced && model.seatsLine && (
              <p
                className="mt-1.5 text-xs font-medium"
                style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
              >
                {model.seatsLine}
              </p>
            )}
            {model.priced && (
              <div className="flex items-center gap-2 mt-1.5">
                {model.strikeLabel && (
                  <span
                    className="text-[10px] font-semibold line-through"
                    style={{ color: 'var(--landing-text-muted)', opacity: 0.8 }}
                  >
                    {model.strikeLabel}
                  </span>
                )}
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: 'var(--landing-text-muted)', opacity: 0.85 }}
                >
                  {model.billingLabel}
                </span>
              </div>
            )}
            {model.priced && model.trialLabel && (
              <p
                className="text-xs mt-2 flex items-center gap-1.5"
                style={{ color: 'var(--landing-text-secondary)', opacity: 0.85 }}
              >
                <ShieldIcon size={11} />
                {model.trialLabel}
              </p>
            )}
          </div>

          {/* Features — grouped into a sidebar-style navigator for data-driven
              tiers (categories on the card, sub-menu slides in from the right),
              flat checklist for the short bundled tiers. */}
          {model.featureGroups && model.featureGroups.length > 0 ? (
            <div className="flex-1 mb-6 sm:mb-8 -mx-1 px-1">
              <FeatureNavigator groups={model.featureGroups} accentFrom={model.accentFrom} />
            </div>
          ) : (
            <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 flex-1">
              {(model.featureTexts ?? []).map((feature, i) => (
                <li key={i} className="flex items-start gap-2 sm:gap-3">
                  <div
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: `${model.accentFrom}22`,
                      border: `1px solid ${model.accentFrom}44`,
                    }}
                  >
                    <CheckIcon
                      size={10}
                      className="sm:w-[11px] sm:h-[11px]"
                      style={{ color: model.accentFrom }}
                    />
                  </div>
                  <span
                    className="text-xs sm:text-sm flex-1 leading-relaxed"
                    style={{ color: 'var(--landing-text-secondary)', opacity: 0.9 }}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* CTA */}
          {cta}
        </div>
      </div>
    </div>
  );
}

export default PlanCard;
