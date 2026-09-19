/**
 * Tests for convex/payrollFile.ts — where the organisation's bank-file layout is
 * stored.
 *
 * The screen that edits this is one click away from an export that instructs a
 * bank to move a month of salaries, so the failures worth locking down are the
 * ones that produce a *plausible* wrong file rather than an error:
 *
 *   - a column list naming a field the renderer does not know, which the old
 *     code path would have dropped silently, leaving the file one column short;
 *   - the same field twice, which a portal parses as a malformed row;
 *   - a separator outside the three a portal accepts, which makes every row
 *     parse as a single mangled column;
 *   - a write from somebody who is not an administrator of the organisation.
 *
 * Pattern: convex-branding.test.ts — mock `_generated/server` and
 * `lib/getAuthCaller`, then require the module inside `jest.isolateModules`.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../convex/_generated/server', () => ({
  mutation: ({ handler, args }: any) => ({ handler, args }),
  query: ({ handler, args }: any) => ({ handler, args }),
}));

jest.mock('../../convex/lib/getAuthCaller', () => ({
  getAuthCaller: jest.fn(),
}));

// ── Module under test ────────────────────────────────────────────────────────
let mockGetAuthCaller: jest.Mock;

type Handler = (ctx: any, args: any) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

const ORG = 'org-1';
const ROW_ID = 'layout_1';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuthCaller = jest.requireMock('../../convex/lib/getAuthCaller').getAuthCaller;
  mockGetAuthCaller.mockReset();
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../convex/payrollFile');
    for (const [name, def] of Object.entries(mod)) {
      if (def && typeof def === 'object' && typeof (def as any).handler === 'function') {
        handlers[name] = (def as any).handler;
      }
    }
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
/** `null` means "belongs to no organisation" — a real state after onboarding. */
function caller(
  role: 'admin' | 'superadmin' | 'supervisor' | 'employee' = 'admin',
  organizationId: string | null = ORG,
) {
  return {
    _id: 'user_admin',
    role,
    email: 'admin@example.com',
    organizationId: organizationId === null ? undefined : organizationId,
    name: 'Admin',
  };
}

/** A ctx whose org-scoped lookup resolves to `existing`. */
function makeCtx(existing: unknown = null) {
  const insert = jest.fn().mockResolvedValue('new_id');
  const patch = jest.fn().mockResolvedValue(undefined);
  const remove = jest.fn().mockResolvedValue(undefined);
  const unique = jest.fn().mockResolvedValue(existing);
  const withIndex = jest.fn().mockReturnValue({ unique });
  const query = jest.fn().mockReturnValue({ withIndex });
  return {
    ctx: { db: { insert, patch, delete: remove, query } },
    insert,
    patch,
    remove,
    query,
    withIndex,
  };
}

const ARGS = {
  profileId: 'ameriabank',
  columns: ['account', 'amount'],
  delimiter: ';' as string | undefined,
  header: true as boolean | undefined,
  purpose: undefined as string | undefined,
  payerAccount: undefined as string | undefined,
};

