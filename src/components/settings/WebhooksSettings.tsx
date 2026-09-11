'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Webhook, Plus, Trash2, Copy, RefreshCcw, History } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

/**
 * Org-admin management for outbound webhooks (Phase 2 of the integration
 * rollout). Endpoints are registered here; product events fan out to them
 * with signed deliveries (HMAC-SHA256). Secrets are write-only: rotating a
 * secret returns it exactly once for the admin to copy.
 */
export function WebhooksSettings() {
  const { t } = useTranslation();
  const endpoints = useQuery(api.webhooks.main.listEndpoints, {});
  const deliveries = useQuery(api.webhooks.main.listDeliveries, {});
  const eventTypes = useQuery(api.webhooks.main.listEventTypes, {});

  const create = useMutation(api.webhooks.main.createEndpoint);
  const update = useMutation(api.webhooks.main.updateEndpoint);
  const remove = useMutation(api.webhooks.main.deleteEndpoint);
  const rotate = useMutation(api.webhooks.main.rotateSecret);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Id<'webhookEndpoints'> | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [showDeliveriesFor, setShowDeliveriesFor] = useState<Id<'webhookEndpoints'> | null>(null);
  const [form, setForm] = useState({ label: '', url: '', allEvents: true });
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const save = async () => {
    if (!form.url.trim()) return;
    setSaving(true);
    try {
      await create({
        label: form.label || undefined,
        url: form.url.trim(),
        events: form.allEvents ? [] : selectedEvents,
      });
      toast.success(t('settingsWebhooks.saved', 'Webhook endpoint created'));
      setCreating(false);
      setForm({ label: '', url: '', allEvents: true });
      setSelectedEvents([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: Id<'webhookEndpoints'>, enabled: boolean) => {
    try {
      await update({ endpointId: id, enabled });
      toast.success(
        enabled
          ? t('settingsWebhooks.enabledToast', 'Endpoint enabled')
          : t('settingsWebhooks.disabledToast', 'Endpoint disabled'),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const del = async (id: Id<'webhookEndpoints'>) => {
    setDeleting(id);
    try {
      await remove({ endpointId: id });
      toast.success(t('settingsWebhooks.deleted', 'Webhook endpoint deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

  const doRotate = async (id: Id<'webhookEndpoints'>) => {
    try {
      const res = await rotate({ endpointId: id });
      setRotatedSecret(res.secret);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(label);
  };

  if (endpoints === undefined) {
    return (
      <div className="flex items-center justify-center py-10">
        <ShieldLoader size="xs" variant="inline" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              {t('settingsWebhooks.title', 'Outbound Webhooks')}
            </CardTitle>
            <CardDescription>
              {t(
                'settingsWebhooks.description',
                'Push platform events (leaves, expenses, documents…) to your systems in real time. Deliveries are signed with HMAC-SHA256.',
              )}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('settingsWebhooks.add', 'Add endpoint')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {endpoints.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              {t('settingsWebhooks.empty', 'No webhook endpoints configured yet.')}
            </p>
          )}
          {endpoints.map((row) => (
            <div
              key={row._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-(--border) p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{row.label ?? row.url}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: row.enabled ? 'var(--success-bg, #dcfce7)' : 'var(--surface-2)',
                      color: row.enabled ? 'var(--success, #16a34a)' : 'var(--text-muted)',
                    }}
                  >
                    {row.enabled
                      ? t('settingsWebhooks.enabled', 'Enabled')
                      : t('settingsWebhooks.disabled', 'Disabled')}
                  </span>
                  {row.lastStatus && (
                    <span className="text-xs text-(--text-muted)">
                      {row.lastStatus === 'success'
                        ? t('settingsWebhooks.lastOk', 'last delivery OK')
                        : t('settingsWebhooks.lastFail', 'last delivery failed')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-(--text-muted) truncate">{row.url}</p>
                <p className="text-xs text-(--text-muted)">
                  {row.events.length === 0
                    ? t('settingsWebhooks.allEvents', 'All events')
                    : `${row.events.length} ${t('settingsWebhooks.eventCount', 'event types')}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={row.enabled} onCheckedChange={(v) => void toggle(row._id, v)} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setShowDeliveriesFor(showDeliveriesFor === row._id ? null : row._id)
                  }
                >
                  <History className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void doRotate(row._id)}>
                  <RefreshCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void del(row._id)}
                  disabled={deleting === row._id}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settingsWebhooks.addTitle', 'Add webhook endpoint')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('settingsWebhooks.label', 'Label')}</label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={t('settingsWebhooks.labelPlaceholder', 'e.g. Zapier — recruiting')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('settingsWebhooks.url', 'URL')}</label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/hooks/hr"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.allEvents}
                  onChange={(e) => setForm({ ...form, allEvents: e.target.checked })}
                />
                {t('settingsWebhooks.subscribeAll', 'Subscribe to all events')}
              </label>
              {!form.allEvents && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-(--border) p-2">
                  {(eventTypes ?? []).map((et) => (
                    <label key={et} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(et)}
                        onChange={(e) =>
                          setSelectedEvents(
                            e.target.checked
                              ? [...selectedEvents, et]
                              : selectedEvents.filter((x) => x !== et),
                          )
                        }
                      />
                      <code className="text-xs">{et}</code>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button disabled={saving || !form.url.trim()} onClick={() => void save()}>
              {t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotated secret dialog */}
      <Dialog open={rotatedSecret !== null} onOpenChange={(o) => !o && setRotatedSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settingsWebhooks.secretTitle', 'New signing secret')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-(--text-muted)">
            {t(
              'settingsWebhooks.secretWarning',
              'Copy it now — it is shown only once. Update your consumer immediately; the old secret stops working right away.',
            )}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-(--border) px-3 py-2 text-xs">
              {rotatedSecret}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(rotatedSecret ?? '', t('settingsWebhooks.copied', 'Copied'))}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deliveries drawer */}
      {showDeliveriesFor && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('settingsWebhooks.deliveries', 'Recent deliveries')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(deliveries ?? [])
              .filter((d) => d.endpointId === showDeliveriesFor)
              .slice(0, 10)
              .map((d) => (
                <div
                  key={d._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-(--border) px-3 py-2 text-xs"
                >
                  <code>{d.eventType}</code>
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      background:
                        d.status === 'success'
                          ? 'var(--success-bg, #dcfce7)'
                          : d.status === 'pending'
                            ? 'var(--surface-2)'
                            : 'var(--danger-bg, #fee2e2)',
                      color:
                        d.status === 'success'
                          ? 'var(--success, #16a34a)'
                          : d.status === 'pending'
                            ? 'var(--text-muted)'
                            : 'var(--danger, #dc2626)',
                    }}
                  >
                    {d.status}
                  </span>
                  <span className="text-(--text-muted)">
                    {d.responseStatus !== undefined ? `HTTP ${d.responseStatus}` : (d.error ?? '')}
                  </span>
                </div>
              ))}
            {(deliveries ?? []).filter((d) => d.endpointId === showDeliveriesFor).length === 0 && (
              <p className="text-sm text-(--text-muted)">
                {t('settingsWebhooks.noDeliveries', 'No deliveries yet.')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
