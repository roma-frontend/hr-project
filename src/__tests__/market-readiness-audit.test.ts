/**
 * Market-readiness audit evidence, 2026-09-30.
 * Remediated cases assert safe behavior. Cases explicitly marked 'currently'
 * remain unsafe CHARACTERIZATION evidence, not security acceptance tests.
 * All calls use convex-test's local in-memory DB, never a deployed backend.
 */
import { convexTest } from 'convex-test';
import schema from '../../convex/schema';
import { api } from '../../convex/_generated/api';
import { isSuperadmin } from '../../convex/lib/auth';

const modules = {
  './_generated/api.ts': () => import('../../convex/_generated/api'),
  './security.ts': () => import('../../convex/security'),
  './analytics.ts': () => import('../../convex/analytics'),
  './surveys.ts': () => import('../../convex/surveys'),
  './shifts.ts': () => import('../../convex/shifts'),
  './backups.ts': () => import('../../convex/backups'),
  './aiGovernance.ts': () => import('../../convex/aiGovernance'),
  './faceRecognition.ts': () => import('../../convex/faceRecognition'),
} as unknown as Record<string, () => Promise<unknown>>;

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert('organizations', {
      name: 'Audit fixture',
      slug: 'audit-fixture',
      plan: 'professional',
      isActive: true,
      createdBySuperadmin: false,
      employeeLimit: 50,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const adminId = await ctx.db.insert('users', {
      organizationId: orgId,
      name: 'Fixture admin',
      email: 'audit-admin@example.test',
      passwordHash: 'fixture-only',
      role: 'admin',
      employeeType: 'staff',
      isActive: true,
      isApproved: true,
      paidLeaveBalance: 0,
      sickLeaveBalance: 0,
      familyLeaveBalance: 0,
      createdAt: Date.now(),
      faceDescriptor: Array(128).fill(0.1),
    });
    return { orgId, adminId };
  });
  return { t, ...ids };
}

