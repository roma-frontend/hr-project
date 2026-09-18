/**
 * Inbound integrations — device punches and Jira events.
 *
 * The two failure modes worth pinning down are the expensive ones: a punch that
 * silently disappears (the employee is then marked late for a day they worked),
 * and a punch that lands twice or on the wrong person (payroll pays for it).
 * Everything below is about "exactly once, on the right employee, never
 * invented".
 *
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('../../convex/_generated/server', () => ({
  query: ({ handler }: any) => ({ handler }),
  mutation: ({ handler }: any) => ({ handler }),
  internalMutation: ({ handler }: any) => ({ handler }),
  internalQuery: ({ handler }: any) => ({ handler }),
  internalAction: ({ handler }: any) => ({ handler }),
}));

const mockGetAuthCaller = jest.fn();
jest.mock('../../convex/lib/getAuthCaller', () => ({
  getAuthCaller: (...a: unknown[]) => mockGetAuthCaller(...a),
}));

import {
  normalizeJiraEvent,
  normalizePunches,
  parsePunchTime,
  truncateRaw,
} from '../../convex/lib/inboundPayload';

type Row = Record<string, any>;

/** Minimal Convex-db mock, same shape the webhook engine tests use. */
function makeDb() {
  const tables: Record<string, Row[]> = {
    users: [],
    inboundTokens: [],
    devicePunches: [],
    tasks: [],
    timeTracking: [],
  };
  let nextId = 1;
  const db = {
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((r) => r._id === id);
        if (row) return row;
      }
      return null;
    },
    insert: async (table: string, doc: Row) => {
      const id = `${table}_${nextId++}`;
      (tables[table] ??= []).push({ _id: id, ...doc });
      return id;
    },
    patch: async (id: string, patch: Row) => {
      const row = await db.get(id);
      if (row) Object.assign(row, patch);
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const i = rows.findIndex((r) => r._id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    },
    query: (table: string) => {
      const rows = tables[table] ?? [];
      const apply = (row: Row, filters: Row) =>
        Object.entries(filters).every(([k, v]) => row[k] === v);
      const chain: any = {
        __filters: {},
        withIndex: (_name: string, cb?: any) => {
          const filters: Row = {};
          if (cb) {
            const cap: any = {
              eq: (k: string, v: unknown) => {
                filters[k] = v;
                return cap;
              },
            };
            cb(cap);
          }
          chain.__filters = filters;
          return chain;
        },
        order: () => chain,
        filter: (fn: any) => {
          chain.__predicate = fn;
          return chain;
        },
        collect: async () =>
          rows.filter((r) => apply(r, chain.__filters ?? {})).map((r) => ({ ...r })),
        take: async (n: number) => rows.filter((r) => apply(r, chain.__filters ?? {})).slice(0, n),
        first: async () => rows.filter((r) => apply(r, chain.__filters ?? {}))[0] ?? null,
      };
      return chain;
    },
  };
  return { db, tables };
}

function makeCtx() {
  const { db, tables } = makeDb();
  return { db, scheduler: { runAfter: jest.fn() }, __tables: tables };
}

const organizationId = 'org1';
const admin = { _id: 'u_admin', role: 'admin', organizationId };

