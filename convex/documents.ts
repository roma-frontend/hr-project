import { v } from 'convex/values';
import { getAuthCaller } from './lib/getAuthCaller';
import { query, mutation } from './_generated/server';
import { MAX_PAGE_SIZE } from './pagination';
import { isSuperadmin } from './lib/auth';
import { DEFAULT_LIST_CAP, SMALL_LIST_CAP } from './lib/limits';
import type { Doc, Id } from './_generated/dataModel';
import {
  assertModuleAccess,
  assertQuota,
  decrementUsage,
  incrementUsage,
} from './lib/entitlements';
import { resolveOrgScope, resolveOrgStaff, assertOrgScope, assertOrgStaff } from './lib/orgAccess';

// ─── Helper: Check permissions ───────────────────────────────────────────────

/** The seven document categories, shared by create and update. */
const documentCategoryValidator = v.union(
  v.literal('policy'),
  v.literal('contract'),
  v.literal('report'),
  v.literal('template'),
  v.literal('form'),
  v.literal('certificate'),
  v.literal('other'),
);

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────

export const listDocuments = query({
  args: {
    organizationId: v.id('organizations'),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    includeUnpublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveOrgStaff(ctx, args.organizationId, { adminOnly: true });
    if (!scope) return [];

    // The library (policies, forms, templates) is staff-only. Employees work
    // with the documents issued to them (issuedDocuments.listMine) instead.

    const docsRaw = await ctx.db
      .query('documents')
      .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
      .take(MAX_PAGE_SIZE + 1);
    const isCappedDocs = docsRaw.length > MAX_PAGE_SIZE;
    void isCappedDocs;
    let docs = docsRaw.slice(0, MAX_PAGE_SIZE);

    if (!args.includeUnpublished) {
      docs = docs.filter((d) => d.isPublished);
    }

    if (args.category) docs = docs.filter((d) => d.category === args.category);
    if (args.search) {
      const lower = args.search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(lower) || d.description?.toLowerCase().includes(lower),
      );
    }

    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const uploader = await ctx.db.get(doc.uploadedBy);
        return { ...doc, uploaderName: uploader?.name ?? 'Unknown' };
      }),
    );

    return enriched;
  },
});

export const getDocument = query({
  args: {
    organizationId: v.id('organizations'),
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const scope = await assertOrgStaff(ctx, args.organizationId, { adminOnly: true });
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.organizationId !== scope.organizationId!) {
      throw new Error('Document not found');
    }
    const uploader = await ctx.db.get(doc.uploadedBy);
    return { ...doc, uploaderName: uploader?.name ?? 'Unknown' };
  },
});

/**
 * Single document by id — backs `/documents/[id]`.
 *
 * The id is the only argument, so the organization has to be checked *after*
 * the read: without it any authenticated user could open any tenant's document
 * by guessing an id. Unpublished drafts stay hidden from non-managers for the
 * same reason the list filters them out.
 */
export const getDocumentById = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) return null;
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;

    const isSuper = isSuperadmin(caller);
    if (!isSuper && caller.organizationId !== doc.organizationId) return null;

    const canManage = isSuper || caller.role === 'admin';
    // The library is staff-only; employees open their issued documents instead.
    if (!canManage) return null;
    if (!doc.isPublished && !canManage) return null;

    const uploader = await ctx.db.get(doc.uploadedBy);
    return { ...doc, uploaderName: uploader?.name ?? 'Unknown', canManage };
  },
});

