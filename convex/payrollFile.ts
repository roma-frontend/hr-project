import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthCaller } from './lib/getAuthCaller';
import { dedupePaymentFields, isPaymentDelimiter, unknownPaymentFields } from './lib/paymentFields';

/**
 * The organisation's salary bank-file layout.
 *
 * Before this module the column order lived in `localStorage` on whichever
 * browser the accountant happened to use (`PayrollRunDetailClient`), which meant
 * the *employer's* bank template was a private preference of one person's
 * machine. Move to a different computer and the export silently changed shape.
 *
 * It lives in the database now, but it is still a setting rather than a
 * certification: `profileId` names a preset, `columns` is the order actually
 * rendered, and every read re-validates against the shared field list so a row
 * written by an older version cannot make the renderer drop a column.
 */

/** Field ids are validated on write; deduped on read. */
function cleanColumns(values: string[]): string[] {
  const unknown = unknownPaymentFields(values);
  if (unknown.length > 0) {
    // Failing loudly beats dropping the column: a stored layout naming a field
    // the renderer does not know would produce a file missing a column that the
    // bank portal expects, and the accountant only finds out at upload.
    throw new Error(`Unknown payment field(s): ${unknown.join(', ')}`);
  }
  return dedupePaymentFields(values);
}

/**
 * Read the caller's org layout.
 *
 * No role gate: the accountant preparing the export is not necessarily an
 * admin, and this is a column order, not a secret. Writes are gated below.
 */
export const getPayrollFileLayout = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller?.organizationId) return null;

    const row = await ctx.db
      .query('orgPayrollFile')
      .withIndex('by_org', (q) => q.eq('organizationId', caller.organizationId!))
      .unique();

    if (!row) return null;

    return {
      profileId: row.profileId,
      // Deduplicated on read as well: a rename or a hand-edited row must not be
      // able to render two identical columns.
      columns: dedupePaymentFields(row.columns),
      delimiter: row.delimiter,
      header: row.header,
      purpose: row.purpose,
      payerAccount: row.payerAccount,
      updatedAt: row.updatedAt,
    };
  },
});

/** Upsert the layout. Admins and superadmins only, matching branding. */
export const savePayrollFileLayout = mutation({
  args: {
    profileId: v.string(),
    columns: v.array(v.string()),
    delimiter: v.optional(v.string()),
    header: v.optional(v.boolean()),
    purpose: v.optional(v.string()),
    payerAccount: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      throw new Error('Only admins can change the salary bank-file layout');
    }
    const organizationId = caller.organizationId;
    if (!organizationId) throw new Error('No organization');

    // A separator outside the three a portal accepts is a typo, and a file with
    // the wrong separator parses as a single mangled column.
    if (args.delimiter !== undefined && !isPaymentDelimiter(args.delimiter)) {
      throw new Error('Unsupported delimiter');
    }

    const columns = cleanColumns(args.columns);

    // Trim, and store blank as absent so "unset keeps the preset" stays true.
    const purpose = args.purpose?.trim() || undefined;
    const payerAccount = args.payerAccount?.trim() || undefined;

    const now = Date.now();
    const existing = await ctx.db
      .query('orgPayrollFile')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .unique();

    const data = {
      profileId: args.profileId,
      columns,
      delimiter: args.delimiter,
      header: args.header,
      purpose,
      payerAccount,
      updatedBy: caller._id,
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...data, updatedAt: now });
      return { id: existing._id, updated: true };
    }

    const id = await ctx.db.insert('orgPayrollFile', {
      organizationId,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
    return { id, updated: false };
  },
});

/** Drop the stored layout so the exports fall back to the preset. */
export const resetPayrollFileLayout = mutation({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthCaller(ctx);
    if (!caller) throw new Error('Not authenticated');
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
      throw new Error('Only admins can change the salary bank-file layout');
    }
    const organizationId = caller.organizationId;
    if (!organizationId) throw new Error('No organization');

    const existing = await ctx.db
      .query('orgPayrollFile')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});