describe('payload normalization', () => {
  const now = Date.UTC(2026, 8, 18, 12, 0, 0); // 2026-09-18T12:00:00Z

  it('reads a ZKTeco-style push (PIN + epoch seconds)', () => {
    const punches = normalizePunches({ pin: '1024', timestamp: 1_787_000_000, state: '0' }, now);
    expect(punches).toHaveLength(1);
    expect(punches[0]).toMatchObject({ employeeNumber: '1024', direction: 'in' });
    expect(punches[0]!.punchAt).toBe(1_787_000_000_000);
  });

  it('reads a Suprema-style push and treats a naive time as Armenia wall clock', () => {
    const punches = normalizePunches(
      { employee_number: 'A-77', datetime: '2026-09-18 09:01:22', direction: 'check_out' },
      now,
    );
    expect(punches[0]).toMatchObject({ employeeNumber: 'A-77', direction: 'out' });
    // 09:01 in Yerevan is 05:01 UTC — and the result must not depend on the
    // timezone this test happens to run in.
    expect(new Date(punches[0]!.punchAt).toISOString()).toBe('2026-09-18T05:01:22.000Z');
  });

  it('keeps an explicit timezone in the device timestamp', () => {
    const punches = normalizePunches(
      { pin: '1', timestamp: '2026-09-18T09:01:22Z', punch_state: '0' },
      now,
    );
    expect(new Date(punches[0]!.punchAt).toISOString()).toBe('2026-09-18T09:01:22.000Z');
  });

  it('reads every punch of a batch', () => {
    const punches = normalizePunches(
      {
        punches: [
          { emp_code: '1', punch_time: '2026-09-18T08:00:00Z', punch_state: '0' },
          { emp_code: '2', punch_time: '2026-09-18T08:05:00Z', punch_state: '1' },
        ],
      },
      now,
    );
    expect(punches.map((p) => p.employeeNumber)).toEqual(['1', '2']);
    expect(punches.map((p) => p.direction)).toEqual(['in', 'out']);
  });

  it('returns null for a payload with no employee number or no time', () => {
    expect(normalizePunches({ timestamp: 1_787_000_000 }, now)).toHaveLength(0);
    expect(normalizePunches({ pin: '1024' }, now)).toHaveLength(0);
    expect(normalizePunches('not json at all', now)).toHaveLength(0);
  });

  it('rejects a time the device got wrong instead of inventing one', () => {
    // A terminal whose clock reset to 1970 (and 1998), and one set a month ahead.
    expect(parsePunchTime(0, now)).toBeNull();
    expect(parsePunchTime(900_000_000, now)).toBeNull();
    expect(parsePunchTime(now + 40 * 24 * 60 * 60 * 1000, now)).toBeNull();
    // A plausible second-based timestamp still converts.
    expect(parsePunchTime(1_787_000_000, now)).toBe(1_787_000_000_000);
  });

  it('maps a Jira issue event onto a task', () => {
    const event = normalizeJiraEvent({
      webhookEvent: 'jira:issue_created',
      issue: {
        key: 'HR-42',
        self: 'https://acme.atlassian.net/rest/api/3/issue/HR-42',
        fields: { summary: 'Onboard the new accountant', description: 'Kit and access' },
      },
    });
    expect(event).toMatchObject({
      issueKey: 'HR-42',
      summary: 'Onboard the new accountant',
      event: 'jira:issue_created',
    });
    expect(event?.url).toContain('HR-42');
  });

  it('refuses a Jira payload without an issue key', () => {
    expect(normalizeJiraEvent({ webhookEvent: 'jira:issue_created' })).toBeNull();
    expect(normalizeJiraEvent({ issue: { fields: { summary: 'x' } } })).toBeNull();
  });

  it('truncates a stored raw payload', () => {
    expect(truncateRaw({ a: 'x'.repeat(5000) }).length).toBeLessThanOrEqual(2001);
  });
});

