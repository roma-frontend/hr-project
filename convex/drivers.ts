/**
 * Driver Management System
 *
 * Features:
 * - Driver registration and profile management
 * - Trip booking requests
 * - Availability checking
 * - Calendar access permissions
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

const SUPERADMIN_EMAIL = 'romangulanyan@gmail.com';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/** Get all available drivers in organization */
export const getAvailableDrivers = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, { organizationId }) => {
    const drivers = await ctx.db
      .query('drivers')
      .withIndex('by_org_available', (q) =>
        q.eq('organizationId', organizationId).eq('isAvailable', true),
      )
      .collect();

    // Enrich with user info and filter only users with role 'driver'
    const enriched = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        // Only show if user has role 'driver'
        if (!user || user.role !== 'driver') return null;

        return {
          ...driver,
          userName: user.name ?? 'Unknown',
          userAvatar: user?.avatarUrl,
          userPosition: user?.position,
        };
      }),
    );

    return enriched.filter(Boolean) as typeof enriched;
  },
});

/** Get driver by ID with full info */
export const getDriverById = query({
  args: {
    driverId: v.id('drivers'),
  },
  handler: async (ctx, { driverId }) => {
    const driver = await ctx.db.get(driverId);
    if (!driver) return null;

    const user = await ctx.db.get(driver.userId);
    return {
      ...driver,
      userName: user?.name ?? 'Unknown',
      userAvatar: user?.avatarUrl,
      userPosition: user?.position,
      userPhone: user?.phone,
    };
  },
});

/** Get driver's schedule for a date range */
export const getDriverSchedule = query({
  args: {
    driverId: v.id('drivers'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverId, startTime, endTime }) => {
    const schedules = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver_time', (q) => q.eq('driverId', driverId))
      .filter((q) =>
        q.and(q.gte(q.field('startTime'), startTime), q.lte(q.field('startTime'), endTime)),
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
      }),
    );

    return enriched;
  },
});

/** Check if driver is available for a time slot */
export const isDriverAvailable = query({
  args: {
    driverId: v.id('drivers'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverId, startTime, endTime }) => {
    // Check for overlapping schedules
    const overlapping = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver_time', (q) => q.eq('driverId', driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'scheduled'),
          q.or(
            q.and(q.lte(q.field('startTime'), startTime), q.gte(q.field('endTime'), startTime)),
            q.and(q.lte(q.field('startTime'), endTime), q.gte(q.field('endTime'), endTime)),
            q.and(q.gte(q.field('startTime'), startTime), q.lte(q.field('endTime'), endTime)),
          ),
        ),
      )
      .first();

    if (overlapping) {
      return {
        available: false,
        reason: 'already_booked',
        conflict: overlapping,
      };
    }

    // Check driver's working hours
    const driver = await ctx.db.get(driverId);
    if (!driver) {
      return { available: false, reason: 'driver_not_found' };
    }

    if (!driver.isAvailable) {
      return { available: false, reason: 'driver_unavailable' };
    }

    // Check if within working hours
    const startDate = new Date(startTime);
    const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    if (!driver.workingHours.workingDays.includes(dayOfWeek)) {
      return { available: false, reason: 'not_working_day' };
    }

    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();
    const timeInMinutes = startHour * 60 + startMinute;

    const [workStartHour, workStartMin] = driver.workingHours.startTime.split(':').map(Number);
    const [workEndHour, workEndMin] = driver.workingHours.endTime.split(':').map(Number);

    const workStartMinutes = (workStartHour ?? 0) * 60 + (workStartMin ?? 0);
    const workEndMinutes = (workEndHour ?? 0) * 60 + (workEndMin ?? 0);

    if (timeInMinutes < workStartMinutes || timeInMinutes > workEndMinutes) {
      return { available: false, reason: 'outside_working_hours' };
    }

    // Check max trips per day
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);

    const tripsToday = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver_time', (q) => q.eq('driverId', driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field('type'), 'trip'),
          q.gte(q.field('startTime'), startOfDay.getTime()),
          q.lte(q.field('startTime'), endOfDay.getTime()),
          q.neq(q.field('status'), 'cancelled'),
        ),
      )
      .collect();

    if (tripsToday.length >= driver.maxTripsPerDay) {
      return { available: false, reason: 'max_trips_reached' };
    }

    return { available: true };
  },
});

/** Get pending driver requests for a driver */
export const getDriverRequests = query({
  args: {
    driverId: v.id('drivers'),
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('approved'),
        v.literal('declined'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, { driverId, status }) => {
    let requests;

    if (status) {
      requests = await ctx.db
        .query('driverRequests')
        .withIndex('by_driver', (q) => q.eq('driverId', driverId))
        .filter((q) => q.eq(q.field('status'), status))
        .collect();
    } else {
      requests = await ctx.db
        .query('driverRequests')
        .withIndex('by_driver', (q) => q.eq('driverId', driverId))
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
          requesterPhone: requester?.phone,
        };
      }),
    );

    return enriched;
  },
});

/** Get my driver requests (for employees) */
export const getMyRequests = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const requests = await ctx.db
      .query('driverRequests')
      .withIndex('by_requester', (q) => q.eq('requesterId', userId))
      .order('desc')
      .take(50);

    // Enrich with driver info and schedule status
    const enriched = await Promise.all(
      requests.map(async (request) => {
        const driver = await ctx.db.get(request.driverId);
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;

        // Check if there's a completed schedule for this request
        const schedule = await ctx.db
          .query('driverSchedules')
          .withIndex('by_driver', (q) => q.eq('driverId', request.driverId))
          .filter((q) =>
            q.and(
              q.eq(q.field('userId'), request.requesterId),
              q.eq(q.field('startTime'), request.startTime),
            ),
          )
          .first();

        return {
          ...request,
          driverName: driverUser?.name,
          driverAvatar: driverUser?.avatarUrl,
          driverUserId: driver?.userId,
          driverPhone: driverUser?.phone,
          driverVehicle: driver?.vehicleInfo,
          scheduleStatus: schedule?.status, // Add schedule status
          scheduleId: schedule?._id,
        };
      }),
    );

    return enriched;
  },
});

/** Check calendar access permission */
export const checkCalendarAccess = query({
  args: {
    ownerId: v.id('users'),
    viewerId: v.id('users'),
  },
  handler: async (ctx, { ownerId, viewerId }) => {
    const access = await ctx.db
      .query('calendarAccess')
      .withIndex('by_owner_viewer', (q) => q.eq('ownerId', ownerId).eq('viewerId', viewerId))
      .first();

    if (!access || !access.isActive) {
      return { hasAccess: false, level: 'none' };
    }

    // Check if expired
    if (access.expiresAt && access.expiresAt < Date.now()) {
      return { hasAccess: false, level: 'none', expired: true };
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
    ownerId: v.id('users'),
  },
  handler: async (ctx, { ownerId }) => {
    const accesses = await ctx.db
      .query('calendarAccess')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .filter((q) => q.eq(q.field('isActive'), true))
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
      }),
    );

    return enriched;
  },
});

