/**
 * Customer API keys — management (settings UI) plus machine-request
 * authorization (the HTTP layer).
 *
 * The two halves are deliberately asymmetric:
 *
 *   - `createApiKey` / `listApiKeys` / `setApiKeyEnabled` / `revokeApiKey` run
 *     the normal human path: `getAuthCaller` + an org-admin check.
 *   - `authorizeApiRequest` runs the machine path. There is no user session, so
 *     the usual `assertModuleAccess` (which resolves the plan from the caller's
 *     identity) cannot be used — the organization is resolved from the key
 *     itself, and the plan gate and monthly quota are evaluated against that
 *     organization directly. Getting this backwards would let a key outlive a
 *     downgrade.
 */

import { v } from 'convex/values';
import { query, mutation, internalMutation } from './_generated/server';
import { getAuthCaller } from './lib/getAuthCaller';
import type { Id } from './_generated/dataModel';
import { sha256Hex } from './lib/sha256';
import { API_SCOPES, apiKeyPrefix, generateApiKey, normalizeScopes } from './lib/apiKey';
import {
  currentPeriodKey,
  getOrgEntitlements,
  getUsageCount,
  incrementUsage,
} from './lib/entitlements';

/** Denormalized module/usage keys the public API is metered under. */
const API_MODULE_KEY = 'apiAccess';
const API_USAGE_KEY = 'apiCalls';

