/**
 * Local payment providers (PSPs) — Idram, Ameriabank/ArCa, ArCa acquiring.
 *
 * Why this exists: Stripe does not process ArCa (Armenian local card network)
 * payments, so Armenian SMEs often literally cannot pay a Stripe invoice.
 * Local PSPs cover that gap with their own hosted payment pages + webhooks.
 *
 * Architecture — PSP-agnostic on purpose:
 *   1. `paymentProviderConfigs` — per-deployment credentials + feature flag.
 *      Secrets stay server-only (never returned to the client).
 *   2. `createLocalPayment`     — an admin starts a checkout: the mutation
 *      records an intent row and returns the PSP handshake parameters
 *      (redirect URL / POST fields) for the configured provider.
 *   3. PSP redirects the customer back to `/checkout/local/result`, then the
 *      PSP server → server webhook hits `/api/webhooks/payments/<provider>`
 *      which calls `payments.ingestWebhook` with a verified signature.
 *   4. `ingestWebhook` verifies the HMAC, marks the payment paid and activates
 *      the subscription via `subscriptions.upsertSubscription` (the same path
 *      Stripe uses), so plans/entitlements resolve identically.
 *
 * Adding a provider = adding credentials to the config + a signature verifier
 * + the handshake field mapping here. Nothing else in the product changes.
 */

import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { getAuthCaller } from './lib/getAuthCaller';
import { isSuperadmin } from './lib/auth';
import { requireOrgAdmin } from './lib/rbac';
import { sha256Hex } from './lib/sha256';
import { notify } from './lib/notify';

// ── Webhook signature verification ──────────────────────────────────────────
// HMAC-SHA256 (RFC 2104) built on the pure-TS sha256Hex the document-integrity
// path already uses — no Node crypto needed in mutations.
//
// Encoding note: PSP secrets are ASCII (hex/base64 keys), and XOR-ing an ASCII
// byte with 0x36/0x5c keeps it < 0x80, so the padded key blocks survive the
// UTF-8 encoder inside sha256Hex byte-for-byte. Keys with non-ASCII bytes are
// rejected rather than silently mis-signed.

function hmacSha256Hex(key: string, message: string): string {
  if (!/^[\x00-\x7F]*$/.test(key)) {
    throw new Error('Payment webhook secret must be ASCII');
  }
  const block = 64;
  let keyChars = key;
  if (keyChars.length > block) keyChars = sha256Hex(keyChars);
  // SHA-256 hex is ASCII too.
  keyChars = keyChars.padEnd(block, '\u0000');

  let ipad = '';
  let opad = '';
  for (let i = 0; i < block; i++) {
    const k = keyChars.charCodeAt(i);
    ipad += String.fromCharCode(k ^ 0x36);
    opad += String.fromCharCode(k ^ 0x5c);
  }
  const inner = sha256Hex(ipad + message);
  return sha256Hex(opad + inner);
}

/** Constant-time-ish comparison — never short-circuits on the first byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify a provider webhook signature over the raw request body. */
export function verifyPaymentSignature(
  secretKey: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  try {
    const expected = hmacSha256Hex(secretKey, rawBody);
    return safeEqual(expected, signatureHex.trim().toLowerCase());
  } catch {
    return false;
  }
}

export type PaymentProvider = 'idram' | 'ameriabank' | 'ardshinbank' | 'fastbank';

/** Providers this deployment can accept — set by the superadmin. */
const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  idram: 'Idram',
  ameriabank: 'Ameriabank (ArCa)',
  ardshinbank: 'Ardshinbank (ArCa)',
  fastbank: 'FastBank (ArCa)',
};

// ── Config storage ───────────────────────────────────────────────────────────

// ── Public read (admin) ──────────────────────────────────────────────────────

/** Providers + safe config for the settings/billing UI. Secrets stripped. */
export const listProviderConfigs = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || !isSuperadmin(caller)) return [];
    const rows = await ctx.db.query('paymentProviderConfigs').take(20);
    return rows.map((row) => ({
      provider: row.provider as PaymentProvider,
      label: PROVIDER_LABELS[row.provider as PaymentProvider] ?? row.provider,
      isEnabled: row.isEnabled,
      merchantId: row.merchantId ?? null,
      hasSecret: typeof row.secretKey === 'string' && row.secretKey.length > 0,
      apiUrl: row.apiUrl ?? null,
      successPath: row.successPath ?? null,
      failPath: row.failPath ?? null,
    }));
  },
});