/** Get driver's calendar for viewer (with permission check) */
export const getDriverCalendarForViewer = query({
  args: {
    driverUserId: v.id('users'),
    viewerId: v.id('users'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverUserId, viewerId, startTime, endTime }) => {
    // Check access permission
    const access = await ctx.db
      .query('calendarAccess')
      .withIndex('by_owner_viewer', (q) => q.eq('ownerId', driverUserId).eq('viewerId', viewerId))
      .first();

    if (!access || !access.isActive || access.accessLevel === 'none') {
      throw new Error('No access to this calendar');
    }

    // Check if expired
    if (access.expiresAt && access.expiresAt < Date.now()) {
      throw new Error('Access expired');
    }

    // Get driver record
    const driver = await ctx.db
      .query('drivers')
      .withIndex('by_user', (q) => q.eq('userId', driverUserId))
      .first();

    if (!driver) {
      throw new Error('User is not a driver');
    }

    // Get schedule
    const schedules = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver_time', (q) => q.eq('driverId', driver._id))
      .filter((q) =>
        q.and(q.gte(q.field('startTime'), startTime), q.lte(q.field('startTime'), endTime)),
      )
      .collect();

    // Filter based on access level
    if (access.accessLevel === 'busy_only') {
      return {
        busySlots: schedules.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          type: s.type,
        })),
        accessLevel: 'busy_only',
      };
    }

    // Full access - return all details
    return {
      busySlots: schedules,
      accessLevel: 'full',
      driver,
    };
  },
});

/** Get all driver schedules for an organization (for general calendar) */
export const getOrgDriverSchedules = query({
  args: {
    organizationId: v.id('organizations'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { organizationId, startTime, endTime }) => {
    const schedules = await ctx.db
      .query('driverSchedules')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .filter((q) =>
        q.and(
          q.neq(q.field('status'), 'cancelled'),
          q.gte(q.field('startTime'), startTime),
          q.lte(q.field('startTime'), endTime),
        ),
      )
      .collect();

    const enriched = await Promise.all(
      schedules.map(async (schedule) => {
        const driver = await ctx.db.get(schedule.driverId);
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;
        const bookedByUser = schedule.userId ? await ctx.db.get(schedule.userId) : null;
        return {
          ...schedule,
          driverName: driverUser?.name ?? 'Unknown',
          driverVehicle: driver?.vehicleInfo,
          bookedByName: bookedByUser?.name,
        };
      }),
    );

    return enriched;
  },
});

/** Get driver record by userId */
export const getDriverByUserId = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const driver = await ctx.db
      .query('drivers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    if (!driver) return null;

    const user = await ctx.db.get(driver.userId);
    return {
      ...driver,
      userName: user?.name ?? 'Unknown',
      userAvatar: user?.avatarUrl,
      userPosition: user?.position,
      userPhone: user?.phone,
    };
  },
});

/** Check if driver is on leave for a given date range */
export const isDriverOnLeave = query({
  args: {
    driverId: v.id('drivers'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, { driverId, startTime, endTime }) => {
    // Get the driver's userId
    const driver = await ctx.db.get(driverId);
    if (!driver) {
      return { onLeave: false, leave: null };
    }

    // Convert startTime to date string for comparison (YYYY-MM-DD)
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const startDateStr = startDate.toISOString().split('T')[0] || '';
    const endDateStr = endDate.toISOString().split('T')[0] || '';

    // Get all approved leaves for this user
    const allLeaves = await ctx.db
      .query('leaveRequests')
      .withIndex('by_user', (q) => q.eq('userId', driver.userId))
      .filter((q) => q.eq(q.field('status'), 'approved'))
      .collect();

    // Check for overlap in JavaScript
    for (const leave of allLeaves) {
      const leaveStart = leave.startDate;
      const leaveEnd = leave.endDate;

      // Check if ranges overlap: leaveStart <= endDateStr AND leaveEnd >= startDateStr
      if (leaveStart <= endDateStr && leaveEnd >= startDateStr) {
        return {
          onLeave: true,
          leave: {
            _id: leave._id,
            type: leave.type,
            startDate: leave.startDate,
            endDate: leave.endDate,
            reason: leave.reason,
          },
        };
      }
    }

    return { onLeave: false, leave: null };
  },
});

/** Get alternative available drivers for a time slot (excluding drivers on leave) */
export const getAlternativeDrivers = query({
  args: {
    organizationId: v.id('organizations'),
    startTime: v.number(),
    endTime: v.number(),
    excludeDriverId: v.optional(v.id('drivers')),
  },
  handler: async (ctx, { organizationId, startTime, endTime, excludeDriverId }) => {
    // Get all available drivers
    const allDrivers = await ctx.db
      .query('drivers')
      .withIndex('by_org_available', (q) =>
        q.eq('organizationId', organizationId).eq('isAvailable', true),
      )
      .collect();

    // Filter out excluded driver
    const drivers = excludeDriverId
      ? allDrivers.filter((d) => d._id !== excludeDriverId)
      : allDrivers;

    // Convert startTime to date string for leave comparison
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const startDateStr = startDate.toISOString().split('T')[0] || '';
    const endDateStr = endDate.toISOString().split('T')[0] || '';

    // Enrich with user info and filter
    const enriched = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        // Only show if user has role 'driver'
        if (!user || user.role !== 'driver') return null;

        // Check if driver is on leave
        const leaveRequests = await ctx.db
          .query('leaveRequests')
          .withIndex('by_user', (q) => q.eq('userId', driver.userId))
          .filter((q) =>
            q.and(
              q.eq(q.field('status'), 'approved'),
              q.lte(q.field('startDate'), endDateStr),
              q.gte(q.field('endDate'), startDateStr),
            ),
          )
          .collect();

        if (leaveRequests.length > 0) {
          return null; // Skip drivers on leave
        }

        // Check if driver is already booked for this time
        const overlapping = await ctx.db
          .query('driverSchedules')
          .withIndex('by_driver_time', (q) => q.eq('driverId', driver._id))
          .filter((q) =>
            q.and(
              q.eq(q.field('status'), 'scheduled'),
              q.or(
                q.and(q.lte(q.field('startTime'), startTime), q.gte(q.field('endTime'), startTime)),
                q.and(q.lte(q.field('startTime'), endTime), q.gte(q.field('endTime'), endTime)),
                q.and(q.gte(q.field('startTime'), startTime), q.lte(q.field('endTime'), endTime)),
              ),
            ),
          )
          .first();

        if (overlapping) {
          return null; // Skip already booked drivers
        }

        return {
          ...driver,
          userName: user.name ?? 'Unknown',
          userAvatar: user?.avatarUrl,
          userPosition: user?.position,
          userPhone: user?.phone,
        };
      }),
    );

    return enriched.filter(Boolean) as typeof enriched;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Request a driver for a trip */
export const requestDriver = mutation({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    driverId: v.id('drivers'),
    startTime: v.number(),
    endTime: v.number(),
    tripInfo: v.object({
      from: v.string(),
      to: v.string(),
      purpose: v.string(),
      passengerCount: v.number(),
      notes: v.optional(v.string()),
      pickupCoords: v.optional(
        v.object({
          lat: v.number(),
          lng: v.number(),
        }),
      ),
      dropoffCoords: v.optional(
        v.object({
          lat: v.number(),
          lng: v.number(),
        }),
      ),
    }),
    // Corporate features (all optional for backward compatibility)
    priority: v.optional(
      v.union(v.literal('P0'), v.literal('P1'), v.literal('P2'), v.literal('P3')),
    ),
    tripCategory: v.optional(
      v.union(
        v.literal('client_meeting'),
        v.literal('airport'),
        v.literal('office_transfer'),
        v.literal('emergency'),
        v.literal('team_event'),
        v.literal('personal'),
      ),
    ),
    costCenter: v.optional(v.string()),
    businessJustification: v.optional(v.string()),
    requiresApproval: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate startTime < endTime
    if (args.startTime >= args.endTime) {
      throw new Error('Start time must be before end time');
    }

    // Check if driver is on leave
    const startDate = new Date(args.startTime);
    const endDate = new Date(args.endTime);
    const startDateStr = startDate.toISOString().split('T')[0] || '';
    const endDateStr = endDate.toISOString().split('T')[0] || '';

    const driver = await ctx.db.get(args.driverId);
    let leaveError = null;

    if (driver) {
      const leaveRequests = await ctx.db
        .query('leaveRequests')
        .withIndex('by_user', (q) => q.eq('userId', driver.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field('status'), 'approved'),
            q.lte(q.field('startDate'), endDateStr),
            q.gte(q.field('endDate'), startDateStr),
          ),
        )
        .collect();

      if (leaveRequests.length > 0) {
        const leave = leaveRequests[0]!;
        leaveError = {
          code: 'DRIVER_ON_LEAVE',
          message: `Водитель находится в отпуске с ${leave.startDate} по ${leave.endDate}. Запросить другого водителя.`,
          leaveType: leave.type,
          startDate: leave.startDate,
          endDate: leave.endDate,
        };
      }
    }

    // Check if driver is available
    const availability = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver_time', (q) => q.eq('driverId', args.driverId))
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'scheduled'),
          q.or(
            q.and(
              q.lte(q.field('startTime'), args.startTime),
              q.gte(q.field('endTime'), args.startTime),
            ),
            q.and(
              q.lte(q.field('startTime'), args.endTime),
              q.gte(q.field('endTime'), args.endTime),
            ),
            q.and(
              q.gte(q.field('startTime'), args.startTime),
              q.lte(q.field('endTime'), args.endTime),
            ),
          ),
        ),
      )
      .first();

    if (availability) {
      throw new Error('Driver is not available at this time');
    }

    // If driver is on leave, return error instead of throwing
    if (leaveError) {
      return {
        requestId: null,
        leaveWarning: null,
        error: leaveError,
      };
    }

    // Create request with corporate fields
    const requestId = await ctx.db.insert('driverRequests', {
      organizationId: args.organizationId,
      requesterId: args.requesterId,
      driverId: args.driverId,
      startTime: args.startTime,
      endTime: args.endTime,
      tripInfo: args.tripInfo,
      status: args.requiresApproval ? 'pending' : 'pending', // Will be approved by manager or driver
      priority: args.priority || 'P2',
      tripCategory: args.tripCategory || 'office_transfer',
      costCenter: args.costCenter,
      businessJustification: args.businessJustification || args.tripInfo.purpose,
      requiresApproval: args.requiresApproval || false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create notification for driver
    const driverRecord = await ctx.db.get(args.driverId);
    const priority = args.priority || 'P2';
    if (driverRecord) {
      await ctx.db.insert('notifications', {
        organizationId: args.organizationId,
        userId: driverRecord.userId,
        type: 'driver_request',
        title: `🚗 ${priority} Trip Request`,
        message: `${args.tripInfo.purpose}: ${args.tripInfo.from} → ${args.tripInfo.to}`,
        isRead: false,
        relatedId: `driver_request:${requestId}`,
        createdAt: Date.now(),
      });
    }

    // If requires approval, notify managers
    if (args.requiresApproval) {
      const admins = await ctx.db
        .query('users')
        .withIndex('by_org_role', (q) =>
          q.eq('organizationId', args.organizationId).eq('role', 'admin'),
        )
        .collect();

      for (const admin of admins) {
        await ctx.db.insert('notifications', {
          organizationId: args.organizationId,
          userId: admin._id,
          type: 'system',
          title: `📋 ${priority} Trip Requires Approval`,
          message: `${args.businessJustification || args.tripInfo.purpose}`,
          isRead: false,
          relatedId: `driver_request:${requestId}`,
          createdAt: Date.now(),
        });
      }
    }

    return { requestId, leaveWarning: null, error: null };
  },
});

