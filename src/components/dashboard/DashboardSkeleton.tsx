'use client';

/**
 * Dashboard skeletons.
 *
 * Two placeholders that mirror the real page layouts block for block
 * (`DashboardClient` for admins/managers, `EmployeeDashboard` for employees),
 * so the switch to live content happens in place instead of re-flowing the
 * whole page. Blocks fade in top-to-bottom with a short stagger — the page
 * visibly "assembles" while the chunk and the first queries are in flight.
 *
 * Bars use `.skeleton` from spark.css (token-driven shimmer, honours
 * prefers-reduced-motion); the frames are real `Card`s so borders, radii and
 * the glass surface match what replaces them pixel for pixel.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Gap between consecutive blocks, ms. Short enough to finish before data lands. */
const STAGGER_MS = 70;

/** Shimmering placeholder bar. */
function Bone({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

/** Fades in after `index * STAGGER_MS`. */
function Block({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn('skeleton-block', className)}
      style={{ '--stagger': `${index * STAGGER_MS}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** Card header: small icon square, title bar, optional right-hand action. */
function CardHead({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
      <Bone className="size-4 rounded-md!" />
      <Bone className="h-3.5 w-28" />
      {action && <Bone className="ml-auto h-6 w-16 rounded-full!" />}
    </div>
  );
}

// ─── Shared pieces ──────────────────────────────────────────────────────────

/** The sticky title band: label, org name, date chip, actions on the right. */
function HeaderSkeleton() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-4 sm:mb-5 border-b border-(--border)">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Bone className="h-2.5 w-20" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Bone className="h-7 w-44 sm:w-64" />
            <Bone className="h-6 w-36 rounded-full!" />
          </div>
        </div>
        <div className="flex gap-2">
          <Bone className="h-8 w-28" />
          <Bone className="h-8 w-32" />
        </div>
      </div>
    </div>
  );
}

/** TasksFocusWidget: header strip plus three slim task rows. */
function TasksStripSkeleton() {
  return (
    <Card className="overflow-hidden border-(--border) glass-panel">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Bone className="size-4 rounded-md!" />
        <Bone className="h-3.5 w-20" />
        <Bone className="size-5 rounded-full!" />
        <div className="ml-auto flex items-center gap-1.5">
          <Bone className="h-7 w-16" />
          <Bone className="hidden h-7 w-24 sm:block" />
        </div>
      </div>
      <div className="space-y-1.5 px-4 pb-3">
        {['w-3/4', 'w-1/2', 'w-2/3'].map((w, i) => (
          <div key={i} className="flex h-8 items-center gap-3 px-2">
            <Bone className="size-4 rounded-full!" />
            <Bone className={cn('h-3', w)} />
            <Bone className="ml-auto h-4 w-12 rounded-full!" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** CheckInOutWidget (compact): icon, title + status, live clock, one button. */
function CheckInStripSkeleton() {
  return (
    <Card className="overflow-hidden glass-panel">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Bone className="size-9 rounded-lg!" />
          <div className="space-y-1.5">
            <Bone className="h-3.5 w-24" />
            <Bone className="h-2.5 w-32" />
          </div>
        </div>
        <Bone className="ml-auto h-6 w-20" />
        <Bone className="h-8 w-24" />
        <Bone className="hidden h-6 w-24 sm:block" />
      </div>
    </Card>
  );
}

/** StatsCard: coloured hairline, label, icon chip, big number, sparkline, hint. */
function StatTileSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-card border border-(--border-subtle) p-3 sm:p-4 shadow-sm glass-panel">
      <Bone className="absolute inset-x-0 top-0 h-0.5 rounded-none!" />
      <div className="flex items-start justify-between gap-3">
        <Bone className="mt-0.5 h-2.5 w-24" />
        <Bone className="size-8 shrink-0 rounded-xl! sm:size-9" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <Bone className="h-8 w-16 sm:h-9" />
        <Bone className="h-5 w-16" />
      </div>
      <Bone className="mt-3 h-2.5 w-28" />
    </div>
  );
}

/** ActivityFeed: title + live badge, then dotted timeline rows. */
function ActivityFeedSkeleton({ rows }: { rows: number }) {
  const widths = ['w-3/5', 'w-1/2', 'w-2/3', 'w-2/5', 'w-1/2', 'w-3/5'];
  return (
    <Card className="overflow-hidden border-(--border) glass-panel">
      <div className="flex items-center gap-2 px-6 pb-3 pt-6">
        <Bone className="size-4 rounded-md!" />
        <Bone className="h-4 w-32" />
        <Bone className="h-5 w-12 rounded-full!" />
        <Bone className="ml-auto h-6 w-20" />
      </div>
      <div className="divide-y divide-(--border)">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-6 py-3">
            <Bone className="size-8 shrink-0 rounded-full!" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bone className={cn('h-3', widths[i % widths.length])} />
              <Bone className="h-2.5 w-1/4" />
            </div>
            <Bone className="h-2.5 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Generic list card: header and a few avatar + text + pill rows. */
function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  const widths = ['w-2/5', 'w-1/2', 'w-1/3', 'w-2/5', 'w-1/2'];
  return (
    <Card className="h-full glass-panel">
      <CardHead />
      <div className="space-y-2 px-4 pb-4 sm:px-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-(--border-subtle) p-3"
          >
            <Bone className="size-8 shrink-0 rounded-full!" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bone className={cn('h-3', widths[i % widths.length])} />
              <Bone className="h-2.5 w-1/3" />
            </div>
            <Bone className="h-5 w-16 shrink-0 rounded-full!" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Admin / manager pieces ─────────────────────────────────────────────────

/** LeaveCharts: a bar chart card stacked on a donut + legend card. */
function ChartsSkeleton() {
  const bars = ['h-[45%]', 'h-[70%]', 'h-[55%]', 'h-[85%]', 'h-[60%]', 'h-[95%]', 'h-[75%]'];
  return (
    <div className="flex h-full flex-col gap-4 sm:gap-5">
      <Card className="flex flex-1 flex-col glass-panel">
        <CardHead />
        <div className="flex min-h-40 flex-1 flex-col px-4 pb-4 sm:px-5">
          <div className="flex flex-1 items-end gap-2 sm:gap-3">
            {bars.map((h, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1">
                <Bone className={cn('w-full rounded-t-md!', h)} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between">
            {bars.map((_, i) => (
              <Bone key={i} className="h-2 w-6" />
            ))}
          </div>
        </div>
      </Card>

      <Card className="glass-panel">
        <CardHead action={false} />
        <div className="flex items-center gap-6 px-4 pb-5 sm:px-5">
          {/* Donut: shimmer ring with the card surface punched out of the middle. */}
          <div className="relative size-28 shrink-0">
            <Bone className="absolute inset-0 rounded-full!" />
            <div className="absolute inset-[22%] z-10 rounded-full bg-(--card)" />
          </div>
          <div className="flex-1 space-y-2.5">
            {['w-3/4', 'w-1/2', 'w-2/3', 'w-2/5'].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Bone className="size-2.5 rounded-full!" />
                <Bone className={cn('h-2.5', w)} />
                <Bone className="ml-auto h-2.5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/** LeaveStats: three balance tiles and a usage block. */
function BalanceSkeleton() {
  return (
    <Card variant="flat" className="h-full glass-panel">
      <CardHead />
      <div className="space-y-4 px-4 pb-4 sm:px-5">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 rounded-card border border-(--border-subtle) bg-(--surface-2) p-3"
            >
              <Bone className="h-7 w-10" />
              <Bone className="h-2.5 w-14" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-card border border-(--border-subtle) bg-(--surface-2) p-4">
          <div className="flex justify-between">
            <Bone className="h-3 w-24" />
            <Bone className="h-3 w-10" />
          </div>
          <Bone className="h-2 w-full rounded-full!" />
          <Bone className="h-2.5 w-2/3" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="space-y-2 rounded-card border border-(--border-subtle) bg-(--surface-2) p-3"
            >
              <Bone className="h-2.5 w-16" />
              <Bone className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** StrategyDashboardWidget: objectives with progress bars and a KPI row. */
function StrategySkeleton() {
  return (
    <Card className="h-full overflow-hidden border-(--border) glass-panel">
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Bone className="size-8 rounded-lg!" />
          <div className="space-y-1.5">
            <Bone className="h-3.5 w-32" />
            <Bone className="h-2.5 w-44" />
          </div>
          <Bone className="ml-auto h-6 w-16 rounded-full!" />
        </div>
        <div className="space-y-4">
          {['w-3/4', 'w-1/2', 'w-2/3'].map((w, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Bone className={cn('h-3', w)} />
                <Bone className="h-3 w-8" />
              </div>
              <Bone className="h-2 w-full rounded-full!" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 rounded-card bg-(--surface-2) p-3">
              <Bone className="h-2.5 w-12" />
              <Bone className="h-5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Employee pieces ────────────────────────────────────────────────────────

/** PayrollUpcomingBanner (compact): one slim row. */
function BannerSkeleton() {
  return (
    <Card variant="flat" className="glass-panel">
      <div className="flex items-center gap-3 px-4 py-3">
        <Bone className="size-8 rounded-lg!" />
        <Bone className="h-3 w-40 sm:w-64" />
        <Bone className="ml-auto h-6 w-20 rounded-full!" />
      </div>
    </Card>
  );
}

/** Small widget card: header plus a handful of rows. */
function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  const widths = ['w-3/5', 'w-2/5', 'w-1/2', 'w-3/4'];
  return (
    <Card className="h-full glass-panel">
      <CardHead />
      <div className="space-y-3 px-4 pb-4 sm:px-5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="size-8 shrink-0 rounded-full!" />
            <div className="flex-1 space-y-1.5">
              <Bone className={cn('h-3', widths[i % widths.length])} />
              <Bone className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** MyLeaveMoneyCard: a headline figure with two supporting numbers. */
function MoneyCardSkeleton() {
  return (
    <Card className="h-full glass-panel">
      <CardHead action={false} />
      <div className="space-y-4 px-4 pb-4 sm:px-5">
        <Bone className="h-9 w-32" />
        <Bone className="h-2 w-full rounded-full!" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 rounded-card bg-(--surface-2) p-3">
              <Bone className="h-2.5 w-14" />
              <Bone className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** AIRecommendationsCard: a few text lines and suggestion pills. */
function AICardSkeleton() {
  return (
    <Card className="h-full glass-panel">
      <CardHead />
      <div className="space-y-4 px-4 pb-4 sm:px-5">
        <div className="space-y-2">
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-5/6" />
          <Bone className="h-3 w-2/3" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Bone className="h-7 w-28 rounded-full!" />
          <Bone className="h-7 w-36 rounded-full!" />
          <Bone className="h-7 w-24 rounded-full!" />
        </div>
      </div>
    </Card>
  );
}

/** Centered number + label tiles (month attendance quick stats). */
function QuickStatSkeleton() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-2 p-4">
        <Bone className="h-7 w-12" />
        <Bone className="h-2.5 w-20" />
      </div>
    </Card>
  );
}

// ─── Public skeletons ───────────────────────────────────────────────────────

/** Placeholder for `DashboardClient` (admin / manager / superadmin). */
export function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('common.loading', { defaultValue: 'Loading…' })}
      className="space-y-4 sm:space-y-6"
    >
      <Block index={0}>
        <HeaderSkeleton />
      </Block>

      <Block index={1}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 sm:gap-5">
          <TasksStripSkeleton />
          <CheckInStripSkeleton />
        </div>
      </Block>

      <Block index={2}>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
      </Block>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2 sm:gap-5">
        <Block index={3} className="h-full">
          <ChartsSkeleton />
        </Block>
        <Block index={4} className="h-full">
          <BalanceSkeleton />
        </Block>
        <Block index={5} className="h-full">
          <ListCardSkeleton rows={4} />
        </Block>
        <Block index={6} className="h-full">
          <StrategySkeleton />
        </Block>
      </div>

      <Block index={7}>
        <ActivityFeedSkeleton rows={6} />
      </Block>
    </div>
  );
}

/** Placeholder for `EmployeeDashboard`. */
export function EmployeeDashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('common.loading', { defaultValue: 'Loading…' })}
      className="space-y-4 sm:space-y-6"
    >
      <Block index={0}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 sm:gap-5">
          <TasksStripSkeleton />
          <CheckInStripSkeleton />
        </div>
      </Block>

      <Block index={1}>
        <BannerSkeleton />
      </Block>

      <Block index={2}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MoneyCardSkeleton />
          <WidgetSkeleton rows={3} />
          <WidgetSkeleton rows={3} />
        </div>
      </Block>

      <Block index={3}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 sm:gap-5">
          <WidgetSkeleton rows={2} />
          <AICardSkeleton />
        </div>
      </Block>

      <Block index={4}>
        <ActivityFeedSkeleton rows={5} />
      </Block>

      <Block index={5}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <QuickStatSkeleton key={i} />
          ))}
        </div>
      </Block>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2 sm:gap-5">
        <Block index={6} className="h-full">
          <ListCardSkeleton rows={3} />
        </Block>
        <Block index={7} className="h-full">
          <BalanceSkeleton />
        </Block>
      </div>
    </div>
  );
}

export default DashboardSkeleton;
