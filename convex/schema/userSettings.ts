import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const userSettings = {
  userSettings: defineTable({
    userId: v.id('users'),
    // Localization
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    timeFormat: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.string()),
    // Appearance
    theme: v.optional(v.string()),
    compactMode: v.optional(v.boolean()),
    defaultView: v.optional(v.string()),
    dataRefreshRate: v.optional(v.string()),
    dashboardWidgets: v.optional(
      v.object({
        quickStats: v.boolean(),
        leaveCalendar: v.boolean(),
        upcomingTasks: v.boolean(),
        teamActivity: v.boolean(),
        recentLeaves: v.boolean(),
        analytics: v.boolean(),
      }),
    ),
    // Notifications
    notificationsEnabled: v.optional(v.boolean()),
    emailNotifications: v.optional(v.boolean()),
    pushNotifications: v.optional(v.boolean()),
    // Productivity
    focusModeEnabled: v.optional(v.boolean()),
    workHoursStart: v.optional(v.string()),
    workHoursEnd: v.optional(v.string()),
    breakRemindersEnabled: v.optional(v.boolean()),
    breakInterval: v.optional(v.number()),
    dailyTaskGoal: v.optional(v.number()),
  }).index('by_user', ['userId']),
};
