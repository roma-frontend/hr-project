/**
 * Integration tests for convex/faceRecognition — the biometric-enrolment paths.
 *
 * A face descriptor plus the enrolment photo are special-category personal data
 * (GDPR Art. 9). The failure modes worth locking down are the ones that would
 * leave the platform holding biometric data without a valid basis:
 *
 *   - enrolling without consent, which the server must refuse even though the
 *     UI already hides the button;
 *   - writing a descriptor onto somebody else's account (the old code trusted
 *     the `userId` it was handed);
 *   - removing Face ID without withdrawing the consent record, which would make
 *     the compliance register claim a live consent for a person with no data.
 *
 * Runs the real mutations against convex-test's in-memory database with the
 * real schema.
 */
import { describe, it, expect } from '@jest/globals';
import { convexTest } from 'convex-test';
import schema from '../../convex/schema';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

const modules = {
  './_generated/api.ts': () => import('../../convex/_generated/api'),
  './faceRecognition.ts': () => import('../../convex/faceRecognition'),
} as unknown as Record<string, () => Promise<unknown>>;

const DESCRIPTOR = Array(128).fill(0.1);

async function seed() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert('organizations', {
      name: 'Acme',
      slug: `acme-${Math.random().toString(36).slice(2)}`,
      plan: 'professional',
      isActive: true,
      createdBySuperadmin: false,
      employeeLimit: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as never);

    const base = {
      organizationId,
      passwordHash: 'x',
      employeeType: 'staff' as const,
      isActive: true,
      isApproved: true,
      travelAllowance: 0,
      paidLeaveBalance: 10,
      sickLeaveBalance: 5,
      familyLeaveBalance: 5,
      createdAt: Date.now(),
    };

    const employeeId = await ctx.db.insert('users', {
      ...base,
      name: 'Employee',
      email: 'employee@acme.test',
      role: 'employee',
    });
    const otherId = await ctx.db.insert('users', {
      ...base,
      name: 'Other',
      email: 'other@acme.test',
      role: 'employee',
    });
    // An account that has not been attached to an organization yet.
    const orphanId = await ctx.db.insert('users', {
      ...base,
      organizationId: undefined,
      name: 'Orphan',
      email: 'orphan@acme.test',
      role: 'employee',
    });

    return { organizationId, employeeId, otherId, orphanId };
  });

  return { t, ...ids };
}

type Ctx = Awaited<ReturnType<typeof seed>>;

const asEmployee = (c: Ctx) => c.t.withIdentity({ email: 'employee@acme.test' });
const asOther = (c: Ctx) => c.t.withIdentity({ email: 'other@acme.test' });
const asOrphan = (c: Ctx) => c.t.withIdentity({ email: 'orphan@acme.test' });

const REGISTER_ARGS = (userId: Id<'users'>) => ({
  userId,
  faceDescriptor: DESCRIPTOR,
  faceImageUrl: 'https://cdn.example/face.jpg',
  consentGranted: true,
});

