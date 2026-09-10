/**
 * Tests for the DB-touching helpers in convex/lib/taskConfig.ts.
 *
 * Covers resolveStatusSet (fallback chain), resyncCanonicalStatus, listFieldsFor,
 * buildCustomFieldsPatch and assertUsersInOrg against a mocked Convex ctx.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  resolveStatusSet,
  resolveStatusSetForTask,
  resyncCanonicalStatus,
  listFieldsFor,
  buildCustomFieldsPatch,
  assertUsersInOrg,
} from '../../convex/lib/taskConfig';

type AnyCtx = any;

function makeCtx() {
  const docs = new Map<string, any>();
  const get = jest.fn(async (id: string) => docs.get(id) ?? null);
  const normalizeId = jest.fn((_table: string, id: string) =>
    /^[A-Za-z0-9_-]+$/.test(id) ? id : null,
  );
  const patch = jest.fn(async () => undefined);
  const builders = new Map<string, any>();
  const query = jest.fn((table: string) => {
    if (!builders.has(table)) {
      const first = jest.fn(async () => null);
      const take = jest.fn(async () => []);
      const withIndex = jest.fn(() => ({ first, take }));
      builders.set(table, { first, take, withIndex });
    }
    return builders.get(table);
  });
  return {
    ctx: { db: { get, normalizeId, patch, query } },
    docs,
    get,
    normalizeId,
    patch,
    query,
    builders,
  };
}

function status(key: string, order: number) {
  return { key, label: key, color: 'gray', type: 'active', order };
}

function field(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'f1',
    name: 'Field',
    type: 'text',
    isActive: true,
    required: false,
    order: 0,
    organizationId: 'org1',
    projectId: undefined,
    ...overrides,
  };
}

describe('resolveStatusSet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers a project-specific set', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('p1', { _id: 'p1', statusSetId: 's1' });
    docs.set('s1', {
      _id: 's1',
      organizationId: 'org1',
      isDefault: false,
      statuses: [status('b', 2), status('a', 1)],
    });

    const res = await resolveStatusSet(ctx, 'org1' as never, 'p1' as never);

    expect(res.source).toBe('project');
    expect(res.setId).toBe('s1');
    expect(res.statuses.map((s) => s.key)).toEqual(['a', 'b']);
  });

  it('ignores a project set from another organization', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('p1', { _id: 'p1', statusSetId: 's1' });
    docs.set('s1', { _id: 's1', organizationId: 'other', isDefault: false, statuses: [] });
    docs.set('orgDefault', { _id: 'orgDefault', isDefault: true, statuses: [status('a', 0)] });
    ctx.db
      .query('taskStatusSets')
      .withIndex()
      .first.mockResolvedValue({
        _id: 'orgDefault',
        isDefault: true,
        statuses: [status('a', 0)],
      });

    const res = await resolveStatusSet(ctx, 'org1' as never, 'p1' as never);

    expect(res.source).toBe('organization');
    expect(res.setId).toBe('orgDefault');
  });

  it('falls back to the organization default', async () => {
    const { ctx } = makeCtx();
    ctx.db
      .query('taskStatusSets')
      .withIndex()
      .first.mockResolvedValue({
        _id: 'orgDefault',
        isDefault: true,
        statuses: [status('a', 0)],
      });

    const res = await resolveStatusSet(ctx, 'org1' as never);

    expect(res.source).toBe('organization');
    expect(res.setId).toBe('orgDefault');
  });

  it('falls back to the built-in default set', async () => {
    const { ctx } = makeCtx();
    const res = await resolveStatusSet(ctx, 'org1' as never);
    expect(res.source).toBe('default');
    expect(res.statuses.length).toBeGreaterThan(0);
  });

  it('handles a project row with no status set', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('p1', { _id: 'p1' });
    ctx.db
      .query('taskStatusSets')
      .withIndex()
      .first.mockResolvedValue({
        _id: 'orgDefault',
        isDefault: true,
        statuses: [status('a', 0)],
      });

    const res = await resolveStatusSet(ctx, 'org1' as never, 'p1' as never);

    expect(res.source).toBe('organization');
  });

  it('handles a project row that no longer exists', async () => {
    const { ctx } = makeCtx();
    const res = await resolveStatusSet(ctx, 'org1' as never, 'missing' as never);
    expect(res.source).toBe('default');
  });

  it('handles no organization and no project', async () => {
    const { ctx } = makeCtx();
    const res = await resolveStatusSet(ctx, undefined);
    expect(res.source).toBe('default');
  });

  it('resolves from a task', async () => {
    const { ctx } = makeCtx();
    ctx.db
      .query('taskStatusSets')
      .withIndex()
      .first.mockResolvedValue({
        _id: 'orgDefault',
        isDefault: true,
        statuses: [status('a', 0)],
      });

    const res = await resolveStatusSetForTask(ctx, {
      organizationId: 'org1',
      projectId: undefined,
    } as never);

    expect(res.source).toBe('organization');
  });
});

describe('resyncCanonicalStatus', () => {
  it('returns 0 without touching the db when nothing changed', async () => {
    const { ctx, query } = makeCtx();
    const count = await resyncCanonicalStatus(ctx, {
      organizationId: 'org1' as never,
      setId: 's1' as never,
      changed: new Map(),
    });
    expect(count).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('patches only governed tasks whose canonical status changed', async () => {
    const { ctx, docs, patch } = makeCtx();
    docs.set('s1', { _id: 's1', isDefault: true });

    ctx.db
      .query('projects')
      .withIndex()
      .take.mockResolvedValue([
        { _id: 'p1', statusSetId: undefined },
        { _id: 'p2', statusSetId: 's1' },
        { _id: 'p3', statusSetId: 'other' },
      ]);
    ctx.db
      .query('tasks')
      .withIndex()
      .take.mockResolvedValue([
        // governed via the default set (no project)
        { _id: 't1', statusKey: 'x', status: 'pending', projectId: undefined },
        // governed via explicit project
        { _id: 't2', statusKey: 'x', status: 'pending', projectId: 'p2' },
        // not governed
        { _id: 't3', statusKey: 'x', status: 'pending', projectId: 'p3' },
        // no status key
        { _id: 't4', status: 'pending', projectId: 'p2' },
        // canonical already matches
        { _id: 't5', statusKey: 'x', status: 'completed', projectId: 'p2' },
      ]);

    const count = await resyncCanonicalStatus(ctx, {
      organizationId: 'org1' as never,
      setId: 's1' as never,
      changed: new Map([['x', 'completed']]),
    });

    expect(count).toBe(2);
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ status: 'completed', completedAt: expect.any(Number) }),
    );
    expect(patch).toHaveBeenCalledWith(
      't2',
      expect.objectContaining({ status: 'completed', completedAt: expect.any(Number) }),
    );
  });

  it('keeps an existing completedAt and clears nothing for non-complete statuses', async () => {
    const { ctx, docs, patch } = makeCtx();
    docs.set('s1', { _id: 's1', isDefault: true });
    ctx.db.query('projects').withIndex().take.mockResolvedValue([]);
    ctx.db
      .query('tasks')
      .withIndex()
      .take.mockResolvedValue([
        { _id: 't1', statusKey: 'x', status: 'pending', projectId: undefined, completedAt: 123 },
      ]);

    await resyncCanonicalStatus(ctx, {
      organizationId: 'org1' as never,
      setId: 's1' as never,
      changed: new Map([['x', 'in_progress']]),
    });

    expect(patch).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ status: 'in_progress', completedAt: 123 }),
    );
  });
});

describe('listFieldsFor', () => {
  it('returns an empty list without an organization', async () => {
    const { ctx } = makeCtx();
    expect(await listFieldsFor(ctx, undefined)).toEqual([]);
  });

  it('returns active organization fields sorted by order', async () => {
    const { ctx } = makeCtx();
    ctx.db
      .query('taskFields')
      .withIndex()
      .take.mockResolvedValue([
        field({ _id: 'b', order: 2, isActive: true }),
        field({ _id: 'a', order: 0, isActive: true }),
        field({ _id: 'archived', order: 1, isActive: false }),
      ]);

    const result = await listFieldsFor(ctx, 'org1' as never);

    expect(result.map((f) => f._id)).toEqual(['a', 'b']);
  });

  it('merges project fields and breaks order ties by name', async () => {
    const { ctx } = makeCtx();
    ctx.db
      .query('taskFields')
      .withIndex()
      .take.mockResolvedValueOnce([field({ _id: 'org', name: 'Zeta', order: 0 })])
      .mockResolvedValueOnce([field({ _id: 'proj', name: 'Alpha', order: 0, projectId: 'p1' })]);

    const result = await listFieldsFor(ctx, 'org1' as never, 'p1' as never);

    expect(result.map((f) => f._id)).toEqual(['proj', 'org']);
  });

  it('includes archived fields on a write path', async () => {
    const { ctx } = makeCtx();
    ctx.db
      .query('taskFields')
      .withIndex()
      .take.mockResolvedValue([field({ _id: 'a', isActive: false })]);

    const result = await listFieldsFor(ctx, 'org1' as never, undefined, { includeArchived: true });

    expect(result).toHaveLength(1);
  });
});

describe('assertUsersInOrg', () => {
  it('returns an empty list for no ids', async () => {
    const { ctx } = makeCtx();
    expect(await assertUsersInOrg(ctx, [], 'org1' as never)).toEqual([]);
  });

  it('rejects a malformed id', async () => {
    const { ctx } = makeCtx();
    ctx.db.normalizeId.mockReturnValue(null);
    await expect(assertUsersInOrg(ctx, ['not valid!'], undefined)).rejects.toThrow(
      'does not exist',
    );
  });

  it('rejects a missing user', async () => {
    const { ctx } = makeCtx();
    await expect(assertUsersInOrg(ctx, ['missing'], 'org1' as never)).rejects.toThrow(
      'does not exist',
    );
  });

  it('rejects a user from another organization', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('u1', { _id: 'u1', organizationId: 'other' });
    await expect(assertUsersInOrg(ctx, ['u1'], 'org1' as never)).rejects.toThrow(
      'outside this organization',
    );
  });

  it('resolves same-organization users', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('u1', { _id: 'u1', organizationId: 'org1' });
    docs.set('u2', { _id: 'u2', organizationId: 'org1' });
    expect(await assertUsersInOrg(ctx, ['u1', 'u2', 'u1'], 'org1' as never)).toEqual(['u1', 'u2']);
  });

  it('accepts any existing user when no org is given', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('u1', { _id: 'u1', organizationId: 'other' });
    expect(await assertUsersInOrg(ctx, ['u1'], undefined)).toEqual(['u1']);
  });
});

describe('buildCustomFieldsPatch', () => {
  it('rejects an unknown column', async () => {
    const { ctx } = makeCtx();
    await expect(
      buildCustomFieldsPatch(ctx, {
        fields: [field()],
        values: { nope: 'x' },
        organizationId: 'org1' as never,
      }),
    ).rejects.toThrow('Unknown column');
  });

  it('rejects a retired column', async () => {
    const { ctx } = makeCtx();
    await expect(
      buildCustomFieldsPatch(ctx, {
        fields: [field({ isActive: false, name: 'Retired' })],
        values: { f1: 'x' },
        organizationId: 'org1' as never,
      }),
    ).rejects.toThrow('Retired');
  });

  it('stores a validated text value', async () => {
    const { ctx } = makeCtx();
    const result = await buildCustomFieldsPatch(ctx, {
      fields: [field()],
      values: { f1: '  hello  ' },
      organizationId: 'org1' as never,
    });
    expect(result).toEqual({ f1: 'hello' });
  });

  it('merges into existing custom fields', async () => {
    const { ctx } = makeCtx();
    const result = await buildCustomFieldsPatch(ctx, {
      fields: [field()],
      values: { f1: 'next' },
      existing: { other: 'kept' },
      organizationId: 'org1' as never,
    });
    expect(result).toEqual({ other: 'kept', f1: 'next' });
  });

  it('removes a cell when the value means empty', async () => {
    const { ctx } = makeCtx();
    const result = await buildCustomFieldsPatch(ctx, {
      fields: [field()],
      values: { f1: '' },
      existing: { f1: 'old' },
      organizationId: 'org1' as never,
    });
    expect(result).toEqual({});
  });

  it('validates referenced users for a user column', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('u1', { _id: 'u1', organizationId: 'org1' });
    const result = await buildCustomFieldsPatch(ctx, {
      fields: [field({ type: 'user' })],
      values: { f1: 'u1' },
      organizationId: 'org1' as never,
    });
    expect(result).toEqual({ f1: 'u1' });
  });

  it('validates every id for a multi-user column', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('u1', { _id: 'u1', organizationId: 'org1' });
    docs.set('u2', { _id: 'u2', organizationId: 'org1' });
    const result = await buildCustomFieldsPatch(ctx, {
      fields: [field({ type: 'users' })],
      values: { f1: ['u1', 'u2'] },
      organizationId: 'org1' as never,
    });
    expect(result).toEqual({ f1: ['u1', 'u2'] });
  });

  it('propagates a user validation failure', async () => {
    const { ctx, docs } = makeCtx();
    docs.set('u1', { _id: 'u1', organizationId: 'other' });
    await expect(
      buildCustomFieldsPatch(ctx, {
        fields: [field({ type: 'user' })],
        values: { f1: 'u1' },
        organizationId: 'org1' as never,
      }),
    ).rejects.toThrow('outside this organization');
  });
});
