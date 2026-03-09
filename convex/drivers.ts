/**
 * Driver Management System
 * 
 * Features:
 * - Driver registration and profile management
 * - Trip booking requests
 * - Availability checking
 * - Calendar access permissions
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const SUPERADMIN_EMAIL = "romangulanyan@gmail.com";

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/** Get all available drivers in organization */
export const getAvailableDrivers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, { organizationId }) => {
    const drivers = await ctx.db
      .query("drivers")
      .withIndex("by_org_available", (q) => q.eq("organizationId", organizationId).eq("isAvailable", true))
      .collect();

    // Enrich with user info and filter only users with role 'driver'
    const enriched = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        // Only show if user has role 'driver'
        if (!user || user.role !== "driver") return null;
        
        return {
          ...driver,
          userName: user.name ?? "Unknown",
          userAvatar: user?.avatarUrl,
          userPosition: user?.position,
        };
      })
    );

    return enriched.filter(Boolean) as typeof enriched;
  },
});

/** Get driver by ID with full info */
export const getDriverById = query({
  args: {
    driverId: v.id("drivers"),
  },
  handler: async (ctx, { driverId }) => {
    const driver = await ctx.db.get(driverId);
    if (!driver) return null;

    const user = await ctx.db.get(driver.userId);
    return {
      ...driver,
      userName: user?.name ?? "Unknown",
      userAvatar: user?.avatarUrl,
      userPosition: user?.position,
      userPhone: user?.phone,
    };
  },
});

/** Get driver's schedule for a date range */
export const getDriverSchedule = query({
  args: {
    driverId: v.id("drivers"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverId, startTime, endTime }) => {
    const schedules = await ctx.db
      .query("driverSchedules")
      .withIndex("by_driver_time", (q) => q.eq("driverId", driverId))
      .filter((q) => 
        q.and(
          q.gte(q.field("startTime"), startTime),
          q.lte(q.field("startTime"), endTime)
        )
      )
      .collect();

    // Enrich with user info for each schedule
    const enriched = await Promise.all(
      schedules.map(async (schedule) => {
        const user = schedule.userId ? await ctx.db.get(schedule.userId) : null;
        return {
          ...schedule,
          userName: user?.name,
          userAvatar: user?.avatarUrl,
        };
      })
    );

    return enriched;
  },
});

/** Check if driver is available for a time slot */
export const isDriverAvailable = query({
  args: {
    driverId: v.id("drivers"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverId, startTime, endTime }) => {
    // Check for overlapping schedules
    const overlapping = await ctx.db
      .query("driverSchedules")
      .withIndex("by_driver_time", (q) => q.eq("driverId", driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), v.literal("scheduled")),
          q.or(
            q.and(
              q.lte(q.field("startTime"), startTime),
              q.gte(q.field("endTime"), startTime)
            ),
            q.and(
              q.lte(q.field("startTime"), endTime),
              q.gte(q.field("endTime"), endTime)
            ),
            q.and(
              q.gte(q.field("startTime"), startTime),
              q.lte(q.field("endTime"), endTime)
            )
          )
        )
      )
      .first();

    if (overlapping) {
      return {
        available: false,
        reason: "already_booked",
        conflict: overlapping,
      };
    }

    // Check driver's working hours
    const driver = await ctx.db.get(driverId);
    if (!driver) {
      return { available: false, reason: "driver_not_found" };
    }

    if (!driver.isAvailable) {
      return { available: false, reason: "driver_unavailable" };
    }

    // Check if within working hours
    const startDate = new Date(startTime);
    const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (!driver.workingHours.workingDays.includes(dayOfWeek)) {
      return { available: false, reason: "not_working_day" };
    }

    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();
    const timeInMinutes = startHour * 60 + startMinute;

    const [workStartHour, workStartMin] = driver.workingHours.startTime.split(":").map(Number);
    const [workEndHour, workEndMin] = driver.workingHours.endTime.split(":").map(Number);
    
    const workStartMinutes = workStartHour * 60 + workStartMin;
    const workEndMinutes = workEndHour * 60 + workEndMin;

    if (timeInMinutes < workStartMinutes || timeInMinutes > workEndMinutes) {
      return { available: false, reason: "outside_working_hours" };
    }

    // Check max trips per day
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);

    const tripsToday = await ctx.db
      .query("driverSchedules")
      .withIndex("by_driver_time", (q) => q.eq("driverId", driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), v.literal("trip")),
          q.gte(q.field("startTime"), startOfDay.getTime()),
          q.lte(q.field("startTime"), endOfDay.getTime()),
          q.neq(q.field("status"), v.literal("cancelled"))
        )
      )
      .collect();

    if (tripsToday.length >= driver.maxTripsPerDay) {
      return { available: false, reason: "max_trips_reached" };
    }

    return { available: true };
  },
});

