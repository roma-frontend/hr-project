import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── ORGANIZATIONS ────────────────────────────────────────────────────────
  // Each tenant is one organization. All data is scoped by organizationId.
  organizations: defineTable({
    name: v.string(),                  // "AURA Medical Center"
    slug: v.string(),                  // "aura" — unique, lowercase, URL-safe
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    isActive: v.boolean(),
    // The superadmin who created this org
    createdBySuperadmin: v.boolean(),
    // Settings
    logoUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    timezone: v.optional(v.string()),
    country: v.optional(v.string()),
    industry: v.optional(v.string()),
    employeeLimit: v.number(),         // max employees by plan
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_plan", ["plan"])
    .index("by_active", ["isActive"]),

  // ── ORGANIZATION CREATION REQUESTS ───────────────────────────────────────
  // When someone wants to create a new organization (Professional/Enterprise)
  organizationRequests: defineTable({
    requestedName: v.string(),
    requestedSlug: v.string(),
    requesterName: v.string(),
    requesterEmail: v.string(),
    requesterPhone: v.optional(v.string()),
    requesterPassword: v.string(),              // hashed password for future user
    requestedPlan: v.union(
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    industry: v.optional(v.string()),
    country: v.optional(v.string()),
    teamSize: v.optional(v.string()),           // "1-10", "11-50", "51-200", "200+"
    description: v.optional(v.string()),        // Why do they need this?
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewedBy: v.optional(v.id("users")),      // superadmin who reviewed
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    // After approval
    organizationId: v.optional(v.id("organizations")),
    userId: v.optional(v.id("users")),          // created admin user
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_email", ["requesterEmail"])
    .index("by_slug", ["requestedSlug"]),

  // ── JOIN REQUESTS ────────────────────────────────────────────────────────
  // When an employee types an org name → request goes to org admin
  organizationInvites: defineTable({
    organizationId: v.optional(v.id("organizations")),
    // For join requests (employee → org)
    requestedByEmail: v.string(),
    requestedByName: v.string(),
    requestedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewedBy: v.optional(v.id("users")), // org admin who reviewed
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    // After approval, the user record ID
    userId: v.optional(v.id("users")),
    // Invite link mode (admin → employee)
    inviteToken: v.optional(v.string()),  // unique token for invite links
    inviteEmail: v.optional(v.string()),  // pre-filled email
    inviteExpiry: v.optional(v.number()), // expiry timestamp
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_email", ["requestedByEmail"])
    .index("by_status", ["status"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_token", ["inviteToken"]),

  // ── USERS ────────────────────────────────────────────────────────────────
  users: defineTable({
    // Multi-tenant: every user belongs to one organization
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    googleId: v.optional(v.string()),     // Google OAuth sub ID
    role: v.union(
      v.literal("superadmin"),   // platform owner (you) — sees all orgs
      v.literal("admin"),        // org admin — sees only their org
      v.literal("supervisor"),
      v.literal("employee"),
      v.literal("driver"),       // employee with driver privileges
    ),
    employeeType: v.union(v.literal("staff"), v.literal("contractor")),
    department: v.optional(v.string()),
    position: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    presenceStatus: v.optional(v.union(
      v.literal("available"),
      v.literal("in_meeting"),
      v.literal("in_call"),
      v.literal("out_of_office"),
      v.literal("busy"),
    )),
    supervisorId: v.optional(v.id("users")),
    isActive: v.boolean(),
    // Approval system
    isApproved: v.boolean(),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    // Travel allowance: contractor=12000, staff=20000
    travelAllowance: v.number(),
    // Annual leave balances
    paidLeaveBalance: v.number(),
    sickLeaveBalance: v.number(),
    familyLeaveBalance: v.number(),
    // WebAuthn
    webauthnChallenge: v.optional(v.string()),
    // Face Recognition
    faceDescriptor: v.optional(v.array(v.number())),
    faceImageUrl: v.optional(v.string()),
    faceRegisteredAt: v.optional(v.number()),
    faceIdBlocked: v.optional(v.boolean()),
    faceIdBlockedAt: v.optional(v.number()),
    faceIdFailedAttempts: v.optional(v.number()),
    faceIdLastAttempt: v.optional(v.number()),
    // Account Suspension (for security/suspicious activity)
    isSuspended: v.optional(v.boolean()),
    suspendedUntil: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    suspendedBy: v.optional(v.id("users")),
    suspendedAt: v.optional(v.number()),
    // Two-Factor Authentication (TOTP)
    totpSecret: v.optional(v.string()),          // encrypted TOTP secret
    totpEnabled: v.optional(v.boolean()),        // is 2FA active
    backupCodes: v.optional(v.array(v.string())), // hashed backup codes
    // Password Reset
    resetPasswordToken: v.optional(v.string()),
    resetPasswordExpiry: v.optional(v.number()),
    // Sessions
    sessionToken: v.optional(v.string()),
    sessionExpiry: v.optional(v.number()),
    // Productivity Settings
    focusModeEnabled: v.optional(v.boolean()),
    workHoursStart: v.optional(v.string()),
    workHoursEnd: v.optional(v.string()),
    breakRemindersEnabled: v.optional(v.boolean()),
    breakInterval: v.optional(v.number()),
    dailyTaskGoal: v.optional(v.number()),
    // Localization Settings
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    timeFormat: v.optional(v.string()),
    firstDayOfWeek: v.optional(v.string()),
    // Dashboard Settings
    defaultView: v.optional(v.string()),
    dataRefreshRate: v.optional(v.string()),
    compactMode: v.optional(v.boolean()),
    dashboardWidgets: v.optional(v.object({
      quickStats: v.boolean(),
      leaveCalendar: v.boolean(),
      upcomingTasks: v.boolean(),
      teamActivity: v.boolean(),
      recentLeaves: v.boolean(),
      analytics: v.boolean(),
    })),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_org", ["organizationId"])
    .index("by_org_role", ["organizationId", "role"])
    .index("by_org_active", ["organizationId", "isActive"])
    .index("by_org_approval", ["organizationId", "isApproved"])
    .index("by_role", ["role"])
    .index("by_supervisor", ["supervisorId"])
    .index("by_approval", ["isApproved"]),

  webauthnCredentials: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    deviceName: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_credential_id", ["credentialId"]),

  // ── LEAVE REQUESTS ───────────────────────────────────────────────────────
  leaveRequests: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    type: v.union(
      v.literal("paid"),
      v.literal("unpaid"),
      v.literal("sick"),
      v.literal("family"),
      v.literal("doctor"),
    ),
    startDate: v.string(),
    endDate: v.string(),
    days: v.number(),
    reason: v.string(),
    comment: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    isRead: v.optional(v.boolean()),        // Track if admin has read this request (optional for migration)
    reviewedBy: v.optional(v.id("users")),
    reviewComment: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  notifications: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    type: v.union(
      v.literal("leave_request"),
      v.literal("leave_approved"),
      v.literal("leave_rejected"),
      v.literal("driver_request"),           // new: driver booking request
      v.literal("driver_request_approved"),  // new: driver request approved
      v.literal("driver_request_rejected"),  // new: driver request rejected
      v.literal("employee_added"),
      v.literal("join_request"),             // new: employee wants to join
      v.literal("join_approved"),            // new: join request approved
      v.literal("join_rejected"),            // new: join request rejected
      v.literal("security_alert"),           // new: suspicious activity detected
      v.literal("status_change"),            // new: presence status changed
      v.literal("message_mention"),
      v.literal("system"),
    ),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    relatedId: v.optional(v.string()),
    metadata: v.optional(v.string()),       // JSON string for additional data (e.g., quick action buttons)
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_user_unread", ["userId", "isRead"]),

  // ── AUDIT LOGS ───────────────────────────────────────────────────────────
  auditLogs: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    action: v.string(),
    target: v.optional(v.string()),
    details: v.optional(v.string()),
    ip: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"]),

  // ── SLA CONFIG ───────────────────────────────────────────────────────────
  slaConfig: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    targetResponseTime: v.number(),
    warningThreshold: v.number(),
    criticalThreshold: v.number(),
    businessHoursOnly: v.boolean(),
    businessStartHour: v.number(),
    businessEndHour: v.number(),
    excludeWeekends: v.boolean(),
    notifyOnWarning: v.boolean(),
    notifyOnCritical: v.boolean(),
    notifyOnBreach: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_org", ["organizationId"]),

  // ── SLA METRICS ──────────────────────────────────────────────────────────
  slaMetrics: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    leaveRequestId: v.id("leaveRequests"),
    submittedAt: v.number(),
    respondedAt: v.optional(v.number()),
    responseTimeHours: v.optional(v.number()),
    targetResponseTime: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("on_time"),
      v.literal("breached"),
    ),
    slaScore: v.optional(v.number()),
    warningTriggered: v.boolean(),
    criticalTriggered: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_leave", ["leaveRequestId"])
    .index("by_status", ["status"])
    .index("by_submitted", ["submittedAt"]),

  // ── EMPLOYEE PROFILES ────────────────────────────────────────────────────
  employeeProfiles: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    biography: v.optional(v.object({
      education: v.optional(v.array(v.string())),
      certifications: v.optional(v.array(v.string())),
      workHistory: v.optional(v.array(v.string())),
      skills: v.optional(v.array(v.string())),
      languages: v.optional(v.array(v.string())),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"]),

  // ── EMPLOYEE DOCUMENTS ───────────────────────────────────────────────────
  employeeDocuments: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    uploaderId: v.id("users"),
    category: v.union(
      v.literal("resume"),
      v.literal("contract"),
      v.literal("certificate"),
      v.literal("performance_review"),
      v.literal("id_document"),
      v.literal("other"),
    ),
    fileName: v.string(),
    fileUrl: v.string(),
    fileSize: v.number(),
    description: v.optional(v.string()),
    uploadedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"]),

  // ── EMPLOYEE NOTES ───────────────────────────────────────────────────────
  employeeNotes: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    employeeId: v.id("users"),
    authorId: v.id("users"),
    type: v.union(
      v.literal("performance"),
      v.literal("behavior"),
      v.literal("achievement"),
      v.literal("concern"),
      v.literal("general"),
    ),
    visibility: v.union(
      v.literal("private"),
      v.literal("hr_only"),
      v.literal("manager_only"),
      v.literal("employee_visible"),
    ),
    content: v.string(),
    sentiment: v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative"),
    ),
    tags: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_employee", ["employeeId"])
    .index("by_author", ["authorId"]),

  // ── PERFORMANCE METRICS ──────────────────────────────────────────────────
  performanceMetrics: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    updatedBy: v.id("users"),
    punctualityScore: v.number(),
    absenceRate: v.number(),
    lateArrivals: v.number(),
    kpiScore: v.number(),
    projectCompletion: v.number(),
    deadlineAdherence: v.number(),
    teamworkRating: v.number(),
    communicationScore: v.number(),
    conflictIncidents: v.number(),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"]),

  // ── TIME TRACKING ────────────────────────────────────────────────────────
  timeTracking: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    checkInTime: v.number(),
    checkOutTime: v.optional(v.number()),
    scheduledStartTime: v.number(),
    scheduledEndTime: v.number(),
    isLate: v.boolean(),
    lateMinutes: v.optional(v.number()),
    isEarlyLeave: v.boolean(),
    earlyLeaveMinutes: v.optional(v.number()),
    overtimeMinutes: v.optional(v.number()),
    totalWorkedMinutes: v.optional(v.number()),
    status: v.union(
      v.literal("checked_in"),
      v.literal("checked_out"),
      v.literal("absent"),
    ),
    date: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_date", ["date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_status", ["status"]),

  // ── SUPERVISOR RATINGS ───────────────────────────────────────────────────
  supervisorRatings: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    employeeId: v.id("users"),
    supervisorId: v.id("users"),
    qualityOfWork: v.number(),
    efficiency: v.number(),
    teamwork: v.number(),
    initiative: v.number(),
    communication: v.number(),
    reliability: v.number(),
    overallRating: v.number(),
    strengths: v.optional(v.string()),
    areasForImprovement: v.optional(v.string()),
    generalComments: v.optional(v.string()),
    ratingPeriod: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_employee", ["employeeId"])
    .index("by_supervisor", ["supervisorId"])
    .index("by_period", ["ratingPeriod"]),

  // ── TASKS ────────────────────────────────────────────────────────────────
  tasks: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.id("users"),
    assignedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    deadline: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    attachmentUrl: v.optional(v.string()),
    attachments: v.optional(v.array(v.object({
      url: v.string(),
      name: v.string(),
      type: v.string(),
      size: v.number(),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_assigned_by", ["assignedBy"])
    .index("by_status", ["status"])
    .index("by_deadline", ["deadline"]),

  // ── TASK COMMENTS ────────────────────────────────────────────────────────
  taskComments: defineTable({
    taskId: v.id("tasks"),
    authorId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  // ── SUBSCRIPTIONS ────────────────────────────────────────────────────────
  // Subscriptions belong to an organization (not individual user)
  subscriptions: defineTable({
    organizationId: v.optional(v.id("organizations")), // ← tenant
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeSessionId: v.optional(v.string()),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("incomplete"),
    ),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    trialEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_email", ["email"]),

  // ── CONTACT INQUIRIES ────────────────────────────────────────────────────
  contactInquiries: defineTable({
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    teamSize: v.optional(v.string()),
    message: v.string(),
    plan: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  // ── WORK SCHEDULE ────────────────────────────────────────────────────────
  workSchedule: defineTable({
    organizationId: v.optional(v.id("organizations")),   // optional for migration
    userId: v.id("users"),
    startTime: v.string(),
    endTime: v.string(),
    workingDays: v.array(v.number()),
    timezone: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"]),

  // ── USER PREFERENCES ─────────────────────────────────────────────────
  // Store user preferences like tour completion, UI settings, etc.
  userPreferences: defineTable({
    userId: v.id("users"),
    key: v.string(),              // e.g., "tour_seen_login-tour", "theme", "notifications_enabled"
    value: v.any(),               // The preference value (boolean, string, object, etc.)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_key", ["userId", "key"]),

  // ── POMODORO SESSIONS ────────────────────────────────────────────────
  pomodoroSessions: defineTable({
    userId: v.id("users"),
    taskId: v.optional(v.id("tasks")),
    startTime: v.number(),
    endTime: v.number(),
    duration: v.number(), // in milliseconds
    completed: v.boolean(),
    interrupted: v.boolean(),
    actualEndTime: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "completed", "interrupted"]),

  // ── AI SITE EDITOR SESSIONS ──────────────────────────────────────────────
  // Track AI-powered site editing sessions with plan-based limitations
  aiSiteEditorSessions: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    // Request details
    userMessage: v.string(),              // What user asked for
    aiResponse: v.string(),               // AI's response
    // What was edited
    editType: v.union(
      v.literal("design"),                // CSS/styling changes
      v.literal("content"),               // Text/content changes
      v.literal("layout"),                // Component structure
      v.literal("logic"),                 // Functionality/behavior
      v.literal("full_control"),          // Complete site modifications (Pro only)
    ),
    targetComponent: v.optional(v.string()), // Which component was edited
    changesMade: v.array(v.object({
      file: v.string(),                   // File path that was modified
      type: v.string(),                   // Type of change
      description: v.string(),            // Human-readable description
      before: v.optional(v.string()),     // Code before (for rollback)
      after: v.optional(v.string()),      // Code after
    })),
    // Plan limits tracking
    limitType: v.union(
      v.literal("limited"),               // Starter: very limited actions
      v.literal("unlimited"),             // Professional: unlimited actions
    ),
    tokensUsed: v.optional(v.number()),   // For usage tracking
    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("rejected"),              // Rejected by plan limits
    ),
    errorMessage: v.optional(v.string()),
    // Rollback capability
    canRollback: v.boolean(),
    rolledBack: v.boolean(),
    rolledBackAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_date", ["organizationId", "createdAt"])
    .index("by_plan", ["plan"])
    .index("by_status", ["status"]),

  // ── SECURITY SETTINGS (superadmin global toggles) ────────────────────────
  securitySettings: defineTable({
    key: v.string(),          // e.g. "adaptive_auth", "keystroke_dynamics", "continuous_face", "audit_logging"
    enabled: v.boolean(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    description: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // ── LOGIN ATTEMPTS ────────────────────────────────────────────────────────
  loginAttempts: defineTable({
    email: v.string(),
    userId: v.optional(v.id("users")),
    organizationId: v.optional(v.id("organizations")),
    success: v.boolean(),
    method: v.union(
      v.literal("password"),
      v.literal("face_id"),
      v.literal("webauthn"),
      v.literal("google"),
    ),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
    riskScore: v.optional(v.number()),
    riskFactors: v.optional(v.array(v.string())),
    blockedReason: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_created", ["createdAt"])
    .index("by_success", ["success"]),

  // ── DEVICE FINGERPRINTS ───────────────────────────────────────────────────
  deviceFingerprints: defineTable({
    userId: v.id("users"),
    fingerprint: v.string(),           // hash of browser/device signature
    userAgent: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    isTrusted: v.boolean(),            // admin/user can mark as trusted
    loginCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_fingerprint", ["fingerprint"])
    .index("by_user_fingerprint", ["userId", "fingerprint"]),

  // ── KEYSTROKE PROFILES ────────────────────────────────────────────────────
  keystrokeProfiles: defineTable({
    userId: v.id("users"),
    // Average timing patterns (ms between keypresses)
    avgDwell: v.number(),              // avg key hold time
    avgFlight: v.number(),             // avg time between keys
    stdDevDwell: v.optional(v.number()),
    stdDevFlight: v.optional(v.number()),
    sampleCount: v.number(),           // how many samples collected
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ── CHAT CONVERSATIONS ───────────────────────────────────────────────────
  // Direct messages (DM) and group channels within an organization
  chatConversations: defineTable({
    organizationId: v.id("organizations"),
    type: v.union(
      v.literal("direct"),   // 1-on-1 between two users
      v.literal("group"),    // group channel/room
    ),
    // Group-only fields
    name: v.optional(v.string()),          // "Design Team", "General"
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdBy: v.id("users"),
    // Last message preview (for conversation list)
    lastMessageAt: v.optional(v.number()),
    lastMessageText: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.id("users")),
    // For direct chats: sorted pair of userIds for uniqueness
    dmKey: v.optional(v.string()),  // e.g. "userId1_userId2" (sorted)
    // Conversation management
    isPinned: v.optional(v.boolean()),      // закреплена ли переписка
    isArchived: v.optional(v.boolean()),    // архивирована ли
    isDeleted: v.optional(v.boolean()),     // мягкое удаление (soft delete)
    deletedBy: v.optional(v.id("users")),   // кто удалил
    deletedAt: v.optional(v.number()),      // когда удалили
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_last", ["organizationId", "lastMessageAt"])
    .index("by_dm_key", ["dmKey"])
    .index("by_creator", ["createdBy"])
    .index("by_org_not_deleted", ["organizationId", "isDeleted"])
    .index("by_org_pinned", ["organizationId", "isPinned"])
    .index("by_org_archived", ["organizationId", "isArchived"]),

  // ── CHAT MEMBERS ─────────────────────────────────────────────────────────
  chatMembers: defineTable({
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    role: v.union(
      v.literal("owner"),    // group creator
      v.literal("admin"),    // can manage members
      v.literal("member"),   // regular member
    ),
    unreadCount: v.number(),
    lastReadAt: v.optional(v.number()),
    lastReadMessageId: v.optional(v.id("chatMessages")),
    isMuted: v.boolean(),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    isArchived: v.optional(v.boolean()),
    joinedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  // ── CHAT MESSAGES ─────────────────────────────────────────────────────────
  chatMessages: defineTable({
    conversationId: v.id("chatConversations"),
    organizationId: v.id("organizations"),
    senderId: v.id("users"),
    type: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("file"),
      v.literal("audio"),
      v.literal("system"),  // "John joined the chat"
      v.literal("call"),    // call event message
    ),
    content: v.string(),          // text or system message
    // Attachments
    attachments: v.optional(v.array(v.object({
      url: v.string(),
      name: v.string(),
      type: v.string(),   // mime type
      size: v.number(),
    }))),
    // Threading / Reply
    replyToId: v.optional(v.id("chatMessages")),
    replyToContent: v.optional(v.string()),  // cached preview
    replyToSenderName: v.optional(v.string()),
    // Reactions: { "👍": ["userId1", "userId2"], "❤️": ["userId3"] }
    reactions: v.optional(v.any()),
    // Mentions
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    // Read receipts: array of { userId, readAt }
    readBy: v.optional(v.array(v.object({
      userId: v.id("users"),
      readAt: v.number(),
    }))),
    // Poll
    poll: v.optional(v.object({
      question: v.string(),
      options: v.array(v.object({
        id: v.string(),
        text: v.string(),
        votes: v.array(v.id("users")),
      })),
      closedAt: v.optional(v.number()),
    })),
    // Thread
    threadCount: v.optional(v.number()),
    threadLastAt: v.optional(v.number()),
    // Scheduled send
    scheduledFor: v.optional(v.number()),
    isSent: v.optional(v.boolean()),
    // Link preview
    linkPreview: v.optional(v.object({
      url: v.string(),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      siteName: v.optional(v.string()),
    })),
    // Thread: parentMessageId for threaded replies
    parentMessageId: v.optional(v.id("chatMessages")),
    // Edit/Delete
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    // Delete for self only (array of userIds who deleted this message for themselves)
    deletedForUsers: v.optional(v.array(v.id("users"))),
    // Pinned
    isPinned: v.optional(v.boolean()),
    pinnedBy: v.optional(v.id("users")),
    pinnedAt: v.optional(v.number()),
    // Call info (for type === "call")
    callDuration: v.optional(v.number()),  // seconds
    callType: v.optional(v.union(v.literal("audio"), v.literal("video"))),
    callStatus: v.optional(v.union(v.literal("missed"), v.literal("answered"), v.literal("declined"))),
    // Service broadcast (official company-wide announcement)
    isServiceBroadcast: v.optional(v.boolean()),  // true = sent by superadmin to all users
    broadcastTitle: v.optional(v.string()),       // e.g. "System Maintenance"
    broadcastIcon: v.optional(v.string()),        // emoji or icon
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_org", ["organizationId"])
    .index("by_sender", ["senderId"])
    .index("by_pinned", ["conversationId", "isPinned"]),

  // ── TYPING INDICATORS ────────────────────────────────────────────────────
  chatTyping: defineTable({
    conversationId: v.id("chatConversations"),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    updatedAt: v.number(),   // TTL: if > 5s old, treat as stopped
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  // ── CALL SESSIONS (WebRTC signaling) ─────────────────────────────────────
  chatCalls: defineTable({
    conversationId: v.id("chatConversations"),
    organizationId: v.id("organizations"),
    initiatorId: v.id("users"),
    type: v.union(v.literal("audio"), v.literal("video")),
    status: v.union(
      v.literal("ringing"),    // waiting for answer
      v.literal("active"),     // call in progress
      v.literal("ended"),      // call ended normally
      v.literal("missed"),     // nobody answered
      v.literal("declined"),   // explicitly declined
    ),
    participants: v.array(v.object({
      userId: v.id("users"),
      joinedAt: v.optional(v.number()),
      leftAt: v.optional(v.number()),
      // WebRTC ICE candidates and SDP offers stored here
      offer: v.optional(v.string()),   // JSON stringified RTCSessionDescription
      answer: v.optional(v.string()),
      iceCandidates: v.optional(v.array(v.string())),
    })),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),  // seconds
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_organization", ["organizationId"])
    .index("by_initiator", ["initiatorId"])
    .index("by_status", ["status"]),

  // ── AI SITE EDITOR USAGE LIMITS ──────────────────────────────────────────
  // Track monthly usage limits for different plans
  aiSiteEditorUsage: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    // Monthly tracking
    month: v.string(),                    // "2026-03" format
    // Usage counters
    designChanges: v.number(),            // Starter: max 5/month
    contentChanges: v.number(),           // Starter: max 10/month
    layoutChanges: v.number(),            // Starter: max 2/month
    logicChanges: v.number(),             // Starter: max 0/month (Pro only)
    fullControlChanges: v.number(),       // Starter: max 0/month (Pro only)
    totalRequests: v.number(),
    // Last reset
    lastResetAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_month", ["organizationId", "month"])
    .index("by_user_month", ["userId", "month"]),

  // ── SHAREPOINT SYNC LOGS ─────────────────────────────────────────────────
  sharepointSyncLogs: defineTable({
    organizationId: v.id("organizations"),
    triggeredBy: v.id("users"),
    created: v.number(),
    updated: v.number(),
    deactivated: v.number(),
    errors: v.number(),
    syncedAt: v.number(),
  }).index("by_org", ["organizationId"]),

  // ── MAINTENANCE MODE ──────────────────────────────────────────────────────
  // Site maintenance/downtime management
  maintenanceMode: defineTable({
    organizationId: v.id("organizations"),
    isActive: v.boolean(),              // is maintenance mode on
    title: v.string(),                  // "System Maintenance"
    message: v.string(),                // detailed message
    startTime: v.number(),              // when maintenance starts
    endTime: v.optional(v.number()),    // when maintenance ends (optional)
    estimatedDuration: v.optional(v.string()), // "2 hours", "30 minutes"
    icon: v.optional(v.string()),       // emoji icon
    enabledBy: v.id("users"),           // who enabled this
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_active", ["isActive"]),

  // ── DRIVER MANAGEMENT ──────────────────────────────────────────────────────
  // Employees who can drive (designated drivers in the organization)
  drivers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),              // the employee who is a driver
    vehicleInfo: v.object({
      model: v.string(),                // e.g., "Mercedes Sprinter"
      plateNumber: v.string(),          // e.g., "34-AB-123"
      capacity: v.number(),             // number of seats
      color: v.optional(v.string()),
      year: v.optional(v.number()),
    }),
    // Availability status
    isAvailable: v.boolean(),           // currently available for bookings
    isOnShift: v.optional(v.boolean()), // currently on shift (real-time status)
    lastStatusUpdateAt: v.optional(v.number()), // when status was last updated
    // Working hours
    workingHours: v.object({
      startTime: v.string(),            // "09:00"
      endTime: v.string(),              // "18:00"
      workingDays: v.array(v.number()), // [1,2,3,4,5] (Monday-Friday)
    }),
    maxTripsPerDay: v.number(),         // maximum trips per day
    currentTripsToday: v.number(),      // trips completed today
    // Performance metrics
    rating: v.number(),                 // average rating (1-5)
    totalTrips: v.number(),             // lifetime trips
    // KPI tracking
    kpiMetrics: v.optional(v.object({
      onTimeRate: v.number(),           // % on-time performance
      customerSatisfaction: v.number(), // avg customer rating
      tripsPerShift: v.number(),        // avg trips per shift
      completionRate: v.number(),       // % trips completed
    })),
    // Shift management
    currentShiftStart: v.optional(v.number()), // when current shift started
    currentShiftEnd: v.optional(v.number()),   // when current shift ends
    overtimeHours: v.optional(v.number()),     // overtime hours this week
    // Vehicle maintenance
    lastMaintenanceDate: v.optional(v.number()),
    nextMaintenanceDue: v.optional(v.number()),
    vehicleMileage: v.optional(v.number()),
    inspectionStatus: v.optional(v.union(
      v.literal("passed"),
      v.literal("failed"),
      v.literal("overdue"),
    )),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_available", ["organizationId", "isAvailable"])
    .index("by_on_shift", ["isOnShift"]),

  // ── DRIVER SHIFT MANAGEMENT ────────────────────────────────────────────────
  // Track driver shift sessions (start/end times, duration, breaks)
  driverShifts: defineTable({
    organizationId: v.id("organizations"),
    driverId: v.id("drivers"),
    userId: v.id("users"),              // the driver's user ID
    startTime: v.number(),              // when shift started
    endTime: v.optional(v.number()),    // when shift ended (null if active)
    scheduledStartTime: v.optional(v.number()), // planned start time
    scheduledEndTime: v.optional(v.number()),   // planned end time
    status: v.union(
      v.literal("active"),              // currently on shift
      v.literal("completed"),           // shift ended normally
      v.literal("paused"),              // on break
      v.literal("overtime"),            // working beyond scheduled hours
    ),
    // Time tracking
    totalHours: v.optional(v.number()), // total hours worked
    breakTime: v.optional(v.number()),  // total break time in minutes
    overtimeHours: v.optional(v.number()), // overtime hours
    // Trip statistics for this shift
    tripsCompleted: v.number(),         // trips completed in this shift
    totalDistance: v.optional(v.number()), // total km driven
    totalDuration: v.optional(v.number()),  // total driving time
    // Performance metrics
    onTimePerformance: v.optional(v.number()), // % on-time trips
    averageRating: v.optional(v.number()),     // avg rating for this shift
    // Notes
    driverNotes: v.optional(v.string()), // driver's notes for the shift
    supervisorNotes: v.optional(v.string()), // supervisor notes
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_driver", ["driverId"])
    .index("by_org", ["organizationId"])
    .index("by_driver_status", ["driverId", "status"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_start_time", ["startTime"]),

  // ── DRIVER SCHEDULE ────────────────────────────────────────────────────────
  // Driver's schedule/availability (blocked times, existing trips)
  driverSchedules: defineTable({
    organizationId: v.id("organizations"),
    driverId: v.id("drivers"),
    userId: v.id("users"),              // employee who booked this slot
    startTime: v.number(),              // timestamp
    endTime: v.number(),                // timestamp
    type: v.union(
      v.literal("trip"),                // booked trip
      v.literal("blocked"),             // blocked by driver
      v.literal("maintenance"),         // vehicle maintenance
      v.literal("time_off"),            // vacation/sick leave
    ),
    status: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    // Trip details
    tripInfo: v.optional(v.object({
      from: v.string(),                 // pickup location
      to: v.string(),                   // destination
      purpose: v.string(),              // e.g., "Airport transfer", "Client meeting"
      passengerCount: v.number(),
      notes: v.optional(v.string()),
      distanceKm: v.optional(v.number()), // distance in km (from Google Maps)
      durationMinutes: v.optional(v.number()), // estimated duration
      passengerPhone: v.optional(v.string()), // passenger phone for driver
      pickupCoords: v.optional(v.object({
        lat: v.number(),
        lng: v.number(),
      })),
      dropoffCoords: v.optional(v.object({
        lat: v.number(),
        lng: v.number(),
      })),
    })),
    // For blocked/maintenance/time_off
    reason: v.optional(v.string()),
    // Driver feedback after trip
    driverFeedback: v.optional(v.object({
      rating: v.number(),               // 1-5 rating from driver
      comment: v.optional(v.string()),
      completedAt: v.number(),
    })),
    // Google Maps data
    mapData: v.optional(v.object({
      distanceMeters: v.number(),
      durationSeconds: v.number(),
      polyline: v.optional(v.string()), // encoded polyline for route
    })),
    // Driver notes (Feature #7)
    driverNotes: v.optional(v.string()),  // e.g., "traffic jam on Lenin st", "passenger was 10min late"
    // Wait time tracking (Feature #8)
    arrivedAt: v.optional(v.number()),    // timestamp when driver marked "I've arrived"
    passengerPickedUpAt: v.optional(v.number()), // timestamp when passenger got in
    waitTimeMinutes: v.optional(v.number()), // calculated wait time
    // ETA (Feature #9)
    etaMinutes: v.optional(v.number()),   // estimated time of arrival to pickup
    etaUpdatedAt: v.optional(v.number()), // when ETA was last updated
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_driver", ["driverId"])
    .index("by_driver_time", ["driverId", "startTime"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ── DRIVER BOOKING REQUESTS ───────────────────────────────────────────────
  // When employee requests a driver
  driverRequests: defineTable({
    organizationId: v.id("organizations"),
    requesterId: v.id("users"),         // employee requesting driver
    driverId: v.id("drivers"),          // requested driver
    startTime: v.number(),
    endTime: v.number(),
    tripInfo: v.object({
      from: v.string(),
      to: v.string(),
      purpose: v.string(),
      passengerCount: v.number(),
      notes: v.optional(v.string()),
      pickupCoords: v.optional(v.object({
        lat: v.number(),
        lng: v.number(),
      })),
      dropoffCoords: v.optional(v.object({
        lat: v.number(),
        lng: v.number(),
      })),
    }),
    // Trip priority (for corporate prioritization)
    priority: v.optional(v.union(
      v.literal("P0"),  // CEO/Board - immediate
      v.literal("P1"),  // Client-facing - urgent
      v.literal("P2"),  // Internal meetings - standard
      v.literal("P3"),  // Personal/non-urgent - lowest
    )),
    // Business justification (compliance)
    businessJustification: v.optional(v.string()), // Цель поездки
    tripCategory: v.optional(v.union(
      v.literal("client_meeting"),
      v.literal("airport"),
      v.literal("office_transfer"),
      v.literal("emergency"),
      v.literal("team_event"),
      v.literal("personal"),
    )),
    costCenter: v.optional(v.string()), // Для бухгалтерии
    // Manager approval workflow
    requiresApproval: v.optional(v.boolean()),
    approvedBy: v.optional(v.id("users")), // manager who approved
    approvedAt: v.optional(v.number()),
    // Status tracking
    status: v.union(
      v.literal("pending"),             // waiting for driver approval
      v.literal("approved"),            // driver accepted
      v.literal("declined"),            // driver declined
      v.literal("cancelled"),           // requester cancelled
      v.literal("completed"),           // trip completed
    ),
    declineReason: v.optional(v.string()), // e.g., "Already booked", "Not available"
    reviewedAt: v.optional(v.number()),
    passengerRated: v.optional(v.boolean()), // whether passenger has rated this trip
    cancelledAt: v.optional(v.number()), // when the request was cancelled
    cancelledBy: v.optional(v.id("users")), // who cancelled (requester or admin)
    cancellationReason: v.optional(v.string()), // reason for cancellation
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_requester", ["requesterId"])
    .index("by_driver", ["driverId"])
    .index("by_status", ["status"])
    .index("by_org_status", ["organizationId", "status"])
    .index("by_priority", ["priority"])
    .index("by_requires_approval", ["requiresApproval"]),

  // ── COMPANY EVENTS / MEETINGS ─────────────────────────────────────────────
  // Corporate events that require attendance from specific departments
  companyEvents: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),                   // e.g., "Annual IT Conference"
    description: v.optional(v.string()),
    startDate: v.number(),              // timestamp
    endDate: v.number(),                // timestamp
    isAllDay: v.optional(v.boolean()),
    // Required departments for attendance
    requiredDepartments: v.array(v.string()), // ["IT", "Finance", "Marketing"]
    // Optional: specific employees required
    requiredEmployeeIds: v.optional(v.array(v.id("users"))),
    // Event type
    eventType: v.union(
      v.literal("meeting"),
      v.literal("conference"),
      v.literal("training"),
      v.literal("team_building"),
      v.literal("holiday"),
      v.literal("deadline"),
      v.literal("other"),
    ),
    // Priority level
    priority: v.optional(v.union(
      v.literal("high"),                // Critical attendance required
      v.literal("medium"),              // Recommended attendance
      v.literal("low"),                 // Optional
    )),
    // Created by
    createdBy: v.id("users"),
    // Notifications
    notifyDaysBefore: v.optional(v.number()), // remind N days before
    notifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_date", ["startDate"])
    .index("by_org_date", ["organizationId", "startDate"])
    .index("by_priority", ["priority"]),

  // ── LEAVE CONFLICT ALERTS ──────────────────────────────────────────────────
  // Track leave requests that conflict with company events
  leaveConflictAlerts: defineTable({
    organizationId: v.id("organizations"),
    leaveRequestId: v.id("leaveRequests"),
    eventId: v.id("companyEvents"),
    userId: v.id("users"),              // employee who requested leave
    department: v.string(),             // employee's department
    conflictType: v.union(
      v.literal("required_department"), // User's dept required at event
      v.literal("required_employee"),   // User specifically required
    ),
    severity: v.union(
      v.literal("high"),                // Required attendee
      v.literal("medium"),              // Department match
      v.literal("low"),                 // Optional event
    ),
    isReviewed: v.boolean(),            // Admin has reviewed
    reviewNotes: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_leave_request", ["leaveRequestId"])
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_is_reviewed", ["isReviewed"]),

  // ── CALENDAR ACCESS PERMISSIONS ───────────────────────────────────────────
  // Who can see whose calendar (driver calendar visibility)
  calendarAccess: defineTable({
    organizationId: v.id("organizations"),
    ownerId: v.id("users"),             // calendar owner (driver)
    viewerId: v.id("users"),            // who can view
    accessLevel: v.union(
      v.literal("full"),                // see all details
      v.literal("busy_only"),           // see only busy/free slots
      v.literal("none"),                // revoked access
    ),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),  // optional expiry
    isActive: v.boolean(),
  })
    .index("by_org", ["organizationId"])
    .index("by_owner", ["ownerId"])
    .index("by_viewer", ["viewerId"])
    .index("by_owner_viewer", ["ownerId", "viewerId"]),

  // ── FAVORITE DRIVERS ──────────────────────────────────────────────────────
  // Employees can save preferred drivers for quick booking
  favoriteDrivers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),              // employee who favorited
    driverId: v.id("drivers"),          // favorited driver
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_driver", ["userId", "driverId"]),

  // ── RECURRING TRIPS ───────────────────────────────────────────────────────
  // Scheduled recurring trip templates
  recurringTrips: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),              // employee who created
    driverId: v.id("drivers"),          // preferred driver
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
      daysOfWeek: v.array(v.number()),  // [1,2,3,4,5] Mon-Fri
      startTime: v.string(),            // "08:30"
      endTime: v.string(),              // "09:00"
    }),
    isActive: v.boolean(),
    lastGeneratedAt: v.optional(v.number()), // last time requests were auto-generated
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org_active", ["organizationId", "isActive"]),

  // ── PASSENGER RATINGS ─────────────────────────────────────────────────────
  // Passengers rate drivers after completed trips
  passengerRatings: defineTable({
    organizationId: v.id("organizations"),
    scheduleId: v.id("driverSchedules"),  // the completed trip
    requestId: v.optional(v.id("driverRequests")), // original request
    passengerId: v.id("users"),           // who rated
    driverId: v.id("drivers"),            // rated driver
    rating: v.number(),                   // 1-5
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_schedule", ["scheduleId"])
    .index("by_passenger", ["passengerId"])
    .index("by_driver", ["driverId"]),
});
