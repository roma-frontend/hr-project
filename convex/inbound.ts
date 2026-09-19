/**
 * Inbound integrations — token management, device punches, Jira events.
 *
 * Direction of travel: *into* Strata. The outbound engine lives in
 * `convex/webhooks/`; this is its mirror, and the two share one idea: the tenant
 * decides what leaves, the tenant decides what may arrive.
 *
 * Why a journal for device punches instead of writing straight into
 * `timeTracking`: that table drives lateness, worked minutes and overtime, i.e.
 * payroll. A terminal can push a typo, a duplicate, or a packet from a clock set
 * to 2019 — none of that should be able to move money. Punches land in
 * `devicePunches`, get matched to an employee by табельный номер, and HR
 * promotes the real ones. The promotion deliberately calls the *existing*
 * `timeTracking.checkIn` / `checkOut` mutations (from the settings UI) rather
 * than reimplementing their rules here — there is exactly one implementation of
 * "what counts as late", and it is not in this file.
 */
import { v } from 'convex/values';
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Id } from './_generated/dataModel';
import { getAuthCaller } from './lib/getAuthCaller';
import { sha256Hex } from './lib/sha256';
import { normalizeJiraEvent } from './lib/inboundPayload';
import { normalizeSerial } from './lib/zkteco';

const TOKEN_PREFIX = 'inb_';
/** Newest punches the review queue returns in one page. */
const PUNCH_PAGE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the caller to an organization they may administer.
 *
 * The same rule the webhook endpoints follow: superadmins act on their own
 * organization, and nobody acts on another tenant's rows.
 */
async function assertOrgManager(
  ctx: QueryCtx | MutationCtx,
  action: string,
): Promise<{ userId: Id<'users'>; organizationId: Id<'organizations'> }> {
  const caller = await getAuthCaller(ctx);
  if (!caller) throw new Error('Not authenticated');
  const admin = caller.role === 'admin' || caller.role === 'superadmin';
  if (!admin) throw new Error(`Only organization admins can ${action}`);
  if (!caller.organizationId) throw new Error('No organization on this account');
  return { userId: caller._id as Id<'users'>, organizationId: caller.organizationId };
}

/**
 * 256 bits of entropy, hex-encoded, prefixed so a leaked string is recognisable
 * in a log or a screenshot.
 */
function generateInboundToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return (
    TOKEN_PREFIX +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Mint a token. The secret is returned exactly once — only its hash is stored,
 * so the settings page can never show it again (mirrors API keys).
 */
export const mintInboundToken = mutation({
  args: {
    provider: v.union(v.literal('device'), v.literal('jira'), v.literal('generic')),
    label: v.string(),
    defaultAssigneeId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await assertOrgManager(ctx, 'create inbound tokens');
    const label = args.label.trim();
    if (!label) throw new Error('Give the token a name');

    if (args.provider === 'jira' && args.defaultAssigneeId) {
      // A task must belong to this tenant; refuse an assignee from elsewhere.
      const assignee = await ctx.db.get(args.defaultAssigneeId);
      if (!assignee || assignee.organizationId !== organizationId) {
        throw new Error('Assignee must be a member of this organization');
      }
    }

    const raw = generateInboundToken();
    const tokenId = await ctx.db.insert('inboundTokens', {
      organizationId,
      provider: args.provider,
      label,
      tokenHash: sha256Hex(raw),
      tokenHint: raw.slice(-4),
      enabled: true,
      defaultAssigneeId: args.provider === 'jira' ? args.defaultAssigneeId : undefined,
      createdAt: Date.now(),
      createdBy: userId,
      receivedCount: 0,
    });

    return { tokenId, token: raw };
  },
});

/** Tokens of this organization, without the hash. */
export const listInboundTokens = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await assertOrgManager(ctx, 'list inbound tokens');
    const rows = await ctx.db
      .query('inboundTokens')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map(({ tokenHash, ...rest }) => rest);
  },
});

export const setInboundTokenEnabled = mutation({
  args: { tokenId: v.id('inboundTokens'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { organizationId } = await assertOrgManager(ctx, 'change inbound tokens');
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.organizationId !== organizationId) {
      throw new Error('Token not found');
    }
    await ctx.db.patch(args.tokenId, { enabled: args.enabled });
    return { ok: true };
  },
});

/**
 * Revoke a token. The URL stops working immediately; already-received punches
 * stay in the journal so the evidence trail survives.
 */
