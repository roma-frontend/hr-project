import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Helper to get current user ID from session token
 */
async function getCurrentUserId(ctx: any, sessionToken?: string): Promise<string | null> {
  if (!sessionToken) return null;

  const users = await ctx.db.query("users").collect();
  const user = users.find((u: any) => u.sessionToken === sessionToken);

  if (!user) return null;
  if (user.sessionExpiry && user.sessionExpiry < Date.now()) return null;

  return user._id;
}

/**
 * Check if user has seen a specific onboarding tour
 */
export const hasSeenTour = query({
  args: {
    tourId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { tourId, sessionToken }) => {
    const userId = await getCurrentUserId(ctx, sessionToken);

    // If not authenticated, check localStorage (handled on client)
    // For authenticated users, check database
    if (!userId) {
      return null; // Client will handle localStorage check
    }

    const preference = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", userId as any).eq("key", `tour_seen_${tourId}`)
      )
      .first();

    return preference?.value === true;
  },
});

/**
 * Mark a tour as seen for the current user
 */
export const markTourAsSeen = mutation({
  args: {
    tourId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { tourId, sessionToken }) => {
    const userId = await getCurrentUserId(ctx, sessionToken);

    // For non-authenticated users, this will be handled via localStorage on client
    if (!userId) {
      return { success: true, storage: "localStorage" };
    }

    // Check if preference already exists
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", userId as any).eq("key", `tour_seen_${tourId}`)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        value: true,
        updatedAt: Date.now(),
      });
    } else {
      // Create new preference
      await ctx.db.insert("userPreferences", {
        userId: userId as any,
        key: `tour_seen_${tourId}`,
        value: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true, storage: "database" };
  },
});

/**
 * Get all user preferences
 */
export const getAllPreferences = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, { sessionToken }) => {
    const userId = await getCurrentUserId(ctx, sessionToken);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .collect();

    return preferences;
  },
});

/**
 * Set a user preference
 */
export const setPreference = mutation({
  args: {
    key: v.string(),
    value: v.any(),
    sessionToken: v.string(),
  },
  handler: async (ctx, { key, value, sessionToken }) => {
    const userId = await getCurrentUserId(ctx, sessionToken);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_and_key", (q) =>
        q.eq("userId", userId as any).eq("key", key)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: userId as any,
        key,
        value,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
