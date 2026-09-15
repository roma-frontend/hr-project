/**
 * Local payment providers — the superadmin's merchant-onboarding console.
 *
 * Why this screen exists: Stripe does not process ArCa (the Armenian local card
 * network), so an Armenian SME often cannot pay a Stripe invoice at all. Idram
 * and the ArCa-acquiring banks close that gap, but each needs a merchant
 * account, a webhook secret and an endpoint that lived only in code before —
 * there was no way to configure any of it from the product.
 *
 * This page is the missing operator surface for `convex/payments.ts`:
 *   - one card per provider: enable, merchant id, webhook secret, endpoint,
 *     and the return paths the PSP sends the customer back to;
 *   - the webhook URL to paste into the bank's / Idram's merchant cabinet,
 *     derived from the Convex site URL so it cannot drift from reality;
 *   - the local payment ledger, so a payment that never flipped to `paid` is
 *     visible here instead of only in the database.
 *
 * Secrets are write-only: `listProviderConfigs` reports `hasSecret`, never the
 * value, and an empty field on save deliberately clears the stored secret.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BadgeCheck, Copy, KeyRound, Landmark, ShieldAlert, Wallet } from 'lucide-react';

import { api } from '@/convex/_generated/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { convexSiteUrl } from '@/lib/convexSiteUrl';

type ProviderKey = 'idram' | 'ameriabank' | 'ardshinbank' | 'fastbank';

const PROVIDERS: { key: ProviderKey; label: string; kind: 'wallet' | 'acquiring' }[] = [
  { key: 'idram', label: 'Idram', kind: 'wallet' },
  { key: 'ameriabank', label: 'Ameriabank (ArCa)', kind: 'acquiring' },
  { key: 'ardshinbank', label: 'Ardshinbank (ArCa)', kind: 'acquiring' },
  { key: 'fastbank', label: 'FastBank (ArCa)', kind: 'acquiring' },
];

interface ProviderDraft {
  isEnabled: boolean;
  merchantId: string;
  secretKey: string;
  apiUrl: string;
  successPath: string;
  failPath: string;
}

const EMPTY_DRAFT: ProviderDraft = {
  isEnabled: false,
  merchantId: '',
  secretKey: '',
  apiUrl: '',
  successPath: '',
  failPath: '',
};

function ProviderCard({
  provider,
  stored,
}: {
  provider: (typeof PROVIDERS)[number];
  stored?: {
    isEnabled: boolean;
    merchantId: string | null;
    hasSecret: boolean;
    apiUrl: string | null;
    successPath: string | null;
    failPath: string | null;
  };
}) {
  const { t } = useTranslation();
  const saveProviderConfig = useMutation(api.payments.saveProviderConfig);
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Seed the form from stored config whenever it changes (or first loads).
  useEffect(() => {
    if (!stored) return;
    setDraft({
      isEnabled: stored.isEnabled,
      merchantId: stored.merchantId ?? '',
      // Never prefilled: the secret is write-only by design.
      secretKey: '',
      apiUrl: stored.apiUrl ?? '',
      successPath: stored.successPath ?? '',
      failPath: stored.failPath ?? '',
    });
  }, [stored]);

  const webhookUrl = `${convexSiteUrl()}/webhooks/payments/${provider.key}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProviderConfig({
        provider: provider.key,
        isEnabled: draft.isEnabled,
        merchantId: draft.merchantId.trim() || undefined,
        // undefined keeps the stored secret; '' clears it.
        secretKey: draft.secretKey === '' ? undefined : draft.secretKey,
        apiUrl: draft.apiUrl.trim() || undefined,
        successPath: draft.successPath.trim() || undefined,
        failPath: draft.failPath.trim() || undefined,
      });
      setDraft((d) => ({ ...d, secretKey: '' }));
      toast.success(
        t('billing.localPayments.saved', '{{provider}} settings saved', {
          provider: provider.label,
        }),
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('billing.localPayments.saveFailed', 'Could not save provider settings'),
      );
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success(t('billing.localPayments.copied', 'Webhook URL copied'));
    } catch {
      toast.error(webhookUrl);
    }
  };

  const field = (
    key: keyof ProviderDraft,
    label: string,
    opts: { placeholder?: string; type?: string; hint?: string } = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${provider.key}-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`${provider.key}-${key}`}
        type={opts.type ?? 'text'}
        value={draft[key] as string}
        placeholder={opts.placeholder}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
      {opts.hint && <p className="text-[11px] text-(--text-muted)">{opts.hint}</p>}
    </div>
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--border) bg-(--background-subtle)">
            {provider.kind === 'wallet' ? (
              <Wallet className="h-5 w-5 text-(--text-secondary)" />
            ) : (
              <Landmark className="h-5 w-5 text-(--text-secondary)" />
            )}
          </div>
          <div>
            <CardTitle className="text-sm">{provider.label}</CardTitle>
            <CardDescription className="text-[11px]">
              {provider.kind === 'wallet'
                ? t('billing.localPayments.walletKind', 'Wallet / EDP payment page')
                : t('billing.localPayments.acquiringKind', 'ArCa card acquiring')}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stored?.hasSecret ? (
            <Badge variant="success" className="gap-1 text-[10px]">
              <KeyRound className="h-3 w-3" />
              {t('billing.localPayments.secretSet', 'Secret set')}
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1 text-[10px]">
              <ShieldAlert className="h-3 w-3" />
              {t('billing.localPayments.noSecret', 'No secret')}
            </Badge>
          )}
          <Switch
            checked={draft.isEnabled}
            onCheckedChange={(v: boolean) => setDraft((d) => ({ ...d, isEnabled: v }))}
            aria-label={t('billing.localPayments.enable', 'Enable {{provider}}', {
              provider: provider.label,
            })}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {field('merchantId', t('billing.localPayments.merchantId', 'Merchant / shop ID'), {
          placeholder: 'e.g. 123456789',
        })}
        {field('secretKey', t('billing.localPayments.secretKey', 'Webhook secret'), {
          type: 'password',
          placeholder: stored?.hasSecret
            ? t('billing.localPayments.secretKeep', 'Stored — leave blank to keep')
            : t('billing.localPayments.secretEnter', 'Paste the PSP signing key'),
        })}
        {field('apiUrl', t('billing.localPayments.apiUrl', 'Endpoint override'), {
          placeholder:
            provider.key === 'idram'
              ? 'https://banking.idram.am/Payment/GetPayment'
              : 'https://.../payment/register',
          hint: t(
            'billing.localPayments.apiUrlHint',
            'Sandbox and production hosts differ — leave blank for the provider default.',
          ),
        })}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('successPath', t('billing.localPayments.successPath', 'Success path'), {
            placeholder: '/checkout/local/success',
          })}
          {field('failPath', t('billing.localPayments.failPath', 'Failure path'), {
            placeholder: '/checkout/local/fail',
          })}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            {t('billing.localPayments.webhookUrl', 'Webhook URL (paste into the PSP cabinet)')}
          </Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-(--border) bg-(--background-subtle) px-3 py-2 text-[11px] text-(--text-secondary)">
              {webhookUrl}
            </code>
            <Button type="button" variant="secondary" size="icon" onClick={copyWebhook}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-(--text-muted)">
            {t(
              'billing.localPayments.hmacHint',
              'Payloads are signed with HMAC-SHA256 over the raw body.',
            )}
          </p>
          <Button onClick={handleSave} disabled={saving}>
            <BadgeCheck className="mr-1.5 h-4 w-4" />
            {saving
              ? t('billing.localPayments.saving', 'Saving…')
              : t('billing.localPayments.save', 'Save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'paid') return 'success';
  if (status === 'failed') return 'destructive';
  if (status === 'pending') return 'warning';
  return 'secondary';
}

export function PaymentProvidersClient() {
  const { t } = useTranslation();
  const configs = useQuery(api.payments.listProviderConfigs);
  const payments = useQuery(api.payments.listLocalPayments);

  const byProvider = useMemo(() => {
    const map = new Map<string, NonNullable<typeof configs>[number]>();
    for (const c of configs ?? []) map.set(c.provider, c);
    return map;
  }, [configs]);

  const loading = configs === undefined || payments === undefined;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-(--border) bg-(--background-subtle)">
          <Landmark className="h-5 w-5 text-(--primary)" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            {t('billing.localPayments.title', 'Local payment providers')}
          </h1>
          <p className="text-xs text-(--text-muted)">
            {t(
              'billing.localPayments.subtitle',
              'Idram and ArCa acquiring — the payment rails Stripe cannot process in Armenia. A provider only appears to customers once it is enabled and has a secret.',
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {PROVIDERS.map((p) => (
            <Skeleton key={p.key} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {PROVIDERS.map((p) => (
            <ProviderCard key={p.key} provider={p} stored={byProvider.get(p.key)} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {t('billing.localPayments.ledgerTitle', 'Local payment ledger')}
          </CardTitle>
          <CardDescription className="text-[11px]">
            {t(
              'billing.localPayments.ledgerSubtitle',
              'Every local checkout, newest first. A pending row with no webhook is a payment the PSP never confirmed.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : payments.length === 0 ? (
            <p className="py-6 text-center text-xs text-(--text-muted)">
              {t('billing.localPayments.ledgerEmpty', 'No local payments yet.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wide text-(--text-muted)">
                  <tr>
                    <th className="py-2 pr-4 font-medium">
                      {t('billing.localPayments.colOrder', 'Order')}
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      {t('billing.localPayments.colProvider', 'Provider')}
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      {t('billing.localPayments.colPlan', 'Plan')}
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      {t('billing.localPayments.colAmount', 'Amount')}
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      {t('billing.localPayments.colStatus', 'Status')}
                    </th>
                    <th className="py-2 font-medium">
                      {t('billing.localPayments.colCreated', 'Created')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id} className="border-t border-(--border)">
                      <td className="py-2 pr-4 font-mono text-[11px]">{p.orderId}</td>
                      <td className="py-2 pr-4 capitalize">{p.provider}</td>
                      <td className="py-2 pr-4 capitalize">{p.plan}</td>
                      <td className="py-2 pr-4">
                        ${p.amountUsd}
                        {typeof p.months === 'number' && p.months > 1 ? ` × ${p.months}mo` : ''}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusVariant(p.status)} className="text-[10px]">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-(--text-muted)">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentProvidersClient;