describe('device punch ingest', () => {
  let mod: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mod = await import('../../convex/inbound');
  });

  function seed(ctx: any, opts: { employeeNumber?: string } = {}) {
    ctx.__tables.users.push({
      _id: 'u1',
      organizationId,
      name: 'Anna',
      employeeNumber: opts.employeeNumber ?? '1024',
      isActive: true,
    });
    ctx.__tables.inboundTokens.push({
      _id: 't1',
      organizationId,
      provider: 'device',
      label: 'Turnstile',
      tokenHash: 'x',
      tokenHint: '0000',
      enabled: true,
      receivedCount: 0,
      createdAt: 1,
      createdBy: 'u_admin',
    });
  }

  it('matches a punch to the employee by табельный номер', async () => {
    const ctx = makeCtx();
    seed(ctx);
    const result = await mod.ingestDevicePunches.handler(ctx, {
      tokenId: 't1',
      organizationId,
      punches: [{ employeeNumber: '1024', punchAt: 1_787_000_000_000, direction: 'in' }],
      raw: '{}',
    });

    expect(result).toMatchObject({ recorded: 1, unmatched: 0, total: 1 });
    expect(ctx.__tables.devicePunches[0]).toMatchObject({
      userId: 'u1',
      status: 'pending',
      employeeNumberRaw: '1024',
    });
    // The punch is evidence, not attendance: nothing reached the payroll table.
    expect(ctx.__tables.timeTracking).toHaveLength(0);
  });

  it('ignores case and padding differences in the number', async () => {
    const ctx = makeCtx();
    seed(ctx, { employeeNumber: 'a-77' });
    await mod.ingestDevicePunches.handler(ctx, {
      tokenId: 't1',
      organizationId,
      punches: [{ employeeNumber: ' A-77 ', punchAt: 1_787_000_000_000, direction: 'in' }],
      raw: '{}',
    });
    expect(ctx.__tables.devicePunches[0].userId).toBe('u1');
  });

  it('keeps an unmatched punch so HR can fix the number later', async () => {
    const ctx = makeCtx();
    seed(ctx);
    const result = await mod.ingestDevicePunches.handler(ctx, {
      tokenId: 't1',
      organizationId,
      punches: [{ employeeNumber: '404', punchAt: 1_787_000_000_000, direction: 'in' }],
      raw: '{}',
    });
    expect(result.unmatched).toBe(1);
    expect(ctx.__tables.devicePunches[0]).toMatchObject({ status: 'unmatched' });
    expect(ctx.__tables.devicePunches[0].userId).toBeUndefined();
  });

  it('records a retried push once and flags the rest as duplicates', async () => {
    const ctx = makeCtx();
    seed(ctx);
    const push = {
      tokenId: 't1',
      organizationId,
      punches: [{ employeeNumber: '1024', punchAt: 1_787_000_000_000, direction: 'in' as const }],
      raw: '{}',
    };
    await mod.ingestDevicePunches.handler(ctx, push);
    const second = await mod.ingestDevicePunches.handler(ctx, push);

    expect(second).toMatchObject({ recorded: 0, duplicates: 1 });
    expect(ctx.__tables.devicePunches.map((p: Row) => p.status)).toEqual(['pending', 'duplicate']);
  });

  it('counts received payloads on the token', async () => {
    const ctx = makeCtx();
    seed(ctx);
    await mod.ingestDevicePunches.handler(ctx, {
      tokenId: 't1',
      organizationId,
      punches: [{ employeeNumber: '1024', punchAt: 1, direction: 'in' }],
      raw: '{}',
    });
    expect(ctx.__tables.inboundTokens[0].receivedCount).toBe(1);
    expect(ctx.__tables.inboundTokens[0].lastUsedAt).toBeGreaterThan(0);
  });

  it('re-matches pending punches when HR fills in the number', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    ctx.__tables.users.push({
      _id: 'u2',
      organizationId,
      name: 'Boris',
      isActive: true,
    });
    ctx.__tables.devicePunches.push({
      _id: 'p1',
      organizationId,
      tokenId: 't1',
      employeeNumberRaw: '999',
      punchAt: 1,
      direction: 'in',
      status: 'unmatched',
      raw: '{}',
      createdAt: 1,
    });

    const result = await mod.setEmployeeNumber.handler(ctx, {
      userId: 'u2',
      employeeNumber: '999',
    });
    expect(result.rematched).toBe(1);
    expect(ctx.__tables.devicePunches[0]).toMatchObject({ userId: 'u2', status: 'pending' });
  });

  it('refuses a табельный номер another employee already owns', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    ctx.__tables.users.push(
      { _id: 'u1', organizationId, name: 'Anna', employeeNumber: '1024', isActive: true },
      { _id: 'u2', organizationId, name: 'Boris', isActive: true },
    );
    await expect(
      mod.setEmployeeNumber.handler(ctx, { userId: 'u2', employeeNumber: '1024' }),
    ).rejects.toThrow(/already used/);
  });
});

