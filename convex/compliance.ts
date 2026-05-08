import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

// ── GDPR Requests ─────────────────────────────────────────────────────────────

export const createGdprRequest = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    requestType: v.union(
      v.literal('data_access'),
      v.literal('data_deletion'),
      v.literal('data_rectification'),
      v.literal('data_portability'),
      v.literal('data_restriction'),
      v.literal('consent_withdrawal'),
    ),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert('gdprRequests', {
      organizationId: args.organizationId,
      userId: args.userId,
      requestType: args.requestType,
      status: 'pending',
      details: args.details,
      requestedBy: args.userId,
      requestedAt: Date.now(),
    });

    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId: args.userId,
      action: `gdpr_request_${args.requestType}`,
      target: `gdpr_request_${requestId}`,
      details: args.details || `GDPR ${args.requestType} request created`,
      createdAt: Date.now(),
    });

    return { success: true, requestId };
  },
});

export const updateGdprRequestStatus = mutation({
  args: {
    requestId: v.id('gdprRequests'),
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('rejected'),
    ),
    processedBy: v.id('users'),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('GDPR request not found');
    }

    const updates: any = {
      status: args.status,
      processedBy: args.processedBy,
      processedAt: Date.now(),
    };

    if (args.status === 'completed') {
      updates.completedAt = Date.now();
    }

    if (args.status === 'rejected') {
      updates.rejectionReason = args.rejectionReason;
    }

    await ctx.db.patch(args.requestId, updates);

    await ctx.db.insert('auditLogs', {
      organizationId: request.organizationId,
      userId: args.processedBy,
      action: `gdpr_request_status_changed`,
      target: `gdpr_request_${args.requestId}`,
      details: `GDPR request status changed to ${args.status}${args.rejectionReason ? `: ${args.rejectionReason}` : ''}`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const getGdprRequests = query({
  args: {
    organizationId: v.optional(v.id('organizations')),
    userId: v.optional(v.id('users')),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let requests = await ctx.db.query('gdprRequests').order('desc').collect();

    if (args.organizationId) {
      requests = requests.filter((r) => r.organizationId === args.organizationId);
    }

    if (args.userId) {
      requests = requests.filter((r) => r.userId === args.userId);
    }

    if (args.status) {
      requests = requests.filter((r) => r.status === args.status);
    }

    requests = requests.slice(0, args.limit || 100);

    // Enrich with user names
    const uniqueUserIds = [
      ...new Set([
        ...requests.map((r) => r.userId),
        ...requests.map((r) => r.requestedBy),
        ...requests.map((r) => r.processedBy).filter(Boolean),
      ]),
    ];

    const usersBatch = await Promise.all(uniqueUserIds.map((id) => ctx.db.get(id as Id<'users'>)));
    const userMap = new Map(
      usersBatch.filter((u): u is Doc<'users'> => u !== null).map((u) => [u._id, u]),
    );

    return requests.map((request) => {
      const user = userMap.get(request.userId);
      const requestedBy = userMap.get(request.requestedBy);
      const processedBy = request.processedBy ? userMap.get(request.processedBy) : null;

      return {
        ...request,
        userName: user?.name ?? 'Unknown',
        userEmail: user?.email ?? '',
        requestedByName: requestedBy?.name ?? 'Unknown',
        processedByName: processedBy?.name ?? null,
      };
    });
  },
});

// ── Consent Management ────────────────────────────────────────────────────────

export const grantConsent = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    consentType: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    version: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('consentRecords')
      .withIndex('by_user_consent', (q) =>
        q.eq('userId', args.userId).eq('consentType', args.consentType),
      )
      .filter((q) => q.eq(q.field('granted'), true))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        grantedAt: Date.now(),
        withdrawnAt: undefined,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        version: args.version,
        metadata: args.metadata,
      });
      return { success: true, consentId: existing._id };
    }

    const consentId = await ctx.db.insert('consentRecords', {
      organizationId: args.organizationId,
      userId: args.userId,
      consentType: args.consentType,
      granted: true,
      grantedAt: Date.now(),
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      version: args.version,
      metadata: args.metadata,
    });

    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId: args.userId,
      action: 'consent_granted',
      target: `consent_${args.consentType}`,
      details: `User granted consent for ${args.consentType}`,
      createdAt: Date.now(),
    });

    return { success: true, consentId };
  },
});