/** Which providers are enabled (any admin — used to show/hide payment options). */
export const listEnabledProviders = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('paymentProviderConfigs').take(20);
    return rows
      .filter((r) => r.isEnabled)
      .map((r) => ({
        provider: r.provider as PaymentProvider,
        label: PROVIDER_LABELS[r.provider as PaymentProvider] ?? r.provider,
      }));
  },
});

// ── Admin config write ───────────────────────────────────────────────────────

export const saveProviderConfig = mutation({
  args: {
    provider: v.union(
      v.literal('idram'),
      v.literal('ameriabank'),
      v.literal('ardshinbank'),
      v.literal('fastbank'),
    ),
    isEnabled: v.boolean(),
    merchantId: v.optional(v.string()),
    /** Omit to keep the stored secret; empty string deletes it. */
    secretKey: v.optional(v.string()),
    apiUrl: v.optional(v.string()),
    successPath: v.optional(v.string()),
    failPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || !isSuperadmin(caller)) {
      throw new Error('Not authorized - superadmin only');
    }
    const existing = await ctx.db
      .query('paymentProviderConfigs')
      .filter((q) => q.eq(q.field('provider'), args.provider))
      .first();

    const { secretKey, ...rest } = args;
    const patch: Record<string, unknown> = { ...rest, updatedAt: Date.now() };
    if (secretKey !== undefined) {
      // Empty string clears the credential (mirrors imID token invalidation).
      patch.secretKey = secretKey === '' ? undefined : secretKey;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert('paymentProviderConfigs', {
      ...args,
      ...(secretKey !== undefined ? { secretKey: secretKey === '' ? undefined : secretKey } : {}),
      updatedAt: Date.now(),
      createdAt: Date.now(),
    } as never);
  },
});

// ── Payment intent ───────────────────────────────────────────────────────────

/**
 * Start a local-provider checkout for the caller's organization.
 * Returns the handshake fields the client needs (post target + fields) or a
 * redirect URL, depending on the provider's flow.
 */
export const createLocalPayment = mutation({
  args: {
    plan: v.union(v.literal('starter'), v.literal('professional'), v.literal('enterprise')),
    provider: v.union(
      v.literal('idram'),
      v.literal('ameriabank'),
      v.literal('ardshinbank'),
      v.literal('fastbank'),
    ),
    /** Months purchased up front (local PSPs rarely do true subscriptions). */
    months: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    await requireOrgAdmin(ctx, caller._id, caller.organizationId!);
    if (!caller.organizationId) throw new Error('No organization');

    const config = await ctx.db
      .query('paymentProviderConfigs')
      .filter((q) => q.eq(q.field('provider'), args.provider))
      .first();
    if (!config?.isEnabled || !config.merchantId) {
      throw new Error(`Payment provider ${args.provider} is not configured`);
    }

    // Amount is authored in USD like the Stripe plans; local providers bill in
    // AMD, so the caller's UI converts at the same rate the pricing page shows
    // and passes `amountAmd` explicitly — the backend never guesses FX.
    const amountByPlan: Record<string, number> = {
      starter: 29,
      professional: 79,
      enterprise: 199,
    };
    const months = args.months ?? 1;
    const usd = (amountByPlan[args.plan] ?? 0) * months;

    const now = Date.now();
    // Provider-agnostic order id: short, unique, traceable in both systems.
    const orderId = `S${now.toString(36).toUpperCase()}${Math.floor(Math.random() * 1296)
      .toString(36)
      .toUpperCase()
      .padStart(2, '0')}`;

    const paymentId = await ctx.db.insert('localPayments', {
      organizationId: caller.organizationId,
      provider: args.provider,
      orderId,
      plan: args.plan,
      months,
      amountUsd: usd,
      status: 'pending',
      createdBy: caller._id,
      createdAt: now,
      updatedAt: now,
    });

    return {
      paymentId,
      orderId,
      provider: args.provider,
      // Idram-style: the customer is POSTed/redirected with these fields.
      merchantId: config.merchantId,
      amountUsd: usd,
      successUrl: config.successPath ?? '/checkout/local/success',
      failUrl: config.failPath ?? '/checkout/local/fail',
    };
  },
});