function assertOrgManager(
  caller: { role: string; organizationId?: Id<'organizations'> } | null,
  action: string,
): Id<'organizations'> {
  if (!caller) throw new Error('Not authenticated');
  if (caller.role === 'superadmin') {
    if (!caller.organizationId) throw new Error('Superadmin has no organization context');
    return caller.organizationId;
  }
  if (caller.role !== 'admin' || !caller.organizationId) {
    throw new Error(`Only organization admins can ${action}`);
  }
  return caller.organizationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Management (settings UI)
// ─────────────────────────────────────────────────────────────────────────────

/** Keys for the caller's organization. Secrets are never returned — only the prefix. */
export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller || !caller.organizationId) return [];
    if (caller.role !== 'admin' && caller.role !== 'superadmin') return [];
    const rows = await ctx.db
      .query('apiKeys')
      .withIndex('by_org', (q) => q.eq('organizationId', caller.organizationId!))
      .collect();
    return rows
      .map((row) => ({
        _id: row._id,
        label: row.label,
        prefix: row.prefix,
        scopes: row.scopes,
        enabled: row.enabled,
        lastUsedAt: row.lastUsedAt ?? null,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Create a key. Returns the raw value exactly once — only its SHA-256 is
 * persisted, so a lost key is rotated, never recovered.
 */
export const createApiKey = mutation({
  args: {
    label: v.optional(v.string()),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage API keys');

    const scopes = normalizeScopes(args.scopes);
    if (scopes.length === 0) {
      throw new Error(`Select at least one scope (available: ${API_SCOPES.join(', ')})`);
    }

    const raw = generateApiKey();
    const now = Date.now();
    const keyId = await ctx.db.insert('apiKeys', {
      organizationId,
      label: args.label?.trim() || 'Untitled key',
      keyHash: sha256Hex(raw),
      prefix: apiKeyPrefix(raw),
      scopes,
      enabled: true,
      createdBy: caller!._id as Id<'users'>,
      createdAt: now,
    });

    await ctx.db.insert('auditLogs', {
      organizationId,
      userId: caller!._id as Id<'users'>,
      action: 'api_key.created',
      target: keyId,
      details: JSON.stringify({ label: args.label ?? null, scopes }),
      createdAt: now,
    });

    return { keyId, key: raw, prefix: apiKeyPrefix(raw) };
  },
});

/** Enable or disable a key without losing it. */
export const setApiKeyEnabled = mutation({
  args: { keyId: v.id('apiKeys'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage API keys');
    const row = await ctx.db.get(args.keyId);
    if (!row || row.organizationId !== organizationId) throw new Error('API key not found');
    await ctx.db.patch(args.keyId, { enabled: args.enabled });
    return { success: true };
  },
});

/** Revoke a key permanently. */
export const revokeApiKey = mutation({
  args: { keyId: v.id('apiKeys') },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    const organizationId = assertOrgManager(caller, 'manage API keys');
    const row = await ctx.db.get(args.keyId);
    if (!row || row.organizationId !== organizationId) throw new Error('API key not found');
    const now = Date.now();
    await ctx.db.insert('auditLogs', {
      organizationId,
      userId: caller!._id as Id<'users'>,
      action: 'api_key.revoked',
      target: args.keyId,
      details: JSON.stringify({ label: row.label, prefix: row.prefix }),
      createdAt: now,
    });
    await ctx.db.delete(args.keyId);
    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Machine authorization (called from the HTTP layer)
// ─────────────────────────────────────────────────────────────────────────────

export type ApiAuthorization =
  | {
      ok: true;
      organizationId: Id<'organizations'>;
      keyId: Id<'apiKeys'>;
      scopes: string[];
      /** Calls used this month after this one, and the plan limit (null = unlimited). */
      used: number;
      limit: number | null;
    }
  | { ok: false; status: number; error: string };

/**
 * Authenticate one API request and charge it against the organization's plan.
 *
 * A mutation rather than a query because it is not idempotent by design: each
 * call stamps `lastUsedAt` and increments the monthly counter, which is what
 * makes the metered plan real instead of decorative.
 *
 * Every failure path returns a status + message rather than throwing, so the
 * HTTP layer can answer 401/403/402/429 precisely. Throwing would collapse all
 * of them into a 500 and hide a misconfigured key from the customer.
 */
export const authorizeApiRequest = internalMutation({
  args: {
    rawKey: v.string(),
    /** Scope the endpoint requires; omit for endpoints any valid key may read. */
    requiredScope: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ApiAuthorization> => {
    const keyHash = sha256Hex(args.rawKey);
    const row = await ctx.db
      .query('apiKeys')
      .withIndex('by_hash', (q) => q.eq('keyHash', keyHash))
      .first();

    // One message for "unknown" and "revoked" alike: distinguishing them tells
    // an attacker which of their guesses was once real.
    if (!row || row.revokedAt) {
      return { ok: false, status: 401, error: 'Invalid API key' };
    }
    if (!row.enabled) {
      return { ok: false, status: 403, error: 'This API key is disabled' };
    }
    if (args.requiredScope && !row.scopes.includes(args.requiredScope)) {
      return {
        ok: false,
        status: 403,
        error: `This key lacks the "${args.requiredScope}" scope`,
      };
    }

    // Plan gate, resolved from the key's organization — not from a caller
    // identity, because a machine request has none.
    const entitlements = await getOrgEntitlements(ctx, row.organizationId);
    const ent = entitlements.moduleMap[API_MODULE_KEY];
    if (!ent?.included) {
      return {
        ok: false,
        status: 402,
        error: `API access is not included in the ${entitlements.planName} plan`,
      };
    }

    const rawLimit = ent.limits?.[API_USAGE_KEY];
    const limit = typeof rawLimit === 'number' && rawLimit > 0 ? rawLimit : null;
    const period = currentPeriodKey();
    const used = await getUsageCount(
      ctx,
      row.organizationId,
      API_MODULE_KEY,
      API_USAGE_KEY,
      period,
    );

    if (limit !== null && used >= limit) {
      return {
        ok: false,
        status: 429,
        error: `Monthly API call limit reached (${limit}) on the ${entitlements.planName} plan`,
      };
    }

    await ctx.db.patch(row._id, { lastUsedAt: Date.now() });
    await incrementUsage(ctx, row.organizationId, API_MODULE_KEY, API_USAGE_KEY, 1, period);

    return {
      ok: true,
      organizationId: row.organizationId,
      keyId: row._id,
      scopes: row.scopes,
      used: used + 1,
      limit,
    };
  },
});