export const withdrawConsent = mutation({
  args: {
    userId: v.id('users'),
    consentType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('consentRecords')
      .withIndex('by_user_consent', (q) =>
        q.eq('userId', args.userId).eq('consentType', args.consentType),
      )
      .filter((q) => q.eq(q.field('granted'), true))
      .first();

    if (!existing) {
      throw new Error('No active consent found to withdraw');
    }

    await ctx.db.patch(existing._id, {
      granted: false,
      withdrawnAt: Date.now(),
    });

    await ctx.db.insert('auditLogs', {
      organizationId: existing.organizationId,
      userId: args.userId,
      action: 'consent_withdrawn',
      target: `consent_${args.consentType}`,
      details: `User withdrew consent for ${args.consentType}`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const getUserConsents = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const consents = await ctx.db
      .query('consentRecords')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();

    return consents;
  },
});

export const getOrgConsentStats = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const allConsents = await ctx.db
      .query('consentRecords')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const consentTypes = new Set(allConsents.map((c) => c.consentType));
    const stats: Record<string, { granted: number; withdrawn: number }> = {};

    for (const type of consentTypes) {
      const typeConsents = allConsents.filter((c) => c.consentType === type);
      stats[type] = {
        granted: typeConsents.filter((c) => c.granted).length,
        withdrawn: typeConsents.filter((c) => !c.granted || c.withdrawnAt).length,
      };
    }

    return stats;
  },
});

// ── Data Access Logging ───────────────────────────────────────────────────────

