/**
 * User Profile helper — reads from userProfiles table with lazy migration from users.
 * Use this in queries/mutations that need profile fields (department, position, phone, etc.)
 */

import type { Id, Doc } from '../_generated/dataModel';

export interface UserProfile {
  _id: Id<'userProfiles'>;
  userId: Id<'users'>;
  employeeType?: 'staff' | 'contractor';
  department?: string;
  departmentId?: Id<'departments'>;
  position?: string;
  positionId?: Id<'positions'>;
  supervisorId?: Id<'users'>;
  phone?: string;
  location?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  presenceStatus?: 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy';
  travelAllowance?: number;
  paidLeaveBalance?: number;
  sickLeaveBalance?: number;
  familyLeaveBalance?: number;
}

/** Profile field names for filtering */
export const PROFILE_FIELDS = [
  'employeeType',
  'department',
  'departmentId',
  'position',
  'positionId',
  'supervisorId',
  'phone',
  'location',
  'avatarUrl',
  'dateOfBirth',
  'presenceStatus',
  'travelAllowance',
  'paidLeaveBalance',
  'sickLeaveBalance',
  'familyLeaveBalance',
] as const;

/**
 * Get user profile from userProfiles table.
 * If not found, lazily migrates from users table.
 * For use in queries (read-only context) — returns profile or null.
 */
export async function getProfile(ctx: any, userId: Id<'users'>): Promise<UserProfile | null> {
  const existing = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .first();
  if (existing) return existing;

  // Lazy migration: copy from users table
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const profileId = await ctx.db.insert('userProfiles', {
    userId,
    employeeType: user.employeeType,
    department: user.department,
    departmentId: user.departmentId,
    position: user.position,
    positionId: user.positionId,
    supervisorId: user.supervisorId,
    phone: user.phone,
    location: user.location,
    avatarUrl: user.avatarUrl,
    dateOfBirth: user.dateOfBirth,
    presenceStatus: user.presenceStatus,
    travelAllowance: user.travelAllowance,
    paidLeaveBalance: user.paidLeaveBalance,
    sickLeaveBalance: user.sickLeaveBalance,
    familyLeaveBalance: user.familyLeaveBalance,
  });

  return await ctx.db.get(profileId);
}

/**
 * Get profile fields directly from user doc (backward compat, no migration).
 * Use this when you already have the user doc loaded and just need profile fields.
 */
export function extractProfileFromUser(user: Doc<'users'>) {
  return {
    employeeType: user.employeeType,
    department: user.department,
    departmentId: user.departmentId,
    position: user.position,
    positionId: user.positionId,
    supervisorId: user.supervisorId,
    phone: user.phone,
    location: user.location,
    avatarUrl: user.avatarUrl,
    dateOfBirth: user.dateOfBirth,
    presenceStatus: user.presenceStatus,
    travelAllowance: user.travelAllowance,
    paidLeaveBalance: user.paidLeaveBalance,
    sickLeaveBalance: user.sickLeaveBalance,
    familyLeaveBalance: user.familyLeaveBalance,
  };
}

/**
 * Dual-write: patch profile fields in both users and userProfiles tables.
 * Use this when updating profile fields to keep both tables in sync.
 */
export async function patchProfile(
  ctx: any,
  userId: Id<'users'>,
  patch: Partial<Omit<UserProfile, '_id' | 'userId'>>,
) {
  // Write to users table (backward compat)
  await ctx.db.patch(userId, patch);

  // Write to userProfiles table
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .first();

  if (profile) {
    await ctx.db.patch(profile._id, patch);
  }
  // If no profile exists yet, lazy migration will create it on next read
}