// ── getPayrollFileLayout ─────────────────────────────────────────────────────
describe('getPayrollFileLayout', () => {
  it('returns null without touching the database when there is no session', async () => {
    const { ctx, query } = makeCtx();
    mockGetAuthCaller.mockResolvedValue(null);

    expect(await handlers.getPayrollFileLayout!(ctx, {})).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns null when the caller belongs to no organisation', async () => {
    // A row exists, so a missing organisation guard would return it.
    const { ctx, query } = makeCtx({ _id: ROW_ID, columns: ['account'], profileId: 'generic' });
    mockGetAuthCaller.mockResolvedValue(caller('admin', null));

    expect(await handlers.getPayrollFileLayout!(ctx, {})).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns null when the organisation has never saved a layout', async () => {
    const { ctx } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    expect(await handlers.getPayrollFileLayout!(ctx, {})).toBeNull();
  });

  it('reads the layout without a role gate — the layout is not a secret', async () => {
    // The accountant preparing the export is not necessarily an admin.
    const { ctx } = makeCtx({
      profileId: 'generic',
      columns: ['beneficiary', 'account', 'amount'],
      delimiter: ',',
      header: true,
      purpose: 'Salary',
      payerAccount: undefined,
      updatedAt: 123,
    });
    mockGetAuthCaller.mockResolvedValue(caller('employee'));

    const result = (await handlers.getPayrollFileLayout!(ctx, {})) as Record<string, unknown>;
    expect(result.columns).toEqual(['beneficiary', 'account', 'amount']);
    expect(result.profileId).toBe('generic');
  });

  it('dedupes a hand-edited column list, so it cannot render two identical columns', async () => {
    const { ctx } = makeCtx({
      profileId: 'generic',
      columns: ['amount', 'amount', 'account'],
      delimiter: undefined,
      header: undefined,
      purpose: undefined,
      payerAccount: undefined,
      updatedAt: 1,
    });
    mockGetAuthCaller.mockResolvedValue(caller());

    const result = (await handlers.getPayrollFileLayout!(ctx, {})) as Record<string, unknown>;
    expect(result.columns).toEqual(['amount', 'account']);
  });
});

// ── savePayrollFileLayout ────────────────────────────────────────────────────
describe('savePayrollFileLayout', () => {
  it('refuses an unauthenticated caller', async () => {
    const { ctx, insert } = makeCtx();
    mockGetAuthCaller.mockResolvedValue(null);

    await expect(handlers.savePayrollFileLayout!(ctx, ARGS)).rejects.toThrow('Not authenticated');
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a supervisor — this is a setting, not an operational action', async () => {
    const { ctx, insert } = makeCtx();
    mockGetAuthCaller.mockResolvedValue(caller('supervisor'));

    await expect(handlers.savePayrollFileLayout!(ctx, ARGS)).rejects.toThrow(/Only admins/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses an admin with no organisation', async () => {
    const { ctx, insert } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller('admin', null));

    await expect(handlers.savePayrollFileLayout!(ctx, ARGS)).rejects.toThrow('No organization');
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a separator the export could not write', async () => {
    // Storing it would produce a file whose every row parses as one column.
    const { ctx, insert } = makeCtx();
    mockGetAuthCaller.mockResolvedValue(caller());

    await expect(handlers.savePayrollFileLayout!(ctx, { ...ARGS, delimiter: '|' })).rejects.toThrow(
      'Unsupported delimiter',
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an unknown column instead of dropping it', async () => {
    // The old failure mode: the file would quietly lose the column.
    const { ctx, insert } = makeCtx();
    mockGetAuthCaller.mockResolvedValue(caller());

    await expect(
      handlers.savePayrollFileLayout!(ctx, { ...ARGS, columns: ['account', 'nope', 'other'] }),
    ).rejects.toThrow('Unknown payment field(s): nope, other');
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a new row for an organisation that has none', async () => {
    const { ctx, insert, patch } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    const result = await handlers.savePayrollFileLayout!(ctx, ARGS);

    expect(insert).toHaveBeenCalledWith(
      'orgPayrollFile',
      expect.objectContaining({
        organizationId: ORG,
        profileId: 'ameriabank',
        columns: ['account', 'amount'],
        delimiter: ';',
        header: true,
        updatedBy: 'user_admin',
      }),
    );
    expect(patch).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'new_id', updated: false });
  });

  it('updates the existing row rather than creating a second one', async () => {
    const { ctx, insert, patch } = makeCtx({ _id: ROW_ID });
    mockGetAuthCaller.mockResolvedValue(caller());

    const result = await handlers.savePayrollFileLayout!(ctx, ARGS);

    expect(patch).toHaveBeenCalledWith(
      ROW_ID,
      expect.objectContaining({ columns: ['account', 'amount'], profileId: 'ameriabank' }),
    );
    expect(insert).not.toHaveBeenCalled();
    expect(result).toEqual({ id: ROW_ID, updated: true });
  });

  it('dedupes before storing, so the file order is what the editor showed', async () => {
    const { ctx, insert } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    await handlers.savePayrollFileLayout!(ctx, {
      ...ARGS,
      columns: ['account', 'amount', 'account'],
    });

    expect(insert).toHaveBeenCalledWith(
      'orgPayrollFile',
      expect.objectContaining({ columns: ['account', 'amount'] }),
    );
  });

  it('stores a blank purpose and payer account as absent, so "unset keeps the preset" stays true', async () => {
    const { ctx, insert } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    await handlers.savePayrollFileLayout!(ctx, { ...ARGS, purpose: '   ', payerAccount: '  ' });

    expect(insert).toHaveBeenCalledWith(
      'orgPayrollFile',
      expect.objectContaining({ purpose: undefined, payerAccount: undefined }),
    );
  });

  it('trims what it stores', async () => {
    const { ctx, insert } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    await handlers.savePayrollFileLayout!(ctx, {
      ...ARGS,
      purpose: '  Salary 2026-09  ',
      payerAccount: ' 15700123456789012345 ',
    });

    expect(insert).toHaveBeenCalledWith(
      'orgPayrollFile',
      expect.objectContaining({
        purpose: 'Salary 2026-09',
        payerAccount: '15700123456789012345',
      }),
    );
  });

  it('accepts an empty column list as "no override" rather than refusing it', async () => {
    // The stored row then means "use the preset as-is", which the export honours.
    const { ctx, insert } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    await handlers.savePayrollFileLayout!(ctx, { ...ARGS, columns: [] });

    expect(insert).toHaveBeenCalledWith('orgPayrollFile', expect.objectContaining({ columns: [] }));
  });

  it('lets a superadmin save an organisation layout', async () => {
    const { ctx, insert } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller('superadmin'));

    await handlers.savePayrollFileLayout!(ctx, ARGS);

    expect(insert).toHaveBeenCalled();
  });
});