export const logDataAccess = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    accessedBy: v.id('users'),
    accessType: v.union(
      v.literal('view'),
      v.literal('export'),
      v.literal('modify'),
      v.literal('delete'),
    ),
    dataType: v.string(),
    recordId: v.optional(v.string()),
    reason: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('dataAccessLogs', {
      ...args,
      createdAt: Date.now(),
    });

    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId: args.accessedBy,
      action: `data_access_${args.accessType}`,
      target: `${args.dataType}${args.recordId ? ` (${args.recordId})` : ''}`,
      details: `Accessed ${args.dataType} for user ${args.userId}${args.reason ? ` - Reason: ${args.reason}` : ''}`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const getDataAccessLogs = query({
  args: {
    organizationId: v.optional(v.id('organizations')),
    userId: v.optional(v.id('users')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query('dataAccessLogs').order('desc').collect();

    if (args.organizationId) {
      logs = logs.filter((l) => l.organizationId === args.organizationId);
    }

    if (args.userId) {
      logs = logs.filter((l) => l.userId === args.userId);
    }

    logs = logs.slice(0, args.limit || 100);

    // Enrich with user names
    const uniqueUserIds = [
      ...new Set([...logs.map((l) => l.userId), ...logs.map((l) => l.accessedBy)]),
    ];

    const usersBatch = await Promise.all(uniqueUserIds.map((id) => ctx.db.get(id as Id<'users'>)));
    const userMap = new Map(
      usersBatch.filter((u): u is Doc<'users'> => u !== null).map((u) => [u._id, u]),
    );

    return logs.map((log) => {
      const user = userMap.get(log.userId);
      const accessedBy = userMap.get(log.accessedBy);

      return {
        ...log,
        userName: user?.name ?? 'Unknown',
        userEmail: user?.email ?? '',
        accessedByName: accessedBy?.name ?? 'Unknown',
        accessedByEmail: accessedBy?.email ?? '',
      };
    });
  },
});

// ── Compliance Policies ───────────────────────────────────────────────────────

export const createPolicy = mutation({
  args: {
    organizationId: v.id('organizations'),
    title: v.string(),
    description: v.optional(v.string()),
    policyType: v.union(
      v.literal('data_retention'),
      v.literal('privacy'),
      v.literal('security'),
      v.literal('access_control'),
      v.literal('general'),
    ),
    content: v.string(),
    version: v.string(),
    createdBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const policyId = await ctx.db.insert('compliancePolicies', {
      organizationId: args.organizationId,
      title: args.title,
      description: args.description,
      policyType: args.policyType,
      content: args.content,
      version: args.version,
      isActive: true,
      effectiveFrom: Date.now(),
      createdBy: args.createdBy,
      updatedBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      userId: args.createdBy,
      action: 'policy_created',
      target: `policy_${policyId}`,
      details: `Compliance policy "${args.title}" created`,
      createdAt: Date.now(),
    });

    return { success: true, policyId };
  },
});

export const updatePolicy = mutation({
  args: {
    policyId: v.id('compliancePolicies'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    version: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    effectiveUntil: v.optional(v.number()),
    updatedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    await ctx.db.patch(args.policyId, {
      ...(args.title && { title: args.title }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.content && { content: args.content }),
      ...(args.version && { version: args.version }),
      ...(args.isActive !== undefined && { isActive: args.isActive }),
      ...(args.effectiveUntil !== undefined && { effectiveUntil: args.effectiveUntil }),
      updatedBy: args.updatedBy,
      updatedAt: Date.now(),
    });

    await ctx.db.insert('auditLogs', {
      organizationId: policy.organizationId,
      userId: args.updatedBy,
      action: 'policy_updated',
      target: `policy_${args.policyId}`,
      details: `Compliance policy "${policy.title}" updated`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const getPolicies = query({
  args: {
    organizationId: v.optional(v.id('organizations')),
    policyType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let policies = await ctx.db.query('compliancePolicies').order('desc').collect();

    if (args.organizationId) {
      policies = policies.filter((p) => p.organizationId === args.organizationId);
    }

    if (args.policyType) {
      policies = policies.filter((p) => p.policyType === args.policyType);
    }

    // Enrich with creator/updater names
    const uniqueUserIds = [
      ...new Set([...policies.map((p) => p.createdBy), ...policies.map((p) => p.updatedBy)]),
    ];

    const usersBatch = await Promise.all(uniqueUserIds.map((id) => ctx.db.get(id as Id<'users'>)));
    const userMap = new Map(
      usersBatch.filter((u): u is Doc<'users'> => u !== null).map((u) => [u._id, u]),
    );

    return policies.map((policy) => {
      const createdBy = userMap.get(policy.createdBy);
      const updatedBy = userMap.get(policy.updatedBy);

      return {
        ...policy,
        createdByName: createdBy?.name ?? 'Unknown',
        updatedByName: updatedBy?.name ?? 'Unknown',
      };
    });
  },
});

export const deletePolicy = mutation({
  args: {
    policyId: v.id('compliancePolicies'),
    deletedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    await ctx.db.delete(args.policyId);

    await ctx.db.insert('auditLogs', {
      organizationId: policy.organizationId,
      userId: args.deletedBy,
      action: 'policy_deleted',
      target: `policy_${args.policyId}`,
      details: `Compliance policy "${policy.title}" deleted`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Compliance Dashboard Stats ────────────────────────────────────────────────

export const getComplianceStats = query({
  args: {
    organizationId: v.optional(v.id('organizations')),
  },
  handler: async (ctx, args) => {
    let gdprRequests = await ctx.db.query('gdprRequests').collect();
    let dataAccessLogs = await ctx.db.query('dataAccessLogs').collect();
    let consentRecords = await ctx.db.query('consentRecords').collect();
    let policies = await ctx.db.query('compliancePolicies').collect();

    if (args.organizationId) {
      gdprRequests = gdprRequests.filter((r) => r.organizationId === args.organizationId);
      dataAccessLogs = dataAccessLogs.filter((l) => l.organizationId === args.organizationId);
      consentRecords = consentRecords.filter((c) => c.organizationId === args.organizationId);
      policies = policies.filter((p) => p.organizationId === args.organizationId);
    }

    const gdprByStatus = {
      pending: gdprRequests.filter((r) => r.status === 'pending').length,
      in_progress: gdprRequests.filter((r) => r.status === 'in_progress').length,
      completed: gdprRequests.filter((r) => r.status === 'completed').length,
      rejected: gdprRequests.filter((r) => r.status === 'rejected').length,
    };

    const consentStats = {
      total: consentRecords.length,
      active: consentRecords.filter((c) => c.granted && !c.withdrawnAt).length,
      withdrawn: consentRecords.filter((c) => !c.granted || c.withdrawnAt).length,
    };

    const policyStats = {
      total: policies.length,
      active: policies.filter((p) => p.isActive).length,
      inactive: policies.filter((p) => !p.isActive).length,
    };

    return {
      gdprRequests: gdprRequests.length,
      gdprByStatus,
      dataAccessLogs: dataAccessLogs.length,
      consentStats,
      policyStats,
    };
  },
});