describe('jira ingest', () => {
  let mod: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mod = await import('../../convex/inbound');
  });

  function seedToken(ctx: any, defaultAssigneeId: string | undefined) {
    ctx.__tables.users.push({ _id: 'u_assignee', organizationId, name: 'HR', isActive: true });
    ctx.__tables.inboundTokens.push({
      _id: 't_jira',
      organizationId,
      provider: 'jira',
      label: 'Jira',
      tokenHash: 'x',
      tokenHint: '0000',
      enabled: true,
      defaultAssigneeId,
      receivedCount: 0,
      createdAt: 1,
      createdBy: 'u_admin',
    });
  }

  const payload = {
    webhookEvent: 'jira:issue_created',
    issue: { key: 'HR-7', fields: { summary: 'Fix the badge printer' } },
  };

  it('creates a task for the configured assignee', async () => {
    const ctx = makeCtx();
    seedToken(ctx, 'u_assignee');
    const result = await mod.ingestJiraEvent.handler(ctx, {
      tokenId: 't_jira',
      organizationId,
      payload,
      raw: '{}',
    });

    expect(result.created).toBe(true);
    expect(ctx.__tables.tasks[0]).toMatchObject({
      title: '[HR-7] Fix the badge printer',
      assignedTo: 'u_assignee',
      assignedBy: 'u_admin',
      status: 'pending',
      priority: 'medium',
      organizationId,
    });
  });

  it('does not create the same issue twice (Jira retries deliveries)', async () => {
    const ctx = makeCtx();
    seedToken(ctx, 'u_assignee');
    await mod.ingestJiraEvent.handler(ctx, {
      tokenId: 't_jira',
      organizationId,
      payload,
      raw: '{}',
    });
    const second = await mod.ingestJiraEvent.handler(ctx, {
      tokenId: 't_jira',
      organizationId,
      payload,
      raw: '{}',
    });

    expect(second).toEqual({ created: false, reason: 'duplicate' });
    expect(ctx.__tables.tasks).toHaveLength(1);
  });

  it('records why it refused instead of creating an unassigned task', async () => {
    const ctx = makeCtx();
    seedToken(ctx, undefined);
    const result = await mod.ingestJiraEvent.handler(ctx, {
      tokenId: 't_jira',
      organizationId,
      payload,
      raw: '{}',
    });

    expect(result).toEqual({ created: false, reason: 'no-assignee' });
    expect(ctx.__tables.tasks).toHaveLength(0);
    expect(ctx.__tables.inboundTokens[0].lastError).toMatch(/assignee/i);
  });

  it('ignores a payload that is not a Jira issue event', async () => {
    const ctx = makeCtx();
    seedToken(ctx, 'u_assignee');
    const result = await mod.ingestJiraEvent.handler(ctx, {
      tokenId: 't_jira',
      organizationId,
      payload: { webhookEvent: 'jira:worklog_updated' },
      raw: '{}',
    });
    expect(result).toEqual({ created: false, reason: 'unrecognized-payload' });
  });
});

describe('inbound token resolution', () => {
  let mod: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mod = await import('../../convex/inbound');
  });

  it('resolves a token by hash and never by the raw prefix alone', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    const minted = await mod.mintInboundToken.handler(ctx, {
      provider: 'device',
      label: 'Turnstile',
    });

    const resolved = await mod.resolveInboundToken.handler(ctx, { raw: minted.token });
    expect(resolved).toMatchObject({
      tokenId: minted.tokenId,
      organizationId,
      provider: 'device',
      enabled: true,
    });
    // The raw secret is not stored anywhere.
    expect(ctx.__tables.inboundTokens[0].tokenHash).not.toBe(minted.token);
    expect(ctx.__tables.inboundTokens[0].tokenHint).toBe(minted.token.slice(-4));

    expect(await mod.resolveInboundToken.handler(ctx, { raw: 'inb_wrong' })).toBeNull();
    expect(await mod.resolveInboundToken.handler(ctx, { raw: 'nope' })).toBeNull();
  });

  it('refuses to mint a token for an employee', async () => {
    mockGetAuthCaller.mockResolvedValue({ ...admin, role: 'employee' });
    const ctx = makeCtx();
    await expect(
      mod.mintInboundToken.handler(ctx, { provider: 'device', label: 'x' }),
    ).rejects.toThrow(/admins/);
  });

  it('refuses an assignee from another organization', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    ctx.__tables.users.push({ _id: 'u_other', organizationId: 'org2', name: 'Outsider' });
    await expect(
      mod.mintInboundToken.handler(ctx, {
        provider: 'jira',
        label: 'Jira',
        defaultAssigneeId: 'u_other',
      }),
    ).rejects.toThrow(/member of this organization/);
  });

  it('stops an ingest as soon as the token is disabled', async () => {
    mockGetAuthCaller.mockResolvedValue(admin);
    const ctx = makeCtx();
    const minted = await mod.mintInboundToken.handler(ctx, { provider: 'device', label: 'T' });
    await mod.setInboundTokenEnabled.handler(ctx, { tokenId: minted.tokenId, enabled: false });

    const resolved = await mod.resolveInboundToken.handler(ctx, { raw: minted.token });
    expect(resolved?.enabled).toBe(false);
  });
});
