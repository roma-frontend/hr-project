'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { Search, Check, ExternalLink, Settings2, Zap, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthUser } from '@/store/useAuthStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MARKETPLACE_APPS,
  appStatus,
  matchesQuery,
  populatedCategories,
  type MarketplaceApp,
  type MarketplaceCategory,
} from '@/lib/marketplace';

/**
 * Integration marketplace (in-app).
 *
 * The card grid is pure catalog data (`src/lib/marketplace.ts`); what makes it
 * more than a poster is the action column, which is driven by the app's setup
 * kind:
 *   - `webhook`  → installs for real, by creating an outbound endpoint on the
 *                  existing delivery engine (signing, retries, delivery audit).
 *   - `settings` → deep-links to the surface that already configures the app.
 *   - `coming`   → no action at all. A card with an install button that cannot
 *                  install anything is the fastest way to lose an admin's trust.
 *
 * "Installed" is never stored separately: it is read back from the endpoints the
 * engine actually holds, so the badge cannot drift from reality.
 */
export default function MarketplaceClient() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory | 'all'>('all');
  const [pending, setPending] = useState<MarketplaceApp | null>(null);

  const user = useAuthUser();
  /**
   * Installation is org-admin only — enforced server-side by `assertOrgManager`
   * in the webhook mutations. Without this check the directory offered every
   * employee a Connect button whose only possible outcome was an error toast.
   */
  const canInstall = user?.role === 'admin' || user?.role === 'superadmin';

  const endpoints = useQuery(api.webhooks.main.listEndpoints);
  const eventTypes = useQuery(api.webhooks.main.listEventTypes);
  const createEndpoint = useMutation(api.webhooks.main.createEndpoint);

  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);

  /** Every event the endpoint could subscribe to — the checkbox list's contents. */
  const allEventTypes = useMemo(() => (eventTypes ?? []) as string[], [eventTypes]);

  /**
   * Only the chosen events the backend actually emits.
   *
   * An app's `defaultEvents` is catalog data and can name an event type the
   * deployment no longer exposes. Counting and submitting those would show "5 of
   * 4 selected" and create a subscription nothing can ever deliver — and because
   * an empty list means *every* event type, a stale name being filtered out at
   * submit time must not be confused with "the admin chose nothing".
   */
  const knownSelected = useMemo(
    () => selectedEvents.filter((event) => allEventTypes.includes(event)),
    [selectedEvents, allEventTypes],
  );

  const endpointsList = useMemo(
    () =>
      (endpoints ?? []) as Array<{
        _id: string;
        label?: string;
        appId?: string;
        enabled?: boolean;
      }>,
    [endpoints],
  );

  /** Label written by this page — the contract that makes the badge honest. */
  const labelFor = (app: MarketplaceApp) => app.name;

  /**
   * Installed = an endpoint this directory created for that app.
   *
   * The app id is the key (`webhookEndpoints.appId`); the label check keeps
   * endpoints created before that column existed — and any endpoint an admin
   * intentionally labelled after the app — counted as installed. Without the id
   * a rename in Settings → Webhooks flipped the badge back to "Connect" while
   * the webhook kept delivering.
   */
  const isInstalled = (app: MarketplaceApp) =>
    endpointsList.some((endpoint) => endpoint.appId === app.id || endpoint.label === labelFor(app));

  const categories = useMemo(() => populatedCategories(), []);

  const visible = useMemo(
    () =>
      MARKETPLACE_APPS.filter(
        (app) => (category === 'all' || app.category === category) && matchesQuery(app, query),
      ).sort((a, b) => b.weight - a.weight),
    [category, query],
  );

  const availableCount = MARKETPLACE_APPS.filter((app) => appStatus(app) === 'available').length;
  const comingCount = MARKETPLACE_APPS.length - availableCount;

  function openInstall(app: MarketplaceApp) {
    if (app.setup.kind !== 'webhook') return;
    setPending(app);
    setUrl('');
    setSelectedEvents(app.setup.defaultEvents);
    setInstalling(false);
  }

  async function submitInstall() {
    if (!pending || pending.setup.kind !== 'webhook') return;
    if (!/^https:\/\/.+/i.test(url.trim())) {
      toast.error(t('marketplace.invalidUrl'));
      return;
    }
    // Two endpoints on the same app deliver every event twice. The label is the
    // key the directory matches on, so refuse the duplicate here instead of
    // silently creating a second consumer the admin cannot see from this page.
    if (isInstalled(pending)) {
      toast.error(t('marketplace.alreadyConnected', { name: pending.name }));
      setPending(null);
      return;
    }
    setInstalling(true);
    try {
      await createEndpoint({
        label: labelFor(pending),
        appId: pending.id,
        url: url.trim(),
        events: knownSelected,
        enabled: true,
      });
      toast.success(t('marketplace.installSuccess', { name: pending.name }));
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('marketplace.installError'));
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('marketplace.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('marketplace.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" />
            {t('marketplace.statsAvailable', { count: availableCount })}
          </Badge>
          <Badge variant="outline">{t('marketplace.statsComing', { count: comingCount })}</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            className="pl-9"
            aria-label={t('marketplace.searchPlaceholder')}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={category === 'all' ? 'default' : 'outline'}
            onClick={() => setCategory('all')}
          >
            {t('marketplace.filterAll')}
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={category === item ? 'default' : 'outline'}
              onClick={() => setCategory(item)}
            >
              {t(`marketplace.categories.${item}`)}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('marketplace.noResults')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((app) => {
            const status = appStatus(app);
            const installed = status === 'available' && isInstalled(app);
            return (
              <Card key={app.id} className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`marketplace.categories.${app.category}`)}
                      </p>
                    </div>
                    {installed ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
                        <Check className="h-3 w-3" />
                        {t('marketplace.actionInstalled')}
                      </Badge>
                    ) : status === 'available' ? (
                      <Badge variant="secondary">{t('marketplace.statusAvailable')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('marketplace.statusComing')}</Badge>
                    )}
                  </div>

                  <p className="flex-1 text-sm text-muted-foreground">
                    {t(`marketplace.apps.${app.id}.description`)}
                  </p>

                  <div className="flex items-center gap-2">
                    {status === 'available' &&
                      app.setup.kind === 'webhook' &&
                      !installed &&
                      (canInstall ? (
                        <Button size="sm" className="gap-1.5" onClick={() => openInstall(app)}>
                          <Plug className="h-3.5 w-3.5" />
                          {t('marketplace.actionConnect')}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t('marketplace.adminOnly')}
                        </span>
                      ))}
                    {status === 'available' && app.setup.kind === 'settings' && (
                      <Button size="sm" variant="outline" className="gap-1.5" asChild>
                        <Link href={(app.setup as { href: string }).href}>
                          <Settings2 className="h-3.5 w-3.5" />
                          {t('marketplace.actionConfigure')}
                        </Link>
                      </Button>
                    )}
                    {installed && (
                      <Button size="sm" variant="outline" className="gap-1.5" asChild>
                        <Link href="/settings?tab=webhooks">
                          <Zap className="h-3.5 w-3.5" />
                          {t('marketplace.actionManage')}
                        </Link>
                      </Button>
                    )}
                    {app.docsUrl && (
                      <a
                        href={app.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t('marketplace.docs')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('marketplace.footnote')}{' '}
        <Link href="/settings?tab=webhooks" className="underline underline-offset-2">
          {t('marketplace.footnoteLink')}
        </Link>
      </p>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('marketplace.installTitle', { name: pending?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('marketplace.installDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="marketplace-url">{t('marketplace.urlLabel')}</Label>
              <Input
                id="marketplace-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://hooks.example.com/strata"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">{t('marketplace.urlHint')}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label>{t('marketplace.eventsLabel')}</Label>
                {/* "None selected" means every event type, which is a rule the
                    flat list only stated in the fine print. Saying it here, at
                    the point of the decision, is what makes clearing the list
                    a choice rather than a mistake. */}
                <span className="text-xs text-muted-foreground">
                  {knownSelected.length === 0
                    ? t('marketplace.eventsAllSelected')
                    : t('marketplace.eventsSelectedCount', {
                        selected: knownSelected.length,
                        total: allEventTypes.length,
                      })}
                </span>
              </div>

              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-(--brand-text) hover:underline"
                  onClick={() => setSelectedEvents([...allEventTypes])}
                >
                  {t('marketplace.eventsSelectAll')}
                </button>
                <button
                  type="button"
                  className="text-(--brand-text) hover:underline"
                  onClick={() => setSelectedEvents([])}
                >
                  {t('marketplace.eventsClear')}
                </button>
              </div>

              {/* Scrollable on purpose. Seventeen event types in a flat column
                  made this dialog taller than the viewport, so the URL field and
                  the Connect button — the two things the admin came for — were
                  pushed off screen by a list they mostly do not change. */}
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-(--border) p-2">
                {allEventTypes.map((eventType) => (
                  <label key={eventType} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedEvents.includes(eventType)}
                      onCheckedChange={(checked) =>
                        setSelectedEvents((current) =>
                          checked === true
                            ? [...current, eventType]
                            : current.filter((item) => item !== eventType),
                        )
                      }
                    />
                    <span className="font-mono text-xs">{eventType}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('marketplace.eventsHint')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={installing}>
              {t('common.cancel')}
            </Button>
            {/* Disabled until the event list arrives: submitting before it does
                would send an empty list, which the engine reads as "every event
                type" — the opposite of a deliberate choice. */}
            <Button onClick={submitInstall} disabled={installing || eventTypes === undefined}>
              {installing ? t('marketplace.installing') : t('marketplace.installSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
