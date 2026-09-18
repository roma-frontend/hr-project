'use client';

/**
 * Org-admin management for public API keys (Settings → API).
 *
 * Mirrors the SCIM token panel deliberately: same "shown once, hashed at rest"
 * contract, same list/toggle/delete shape. What differs is that a key carries
 * *scopes*, so the create dialog asks which resources the integration may read
 * rather than handing out the whole tenant by default.
 */

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyRound, Plus, Trash2, Copy, ShieldCheck } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { publicApiBaseUrl } from '@/lib/convexSiteUrl';

/** Mirrors `API_SCOPES` in convex/lib/apiKey.ts — the backend also validates. */
const SCOPES = [
  'employees:read',
  'departments:read',
  'positions:read',
  'leaves:read',
  'webhooks:read',
  'webhooks:write',
] as const;

export function ApiKeysSettings() {
  const { t } = useTranslation();
  const keys = useQuery(api.apiKeys.listApiKeys, {});

  const create = useMutation(api.apiKeys.createApiKey);
  const setEnabled = useMutation(api.apiKeys.setApiKeyEnabled);
  const revoke = useMutation(api.apiKeys.revokeApiKey);

  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string[]>([...SCOPES]);
  const [saving, setSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Id<'apiKeys'> | null>(null);

  const baseUrl = publicApiBaseUrl();
  const example = `curl -H "Authorization: Bearer <key>" ${baseUrl}/employees`;

  const copy = (text: string, message: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const toggleScope = (scope: string, on: boolean) => {
    setSelected((prev) => (on ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await create({ label: label || undefined, scopes: selected });
      setCreatedKey(res.key);
      setCreating(false);
      setLabel('');
      setSelected([...SCOPES]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: Id<'apiKeys'>) => {
    setDeleting(id);
    try {
      await revoke({ keyId: id });
      toast.success(t('settingsApi.deleted', 'API key revoked'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

  if (keys === undefined) {
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
              <KeyRound className="w-4 h-4" />
              {t('settingsApi.title', 'API keys')}
            </CardTitle>
            <CardDescription>
              {t(
                'settingsApi.description',
                'Read-only access to your organization data for HRIS sync, payroll export or BI. Each key carries its own scopes and monthly call limit.',
              )}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('settingsApi.add', 'Create key')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-(--border) p-3 space-y-2">
            <p className="text-sm font-medium">{t('settingsApi.baseUrl', 'Base URL')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-(--border) px-3 py-2 text-xs">
                {baseUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(baseUrl, t('settingsApi.copied', 'Copied'))}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-(--text-muted)">
              {t('settingsApi.example', 'Example')}: <code className="break-all">{example}</code>
            </p>
          </div>

          {keys.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              {t('settingsApi.empty', 'No API keys yet.')}
            </p>
          )}

          {keys.map((row) => (
            <div
              key={row._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-(--border) p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{row.label}</span>
                  <code className="text-xs text-(--text-muted)">{row.prefix}…</code>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: row.enabled ? 'var(--success-bg, #dcfce7)' : 'var(--surface-2)',
                      color: row.enabled ? 'var(--success, #16a34a)' : 'var(--text-muted)',
                    }}
                  >
                    {row.enabled
                      ? t('settingsApi.enabled', 'Enabled')
                      : t('settingsApi.disabled', 'Disabled')}
                  </span>
                </div>
                <p className="text-xs text-(--text-muted) truncate">{row.scopes.join(', ')}</p>
                <p className="text-xs text-(--text-muted)">
                  {row.lastUsedAt
                    ? `${t('settingsApi.lastUsed', 'Last used')}: ${new Date(row.lastUsedAt).toLocaleString()}`
                    : t('settingsApi.neverUsed', 'Never used')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(v) => {
                    void setEnabled({ keyId: row._id, enabled: v });
                  }}
                />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settingsApi.addTitle', 'Create API key')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('settingsApi.label', 'Label')}</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('settingsApi.labelPlaceholder', 'e.g. Armsoft payroll sync')}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('settingsApi.scopes', 'Scopes')}</p>
              {SCOPES.map((scope) => (
                <div key={scope} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{scope}</p>
                    <p className="text-xs text-(--text-muted)">
                      {t(`settingsApi.scope_${scope.replace(':', '_')}`, scope)}
                    </p>
                  </div>
                  <Switch
                    checked={selected.includes(scope)}
                    onCheckedChange={(v) => toggleScope(scope, v)}
                  />
                </div>
              ))}
            </div>

            <Button
              disabled={saving || selected.length === 0}
              onClick={() => void save()}
              className="w-full"
            >
              {t('settingsApi.create', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Created-key dialog */}
      <Dialog open={createdKey !== null} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settingsApi.keyTitle', 'Your API key')}</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-xl border border-(--border) p-3">
            <ShieldCheck className="mt-0.5 w-4 h-4 shrink-0 text-(--success, #16a34a)" />
            <p className="text-sm text-(--text-muted)">
              {t(
                'settingsApi.keyWarning',
                'Copy it now — it is shown only once and cannot be retrieved later. Only a hash is stored on our side.',
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-(--border) px-3 py-2 text-xs">
              {createdKey}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(createdKey ?? '', t('settingsApi.copied', 'Copied'))}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-(--text-muted)">
            {t('settingsApi.tryIt', 'Try it')}:{' '}
            <code className="break-all">
              curl -H &quot;Authorization: Bearer {createdKey}&quot; {baseUrl}/me
            </code>
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
