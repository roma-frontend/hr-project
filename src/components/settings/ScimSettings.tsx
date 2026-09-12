'use client';

import { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Copy, Zap } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

/**
 * Org-admin management for SCIM 2.0 provisioning tokens (Phase 3).
 * Create a bearer token, hand it + the base URL to the IdP (Azure AD, Okta,
 * Google Workspace), and the directory keeps the employee list in sync.
 */
export function ScimSettings() {
  const { t } = useTranslation();
  const tokens = useQuery(api.scim.main.listTokens, {});

  const create = useMutation(api.scim.main.createToken);
  const update = useMutation(api.scim.main.updateToken);
  const remove = useMutation(api.scim.main.deleteToken);
  const probe = useAction(api.scim.main.probeConnection);

  const [probing, setProbing] = useState(false);
  const runProbe = async () => {
    setProbing(true);
    try {
      const res = await probe({});
      toast.success(
        t('settingsScim.probeOk', 'SCIM endpoint OK — {{count}} user(s) visible via bearer auth', {
          count: res.totalUsers,
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setProbing(false);
    }
  };

  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Id<'scimTokens'> | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = `${appUrl}/api/scim/v2`;

  const save = async () => {
    setSaving(true);
    try {
      const res = await create({ label: label || undefined });
      setCreatedToken(res.token);
      setCreating(false);
      setLabel('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: Id<'scimTokens'>) => {
    setDeleting(id);
    try {
      await remove({ tokenId: id });
      toast.success(t('settingsScim.deleted', 'SCIM token deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

  const copy = (text: string, msg: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  if (tokens === undefined) {
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
              <Users className="w-4 h-4" />
              {t('settingsScim.title', 'SCIM Provisioning')}
            </CardTitle>
            <CardDescription>
              {t(
                'settingsScim.description',
                'Let your identity provider (Azure AD, Okta, Google Workspace…) create, update and deactivate employees automatically.',
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runProbe()}
              disabled={probing}
              title={t('settingsScim.probe', 'Test connection')}
            >
              <Zap className={`w-4 h-4 mr-1 ${probing ? 'animate-pulse' : ''}`} />
              {t('settingsScim.probe', 'Test connection')}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t('settingsScim.add', 'Create token')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-(--border) p-3 space-y-2">
            <p className="text-sm font-medium">{t('settingsScim.baseUrl', 'Base URL')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-(--border) px-3 py-2 text-xs">
                {baseUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(baseUrl, t('settingsScim.copied', 'Copied'))}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {tokens.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              {t('settingsScim.empty', 'No SCIM tokens created yet.')}
            </p>
          )}
          {tokens.map((row) => (
            <div
              key={row._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-(--border) p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {row.label ?? row.tokenHash.slice(0, 12)}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: row.enabled ? 'var(--success-bg, #dcfce7)' : 'var(--surface-2)',
                      color: row.enabled ? 'var(--success, #16a34a)' : 'var(--text-muted)',
                    }}
                  >
                    {row.enabled
                      ? t('settingsScim.enabled', 'Enabled')
                      : t('settingsScim.disabled', 'Disabled')}
                  </span>
                </div>
                <p className="text-xs text-(--text-muted)">
                  {row.lastUsedAt
                    ? `${t('settingsScim.lastUsed', 'Last used')}: ${new Date(row.lastUsedAt).toLocaleString()}`
                    : t('settingsScim.neverUsed', 'Never used')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(v) => {
                    void update({ tokenId: row._id, enabled: v });
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
            <DialogTitle>{t('settingsScim.addTitle', 'Create SCIM token')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('settingsScim.label', 'Label')}</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('settingsScim.labelPlaceholder', 'e.g. Azure AD provisioning')}
              />
            </div>
            <Button disabled={saving} onClick={() => void save()} className="w-full">
              {t('settingsScim.create', 'Create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Created-token dialog */}
      <Dialog open={createdToken !== null} onOpenChange={(o) => !o && setCreatedToken(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('settingsScim.tokenTitle', 'Your SCIM bearer token')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-(--text-muted)">
            {t(
              'settingsScim.tokenWarning',
              "Copy it now — it is shown only once and cannot be retrieved later. Paste it into your identity provider's SCIM provisioning settings.",
            )}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-(--border) px-3 py-2 text-xs">
              {createdToken}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(createdToken ?? '', t('settingsScim.copied', 'Copied'))}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