// ── Webhook ingestion (called from the Next.js API route) ────────────────────

/**
 * PSP → Strata webhook. The HTTP route verifies the HMAC with the stored
 * secret and forwards the normalized payload here; this mutation performs the
 * state change exactly once (idempotent by `orderId`).
 */
export const ingestWebhook = internalMutation({
  args: {
    provider: v.union(
      v.literal('idram'),
      v.literal('ameriabank'),
      v.literal('ardshinbank'),
      v.literal('fastbank'),
    ),
    orderId: v.string(),
    /** PSP transaction/reference id for reconciliation. */
    providerRef: v.optional(v.string()),
    success: v.boolean(),
    amountUsd: v.optional(v.number()),
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('localPayments')
      .filter((q) => q.eq(q.field('orderId'), args.orderId))
      .first();
    if (!payment) {
      throw new Error(`Unknown order: ${args.orderId}`);
    }
    // Idempotency: a PSP retry after success must be a no-op.
    if (payment.status === 'paid') {
      return { duplicate: true };
    }

    const now = Date.now();
    if (!args.success) {
      await ctx.db.patch(payment._id, {
        status: 'failed',
        providerRef: args.providerRef,
        updatedAt: now,
      });
      return { paid: false };
    }

    await ctx.db.patch(payment._id, {
      status: 'paid',
      providerRef: args.providerRef,
      paidAt: now,
      updatedAt: now,
    });

    // Activate the subscription through the same path Stripe uses, so plans,
    // employee limits and billing-catalog pinning behave identically.
    const months = payment.months ?? 1;
    const existing = payment.organizationId
      ? await ctx.db
          .query('subscriptions')
          .withIndex('by_org', (q) => q.eq('organizationId', payment.organizationId!))
          .first()
      : null;

    // Extend from the current period end when re-paying early (no lost days).
    const base =
      existing?.currentPeriodEnd && existing.currentPeriodEnd > now
        ? existing.currentPeriodEnd
        : now;
    const periodEnd = base + months * 30 * 24 * 60 * 60 * 1000;

    await ctx.db.insert('subscriptions', {
      organizationId: payment.organizationId,
      plan: payment.plan,
      status: 'active',
      paymentProvider: payment.provider,
      providerRef: args.providerRef ?? payment.orderId,
      billingCurrency: 'AMD',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      email: undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Keep the org plan/limits in sync (same as upsertSubscription does).
    const PLAN_EMPLOYEE_LIMITS = { starter: 10, professional: 50, enterprise: 999999 } as const;
    if (payment.organizationId) {
      await ctx.db.patch(payment.organizationId, {
        plan: payment.plan,
        employeeLimit: PLAN_EMPLOYEE_LIMITS[payment.plan],
      });
      // Notify org admins that the plan went live.
      const admins = await ctx.db
        .query('users')
        .withIndex('by_org_role', (q) =>
          q.eq('organizationId', payment.organizationId!).eq('role', 'admin'),
        )
        .take(10);
      for (const admin of admins) {
        await notify(ctx, {
          organizationId: payment.organizationId,
          userId: admin._id,
          type: 'system',
          titleKey: 'notifications.titles.paymentConfirmed',
          messageKey: 'notifications.messages.paymentConfirmed',
          params: { provider: PROVIDER_LABELS[payment.provider], plan: payment.plan },
          fallbackTitle: '💳 Payment confirmed',
          fallbackMessage: `${PROVIDER_LABELS[payment.provider]} payment received — ${payment.plan} plan is active.`,
          route: '/settings',
        });
      }
    }

    return { paid: true, periodEnd };
  },
});

// ── Payment history (superadmin) ─────────────────────────────────────────────

export const listLocalPayments = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || !isSuperadmin(caller)) return [];
    const rows = await ctx.db.query('localPayments').take(200);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** The caller's own organization payments (admin visibility). */
export const listMyPayments = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller?.organizationId) return [];
    const rows = await ctx.db
      .query('localPayments')
      .filter((q) => q.eq(q.field('organizationId'), caller.organizationId))
      .take(50);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});