export const createDocument = mutation({
  args: {
    organizationId: v.id('organizations'),
    title: v.string(),
    description: v.optional(v.string()),
    category: documentCategoryValidator,
    fileUrl: v.string(),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    isMandatory: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'documents');
    const scope = await assertOrgStaff(ctx, args.organizationId, { adminOnly: true });

    // Plan enforcement: each document consumes one slot of the `documents`
    // quota (the constructor sets the per-plan limit).
    await assertQuota(ctx, 'documents', 'documents', 1);

    const now = Date.now();
    const documentId = await ctx.db.insert('documents', {
      organizationId: scope.organizationId!,
      title: args.title,
      description: args.description,
      category: args.category,
      fileUrl: args.fileUrl,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedBy: scope.caller._id,
      isPublished: false,
      isMandatory: args.isMandatory ?? false,
      expiresAt: args.expiresAt,
      tags: args.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });

    await incrementUsage(ctx, scope.organizationId!, 'documents', 'documents', 1);
    return documentId;
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.id('documents'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(documentCategoryValidator),
    fileUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isMandatory: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'documents');
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error('Document not found');
    const scope = await assertOrgStaff(ctx, doc.organizationId, { adminOnly: true });

    const patch: Partial<Doc<'documents'>> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.category !== undefined) patch.category = args.category;
    if (args.fileUrl !== undefined) patch.fileUrl = args.fileUrl;
    if (args.fileName !== undefined) patch.fileName = args.fileName;
    if (args.fileSize !== undefined) patch.fileSize = args.fileSize;
    if (args.mimeType !== undefined) patch.mimeType = args.mimeType;
    if (args.isPublished !== undefined) patch.isPublished = args.isPublished;
    if (args.isMandatory !== undefined) patch.isMandatory = args.isMandatory;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt;
    if (args.tags !== undefined) patch.tags = args.tags;

    await ctx.db.patch(args.documentId, patch);
    return { success: true };
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'documents');
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error('Document not found');
    // Same gate as create/update: this deletes the record *and* everyone's read
    // history, which any org member could previously do for any document.
    const scope = await assertOrgStaff(ctx, doc.organizationId, { adminOnly: true });

    const viewsRaw = await ctx.db
      .query('documentViews')
      .withIndex('by_document', (q) =>
        q.eq('organizationId', scope.organizationId!).eq('documentId', doc._id),
      )
      .take(DEFAULT_LIST_CAP + 1);
    const isCappedViews = viewsRaw.length > DEFAULT_LIST_CAP;
    void isCappedViews;
    const views = viewsRaw.slice(0, DEFAULT_LIST_CAP);
    for (const view of views) await ctx.db.delete(view._id);

    await ctx.db.delete(args.documentId);
    // A deleted document frees its quota slot.
    await decrementUsage(ctx, scope.organizationId!, 'documents', 'documents', 1);
    return { success: true };
  },
});

// ─── DOCUMENT VIEWS ──────────────────────────────────────────────────────────

/**
 * Record that the caller opened a document, and optionally that they
 * acknowledged it.
 *
 * `acknowledged` is only ever raised, never cleared implicitly: a later plain
 * view (opening the file again) used to overwrite the flag with `undefined` and
 * silently revoke an acknowledgement the employee had already given.
 */
export const recordDocumentView = mutation({
  args: {
    organizationId: v.id('organizations'),
    documentId: v.id('documents'),
    acknowledged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const scope = await assertOrgStaff(ctx, args.organizationId, { adminOnly: true });

    const document = await ctx.db.get(args.documentId);
    if (!document || document.organizationId !== scope.organizationId!) {
      throw new Error('Document not found');
    }

    const existing = await ctx.db
      .query('documentViews')
      .withIndex('by_user_document', (q) =>
        q
          .eq('organizationId', scope.organizationId!)
          .eq('userId', scope.caller._id)
          .eq('documentId', args.documentId),
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        viewedAt: now,
        acknowledged: args.acknowledged ?? existing.acknowledged,
      });
    } else {
      await ctx.db.insert('documentViews', {
        organizationId: scope.organizationId!,
        documentId: args.documentId,
        userId: scope.caller._id,
        viewedAt: now,
        acknowledged: args.acknowledged,
      });
    }

    return { success: true };
  },
});

export const getMyDocumentViews = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const scope = await resolveOrgScope(ctx, args.organizationId);
    if (!scope) return [];
    const viewsRaw = await ctx.db
      .query('documentViews')
      .withIndex('by_user', (q) =>
        q.eq('organizationId', scope.organizationId!).eq('userId', scope.caller._id),
      )
      .take(DEFAULT_LIST_CAP + 1);
    const isCappedMyViews = viewsRaw.length > DEFAULT_LIST_CAP;
    void isCappedMyViews;
    return viewsRaw.slice(0, DEFAULT_LIST_CAP);
  },
});

