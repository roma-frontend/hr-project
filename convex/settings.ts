/**
 * User Settings Management
 * Save and load user preferences (language, timezone, date format, etc.)
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

/**
 * Get user settings
 */
export const getUserSettings = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    return {
      language: user.language ?? 'en',
      timezone: user.timezone ?? 'UTC',
      dateFormat: user.dateFormat ?? 'DD/MM/YYYY',
      timeFormat: user.timeFormat ?? '24h',
      firstDayOfWeek: user.firstDayOfWeek ?? 'monday',
      theme: user.theme ?? 'system',
      notificationsEnabled: user.notificationsEnabled ?? true,
      emailNotifications: user.emailNotifications ?? true,
      pushNotifications: user.pushNotifications ?? false,
    };
  },
});

/**
 * Update user settings
 */
export const updateUserSettings = mutation({
  args: {
    userId: v.id('users'),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    timeFormat: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.string()),
    theme: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    emailNotifications: v.optional(v.boolean()),
    pushNotifications: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const patch: any = { updatedAt: Date.now() };

    if (args.language !== undefined) patch.language = args.language;
    if (args.timezone !== undefined) patch.timezone = args.timezone;
    if (args.dateFormat !== undefined) patch.dateFormat = args.dateFormat;
    if (args.timeFormat !== undefined) patch.timeFormat = args.timeFormat;
    if (args.firstDayOfWeek !== undefined) patch.firstDayOfWeek = args.firstDayOfWeek;
    if (args.theme !== undefined) patch.theme = args.theme;
    if (args.notificationsEnabled !== undefined)
      patch.notificationsEnabled = args.notificationsEnabled;
    if (args.emailNotifications !== undefined) patch.emailNotifications = args.emailNotifications;
    if (args.pushNotifications !== undefined) patch.pushNotifications = args.pushNotifications;

    await ctx.db.patch(args.userId, patch);

    return { success: true };
  },
});

/**
 * Update localization settings (language, timezone, date format)
 */
export const updateLocalizationSettings = mutation({
  args: {
    userId: v.id('users'),
    language: v.string(),
    timezone: v.string(),
    dateFormat: v.string(),
    timeFormat: v.string(),
    firstDayOfWeek: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    await ctx.db.patch(args.userId, {
      language: args.language,
      timezone: args.timezone,
      dateFormat: args.dateFormat,
      timeFormat: args.timeFormat,
      firstDayOfWeek: args.firstDayOfWeek,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update notification settings
 */
export const updateNotificationSettings = mutation({
  args: {
    userId: v.id('users'),
    notificationsEnabled: v.boolean(),
    emailNotifications: v.boolean(),
    pushNotifications: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    await ctx.db.patch(args.userId, {
      notificationsEnabled: args.notificationsEnabled,
      emailNotifications: args.emailNotifications,
      pushNotifications: args.pushNotifications,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update theme/appearance settings
 */
export const updateThemeSettings = mutation({
  args: {
    userId: v.id('users'),
    theme: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    await ctx.db.patch(args.userId, {
      theme: args.theme,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update session profile (for compatibility with existing action)
 */
export const updateSessionProfile = mutation({
  args: {
    userId: v.id('users'),
    profile: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    const patch: any = { updatedAt: Date.now() };

    if (args.profile.language !== undefined) patch.language = args.profile.language;
    if (args.profile.timezone !== undefined) patch.timezone = args.profile.timezone;
    if (args.profile.dateFormat !== undefined) patch.dateFormat = args.profile.dateFormat;
    if (args.profile.timeFormat !== undefined) patch.timeFormat = args.profile.timeFormat;
    if (args.profile.firstDayOfWeek !== undefined)
      patch.firstDayOfWeek = args.profile.firstDayOfWeek;

    await ctx.db.patch(args.userId, patch);

    return { success: true };
  },
});

/**
 * Get organization settings (for payroll tax configuration)
 */
export const getOrganizationSettings = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('Organization not found');

    return {
      organizationId: org._id,
      taxCountry: org.taxCountry ?? 'armenia',
      currency: org.currency ?? 'AMD',
      payrollCycle: org.payrollCycle ?? 'monthly',
      overtimeMultiplier: org.overtimeMultiplier ?? 1.5,
    };
  },
});
