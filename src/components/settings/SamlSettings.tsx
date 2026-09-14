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
import { Plus, Trash2, Copy, FileBadge } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { ShieldLoader } from '@/components/ui/ShieldLoader';

/**
 * Org-admin management for SAML 2.0 SSO connections.
 *
 * Mirrors the OIDC section (SsoSettings): write-only certificate handling,
 * per-connection callback/Metadata URLs, and a shared login audit log.
 * The SP metadata for IdP admins lives at /api/sso/metadata/<connectionId>.
 */
export function SamlSettings() {
  const { t } = useTranslation();
  const connections = useQuery(api.sso.main.listSamlConnections, {});

  const upsert = useMutation(api.sso.main.upsertSamlConnection);
  const remove = useMutation(api.sso.main.deleteConnection);

  const [editing, setEditing] = useState<null | {
    id?: Id<'ssoConnections'>;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificate: string;
    domains: string;
    label: string;
    autoProvision: boolean;
    enabled: boolean;
  }>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Id<'ssoConnections'> | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const openNew = () =>
    setEditing({
      idpEntityId: '',
      idpSsoUrl: '',
      idpCertificate: '',
      domains: '',
      label: '',
      autoProvision: false,
      enabled: true,
    });

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await upsert({
        id: editing.id,
        idpEntityId: editing.idpEntityId,
        idpSsoUrl: editing.idpSsoUrl,
        idpCertificate: editing.idpCertificate.trim() || undefined,
        domains: editing.domains
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        label: editing.label || undefined,
        autoProvision: editing.autoProvision,
        enabled: editing.enabled,
      });
      toast.success(t('settingsSaml.saved', 'SAML connection saved'));
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: Id<'ssoConnections'>) => {
    setDeleting(id);
    try {
      await remove({ id });
      toast.success(t('settingsSaml.deleted', 'SAML connection deleted'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  };

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(label);
  };

  if (connections === undefined) {
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
              <FileBadge className="w-4 h-4" />
              {t('settingsSaml.title', 'Single Sign-On (SAML 2.0)')}
            </CardTitle>
            <CardDescription>
              {t(
                'settingsSaml.description',
                'Enterprise federation with any SAML 2.0 identity provider — Okta, Azure AD/Entra, OneLogin, Keycloak.',
              )}
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" />
            {t('settingsSaml.add', 'Add SAML connection')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {connections.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              {t('settingsSaml.empty', 'No SAML connections configured yet.')}
            </p>
          )}
          {connections.map((row) => (
            <div
              key={row._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-(--border) p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{row.label ?? row.idpEntityId}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: row.enabled ? 'var(--success-bg, #dcfce7)' : 'var(--surface-2)',
                      color: row.enabled ? 'var(--success, #16a34a)' : 'var(--text-muted)',
                    }}
                  >
                    {row.enabled
                      ? t('settingsSaml.enabled', 'Enabled')
                      : t('settingsSaml.disabled', 'Disabled')}
                  </span>
                </div>
                <p className="text-xs text-(--text-muted) truncate">
                  {row.idpSsoUrl} ·{' '}
                  {row.domains.length
                    ? row.domains.join(', ')
                    : t('settingsSaml.allDomains', 'all domains')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copy(
                      `${appUrl}/api/sso/metadata/${row.connectionId}`,
                      t('settingsSaml.copied', 'Copied'),
                    )
                  }
                  aria-label={t('settingsSaml.copyMetadata', 'Copy SP metadata URL')}
                  title={t('settingsSaml.copyMetadata', 'Copy SP metadata URL')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEditing({
                      id: row._id,
                      idpEntityId: row.idpEntityId ?? row.issuer,
                      idpSsoUrl: row.idpSsoUrl ?? '',
                      idpCertificate: '', // write-only — blank keeps the stored cert
                      domains: row.domains.join(', '),
                      label: row.label ?? '',
                      autoProvision: row.autoProvision,
                      enabled: row.enabled,
                    })
                  }
                >
                  {t('integration.configure', 'Configure')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => del(row._id)}
                  disabled={deleting === row._id}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id
                ? t('settingsSaml.editTitle', 'Edit SAML connection')
                : t('settingsSaml.addTitle', 'Add SAML connection')}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  {t('settingsSaml.entityId', 'IdP Entity ID')}
                </label>
                <Input
                  value={editing.idpEntityId}
                  onChange={(e) => setEditing({ ...editing, idpEntityId: e.target.value })}
                  placeholder="https://idp.company.com/saml/metadata"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('settingsSaml.ssoUrl', 'IdP Single Sign-On URL')}
                </label>
                <Input
                  value={editing.idpSsoUrl}
                  onChange={(e) => setEditing({ ...editing, idpSsoUrl: e.target.value })}
                  placeholder="https://idp.company.com/saml/sso"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('settingsSaml.certificate', 'IdP signing certificate (X.509 PEM)')}
                </label>
                <textarea
                  className="w-full rounded-md border border-(--border) bg-transparent p-2 text-xs font-mono"
                  rows={4}
                  value={editing.idpCertificate}
                  onChange={(e) => setEditing({ ...editing, idpCertificate: e.target.value })}
                  placeholder="-----BEGIN CERTIFICATE-----"
                />
                {editing.id && (
                  <p className="text-xs text-(--text-muted) mt-1">
                    {t('settingsSaml.certHint', 'Leave blank to keep the current certificate.')}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t('settingsSaml.domains', 'Allowed email domains')}
                </label>
                <Input
                  value={editing.domains}
                  onChange={(e) => setEditing({ ...editing, domains: e.target.value })}
                  placeholder="company.com, subsidiary.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('settingsSaml.label', 'Label')}</label>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder={t('settingsSaml.labelPlaceholder', 'Okta (HQ)')}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editing.autoProvision}
                  onCheckedChange={(v) => setEditing({ ...editing, autoProvision: v })}
                />
                {t('settingsSaml.autoProvision', 'Auto-create accounts for new users')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editing.enabled}
                  onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                />
                {t('settingsSaml.enabledLabel', 'Enabled')}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <ShieldLoader size="xs" variant="inline" /> : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