/**
 * Who read (and acknowledged) a document. Staff-only: it exposes the names and
 * emails of everyone who opened it, which is not the reading employee's business.
 * Returns `[]` instead of throwing so a non-manager's page renders empty.
 */
export const getDocumentViews = query({
  args: {
    organizationId: v.id('organizations'),
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const scope = await resolveOrgStaff(ctx, args.organizationId, { adminOnly: true });
    if (!scope) return [];
    const viewsRaw = await ctx.db
      .query('documentViews')
      .withIndex('by_document', (q) =>
        q.eq('organizationId', scope.organizationId!).eq('documentId', args.documentId),
      )
      .take(DEFAULT_LIST_CAP + 1);
    const isCappedViews = viewsRaw.length > DEFAULT_LIST_CAP;
    void isCappedViews;
    const views = viewsRaw.slice(0, DEFAULT_LIST_CAP);

    const enriched = await Promise.all(
      views.map(async (view) => {
        const user = await ctx.db.get(view.userId);
        return { ...view, userName: user?.name ?? 'Unknown', userEmail: user?.email };
      }),
    );

    return enriched;
  },
});

// ─── DOCUMENT CATEGORIES ─────────────────────────────────────────────────────

export const getDocumentCategories = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const scope = await resolveOrgStaff(ctx, args.organizationId, { adminOnly: true });
    // Categories organize the staff-only library — nothing to list for others.
    if (!scope) return [];
    const catsRaw = await ctx.db
      .query('documentCategories')
      .withIndex('by_org', (q) => q.eq('organizationId', scope.organizationId!))
      .order('asc')
      .take(SMALL_LIST_CAP + 1);
    const isCappedCats = catsRaw.length > SMALL_LIST_CAP;
    void isCappedCats;
    return catsRaw.slice(0, SMALL_LIST_CAP);
  },
});

export const createDocumentCategory = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertModuleAccess(ctx, 'documents');
    const scope = await assertOrgStaff(ctx, args.organizationId, { adminOnly: true });

    const now = Date.now();
    return await ctx.db.insert('documentCategories', {
      organizationId: scope.organizationId!,
      name: args.name,
      description: args.description,
      icon: args.icon,
      color: args.color,
      order: args.order ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── TEAM/ADMIN DOCUMENT OVERVIEW ────────────────────────────────────────────

export const getTeamDocumentOverview = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    // Resolve the requester without throwing — a stale client cache may call
    // this query for a user whose DB role no longer qualifies as admin. In
    // that case we return `null` so the UI (which already guards on
    // `teamOverview` being truthy) degrades gracefully instead of crashing
    // the whole page render.
    if (!caller) return null;

    const isPlatformSuperadmin = isSuperadmin(caller);

    const isAdmin = isPlatformSuperadmin || caller.role === 'admin';
    if (!isAdmin) return null;

    if (!isPlatformSuperadmin && caller.organizationId !== args.organizationId) {
      return null;
    }

    const docsRaw = await ctx.db
      .query('documents')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP + 1);
    const isCappedDocs = docsRaw.length > DEFAULT_LIST_CAP;
    void isCappedDocs;
    const docs = docsRaw.slice(0, DEFAULT_LIST_CAP);

    const viewsRaw = await ctx.db
      .query('documentViews')
      .withIndex('by_user', (q) => q.eq('organizationId', args.organizationId))
      .take(DEFAULT_LIST_CAP + 1);
    const isCappedViews = viewsRaw.length > DEFAULT_LIST_CAP;
    void isCappedViews;
    const views = viewsRaw.slice(0, DEFAULT_LIST_CAP);

    const totalDocuments = docs.length;
    const publishedDocuments = docs.filter((d) => d.isPublished).length;
    const mandatoryDocuments = docs.filter((d) => d.isMandatory).length;
    const totalViews = views.length;
    const acknowledgedViews = views.filter((v) => v.acknowledged).length;

    const acknowledgmentRate =
      totalViews > 0 ? Math.round((acknowledgedViews / totalViews) * 100) : 0;

    return {
      totalDocuments,
      publishedDocuments,
      mandatoryDocuments,
      totalViews,
      acknowledgmentRate,
    };
  },
});