/** Approve or decline driver request */
export const respondToDriverRequest = mutation({
  args: {
    requestId: v.id('driverRequests'),
    driverId: v.id('drivers'),
    userId: v.id('users'),
    approved: v.boolean(),
    declineReason: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, driverId, userId, approved, declineReason }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error('Request not found');

    // Verify this is the correct driver
    if (request.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    // Update request status
    await ctx.db.patch(requestId, {
      status: approved ? 'approved' : 'declined',
      declineReason: declineReason,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (approved) {
      // Create schedule entry
      await ctx.db.insert('driverSchedules', {
        organizationId: request.organizationId,
        driverId,
        userId: request.requesterId,
        startTime: request.startTime,
        endTime: request.endTime,
        type: 'trip',
        status: 'scheduled',
        tripInfo: request.tripInfo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Update total trips count
      const driver = await ctx.db.get(driverId);
      if (driver) {
        await ctx.db.patch(driverId, {
          totalTrips: (driver.totalTrips || 0) + 1,
          updatedAt: Date.now(),
        });
      }
    }

    // Create notification for requester
    await ctx.db.insert('notifications', {
      organizationId: request.organizationId,
      userId: request.requesterId,
      type: approved ? 'driver_request_approved' : 'driver_request_rejected',
      title: approved ? 'Driver Request Approved' : 'Driver Request Declined',
      message: approved
        ? `Your trip to ${request.tripInfo.to} has been confirmed`
        : `Decline reason: ${declineReason || 'Not specified'}`,
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
    organizationId: v.id('organizations'),
    ownerId: v.id('users'),
    viewerId: v.id('users'),
    accessLevel: v.union(v.literal('full'), v.literal('busy_only')),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { organizationId, ownerId, viewerId, accessLevel, expiresAt }) => {
    // Check if access already exists
    const existing = await ctx.db
      .query('calendarAccess')
      .withIndex('by_owner_viewer', (q) => q.eq('ownerId', ownerId).eq('viewerId', viewerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessLevel,
        expiresAt,
        isActive: true,
      });
      return existing._id;
    }

    // Create new access
    const accessId = await ctx.db.insert('calendarAccess', {
      organizationId,
      ownerId,
      viewerId,
      accessLevel,
      expiresAt,
      isActive: true,
      grantedAt: Date.now(),
    });

    // Create notification for viewer
    await ctx.db.insert('notifications', {
      organizationId,
      userId: viewerId,
      type: 'status_change',
      title: 'Calendar Access Granted',
      message: 'You now have access to view my calendar',
      isRead: false,
      createdAt: Date.now(),
    });

    return accessId;
  },
});

/** Revoke calendar access */
export const revokeCalendarAccess = mutation({
  args: {
    accessId: v.id('calendarAccess'),
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
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    driverUserId: v.id('users'),
  },
  handler: async (ctx, { organizationId, requesterId, driverUserId }) => {
    // Create notification for driver
    await ctx.db.insert('notifications', {
      organizationId,
      userId: driverUserId,
      type: 'status_change',
      title: 'Calendar Access Request',
      message: 'An employee wants to view your calendar availability',
      isRead: false,
      metadata: JSON.stringify({
        type: 'calendar_access_request',
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
    requestId: v.id('driverRequests'),
    userId: v.id('users'),
  },
  handler: async (ctx, { requestId, userId }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error('Request not found');
    if (request.requesterId !== userId) throw new Error('Unauthorized');

    await ctx.db.patch(requestId, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Register as a driver - only organization admins can register drivers */
export const registerAsDriver = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
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
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get the user making the request
    const requester = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
      .first();

    if (!requester) {
      throw new Error('User not found');
    }

    // Only organization admins can register drivers
    if (requester.role !== 'admin') {
      throw new Error('Only organization admins can register drivers');
    }

    // Verify the user being registered belongs to the same organization
    const userToRegister = await ctx.db.get(args.userId);
    if (!userToRegister || userToRegister.organizationId !== args.organizationId) {
      throw new Error('User does not belong to this organization');
    }

    // Check if user is already a driver
    const existing = await ctx.db
      .query('drivers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
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

    const driverId = await ctx.db.insert('drivers', {
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
    driverId: v.id('drivers'),
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

/** Update a driver request (requester/admin can edit pending or approved requests) */
export const updateDriverRequest = mutation({
  args: {
    requestId: v.id('driverRequests'),
    userId: v.id('users'),
    driverId: v.optional(v.id('drivers')),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    tripInfo: v.optional(
      v.object({
        from: v.string(),
        to: v.string(),
        purpose: v.string(),
        passengerCount: v.number(),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error('Request not found');

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');
    const isSuperadmin = user.email?.toLowerCase() === SUPERADMIN_EMAIL;
    const isAdmin = user.role === 'admin';

    if (request.requesterId !== args.userId && !isSuperadmin && !isAdmin) {
      throw new Error('Only the requester can edit this booking');
    }

    if (request.status === 'cancelled') {
      throw new Error('Cannot edit a cancelled request');
    }

    const wasApproved = request.status === 'approved';

    // If the request was approved, remove the schedule entry
    if (wasApproved) {
      const schedule = await ctx.db
        .query('driverSchedules')
        .withIndex('by_driver', (q) => q.eq('driverId', request.driverId))
        .filter((q) =>
          q.and(
            q.eq(q.field('userId'), request.requesterId),
            q.eq(q.field('startTime'), request.startTime),
            q.eq(q.field('endTime'), request.endTime),
          ),
        )
        .first();
      if (schedule) {
        await ctx.db.delete(schedule._id);
      }

      // Decrement total trips
      const driver = await ctx.db.get(request.driverId);
      if (driver && driver.totalTrips > 0) {
        await ctx.db.patch(request.driverId, {
          totalTrips: driver.totalTrips - 1,
          updatedAt: Date.now(),
        });
      }
    }

    // Update the request fields
    const patch: Record<string, any> = {
      updatedAt: Date.now(),
      status: 'pending' as const, // Reset to pending so driver re-approves
      reviewedAt: undefined,
      declineReason: undefined,
    };
    if (args.driverId) patch.driverId = args.driverId;
    if (args.startTime) patch.startTime = args.startTime;
    if (args.endTime) patch.endTime = args.endTime;
    if (args.tripInfo) patch.tripInfo = args.tripInfo;

    await ctx.db.patch(args.requestId, patch);

    // Notify the driver about the updated request
    const driverId = args.driverId || request.driverId;
    const driverRecord = driverId ? await ctx.db.get(driverId) : null;
    if (driverRecord) {
      const tripInfo = args.tripInfo || request.tripInfo;
      await ctx.db.insert('notifications', {
        organizationId: request.organizationId,
        userId: driverRecord.userId,
        type: 'driver_request',
        title: wasApproved
          ? 'Driver Request Updated (Re-approval needed)'
          : 'Driver Request Updated',
        message: `${tripInfo.purpose}: ${tripInfo.from} → ${tripInfo.to}`,
        isRead: false,
        relatedId: `driver_request:${args.requestId}`,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/** Delete a driver request (only requester can delete, only pending/declined) */
export const deleteDriverRequest = mutation({
  args: {
    requestId: v.id('driverRequests'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error('Request not found');

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');
    const isSuperadmin = user.email?.toLowerCase() === SUPERADMIN_EMAIL;
    const isAdmin = user.role === 'admin';

    if (request.requesterId !== args.userId && !isSuperadmin && !isAdmin) {
      throw new Error('Only the requester can delete this booking');
    }

    if (request.status === 'approved') {
      // Also delete the associated schedule entry
      const schedule = await ctx.db
        .query('driverSchedules')
        .withIndex('by_driver', (q) => q.eq('driverId', request.driverId))
        .filter((q) =>
          q.and(
            q.eq(q.field('userId'), request.requesterId),
            q.eq(q.field('startTime'), request.startTime),
            q.eq(q.field('endTime'), request.endTime),
          ),
        )
        .first();
      if (schedule) {
        await ctx.db.delete(schedule._id);
      }
    }

    // Instead of deleting the request, mark it as cancelled to preserve history
    // This ensures the driver still has a record of the trip in their logs
    await ctx.db.patch(args.requestId, {
      status: 'cancelled',
      cancelledAt: Date.now(),
      cancelledBy: args.userId,
      cancellationReason: 'Cancelled by requester',
    });

    return { success: true };
  },
});

/** Block time slot (for driver) */
export const blockTimeSlot = mutation({
  args: {
    driverId: v.id('drivers'),
    organizationId: v.id('organizations'),
    startTime: v.number(),
    endTime: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { driverId, organizationId, startTime, endTime, reason }) => {
    await ctx.db.insert('driverSchedules', {
      organizationId,
      driverId,
      userId: (await ctx.db.get(driverId))!.userId,
      startTime,
      endTime,
      type: 'blocked',
      status: 'scheduled',
      reason,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Update trip status (in_progress, completed, etc.) */
export const updateTripStatus = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    userId: v.id('users'),
    status: v.union(v.literal('in_progress'), v.literal('completed'), v.literal('cancelled')),
  },
  handler: async (ctx, { scheduleId, userId, status }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Verify user is the driver
    if (schedule.driverId) {
      const driver = await ctx.db.get(schedule.driverId);
      if (!driver || driver.userId !== userId) {
        throw new Error('Only the driver can update trip status');
      }
    }

    await ctx.db.patch(scheduleId, {
      status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Submit driver feedback after trip completion */
export const submitDriverFeedback = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    userId: v.id('users'),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { scheduleId, userId, rating, comment }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Verify user is the driver
    if (schedule.driverId) {
      const driver = await ctx.db.get(schedule.driverId);
      if (!driver || driver.userId !== userId) {
        throw new Error('Only the driver can submit feedback');
      }
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    await ctx.db.patch(scheduleId, {
      driverFeedback: {
        rating,
        comment,
        completedAt: Date.now(),
      },
      status: 'completed',
      updatedAt: Date.now(),
    });

    // Update driver's total rating
    if (schedule.driverId) {
      const driver = await ctx.db.get(schedule.driverId);
      if (driver) {
        const currentRating = driver.rating || 5.0;
        const totalTrips = driver.totalTrips || 0;
        const newRating = (currentRating * totalTrips + rating) / (totalTrips + 1);
        await ctx.db.patch(schedule.driverId, {
          rating: newRating,
          totalTrips: totalTrips + 1,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

/** Block time for vacation/sick leave */
export const blockTimeOff = mutation({
  args: {
    driverId: v.id('drivers'),
    organizationId: v.id('organizations'),
    startTime: v.number(),
    endTime: v.number(),
    reason: v.string(),
    type: v.union(v.literal('vacation'), v.literal('sick_leave'), v.literal('personal')),
  },
  handler: async (ctx, { driverId, organizationId, startTime, endTime, reason, type }) => {
    const driver = await ctx.db.get(driverId);
    if (!driver) throw new Error('Driver not found');

    await ctx.db.insert('driverSchedules', {
      organizationId,
      driverId,
      userId: driver.userId,
      startTime,
      endTime,
      type: 'time_off',
      status: 'scheduled',
      reason: `${type}: ${reason}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Calculate route distance and duration using Google Maps API */
export const calculateRoute = mutation({
  args: {
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, { from, to }) => {
    // Note: This requires Google Maps API key to be set in environment variables
    // For now, return mock data - in production, you would call Google Maps API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key
      return {
        distanceMeters: 15000, // 15 km mock
        durationSeconds: 1800, // 30 min mock
        distanceKm: 15,
        durationMinutes: 30,
      };
    }

    // In production, call Google Maps Distance Matrix API:
    // const response = await fetch(
    //   `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&key=${apiKey}`
    // );
    // const data = await response.json();
    // return {
    //   distanceMeters: data.rows[0].elements[0].distance.value,
    //   durationSeconds: data.rows[0].elements[0].duration.value,
    //   distanceKm: data.rows[0].elements[0].distance.value / 1000,
    //   durationMinutes: data.rows[0].elements[0].duration.value / 60,
    // };

    return {
      distanceMeters: 15000,
      durationSeconds: 1800,
      distanceKm: 15,
      durationMinutes: 30,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #1: Passenger Rating (after trip completion)
// ─────────────────────────────────────────────────────────────────────────────

/** Submit passenger rating for driver after completed trip */
export const submitPassengerRating = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    requestId: v.optional(v.id('driverRequests')),
    passengerId: v.id('users'),
    driverId: v.id('drivers'),
    organizationId: v.id('organizations'),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if already rated
    const existing = await ctx.db
      .query('passengerRatings')
      .withIndex('by_schedule', (q) => q.eq('scheduleId', args.scheduleId))
      .filter((q) => q.eq(q.field('passengerId'), args.passengerId))
      .first();

    if (existing) {
      throw new Error('You have already rated this trip');
    }

    // Insert rating
    await ctx.db.insert('passengerRatings', {
      organizationId: args.organizationId,
      scheduleId: args.scheduleId,
      requestId: args.requestId,
      passengerId: args.passengerId,
      driverId: args.driverId,
      rating: args.rating,
      comment: args.comment,
      createdAt: Date.now(),
    });

    // Update driver average rating
    const driver = await ctx.db.get(args.driverId);
    if (driver) {
      const allRatings = await ctx.db
        .query('passengerRatings')
        .withIndex('by_driver', (q) => q.eq('driverId', args.driverId))
        .collect();
      const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0) + args.rating;
      const count = allRatings.length + 1;
      await ctx.db.patch(args.driverId, {
        rating: totalRating / count,
        updatedAt: Date.now(),
      });
    }

    // Mark request as rated
    if (args.requestId) {
      await ctx.db.patch(args.requestId, {
        passengerRated: true,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/** Check if passenger has rated a trip */
export const hasPassengerRated = query({
  args: {
    scheduleId: v.id('driverSchedules'),
    passengerId: v.id('users'),
  },
  handler: async (ctx, { scheduleId, passengerId }) => {
    const existing = await ctx.db
      .query('passengerRatings')
      .withIndex('by_schedule', (q) => q.eq('scheduleId', scheduleId))
      .filter((q) => q.eq(q.field('passengerId'), passengerId))
      .first();
    return !!existing;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #2: Trip History (completed trips)
// ─────────────────────────────────────────────────────────────────────────────

/** Get completed trip history for a user */
export const getCompletedTrips = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit: take }) => {
    const requests = await ctx.db
      .query('driverRequests')
      .withIndex('by_requester', (q) => q.eq('requesterId', userId))
      .order('desc')
      .collect();

    // Filter to approved requests where trip is completed
    const completedRequests = [];
    for (const request of requests) {
      if (request.status !== 'approved') continue;

      // Find associated schedule
      const schedule = await ctx.db
        .query('driverSchedules')
        .withIndex('by_driver', (q) => q.eq('driverId', request.driverId))
        .filter((q) =>
          q.and(
            q.eq(q.field('userId'), request.requesterId),
            q.eq(q.field('startTime'), request.startTime),
            q.eq(q.field('status'), 'completed'),
          ),
        )
        .first();

      if (schedule) {
        const driver = await ctx.db.get(request.driverId);
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;

        // Check if rated
        const rating = await ctx.db
          .query('passengerRatings')
          .withIndex('by_schedule', (q) => q.eq('scheduleId', schedule._id))
          .filter((q) => q.eq(q.field('passengerId'), userId))
          .first();

        completedRequests.push({
          ...request,
          scheduleId: schedule._id,
          completedAt: schedule.updatedAt,
          driverName: driverUser?.name,
          driverAvatar: driverUser?.avatarUrl,
          driverVehicle: driver?.vehicleInfo,
          driverNotes: schedule.driverNotes,
          waitTimeMinutes: schedule.waitTimeMinutes,
          hasRated: !!rating,
          passengerRating: rating?.rating,
        });
      }

      if (take && completedRequests.length >= take) break;
    }

    return completedRequests;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #3: Trip Reassignment (request another driver on decline)
// ─────────────────────────────────────────────────────────────────────────────

/** Reassign a declined request to a new driver */
export const reassignDriverRequest = mutation({
  args: {
    requestId: v.id('driverRequests'),
    userId: v.id('users'),
    newDriverId: v.id('drivers'),
  },
  handler: async (ctx, { requestId, userId, newDriverId }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error('Request not found');
    if (request.requesterId !== userId) throw new Error('Unauthorized');
    if (request.status !== 'declined') throw new Error('Only declined requests can be reassigned');

    // Check new driver availability
    const overlap = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver_time', (q) => q.eq('driverId', newDriverId))
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'scheduled'),
          q.or(
            q.and(
              q.lte(q.field('startTime'), request.startTime),
              q.gte(q.field('endTime'), request.startTime),
            ),
            q.and(
              q.lte(q.field('startTime'), request.endTime),
              q.gte(q.field('endTime'), request.endTime),
            ),
            q.and(
              q.gte(q.field('startTime'), request.startTime),
              q.lte(q.field('endTime'), request.endTime),
            ),
          ),
        ),
      )
      .first();

    if (overlap) throw new Error('New driver is not available at this time');

    // Update request
    await ctx.db.patch(requestId, {
      driverId: newDriverId,
      status: 'pending',
      declineReason: undefined,
      reviewedAt: undefined,
      updatedAt: Date.now(),
    });

    // Notify new driver
    const driver = await ctx.db.get(newDriverId);
    if (driver) {
      await ctx.db.insert('notifications', {
        organizationId: request.organizationId,
        userId: driver.userId,
        type: 'driver_request',
        title: 'New Driver Request (Reassigned)',
        message: `${request.tripInfo.purpose}: ${request.tripInfo.from} → ${request.tripInfo.to}`,
        isRead: false,
        relatedId: `driver_request:${requestId}`,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #4: Driver Filters (capacity, working hours, rating sort)
// ─────────────────────────────────────────────────────────────────────────────

/** Get available drivers with filters */
export const getFilteredDrivers = query({
  args: {
    organizationId: v.id('organizations'),
    minCapacity: v.optional(v.number()),
    tripStartTime: v.optional(v.number()),
    tripEndTime: v.optional(v.number()),
    sortBy: v.optional(v.union(v.literal('rating'), v.literal('trips'), v.literal('name'))),
  },
  handler: async (ctx, { organizationId, minCapacity, tripStartTime, tripEndTime, sortBy }) => {
    const drivers = await ctx.db
      .query('drivers')
      .withIndex('by_org_available', (q) =>
        q.eq('organizationId', organizationId).eq('isAvailable', true),
      )
      .collect();

    const enriched = await Promise.all(
      drivers.map(async (driver) => {
        const user = await ctx.db.get(driver.userId);
        if (!user || user.role !== 'driver') return null;

        // Filter by capacity
        if (minCapacity && driver.vehicleInfo.capacity < minCapacity) return null;

        // Filter by working hours match
        let withinWorkingHours = true;
        if (tripStartTime) {
          const startDate = new Date(tripStartTime);
          const dayOfWeek = startDate.getDay();
          if (!driver.workingHours.workingDays.includes(dayOfWeek)) {
            withinWorkingHours = false;
          } else {
            const timeInMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const [wsh, wsm] = driver.workingHours.startTime.split(':').map(Number);
            const [weh, wem] = driver.workingHours.endTime.split(':').map(Number);
            if (
              timeInMinutes < (wsh ?? 0) * 60 + (wsm ?? 0) ||
              timeInMinutes > (weh ?? 0) * 60 + (wem ?? 0)
            ) {
              withinWorkingHours = false;
            }
          }
        }

        // Check time slot availability
        let isTimeSlotFree = true;
        if (tripStartTime && tripEndTime) {
          const overlap = await ctx.db
            .query('driverSchedules')
            .withIndex('by_driver_time', (q) => q.eq('driverId', driver._id))
            .filter((q) =>
              q.and(
                q.eq(q.field('status'), 'scheduled'),
                q.or(
                  q.and(
                    q.lte(q.field('startTime'), tripStartTime),
                    q.gte(q.field('endTime'), tripStartTime),
                  ),
                  q.and(
                    q.lte(q.field('startTime'), tripEndTime),
                    q.gte(q.field('endTime'), tripEndTime),
                  ),
                  q.and(
                    q.gte(q.field('startTime'), tripStartTime),
                    q.lte(q.field('endTime'), tripEndTime),
                  ),
                ),
              ),
            )
            .first();
          if (overlap) isTimeSlotFree = false;
        }

        return {
          ...driver,
          userName: user.name ?? 'Unknown',
          userAvatar: user?.avatarUrl,
          userPosition: user?.position,
          withinWorkingHours,
          isTimeSlotFree,
        };
      }),
    );

    const result = enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[];

    // Sort
    if (sortBy === 'rating') {
      result.sort((a, b) => (b!.rating ?? 0) - (a!.rating ?? 0));
    } else if (sortBy === 'trips') {
      result.sort((a, b) => (b!.totalTrips ?? 0) - (a!.totalTrips ?? 0));
    } else if (sortBy === 'name') {
      result.sort((a, b) => (a!.userName ?? '').localeCompare(b!.userName ?? ''));
    } else {
      // Default: sort by rating
      result.sort((a, b) => (b!.rating ?? 0) - (a!.rating ?? 0));
    }

    return result;
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #5: Recurring Trips
// ─────────────────────────────────────────────────────────────────────────────

/** Create a recurring trip template */
export const createRecurringTrip = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    driverId: v.id('drivers'),
    tripInfo: v.object({
      from: v.string(),
      to: v.string(),
      purpose: v.string(),
      passengerCount: v.number(),
      notes: v.optional(v.string()),
      pickupCoords: v.optional(v.object({ lat: v.number(), lng: v.number() })),
      dropoffCoords: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    }),
    schedule: v.object({
      daysOfWeek: v.array(v.number()),
      startTime: v.string(),
      endTime: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('recurringTrips', {
      organizationId: args.organizationId,
      userId: args.userId,
      driverId: args.driverId,
      tripInfo: args.tripInfo,
      schedule: args.schedule,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});

/** Get recurring trips for a user */
export const getRecurringTrips = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const trips = await ctx.db
      .query('recurringTrips')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const enriched = await Promise.all(
      trips.map(async (trip) => {
        const driver = await ctx.db.get(trip.driverId);
        const driverUser = driver ? await ctx.db.get(driver.userId) : null;
        return {
          ...trip,
          driverName: driverUser?.name,
          driverVehicle: driver?.vehicleInfo,
        };
      }),
    );
    return enriched;
  },
});

/** Toggle recurring trip active/inactive */
export const toggleRecurringTrip = mutation({
  args: {
    recurringTripId: v.id('recurringTrips'),
    userId: v.id('users'),
    isActive: v.boolean(),
  },
  handler: async (ctx, { recurringTripId, userId, isActive }) => {
    const trip = await ctx.db.get(recurringTripId);
    if (!trip) throw new Error('Recurring trip not found');
    if (trip.userId !== userId) throw new Error('Unauthorized');
    await ctx.db.patch(recurringTripId, { isActive, updatedAt: Date.now() });
    return { success: true };
  },
});

/** Delete recurring trip */
export const deleteRecurringTrip = mutation({
  args: {
    recurringTripId: v.id('recurringTrips'),
    userId: v.id('users'),
  },
  handler: async (ctx, { recurringTripId, userId }) => {
    const trip = await ctx.db.get(recurringTripId);
    if (!trip) throw new Error('Recurring trip not found');
    if (trip.userId !== userId) throw new Error('Unauthorized');
    await ctx.db.delete(recurringTripId);
    return { success: true };
  },
});

/** Generate today's requests from active recurring trips (called by cron or manually) */
export const generateRecurringRequests = mutation({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayStr = today.toISOString().slice(0, 10);

    const recurringTrips = await ctx.db
      .query('recurringTrips')
      .withIndex('by_org_active', (q) =>
        q.eq('organizationId', organizationId).eq('isActive', true),
      )
      .collect();

    let generated = 0;
    for (const trip of recurringTrips) {
      if (!trip.schedule.daysOfWeek.includes(dayOfWeek)) continue;

      // Check if already generated today
      if (trip.lastGeneratedAt) {
        const lastDate = new Date(trip.lastGeneratedAt).toISOString().slice(0, 10);
        if (lastDate === todayStr) continue;
      }

      // Calculate times
      const [sh, sm] = trip.schedule.startTime.split(':').map(Number);
      const [eh, em] = trip.schedule.endTime.split(':').map(Number);
      const startTime = new Date(today);
      startTime.setHours(sh ?? 0, sm ?? 0, 0, 0);
      const endTime = new Date(today);
      endTime.setHours(eh ?? 0, em ?? 0, 0, 0);

      // Create request
      await ctx.db.insert('driverRequests', {
        organizationId,
        requesterId: trip.userId,
        driverId: trip.driverId,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        tripInfo: trip.tripInfo,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Notify driver
      const driver = await ctx.db.get(trip.driverId);
      if (driver) {
        await ctx.db.insert('notifications', {
          organizationId,
          userId: driver.userId,
          type: 'driver_request',
          title: 'Recurring Trip Request',
          message: `${trip.tripInfo.purpose}: ${trip.tripInfo.from} → ${trip.tripInfo.to}`,
          isRead: false,
          createdAt: Date.now(),
        });
      }

      await ctx.db.patch(trip._id, { lastGeneratedAt: Date.now(), updatedAt: Date.now() });
      generated++;
    }

    return { generated };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #6: Favorite Drivers
// ─────────────────────────────────────────────────────────────────────────────

/** Add driver to favorites */
export const addFavoriteDriver = mutation({
  args: {
    organizationId: v.id('organizations'),
    userId: v.id('users'),
    driverId: v.id('drivers'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('favoriteDrivers')
      .withIndex('by_user_driver', (q) => q.eq('userId', args.userId).eq('driverId', args.driverId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('favoriteDrivers', {
      organizationId: args.organizationId,
      userId: args.userId,
      driverId: args.driverId,
      createdAt: Date.now(),
    });
  },
});

/** Remove driver from favorites */
export const removeFavoriteDriver = mutation({
  args: {
    userId: v.id('users'),
    driverId: v.id('drivers'),
  },
  handler: async (ctx, { userId, driverId }) => {
    const existing = await ctx.db
      .query('favoriteDrivers')
      .withIndex('by_user_driver', (q) => q.eq('userId', userId).eq('driverId', driverId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});

/** Get user's favorite drivers */
export const getFavoriteDrivers = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const favorites = await ctx.db
      .query('favoriteDrivers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        const driver = await ctx.db.get(fav.driverId);
        if (!driver) return null;
        const user = await ctx.db.get(driver.userId);
        return {
          ...fav,
          driver: {
            ...driver,
            userName: user?.name ?? 'Unknown',
            userAvatar: user?.avatarUrl,
          },
        };
      }),
    );
    return enriched.filter(Boolean);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #7: Driver Notes
// ─────────────────────────────────────────────────────────────────────────────

/** Driver adds notes to a trip */
export const addDriverNotes = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    userId: v.id('users'),
    notes: v.string(),
  },
  handler: async (ctx, { scheduleId, userId, notes }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    const driver = await ctx.db.get(schedule.driverId);
    if (!driver || driver.userId !== userId) throw new Error('Only the driver can add notes');

    await ctx.db.patch(scheduleId, {
      driverNotes: notes,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #8: Wait Time Tracking
// ─────────────────────────────────────────────────────────────────────────────

/** Driver marks "I've arrived" — starts wait timer */
export const markDriverArrived = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    userId: v.id('users'),
  },
  handler: async (ctx, { scheduleId, userId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    const driver = await ctx.db.get(schedule.driverId);
    if (!driver || driver.userId !== userId) throw new Error('Only the driver can mark arrival');

    await ctx.db.patch(scheduleId, {
      arrivedAt: Date.now(),
      status: 'in_progress',
      updatedAt: Date.now(),
    });

    // Notify passenger
    await ctx.db.insert('notifications', {
      organizationId: schedule.organizationId,
      userId: schedule.userId,
      type: 'status_change',
      title: 'Driver Has Arrived',
      message: 'Your driver has arrived at the pickup location',
      isRead: false,
      createdAt: Date.now(),
    });

    return { success: true, arrivedAt: Date.now() };
  },
});

/** Driver marks passenger picked up — stops wait timer */
export const markPassengerPickedUp = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    userId: v.id('users'),
  },
  handler: async (ctx, { scheduleId, userId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    const driver = await ctx.db.get(schedule.driverId);
    if (!driver || driver.userId !== userId) throw new Error('Only the driver can mark pickup');

    const now = Date.now();
    const waitTime = schedule.arrivedAt ? Math.round((now - schedule.arrivedAt) / 60000) : 0;

    await ctx.db.patch(scheduleId, {
      passengerPickedUpAt: now,
      waitTimeMinutes: waitTime,
      updatedAt: now,
    });

    return { success: true, waitTimeMinutes: waitTime };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE #9: ETA (Estimated Time of Arrival)
// ─────────────────────────────────────────────────────────────────────────────

/** Driver updates ETA to pickup */
export const updateETA = mutation({
  args: {
    scheduleId: v.id('driverSchedules'),
    userId: v.id('users'),
    etaMinutes: v.number(),
  },
  handler: async (ctx, { scheduleId, userId, etaMinutes }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    const driver = await ctx.db.get(schedule.driverId);
    if (!driver || driver.userId !== userId) throw new Error('Only the driver can update ETA');

    await ctx.db.patch(scheduleId, {
      etaMinutes,
      etaUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Notify passenger
    await ctx.db.insert('notifications', {
      organizationId: schedule.organizationId,
      userId: schedule.userId,
      type: 'status_change',
      title: 'Driver ETA Updated',
      message: `Your driver will arrive in approximately ${etaMinutes} minutes`,
      isRead: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/** Get ETA for a schedule (passenger view) */
export const getScheduleETA = query({
  args: { scheduleId: v.id('driverSchedules') },
  handler: async (ctx, { scheduleId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) return null;
    return {
      etaMinutes: schedule.etaMinutes,
      etaUpdatedAt: schedule.etaUpdatedAt,
      arrivedAt: schedule.arrivedAt,
      passengerPickedUpAt: schedule.passengerPickedUpAt,
      waitTimeMinutes: schedule.waitTimeMinutes,
      status: schedule.status,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: Get driver statistics
// ─────────────────────────────────────────────────────────────────────────────

/** Get driver statistics */
export const getDriverStats = query({
  args: {
    driverId: v.id('drivers'),
    period: v.union(v.literal('week'), v.literal('month'), v.literal('year')),
  },
  handler: async (ctx, { driverId, period }) => {
    const now = Date.now();
    let periodStart: number;

    if (period === 'week') {
      periodStart = now - 7 * 24 * 60 * 60 * 1000;
    } else if (period === 'month') {
      periodStart = now - 30 * 24 * 60 * 60 * 1000;
    } else {
      periodStart = now - 365 * 24 * 60 * 60 * 1000;
    }

    const schedules = await ctx.db
      .query('driverSchedules')
      .withIndex('by_driver', (q) => q.eq('driverId', driverId))
      .filter((q) =>
        q.and(
          q.gte(q.field('startTime'), periodStart),
          q.eq(q.field('status'), 'completed'),
          q.eq(q.field('type'), 'trip'),
        ),
      )
      .collect();

    const totalTrips = schedules.length;
    const totalDistance = schedules.reduce((sum, s) => sum + (s.tripInfo?.distanceKm || 0), 0);
    const totalDuration = schedules.reduce((sum, s) => sum + (s.tripInfo?.durationMinutes || 0), 0);

    // Calculate popular routes
    const routeCounts: Record<string, number> = {};
    schedules.forEach((s) => {
      const route = `${s.tripInfo?.from} → ${s.tripInfo?.to}`;
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    });

    const popularRoutes = Object.entries(routeCounts)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalTrips,
      totalDistanceKm: totalDistance,
      totalDurationMinutes: totalDuration,
      averageDistancePerTrip: totalTrips > 0 ? totalDistance / totalTrips : 0,
      averageDurationPerTrip: totalTrips > 0 ? totalDuration / totalTrips : 0,
      popularRoutes,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Start a new shift for a driver */
export const startShift = mutation({
  args: {
    driverId: v.id('drivers'),
    userId: v.id('users'),
    organizationId: v.id('organizations'),
    scheduledStartTime: v.optional(v.number()),
    scheduledEndTime: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { driverId, userId, organizationId, scheduledStartTime, scheduledEndTime },
  ) => {
    // Check if driver already has an active shift
    const existingShift = await ctx.db
      .query('driverShifts')
      .withIndex('by_driver_status', (q) => q.eq('driverId', driverId).eq('status', 'active'))
      .first();

    if (existingShift) {
      throw new Error('Driver already has an active shift');
    }

    // Create new shift
    const shiftId = await ctx.db.insert('driverShifts', {
      organizationId,
      driverId,
      userId,
      startTime: Date.now(),
      scheduledStartTime,
      scheduledEndTime,
      status: 'active',
      tripsCompleted: 0,
      totalDistance: 0,
      totalDuration: 0,
      breakTime: 0,
      overtimeHours: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update driver status
    await ctx.db.patch(driverId, {
      isOnShift: true,
      currentShiftStart: Date.now(),
      currentShiftEnd: scheduledEndTime,
      lastStatusUpdateAt: Date.now(),
    });

    return shiftId;
  },
});

/** End current shift */
export const endShift = mutation({
  args: {
    driverId: v.id('drivers'),
    userId: v.id('users'),
    breakTime: v.optional(v.number()),
    driverNotes: v.optional(v.string()),
  },
  handler: async (ctx, { driverId, userId, breakTime, driverNotes }) => {
    // Find active shift
    const shift = await ctx.db
      .query('driverShifts')
      .withIndex('by_driver_status', (q) => q.eq('driverId', driverId).eq('status', 'active'))
      .first();

    if (!shift) {
      throw new Error('No active shift found');
    }

    const endTime = Date.now();
    const totalHours = (endTime - shift.startTime) / (1000 * 60 * 60);

    // Calculate overtime
    let overtimeHours = 0;
    if (shift.scheduledEndTime && endTime > shift.scheduledEndTime) {
      overtimeHours = (endTime - shift.scheduledEndTime) / (1000 * 60 * 60);
    }

    // Get driver record
    const driver = await ctx.db.get(driverId);

    // Update shift
    await ctx.db.patch(shift._id, {
      endTime,
      status: 'completed',
      totalHours,
      breakTime: breakTime || 0,
      overtimeHours,
      driverNotes: driverNotes || shift.driverNotes,
      updatedAt: Date.now(),
    });

    // Update driver status
    await ctx.db.patch(driverId, {
      isOnShift: false,
      currentShiftStart: undefined,
      currentShiftEnd: undefined,
      lastStatusUpdateAt: Date.now(),
      overtimeHours: (driver?.overtimeHours || 0) + overtimeHours,
    });

    return shift._id;
  },
});

/** Pause shift (for breaks) */
export const pauseShift = mutation({
  args: {
    driverId: v.id('drivers'),
    userId: v.id('users'),
  },
  handler: async (ctx, { driverId, userId }) => {
    const shift = await ctx.db
      .query('driverShifts')
      .withIndex('by_driver_status', (q) => q.eq('driverId', driverId).eq('status', 'active'))
      .first();

    if (!shift) {
      throw new Error('No active shift found');
    }

    await ctx.db.patch(shift._id, {
      status: 'paused',
      updatedAt: Date.now(),
    });

    return shift._id;
  },
});

/** Resume paused shift */
export const resumeShift = mutation({
  args: {
    driverId: v.id('drivers'),
    userId: v.id('users'),
  },
  handler: async (ctx, { driverId, userId }) => {
    const shift = await ctx.db
      .query('driverShifts')
      .withIndex('by_driver_status', (q) => q.eq('driverId', driverId).eq('status', 'paused'))
      .first();

    if (!shift) {
      throw new Error('No paused shift found');
    }

    await ctx.db.patch(shift._id, {
      status: 'active',
      updatedAt: Date.now(),
    });

    return shift._id;
  },
});

/** Get current active shift for a driver */
export const getCurrentShift = query({
  args: {
    driverId: v.id('drivers'),
  },
  handler: async (ctx, { driverId }) => {
    const shift = await ctx.db
      .query('driverShifts')
      .withIndex('by_driver_status', (q) => q.eq('driverId', driverId).eq('status', 'active'))
      .first();

    if (!shift) return null;

    // Calculate current duration
    const now = Date.now();
    const currentDuration = (now - shift.startTime) / (1000 * 60 * 60); // hours

    return {
      ...shift,
      currentDuration,
      isOvertime: shift.scheduledEndTime && now > shift.scheduledEndTime,
    };
  },
});

/** Get shift history for a driver */
export const getShiftHistory = query({
  args: {
    driverId: v.id('drivers'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { driverId, limit }) => {
    const shifts = await ctx.db
      .query('driverShifts')
      .withIndex('by_driver', (q) => q.eq('driverId', driverId))
      .order('desc')
      .take(limit || 50);

    return shifts.map((shift) => ({
      ...shift,
      duration: shift.endTime ? (shift.endTime - shift.startTime) / (1000 * 60 * 60) : null,
    }));
  },
});

/** Get shift statistics for organization */
export const getShiftStatistics = query({
  args: {
    organizationId: v.id('organizations'),
    period: v.union(v.literal('week'), v.literal('month'), v.literal('year')),
  },
  handler: async (ctx, { organizationId, period }) => {
    const now = Date.now();
    let periodStart: number;

    if (period === 'week') {
      periodStart = now - 7 * 24 * 60 * 60 * 1000;
    } else if (period === 'month') {
      periodStart = now - 30 * 24 * 60 * 60 * 1000;
    } else {
      periodStart = now - 365 * 24 * 60 * 60 * 1000;
    }

    const shifts = await ctx.db
      .query('driverShifts')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .filter((q) => q.gte(q.field('startTime'), periodStart))
      .collect();

    const completedShifts = shifts.filter((s) => s.status === 'completed');

    const totalShifts = completedShifts.length;
    const totalHours = completedShifts.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const totalOvertime = completedShifts.reduce((sum, s) => sum + (s.overtimeHours || 0), 0);
    const totalTrips = completedShifts.reduce((sum, s) => sum + (s.tripsCompleted || 0), 0);
    const totalDistance = completedShifts.reduce((sum, s) => sum + (s.totalDistance || 0), 0);

    const avgShiftDuration = totalShifts > 0 ? totalHours / totalShifts : 0;
    const avgTripsPerShift = totalShifts > 0 ? totalTrips / totalShifts : 0;

    return {
      totalShifts,
      totalHours,
      totalOvertime,
      totalTrips,
      totalDistanceKm: totalDistance,
      avgShiftDuration,
      avgTripsPerShift,
      activeShifts: shifts.filter((s) => s.status === 'active').length,
    };
  },
});

/** Update shift trip count (called when a trip is completed) */
export const updateShiftTripCount = mutation({
  args: {
    shiftId: v.id('driverShifts'),
    distanceKm: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { shiftId, distanceKm, durationMinutes }) => {
    const shift = await ctx.db.get(shiftId);
    if (!shift) throw new Error('Shift not found');

    await ctx.db.patch(shiftId, {
      tripsCompleted: (shift.tripsCompleted || 0) + 1,
      totalDistance: (shift.totalDistance || 0) + (distanceKm || 0),
      totalDuration: (shift.totalDuration || 0) + (durationMinutes || 0),
      updatedAt: Date.now(),
    });

    return shiftId;
  },
});