describe('launch audit: security regressions and remaining unsafe characterizations', () => {
  it('anonymous caller cannot disable a global security setting', async () => {
    const { t, adminId } = await seed();
    await expect(
      t.mutation(api.security.toggleSetting, {
        key: 'failed_login_lockout',
        enabled: false,
        updatedBy: adminId,
      }),
    ).rejects.toThrow('Only superadmins');
    expect(await t.query(api.security.getSetting, { key: 'failed_login_lockout' })).toBe(true);
  });

  it('anonymous caller cannot read an employee backup snapshot by id', async () => {
    const { t, orgId, adminId } = await seed();
    const backupId = await t.run((ctx) =>
      ctx.db.insert('employeeBackups', {
        organizationId: orgId,
        userId: adminId,
        userName: 'Fixture admin',
        userEmail: 'audit-admin@example.test',
        snapshot: JSON.stringify({ notes: ['private fixture'] }),
        snapshotSize: 32,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }),
    );
    const result = await t.query(api.backups.getBackupDetails, { backupId });
    expect(result).toBeNull();
  });

  it('anonymous caller cannot enumerate backup metadata for an org', async () => {
    const { t, orgId, adminId } = await seed();
    await t.run((ctx) =>
      ctx.db.insert('employeeBackups', {
        organizationId: orgId,
        userId: adminId,
        userName: 'Fixture admin',
        userEmail: 'audit-admin@example.test',
        snapshot: '{}',
        snapshotSize: 2,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }),
    );
    const result = await t.query(api.backups.getOrgBackups, { organizationId: orgId });
    expect(result).toEqual([]);
  });

  it('anonymous caller cannot change AI guardrails using a supplied admin id', async () => {
    const { t, orgId, adminId } = await seed();
    await expect(
      t.mutation(api.aiGovernance.updateGuardrail, {
        organizationId: orgId,
        userId: adminId,
        key: 'piiDetection',
        enabled: false,
      }),
    ).rejects.toThrow('Not authorized');
    const rows = await t.run((ctx) => ctx.db.query('aiGuardrailSettings').collect());
    expect(rows).toEqual([]);
  });

  it('anonymous caller cannot retrieve raw user records from analytics', async () => {
    const { t, orgId } = await seed();
    const result = await t.query(api.analytics.getAnalyticsOverview, { organizationId: orgId });
    expect(result.users).toEqual([]);
    expect(result.leaves).toEqual([]);
  });

  it('authorized analytics uses a whitelist and rejects a different tenant', async () => {
    const { t, orgId, adminId } = await seed();
    const caller = t.withIdentity({ email: 'audit-admin@example.test' });
    const result = await caller.query(api.analytics.getAnalyticsOverview, {});
    expect(result.totalEmployees).toBe(1);
    expect(result.users[0]).not.toHaveProperty('passwordHash');
    expect(result.users[0]).not.toHaveProperty('faceDescriptor');
    expect(result.users[0]).not.toHaveProperty('email');
    const otherOrg = await t.run((ctx) =>
      ctx.db.insert('organizations', {
        name: 'Other tenant',
        slug: 'other',
        plan: 'professional',
        isActive: true,
        createdBySuperadmin: false,
        employeeLimit: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    expect(
      (await caller.query(api.analytics.getAnalyticsOverview, { organizationId: otherOrg })).users,
    ).toEqual([]);
    expect(
      (await caller.query(api.analytics.getDashboardStats, { organizationId: otherOrg }))
        .totalEmployees,
    ).toBe(0);
    expect(await caller.query(api.analytics.getRecentLeaves, { organizationId: otherOrg })).toEqual(
      [],
    );
    expect(
      (
        await caller.query(api.analytics.getReportData, {
          organizationId: otherOrg,
          metric: 'employees',
          groupBy: 'none',
        })
      ).total,
    ).toBe(0);
    expect(
      (await caller.query(api.analytics.getUserAnalytics, { userId: adminId }))?.user._id,
    ).toBe(adminId);
    await t.run((ctx) => ctx.db.patch(orgId, { frozenAt: Date.now() }));
    expect((await caller.query(api.analytics.getAnalyticsOverview, {})).users).toEqual([]);
  });

  it('all administrative AI queries reject an anonymous supplied admin id', async () => {
    const { t, orgId, adminId } = await seed();
    const args = { organizationId: orgId, userId: adminId };
    await expect(t.query(api.aiGovernance.getStats, args)).rejects.toThrow('Not authorized');
    await expect(t.query(api.aiGovernance.getRecentActivity, args)).rejects.toThrow(
      'Not authorized',
    );
    await expect(t.query(api.aiGovernance.getAgentHealth, args)).rejects.toThrow('Not authorized');
    await expect(t.query(api.aiGovernance.getAuditLog, args)).rejects.toThrow('Not authorized');
    await expect(t.query(api.aiGovernance.getGuardrails, args)).rejects.toThrow('Not authorized');
  });

  it('AI settings allow the actual org admin and reject unknown prototype keys', async () => {
    const { t, orgId, adminId } = await seed();
    const caller = t.withIdentity({ email: 'audit-admin@example.test' });
    const args = { organizationId: orgId, userId: adminId, key: 'piiDetection', enabled: false };
    await caller.mutation(api.aiGovernance.updateGuardrail, args);
    expect(
      (
        await caller.query(api.aiGovernance.getGuardrails, {
          organizationId: orgId,
          userId: adminId,
        })
      ).piiDetection,
    ).toBe(false);
    await expect(
      caller.mutation(api.aiGovernance.updateGuardrail, {
        ...args,
        key: 'constructor',
      }),
    ).rejects.toThrow('Unknown guardrail');
    await t.run((ctx) => ctx.db.patch(adminId, { isActive: false }));
    await expect(caller.mutation(api.aiGovernance.updateGuardrail, args)).rejects.toThrow(
      'Not authorized',
    );
  });

  it('employees cannot impersonate an admin or read colleagues personal analytics', async () => {
    const { t, orgId, adminId } = await seed();
    const employeeId = await t.run(async (ctx) => {
      const admin = (await ctx.db.get(adminId))!;
      const { _id, _creationTime, ...fields } = admin;
      return ctx.db.insert('users', {
        ...fields,
        email: 'employee@example.test',
        role: 'employee',
      });
    });
    const caller = t.withIdentity({ email: 'employee@example.test' });
    await expect(
      caller.mutation(api.aiGovernance.updateGuardrail, {
        organizationId: orgId,
        userId: adminId,
        key: 'piiDetection',
        enabled: false,
      }),
    ).rejects.toThrow('Not authorized');
    expect(await caller.query(api.analytics.getUserAnalytics, { userId: adminId })).toBeNull();
    expect(
      (await caller.query(api.analytics.getUserAnalytics, { userId: employeeId }))?.user._id,
    ).toBe(employeeId);
    expect((await caller.query(api.analytics.getAnalyticsOverview, {})).users).toEqual([]);
    expect(
      (await caller.query(api.analytics.getReportData, { metric: 'payroll', groupBy: 'none' }))
        .total,
    ).toBe(0);
  });

  it('AI telemetry derives its actor from auth and rejects anonymous or forged actors', async () => {
    const { t, orgId, adminId } = await seed();
    const args = {
      organizationId: orgId,
      userId: adminId,
      userName: 'Forged',
      agent: 'general',
      action: 'fixture',
      status: 'allowed' as const,
      tokens: 10,
      latencyMs: 5,
    };
    await expect(t.mutation(api.aiGovernance.logRequest, args)).rejects.toThrow('Not authorized');
    const caller = t.withIdentity({ email: 'audit-admin@example.test' });
    await caller.mutation(api.aiGovernance.logRequest, args);
    const rows = await t.run((ctx) => ctx.db.query('aiRequestLogs').collect());
    expect(rows[0]?.userName).toBe('Fixture admin');
    await expect(
      caller.mutation(api.aiGovernance.logRequest, { ...args, tokens: -1 }),
    ).rejects.toThrow('Invalid telemetry');
    const other = await t.run(async (ctx) => {
      const admin = (await ctx.db.get(adminId))!;
      const { _id, _creationTime, ...fields } = admin;
      const otherOrgId = await ctx.db.insert('organizations', {
        name: 'Other',
        slug: 'telemetry-other',
        plan: 'professional',
        isActive: true,
        createdBySuperadmin: false,
        employeeLimit: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const otherAdminId = await ctx.db.insert('users', {
        ...fields,
        organizationId: otherOrgId,
        email: 'other-admin@example.test',
      });
      return { otherOrgId, otherAdminId };
    });
    await expect(
      caller.mutation(api.aiGovernance.logRequest, {
        ...args,
        userId: other.otherAdminId,
      }),
    ).rejects.toThrow('caller mismatch');
    await expect(
      caller.mutation(api.aiGovernance.logRequest, {
        ...args,
        organizationId: other.otherOrgId,
      }),
    ).rejects.toThrow('Not authorized');
    await expect(
      caller.mutation(api.aiGovernance.updateGuardrail, {
        organizationId: other.otherOrgId,
        userId: other.otherAdminId,
        key: 'piiDetection',
        enabled: false,
      }),
    ).rejects.toThrow('Not authorized');
    await expect(
      caller.mutation(api.aiGovernance.updateGuardrail, {
        organizationId: orgId,
        userId: other.otherAdminId,
        key: 'piiDetection',
        enabled: false,
      }),
    ).rejects.toThrow('caller mismatch');
    await t.run((ctx) => ctx.db.patch(adminId, { role: 'superadmin' }));
    await expect(
      caller.mutation(api.security.toggleSetting, {
        key: 'audit_logging',
        enabled: false,
        updatedBy: other.otherAdminId,
      }),
    ).rejects.toThrow('caller mismatch');
  });

  it('backup operations require an active DB superadmin, not an org admin', async () => {
    const { t, orgId, adminId } = await seed();
    const caller = t.withIdentity({ email: 'audit-admin@example.test' });
    await expect(
      t.mutation(api.backups.createEmployeeBackup, {
        organizationId: orgId,
        userId: adminId,
      }),
    ).rejects.toThrow('Only superadmins');
    await expect(
      t.mutation(api.backups.createOrgBackups, { organizationId: orgId }),
    ).rejects.toThrow('Only superadmins');
    await expect(t.mutation(api.backups.cleanupExpiredBackups, {})).rejects.toThrow(
      'Only superadmins',
    );
    const backupId = await t.run((ctx) =>
      ctx.db.insert('employeeBackups', {
        organizationId: orgId,
        userId: adminId,
        userName: 'Fixture admin',
        userEmail: 'audit-admin@example.test',
        snapshot: '{}',
        snapshotSize: 2,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }),
    );
    expect(await caller.query(api.backups.getBackupDetails, { backupId })).toBeNull();
    expect(
      await t.query(api.backups.getUserBackups, { organizationId: orgId, userId: adminId }),
    ).toEqual([]);
    await t.run((ctx) => ctx.db.patch(adminId, { role: 'superadmin' }));
    expect((await caller.query(api.backups.getBackupDetails, { backupId }))?.snapshot).toEqual({});
    expect((await caller.query(api.backups.getOrgBackups, { organizationId: orgId })).length).toBe(
      1,
    );
    await t.run((ctx) => ctx.db.patch(adminId, { isActive: false }));
    expect(await caller.query(api.backups.getBackupDetails, { backupId })).toBeNull();
  });

  it('global setting changes require the DB superadmin and a matching audit actor', async () => {
    const { t, adminId } = await seed();
    const caller = t.withIdentity({ email: 'audit-admin@example.test' });
    const args = { key: 'failed_login_lockout', enabled: false, updatedBy: adminId };
    await expect(caller.mutation(api.security.toggleSetting, args)).rejects.toThrow(
      'Only superadmins',
    );
    expect(await t.query(api.security.getAllSettings, {})).toEqual([]);
    await expect(t.query(api.security.getLoginStats, {})).rejects.toThrow('Not authorized');
    expect((await caller.query(api.security.getLoginStats, {})).total).toBe(0);
    await t.run((ctx) => ctx.db.patch(adminId, { role: 'superadmin' }));
    await caller.mutation(api.security.toggleSetting, args);
    expect(await t.query(api.security.getSetting, { key: args.key })).toBe(false);
    await expect(
      caller.mutation(api.security.toggleSetting, { ...args, key: 'unknown' }),
    ).rejects.toThrow('Unknown security');
    const logs = await t.run((ctx) => ctx.db.query('auditLogs').collect());
    expect(logs[0]?.userId).toBe(adminId);
  });

  it('anonymous caller cannot read a private draft survey', async () => {
    const { t, orgId, adminId } = await seed();
    const surveyId = await t.run((ctx) =>
      ctx.db.insert('surveys', {
        organizationId: orgId,
        title: 'Private draft',
        createdBy: adminId,
        status: 'draft',
        isAnonymous: true,
        responseCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const result = await t.query(api.surveys.getSurveyWithQuestions, { surveyId });
    expect(result).toBeNull();
  });

  it('roster date-index query returns the requested newer shift', async () => {
    const { t, orgId, adminId } = await seed();
    await t.run(async (ctx) => {
      for (let i = 0; i < 2000; i++) {
        await ctx.db.insert('shifts', {
          organizationId: orgId,
          userId: adminId,
          date: '2026-01-01',
          startMinute: 540,
          endMinute: 1020,
          status: 'published',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await ctx.db.insert('shifts', {
        organizationId: orgId,
        userId: adminId,
        date: '2026-09-30',
        startMinute: 540,
        endMinute: 1020,
        status: 'published',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const result = await t
      .withIdentity({ email: 'audit-admin@example.test' })
      .query(api.shifts.getRoster, { from: '2026-09-30', to: '2026-09-30' });
    expect(result.shifts).toHaveLength(1);
  });

  it('bootstrap email does not grant superadmin privileges to an employee role', () => {
    const previous = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
    process.env.BOOTSTRAP_SUPERADMIN_EMAIL = 'bootstrap@example.test';
    try {
      expect(isSuperadmin({ role: 'employee', email: 'bootstrap@example.test' })).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
      else process.env.BOOTSTRAP_SUPERADMIN_EMAIL = previous;
    }
  });

  it('failed biometric attempts persist counters and lockout', async () => {
    const { t, adminId } = await seed();
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = (await t.mutation(api.faceRecognition.loginWithFace, {
        email: 'audit-admin@example.test',
        faceDescriptor: Array(128).fill(10),
      })) as unknown as { error?: string; blocked?: boolean };
      expect(res.error).toBeDefined();
    }
    const user = await t.run((ctx) => ctx.db.get(adminId));
    expect(user?.faceIdFailedAttempts ?? 0).toBeGreaterThan(0);
    expect(user?.faceIdBlocked ?? false).toBe(true);
    const logs = await t.run((ctx) => ctx.db.query('loginAttempts').collect());
    expect(logs.length).toBeGreaterThan(0);
  });
});