export const deleteInboundToken = mutation({
  args: { tokenId: v.id('inboundTokens') },
  handler: async (ctx, args) => {
    const { organizationId } = await assertOrgManager(ctx, 'delete inbound tokens');
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.organizationId !== organizationId) {
      throw new Error('Token not found');
    }
    await ctx.db.delete(args.tokenId);
    return { ok: true };
  },
});

/**
 * Point a physical terminal at this token by serial number.
 *
 * The SN is what a ZKTeco device was configured with in its own menu; it cannot
 * be rotated from our side, so the checks matter:
 *   - only `device` tokens may carry one (a Jira token with a serial is a
 *     configuration mistake, not a feature),
 *   - a serial belongs to exactly one token across the whole platform — a typo
 *     would otherwise let one tenant's terminal write into another tenant's
 *     journal, which is the one failure mode this must never allow.
 * Pass an empty string to detach a device (e.g. before decommissioning it).
 */
export const setDeviceSerial = mutation({
  args: { tokenId: v.id('inboundTokens'), deviceSerial: v.string() },
  handler: async (ctx, args) => {
    const { organizationId } = await assertOrgManager(ctx, 'configure device serials');
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.organizationId !== organizationId) {
      throw new Error('Token not found');
    }
    if (token.provider !== 'device') {
      throw new Error('Only device tokens can be bound to a terminal serial number');
    }

    const serial = normalizeSerial(args.deviceSerial);
    if (!serial) {
      await ctx.db.patch(args.tokenId, { deviceSerial: undefined });
      return { ok: true, deviceSerial: null };
    }

    const existing = await ctx.db
      .query('inboundTokens')
      .withIndex('by_device_serial', (q) => q.eq('deviceSerial', serial))
      .first();
    if (existing && existing._id !== args.tokenId) {
      throw new Error(`Serial ${serial} is already bound to another integration`);
    }

    await ctx.db.patch(args.tokenId, { deviceSerial: serial });
    return { ok: true, deviceSerial: serial };
  },
});

/**
 * Which tenant does this terminal belong to? Used by the `/iclock/*` routes,
 * which receive a serial number and nothing else — the device has no secret URL
 * and no headers we may trust.
 */
export const resolveTokenByDeviceSerial = internalQuery({
  args: { deviceSerial: v.string() },
  handler: async (ctx, args) => {
    const serial = normalizeSerial(args.deviceSerial);
    if (!serial) return null;
    const token = await ctx.db
      .query('inboundTokens')
      .withIndex('by_device_serial', (q) => q.eq('deviceSerial', serial))
      .first();
    if (!token) return null;
    return {
      tokenId: token._id,
      organizationId: token.organizationId,
      provider: token.provider,
      enabled: token.enabled,
      label: token.label,
      deviceSerial: token.deviceSerial ?? serial,
    };
  },
});

