/**
 * Query-safe session validation + per-user rate limiting.
 * Verifies that the requester has an active session before returning user doc.
 */
import type { Id, Doc } from '../_generated/dataModel';

// Simple in-memory rate limiter (resets on deploy/restart)
const queryCounters = new Map<string, { count: number; resetAt: number }>();
const MAX_QUERIES_PER_MINUTE = 300;

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = queryCounters.get(userId);
  if (!entry || entry.resetAt < now) {
    queryCounters.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  entry.count++;
  if (entry.count > MAX_QUERIES_PER_MINUTE) {
    throw new Error('Rate limit exceeded. Please slow down.');
  }
}

export async function requireRequester(
  ctx: { db: any },
  requesterId: Id<'users'>,
): Promise<Doc<'users'>> {
  checkRateLimit(requesterId);
  const user = await ctx.db.get(requesterId);
  if (!user) throw new Error('User not found');
  if (!user.isActive) throw new Error('Account deactivated');
  if (!user.sessionToken || !user.sessionExpiry || user.sessionExpiry < Date.now()) {
    throw new Error('Session expired');
  }
  return user;
}
