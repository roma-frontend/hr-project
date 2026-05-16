/**
 * Query-safe session validation for requesterId.
 * Verifies that the requester has an active session before returning user doc.
 * Use this in queries instead of raw ctx.db.get(requesterId).
 */
import type { Id, Doc } from '../_generated/dataModel';

export async function requireRequester(
  ctx: { db: any },
  requesterId: Id<'users'>,
): Promise<Doc<'users'>> {
  const user = await ctx.db.get(requesterId);
  if (!user) throw new Error('User not found');
  if (!user.isActive) throw new Error('Account deactivated');
  if (!user.sessionToken || !user.sessionExpiry || user.sessionExpiry < Date.now()) {
    throw new Error('Session expired. Please log in again.');
  }
  return user;
}
