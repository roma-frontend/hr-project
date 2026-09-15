'use client';

/**
 * Return landing for a local-PSP checkout (Idram / ArCa).
 *
 * Deliberately does NOT claim the plan is active: reaching this page only means
 * the customer's browser came back. The subscription is activated by the PSP's
 * server-to-server webhook (`/webhooks/payments/<provider>`), which may land a
 * few seconds later. Saying "paid" here on a browser redirect is how a
 * trivially forgeable URL becomes free Enterprise — so the copy stays honest.
 */

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export function LocalResultClient({ outcome }: { outcome: 'success' | 'fail' }) {
  const { t } = useTranslation();
  const params = useSearchParams();
  const orderId = params.get('orderId') ?? params.get('orderid') ?? params.get('EDP_ORDERID');
  const provider = params.get('provider');

  const ok = outcome === 'success';
  const Icon = ok ? CheckCircle2 : XCircle;

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--card)/70 p-8 text-center backdrop-blur-xl">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: ok
              ? 'color-mix(in srgb, var(--success) 18%, transparent)'
              : 'color-mix(in srgb, var(--danger, #ef4444) 18%, transparent)',
          }}
        >
          <Icon
            className="h-7 w-7"
            style={{ color: ok ? 'var(--success)' : 'var(--danger, #ef4444)' }}
          />
        </div>

        <h1 className="text-lg font-bold tracking-tight">
          {ok
            ? t('billing.localResult.successTitle', 'Payment received')
            : t('billing.localResult.failTitle', 'Payment not completed')}
        </h1>

        <p className="mt-2 text-xs text-(--text-muted)">
          {ok
            ? t(
                'billing.localResult.successBody',
                'Your bank confirmed the payment. The plan activates as soon as the provider notifies us — usually a few seconds.',
              )
            : t(
                'billing.localResult.failBody',
                'The provider did not confirm the payment. No charge was applied — you can try again from the billing page.',
              )}
        </p>

        {ok && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-(--border) bg-(--background-subtle) p-3 text-left">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--text-muted)" />
            <p className="text-[11px] text-(--text-muted)">
              {t(
                'billing.localResult.activationHint',
                'If the plan still shows as inactive after a minute, the provider webhook did not arrive. Quote the order id below to support.',
              )}
            </p>
          </div>
        )}

        {orderId && (
          <p className="mt-4 font-mono text-[11px] text-(--text-secondary)">
            {t('billing.localResult.order', 'Order')}: {orderId}
            {provider ? ` · ${provider}` : ''}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/settings"
            className="rounded-xl border border-(--border) px-4 py-2 text-xs font-medium text-(--text-secondary) transition hover:bg-(--background-subtle)"
          >
            {t('billing.localResult.backToBilling', 'Back to billing')}
          </Link>
          {!ok && (
            <Link
              href="/settings"
              className="rounded-xl bg-(--primary) px-4 py-2 text-xs font-semibold text-white"
            >
              {t('billing.localResult.tryAgain', 'Try again')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default LocalResultClient;
