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
  isSelfInstallable,
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

  const endpointsList = useMemo(
    () => (endpoints ?? []) as Array<{ _id: string; label?: string; enabled?: boolean }>,
    [endpoints],
  );

  /** Label written by this page — the contract that makes the badge honest. */
  const labelFor = (app: MarketplaceApp) => app.name;

  const isInstalled = (app: MarketplaceApp) =>
    endpointsList.some((endpoint) => endpoint.label === labelFor(app));

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
        url: url.trim(),
        events: selectedEvents,
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
              <Label>{t('marketplace.eventsLabel')}</Label>
              {(eventTypes ?? []).map((eventType) => (
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
              <p className="text-xs text-muted-foreground">{t('marketplace.eventsHint')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={installing}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitInstall} disabled={installing}>
              {installing ? t('marketplace.installing') : t('marketplace.installSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