// ── resetPayrollFileLayout ───────────────────────────────────────────────────
describe('resetPayrollFileLayout', () => {
  it('refuses an unauthenticated caller', async () => {
    const { ctx, remove } = makeCtx({ _id: ROW_ID });
    mockGetAuthCaller.mockResolvedValue(null);

    await expect(handlers.resetPayrollFileLayout!(ctx, {})).rejects.toThrow('Not authenticated');
    expect(remove).not.toHaveBeenCalled();
  });

  it('refuses a non-admin', async () => {
    const { ctx, remove } = makeCtx({ _id: ROW_ID });
    mockGetAuthCaller.mockResolvedValue(caller('employee'));

    await expect(handlers.resetPayrollFileLayout!(ctx, {})).rejects.toThrow(/Only admins/);
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes the stored row so exports fall back to the preset', async () => {
    const { ctx, remove } = makeCtx({ _id: ROW_ID });
    mockGetAuthCaller.mockResolvedValue(caller());

    const result = await handlers.resetPayrollFileLayout!(ctx, {});

    expect(remove).toHaveBeenCalledWith(ROW_ID);
    expect(result).toEqual({ success: true });
  });

  it('succeeds when there was nothing to reset', async () => {
    const { ctx, remove } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller());

    const result = await handlers.resetPayrollFileLayout!(ctx, {});

    expect(remove).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('scopes the lookup to the caller’s organisation', async () => {
    const { ctx, query, withIndex } = makeCtx(null);
    mockGetAuthCaller.mockResolvedValue(caller('admin', 'org-42'));

    await handlers.resetPayrollFileLayout!(ctx, {});

    expect(query).toHaveBeenCalledWith('orgPayrollFile');
    expect(withIndex).toHaveBeenCalledWith('by_org', expect.any(Function));
  });
});