/** Which token is this URL? Used by the HTTP route before anything is written. */
export const resolveInboundToken = internalQuery({
  args: { raw: v.string() },
  handler: async (ctx, args) => {
    if (!args.raw.startsWith(TOKEN_PREFIX)) return null;
    const token = await ctx.db
      .query('inboundTokens')
      .withIndex('by_hash', (q) => q.eq('tokenHash', sha256Hex(args.raw)))
      .first();
    if (!token) return null;
    return {
      tokenId: token._id,
      organizationId: token.organizationId,
      provider: token.provider,
      enabled: token.enabled,
      defaultAssigneeId: token.defaultAssigneeId ?? null,
      createdBy: token.createdBy,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Device punches (ZKTeco / Suprema)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a табельный номер to an employee of this organization.
 *
 * Normalizes case and surrounding spaces: a device configured as `1024` and a
 * profile that says `1024 ` are the same person, and a punch journal full of
 * near-misses is worse than useless.
 */
async function findUserByEmployeeNumber(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  employeeNumber: string,
): Promise<Id<'users'> | null> {
  const wanted = employeeNumber.trim().toLowerCase();
  const rows = await ctx.db
    .query('users')
    .withIndex('by_org_employee_number', (q) => q.eq('organizationId', organizationId))
    .collect();
  const match = rows.find(
    (row) => (row.employeeNumber ?? '').trim().toLowerCase() === wanted && row.isActive,
  );
  return match?._id ?? null;
}

/**
 * Store one push. Unmatched punches are kept (HR can add the табельный номер
 * and re-run the match); nothing is silently dropped.
 */
export const ingestDevicePunches = internalMutation({
  args: {
    tokenId: v.id('inboundTokens'),
    organizationId: v.id('organizations'),
    punches: v.array(
      v.object({
        employeeNumber: v.string(),
        punchAt: v.number(),
        direction: v.union(v.literal('in'), v.literal('out'), v.literal('unknown')),
      }),
    ),
    raw: v.string(),
  },
  handler: async (ctx, args) => {
    let recorded = 0;
    let unmatched = 0;
    let duplicates = 0;
    const now = Date.now();

    // Read this token's history once: the duplicate check below is per punch,
    // and a device that batches 200 punches should not cause 200 scans.
    const seen = await ctx.db
      .query('devicePunches')
      .withIndex('by_token_time', (q) => q.eq('tokenId', args.tokenId))
      .collect();
    const seenKeys = new Set(
      seen
        .filter((row) => row.status !== 'ignored')
        .map(
          (row) => `${row.employeeNumberRaw}|${Math.floor(row.punchAt / 60_000)}|${row.direction}`,
        ),
    );

    for (const punch of args.punches) {
      const userId = await findUserByEmployeeNumber(ctx, args.organizationId, punch.employeeNumber);

      // Same employee, same minute, same direction = the terminal retried the
      // push (or a batch overlapped). Keeping the second copy would later ask HR
      // to import the same event twice.
      const key = `${punch.employeeNumber}|${Math.floor(punch.punchAt / 60_000)}|${punch.direction}`;
      const duplicate = seenKeys.has(key);
      seenKeys.add(key);

      await ctx.db.insert('devicePunches', {
        organizationId: args.organizationId,
        tokenId: args.tokenId,
        employeeNumberRaw: punch.employeeNumber,
        userId: userId ?? undefined,
        punchAt: punch.punchAt,
        direction: punch.direction,
        status: duplicate ? 'duplicate' : userId ? 'pending' : 'unmatched',
        raw: args.raw.slice(0, 2000),
        createdAt: now,
      });
      if (duplicate) {
        duplicates += 1;
        continue;
      }
      if (userId) recorded += 1;
      else unmatched += 1;
    }

    const token = await ctx.db.get(args.tokenId);
    await ctx.db.patch(args.tokenId, {
      lastUsedAt: now,
      receivedCount: (token?.receivedCount ?? 0) + args.punches.length,
    });

    return { recorded, unmatched, duplicates, total: args.punches.length };
  },
});

/** Review queue: newest punches first, optionally filtered by status. */
export const listDevicePunches = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('unmatched'),
        v.literal('imported'),
        v.literal('ignored'),
        v.literal('duplicate'),
      ),
    ),
    tokenId: v.optional(v.id('inboundTokens')),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await assertOrgManager(ctx, 'read device punches');
    const rows = args.tokenId
      ? await ctx.db
          .query('devicePunches')
          .withIndex('by_token_time', (q) => q.eq('tokenId', args.tokenId!))
          .collect()
      : await ctx.db
          .query('devicePunches')
          .withIndex('by_org_status', (q) =>
            args.status
              ? q.eq('organizationId', organizationId).eq('status', args.status)
              : q.eq('organizationId', organizationId),
          )
          .collect();

    return rows
      .filter((row) => row.organizationId === organizationId)
      .filter((row) => (args.status ? row.status === args.status : true))
      .sort((a, b) => b.punchAt - a.punchAt)
      .slice(0, PUNCH_PAGE)
      .map((row) => ({
        _id: row._id,
        employeeNumberRaw: row.employeeNumberRaw,
        userId: row.userId ?? null,
        punchAt: row.punchAt,
        direction: row.direction,
        status: row.status,
        note: row.note ?? null,
        timeTrackingId: row.timeTrackingId ?? null,
      }));
  },
});

/**
 * Remember that a punch became a check-in/check-out.
 *
 * The write to `timeTracking` is the existing `checkIn`/`checkOut` mutation,
 * called from the settings UI by the same admin (it already accepts `userId` +
 * `occurredAt` for exactly this "HR corrects attendance" case). This mutation
 * only records the link, so payroll rules keep living in one place.
 */