/** Get pending driver requests for a driver */
export const getDriverRequests = query({
  args: {
    driverId: v.id("drivers"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, { driverId, status }) => {
    let requests;
    
    if (status) {
      requests = await ctx.db
        .query("driverRequests")
        .withIndex("by_driver", (q) => q.eq("driverId", driverId))
        .filter((q) => q.eq(q.field("status"), status))
        .collect();
    } else {
      requests = await ctx.db
        .query("driverRequests")
        .withIndex("by_driver", (q) => q.eq("driverId", driverId))
        .collect();
    }

    // Enrich with requester info
    const enriched = await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        return {
          ...request,
          requesterName: requester?.name,
          requesterAvatar: requester?.avatarUrl,
          requesterPosition: requester?.position,
        };
      })
    );

    return enriched;
  },
});

/** Get my driver requests (for employees) */
export const getMyRequests = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const requests = await ctx.db
      .query("driverRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", userId))
      .order("desc")
      .take(50);

    // Enrich with driver info
    const enriched = await Promise.all(
      requests.map(async (request) => {
        const driver = await ctx.db.get(request.driverId);
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;
        return {
          ...request,
          driverName: driverUser?.name,
          driverAvatar: driverUser?.avatarUrl,
          driverVehicle: driver?.vehicleInfo,
        };
      })
    );

    return enriched;
  },
});

/** Check calendar access permission */
export const checkCalendarAccess = query({
  args: {
    ownerId: v.id("users"),
    viewerId: v.id("users"),
  },
  handler: async (ctx, { ownerId, viewerId }) => {
    const access = await ctx.db
      .query("calendarAccess")
      .withIndex("by_owner_viewer", (q) => q.eq("ownerId", ownerId).eq("viewerId", viewerId))
      .first();

    if (!access || !access.isActive) {
      return { hasAccess: false, level: "none" };
    }

    // Check if expired
    if (access.expiresAt && access.expiresAt < Date.now()) {
      return { hasAccess: false, level: "none", expired: true };
    }

    return {
      hasAccess: true,
      level: access.accessLevel,
      grantedAt: access.grantedAt,
    };
  },
});

/** Get users who have access to my calendar */
export const getCalendarAccessList = query({
  args: {
    ownerId: v.id("users"),
  },
  handler: async (ctx, { ownerId }) => {
    const accesses = await ctx.db
      .query("calendarAccess")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Enrich with viewer info
    const enriched = await Promise.all(
      accesses.map(async (access) => {
        const viewer = await ctx.db.get(access.viewerId);
        return {
          ...access,
          viewerName: viewer?.name,
          viewerAvatar: viewer?.avatarUrl,
          viewerPosition: viewer?.position,
        };
      })
    );

    return enriched;
  },
});