describe('faceRecognition.registerFace', () => {
  it('stores the descriptor and the consent record together', async () => {
    const c = await seed();

    await asEmployee(c).mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.employeeId));

    const state = await c.t.run(async (ctx) => {
      const user = await ctx.db.get(c.employeeId);
      const consents = await ctx.db.query('consentRecords').collect();
      const audit = (await ctx.db.query('auditLogs').collect()).map((row) => row.action);
      return { user, consents, audit };
    });

    expect(state.user?.faceDescriptor).toHaveLength(128);
    expect(state.user?.faceImageUrl).toBe('https://cdn.example/face.jpg');
    expect(state.user?.faceRegisteredAt).toEqual(expect.any(Number));

    // Exactly one active biometric consent, versioned to the text shown.
    expect(state.consents).toHaveLength(1);
    expect(state.consents[0].consentType).toBe('biometric_face_id');
    expect(state.consents[0].granted).toBe(true);
    expect(state.consents[0].version).toBe('2026-09-20');
    expect(state.audit).toContain('face_registered');
  });

  it('refuses enrolment without consent and stores nothing', async () => {
    const c = await seed();

    await expect(
      asEmployee(c).mutation(api.faceRecognition.registerFace, {
        ...REGISTER_ARGS(c.employeeId),
        consentGranted: false,
      }),
    ).rejects.toThrow('Biometric consent is required to register Face ID');

    const state = await c.t.run(async (ctx) => {
      const user = await ctx.db.get(c.employeeId);
      const consents = await ctx.db.query('consentRecords').collect();
      return { user, consents };
    });
    expect(state.user?.faceDescriptor).toBeUndefined();
    expect(state.consents).toHaveLength(0);
  });

  it('refuses to write a descriptor onto somebody else’s account', async () => {
    const c = await seed();

    // The caller is the other employee; the target is not them.
    await expect(
      asOther(c).mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.employeeId)),
    ).rejects.toThrow('Cannot register Face ID for another user');

    const target = await c.t.run(async (ctx) => await ctx.db.get(c.employeeId));
    expect(target?.faceDescriptor).toBeUndefined();
  });

  it('refuses an account that belongs to no organization', async () => {
    const c = await seed();

    // Enrolling for yourself — the organisation check is what must refuse.
    await expect(
      asOrphan(c).mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.orphanId)),
    ).rejects.toThrow('Face ID requires an account that belongs to an organization');
  });

  it('rejects an unauthenticated caller', async () => {
    const c = await seed();

    await expect(
      c.t.mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.employeeId)),
    ).rejects.toThrow('Not authenticated');
  });

  it('rejects a descriptor of the wrong length before anything is stored', async () => {
    const c = await seed();

    await expect(
      asEmployee(c).mutation(api.faceRecognition.registerFace, {
        ...REGISTER_ARGS(c.employeeId),
        faceDescriptor: [0.1, 0.2],
      }),
    ).rejects.toThrow('Face descriptor must be 128-dim');
  });

  it('re-enrolment refreshes the same consent row instead of adding a second', async () => {
    const c = await seed();
    const asMe = asEmployee(c);

    await asMe.mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.employeeId));
    await asMe.mutation(api.faceRecognition.registerFace, {
      ...REGISTER_ARGS(c.employeeId),
      consentVersion: '2026-10-01',
    });

    const consents = await c.t.run(async (ctx) => await ctx.db.query('consentRecords').collect());
    expect(consents).toHaveLength(1);
    expect(consents[0].version).toBe('2026-10-01');
    expect(consents[0].withdrawnAt).toBeUndefined();
  });
});

describe('faceRecognition.removeFaceRegistration', () => {
  it('wipes the descriptor and withdraws the consent', async () => {
    const c = await seed();
    const asMe = asEmployee(c);
    await asMe.mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.employeeId));

    const result = await asMe.mutation(api.faceRecognition.removeFaceRegistration, {
      userId: c.employeeId,
    });

    const state = await c.t.run(async (ctx) => {
      const user = await ctx.db.get(c.employeeId);
      const consents = await ctx.db.query('consentRecords').collect();
      return { user, consents };
    });

    expect(result.consentWithdrawn).toBe(1);
    expect(state.user?.faceDescriptor).toBeUndefined();
    expect(state.user?.faceImageUrl).toBeUndefined();
    expect(state.user?.faceRegisteredAt).toBeUndefined();
    // The consent register no longer claims an active biometric consent.
    expect(state.consents[0].granted).toBe(false);
    expect(state.consents[0].withdrawnAt).toEqual(expect.any(Number));
  });

  it('succeeds when there was no consent to withdraw', async () => {
    const c = await seed();

    const result = await asEmployee(c).mutation(api.faceRecognition.removeFaceRegistration, {
      userId: c.employeeId,
    });
    expect(result.consentWithdrawn).toBe(0);
  });

  it('refuses a caller removing a colleague’s Face ID', async () => {
    const c = await seed();
    await asEmployee(c).mutation(api.faceRecognition.registerFace, REGISTER_ARGS(c.employeeId));

    await expect(
      asOther(c).mutation(api.faceRecognition.removeFaceRegistration, { userId: c.employeeId }),
    ).rejects.toThrow('Not authorized to remove face registration');
  });
});