export const markPunchImported = mutation({
  args: { punchId: v.id('devicePunches'), timeTrackingId: v.id('timeTracking') },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await assertOrgManager(ctx, 'review device punches');
    const punch = await ctx.db.get(args.punchId);
    if (!punch || punch.organizationId !== organizationId) throw new Error('Punch not found');
    if (!punch.userId) throw new Error('Match the punch to an employee first');

    const entry = await ctx.db.get(args.timeTrackingId);
    if (!entry || entry.userId !== punch.userId) {
      throw new Error('That attendance row does not belong to the matched employee');
    }

    await ctx.db.patch(args.punchId, {
      status: 'imported',
      timeTrackingId: args.timeTrackingId,
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const ignorePunch = mutation({
  args: { punchId: v.id('devicePunches'), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await assertOrgManager(ctx, 'review device punches');
    const punch = await ctx.db.get(args.punchId);
    if (!punch || punch.organizationId !== organizationId) throw new Error('Punch not found');

    await ctx.db.patch(args.punchId, {
      status: 'ignored',
      note: args.note?.trim() || undefined,
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Set an employee's табельный номер (and re-match their pending punches).
 *
 * This is the fix for an unmatched punch: HR fills in the number instead of
 * retyping the punch, and the journal repairs itself.
 */
export const setEmployeeNumber = mutation({
  args: { userId: v.id('users'), employeeNumber: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId: reviewerId, organizationId } = await assertOrgManager(
      ctx,
      'set employee numbers',
    );
    const user = await ctx.db.get(args.userId);
    if (!user || user.organizationId !== organizationId) throw new Error('Employee not found');

    const employeeNumber = args.employeeNumber?.trim() || undefined;

    if (employeeNumber) {
      // Two employees sharing a number means every punch is a coin flip.
      const clash = await ctx.db
        .query('users')
        .withIndex('by_org_employee_number', (q) =>
          q.eq('organizationId', organizationId).eq('employeeNumber', employeeNumber),
        )
        .first();
      if (clash && clash._id !== args.userId) {
        throw new Error(`Табельный номер ${employeeNumber} is already used by another employee`);
      }
    }

    await ctx.db.patch(args.userId, { employeeNumber });

    // Re-match this person's unmatched punches (oldest first, so the review
    // queue reads chronologically).
    const punches = await ctx.db
      .query('devicePunches')
      .withIndex('by_org_status', (q) =>
        q.eq('organizationId', organizationId).eq('status', 'unmatched'),
      )
      .collect();
    let rematched = 0;
    for (const punch of punches) {
      if (
        employeeNumber &&
        punch.employeeNumberRaw.trim().toLowerCase() === employeeNumber.toLowerCase()
      ) {
        await ctx.db.patch(punch._id, { userId: args.userId, status: 'pending' });
        rematched += 1;
      }
    }

    return { ok: true, rematched, reviewedBy: reviewerId };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Jira → task
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn a Jira issue event into a task.
 *
 * The assignee is the one configured on the token (no guessing), and the task is
 * created by the token's creator so the audit trail names a real person. Only
 * issue events create tasks: a comment on an existing issue is noise on a board.
 */
export const ingestJiraEvent = internalMutation({
  args: {
    tokenId: v.id('inboundTokens'),
    organizationId: v.id('organizations'),
    payload: v.any(),
    raw: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) return { created: false, reason: 'token-missing' as const };

    const event = normalizeJiraEvent(args.payload);
    if (!event) return { created: false, reason: 'unrecognized-payload' as const };

    const assigneeId = token.defaultAssigneeId;
    if (!assigneeId) {
      await reportTokenError(ctx, args.tokenId, 'No default assignee configured');
      return { created: false, reason: 'no-assignee' as const };
    }

    const assignee = await ctx.db.get(assigneeId);
    if (!assignee || assignee.organizationId !== args.organizationId) {
      await reportTokenError(ctx, args.tokenId, 'Configured assignee no longer exists');
      return { created: false, reason: 'assignee-missing' as const };
    }

    // Idempotency: Jira retries a failed delivery, and a duplicate issue key
    // would otherwise put the same ticket on the board twice.
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();
    const marker = `[${event.issueKey}]`;
    if (existing.some((task) => task.title.startsWith(marker))) {
      return { created: false, reason: 'duplicate' as const };
    }

    const now = Date.now();
    const descriptionParts = [event.url, event.description].filter(Boolean);
    const taskId = await ctx.db.insert('tasks', {
      organizationId: args.organizationId,
      title: `${marker} ${event.summary}`.slice(0, 200),
      description:
        descriptionParts.length > 0 ? descriptionParts.join('\n\n').slice(0, 4000) : undefined,
      assignedTo: assigneeId,
      assignedBy: token.createdBy,
      status: 'pending',
      priority: 'medium',
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.tokenId, {
      lastUsedAt: now,
      receivedCount: token.receivedCount + 1,
      lastError: undefined,
    });

    return { created: true as const, taskId };
  },
});

async function reportTokenError(
  ctx: MutationCtx,
  tokenId: Id<'inboundTokens'>,
  message: string,
): Promise<void> {
  const token = await ctx.db.get(tokenId);
  if (!token) return;
  await ctx.db.patch(tokenId, { lastError: message, lastUsedAt: Date.now() });
}