/** Get driver's calendar for viewer (with permission check) */
export const getDriverCalendarForViewer = query({
  args: {
    driverUserId: v.id("users"),
    viewerId: v.id("users"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverUserId, viewerId, startTime, endTime }) => {
    // Check access permission
    const access = await ctx.db
      .query("calendarAccess")
      .withIndex("by_owner_viewer", (q) => q.eq("ownerId", driverUserId).eq("viewerId", viewerId))
      .first();

    if (!access || !access.isActive || access.accessLevel === "none") {
      throw new Error("No access to this calendar");
    }

    // Check if expired
    if (access.expiresAt && access.expiresAt < Date.now()) {
      throw new Error("Access expired");
    }

    // Get driver record
    const driver = await ctx.db
      .query("drivers")
      .withIndex("by_user", (q) => q.eq("userId", driverUserId))
      .first();

    if (!driver) {
      throw new Error("User is not a driver");
    }

    // Get schedule
    const schedules = await ctx.db
      .query("driverSchedules")
      .withIndex("by_driver_time", (q) => q.eq("driverId", driver._id))
      .filter((q) =>
        q.and(
          q.gte(q.field("startTime"), startTime),
          q.lte(q.field("startTime"), endTime)
        )
      )
      .collect();

    // Filter based on access level
    if (access.accessLevel === "busy_only") {
      return {
        busySlots: schedules.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type,
        })),
        accessLevel: "busy_only",
      };
    }

    // Full access - return all details
    return {
      busySlots: schedules,
      accessLevel: "full",
      driver,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Request a driver for a trip */
export const requestDriver = mutation({
  args: {
    organizationId: v.id("organizations"),
    requesterId: v.id("users"),
    driverId: v.id("drivers"),
    startTime: v.number(),
    endTime: v.number(),
    tripInfo: v.object({
      from: v.string(),
      to: v.string(),
      purpose: v.string(),
      passengerCount: v.number(),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Check if driver is available
    const availability = await ctx.db
      .query("driverSchedules")
      .withIndex("by_driver_time", (q) => q.eq("driverId", args.driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "scheduled"),
          q.or(
            q.and(
              q.lte(q.field("startTime"), args.startTime),
              q.gte(q.field("endTime"), args.startTime)
            ),
            q.and(
              q.lte(q.field("startTime"), args.endTime),
              q.gte(q.field("endTime"), args.endTime)
            )
          )
        )
      )
      .first();

    if (availability) {
      throw new Error("Driver is not available at this time");
    }

    // Create request
    const requestId = await ctx.db.insert("driverRequests", {
      organizationId: args.organizationId,
      requesterId: args.requesterId,
      driverId: args.driverId,
      startTime: args.startTime,
      endTime: args.endTime,
      tripInfo: args.tripInfo,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create notification for driver
    const driver = await ctx.db.get(args.driverId);
    if (driver) {
      await ctx.db.insert("notifications", {
        organizationId: args.organizationId,
        userId: driver.userId,
        type: "leave_request", // Reusing notification type
        title: "New Driver Request",
        message: `${args.tripInfo.purpose}: ${args.tripInfo.from} → ${args.tripInfo.to}`,
        isRead: false,
        relatedId: `driver_request:${requestId}`,
        createdAt: Date.now(),
      });
    }

    return requestId;
  },
});

/** Approve or decline driver request */
export const respondToDriverRequest = mutation({
  args: {
    requestId: v.id("driverRequests"),
    driverId: v.id("drivers"),
    userId: v.id("users"),
    approved: v.boolean(),
    declineReason: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, driverId, userId, approved, declineReason }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");

    // Verify this is the correct driver
    if (request.driverId !== driverId) {
      throw new Error("Unauthorized");
    }

    // Update request status
    await ctx.db.patch(requestId, {
      status: approved ? "approved" : "declined",
      declineReason: declineReason,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (approved) {
      // Create schedule entry
      await ctx.db.insert("driverSchedules", {
        organizationId: request.organizationId,
        driverId,
        userId: request.requesterId,
        startTime: request.startTime,
        endTime: request.endTime,
        type: "trip",
        status: "scheduled",
        tripInfo: request.tripInfo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Update driver's trip count
      const driver = await ctx.db.get(driverId);
      if (driver) {
        await ctx.db.patch(driverId, {
          currentTripsToday: driver.currentTripsToday + 1,
          updatedAt: Date.now(),
        });
      }
    }

    // Create notification for requester
    await ctx.db.insert("notifications", {
      organizationId: request.organizationId,
      userId: request.requesterId,
      type: approved ? "leave_approved" : "leave_rejected",
      title: approved ? "Driver Request Approved" : "Driver Request Declined",
      message: approved
        ? `Your trip to ${request.tripInfo.to} has been confirmed`
        : `Decline reason: ${declineReason || "Not specified"}`,
      isRead: false,
      relatedId: `driver_request:${requestId}`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/** Grant calendar access to another user */
export const grantCalendarAccess = mutation({
  args: {
    organizationId: v.id("organizations"),
    ownerId: v.id("users"),
    viewerId: v.id("users"),
    accessLevel: v.union(
      v.literal("full"),
      v.literal("busy_only")
    ),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { organizationId, ownerId, viewerId, accessLevel, expiresAt }) => {
    // Check if access already exists
    const existing = await ctx.db
      .query("calendarAccess")
      .withIndex("by_owner_viewer", (q) => q.eq("ownerId", ownerId).eq("viewerId", viewerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessLevel,
        expiresAt,
        isActive: true,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new access
    const accessId = await ctx.db.insert("calendarAccess", {
      organizationId,
      ownerId,
      viewerId,
      accessLevel,
      expiresAt,
      isActive: true,
      grantedAt: Date.now(),
    });

    // Create notification for viewer
    await ctx.db.insert("notifications", {
      organizationId,
      userId: viewerId,
      type: "status_change",
      title: "Calendar Access Granted",
      message: "You now have access to view my calendar",
      isRead: false,
      createdAt: Date.now(),
    });

    return accessId;
  },
});

/** Revoke calendar access */
export const revokeCalendarAccess = mutation({
  args: {
    accessId: v.id("calendarAccess"),
  },
  handler: async (ctx, { accessId }) => {
    await ctx.db.patch(accessId, {
      isActive: false,
    });
    return { success: true };
  },
});

/** Request calendar access from a driver */
export const requestCalendarAccess = mutation({
  args: {
    organizationId: v.id("organizations"),
    requesterId: v.id("users"),
    driverUserId: v.id("users"),
  },
  handler: async (ctx, { organizationId, requesterId, driverUserId }) => {
    // Create notification for driver
    await ctx.db.insert("notifications", {
      organizationId,
      userId: driverUserId,
      type: "status_change",
      title: "Calendar Access Request",
      message: "An employee wants to view your calendar availability",
      isRead: false,
      metadata: JSON.stringify({
        type: "calendar_access_request",
        requesterId,
      }),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/** Cancel a driver request */
export const cancelDriverRequest = mutation({
  args: {
    requestId: v.id("driverRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, { requestId, userId }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");
    if (request.requesterId !== userId) throw new Error("Unauthorized");

    await ctx.db.patch(requestId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Register as a driver */
export const registerAsDriver = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    vehicleInfo: v.object({
      model: v.string(),
      plateNumber: v.string(),
      capacity: v.number(),
      color: v.optional(v.string()),
      year: v.optional(v.number()),
    }),
    workingHours: v.object({
      startTime: v.string(),
      endTime: v.string(),
      workingDays: v.array(v.number()),
    }),
    maxTripsPerDay: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if user is already a driver
    const existing = await ctx.db
      .query("drivers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing driver info instead of throwing error
      await ctx.db.patch(existing._id, {
        vehicleInfo: args.vehicleInfo,
        workingHours: args.workingHours,
        maxTripsPerDay: args.maxTripsPerDay,
        isAvailable: true,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    const driverId = await ctx.db.insert("drivers", {
      organizationId: args.organizationId,
      userId: args.userId,
      vehicleInfo: args.vehicleInfo,
      isAvailable: true,
      workingHours: args.workingHours,
      maxTripsPerDay: args.maxTripsPerDay,
      currentTripsToday: 0,
      rating: 5.0,
      totalTrips: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return driverId;
  },
});

/** Update driver availability */
export const updateDriverAvailability = mutation({
  args: {
    driverId: v.id("drivers"),
    isAvailable: v.boolean(),
  },
  handler: async (ctx, { driverId, isAvailable }) => {
    await ctx.db.patch(driverId, {
      isAvailable,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** Block time slot (for driver) */
export const blockTimeSlot = mutation({
  args: {
    driverId: v.id("drivers"),
    organizationId: v.id("organizations"),
    startTime: v.number(),
    endTime: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { driverId, organizationId, startTime, endTime, reason }) => {
    await ctx.db.insert("driverSchedules", {
      organizationId,
      driverId,
      userId: (await ctx.db.get(driverId))!.userId,
      startTime,
      endTime,
      type: "blocked",
      status: "scheduled",
      reason,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
