import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const settings = {
  subscriptions: defineTable({
    organizationId: v.optional(v.id('organizations')),
    /**
     * PSP that owns this subscription. Absent = Stripe (legacy rows).
     * Stripe is card-only and cannot charge ArCa/local Armenian cards, so
     * local providers (Idram, Ameriabank/ArCa) activate subscriptions through
     * their own webhooks — `stripeCustomerId`/`stripeSubscriptionId` stay
     * empty for them and `providerRef` carries the PSP-side reference.
     */
    paymentProvider: v.optional(
      v.union(
        v.literal('stripe'),
        v.literal('idram'),
        v.literal('ameriabank'),
        v.literal('ardshinbank'),
        v.literal('fastbank'),
      ),
    ),
    /** PSP-side payment/subscription reference for non-Stripe providers. */
    providerRef: v.optional(v.string()),
    /** Currency the subscription is billed in (AMD for local providers). */
    billingCurrency: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    plan: v.union(v.literal('starter'), v.literal('professional'), v.literal('enterprise')),
    status: v.union(
      v.literal('trialing'),
      v.literal('active'),
      v.literal('past_due'),
      v.literal('canceled'),
      v.literal('incomplete'),
    ),
    email: v.optional(v.string()),
    userId: v.optional(v.id('users')),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    trialEnd: v.optional(v.number()),
    metadata: v.optional(
      v.object({
        manual: v.optional(v.boolean()),
        customPrice: v.optional(v.number()),
        notes: v.optional(v.string()),
        createdBy: v.optional(v.id('users')),
        createdAt: v.optional(v.number()),
      }),
    ),
    // Plan-editor linkage: the billingPlans row + the published version the
    // subscriber signed up on (billingPlanVersions.version). Overrides are a
    // JSON blob of per-org limit/price adjustments granted manually.
    planId: v.optional(v.id('billingPlans')),
    planVersion: v.optional(v.number()),
    overrides: v.optional(v.string()),
    // Per-org custom Enterprise deal: a full PlanSnapshot JSON (plan + module
    // entitlements) granted by the superadmin. When present it takes priority
    // over the published catalog snapshot, so each Enterprise customer gets
    // exactly the modules and limits they paid for.
    customSnapshot: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_stripe_subscription', ['stripeSubscriptionId'])
    .index('by_status', ['status'])
    .index('by_user', ['userId'])
    .index('by_email', ['email']),

  contactInquiries: defineTable({
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    teamSize: v.optional(v.string()),
    message: v.string(),
    plan: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_created', ['createdAt']),

  maintenanceMode: defineTable({
    organizationId: v.id('organizations'),
    isActive: v.boolean(),
    title: v.string(),
    message: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    estimatedDuration: v.optional(v.string()),
    icon: v.optional(v.string()),
    enabledBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_active', ['isActive']),

  scheduledJobs: defineTable({
    organizationId: v.id('organizations'),
    functionName: v.string(),
    schedule: v.string(),
    isActive: v.boolean(),
    lastRun: v.optional(v.number()),
    nextRun: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_active', ['organizationId', 'isActive'])
    .index('by_function', ['functionName']),

  /**
   * Per-organization branding configuration.
   * Exactly one row per org — upserted by the saveBranding mutation.
   */
  orgBranding: defineTable({
    organizationId: v.id('organizations'),
    // Light theme colors
    primaryColor: v.string(),
    secondaryColor: v.string(),
    accentColor: v.string(),
    // Dark theme color overrides (optional — falls back to light when absent)
    primaryColorDark: v.optional(v.string()),
    secondaryColorDark: v.optional(v.string()),
    accentColorDark: v.optional(v.string()),
    // Typography
    headingFont: v.optional(v.string()),
    bodyFont: v.optional(v.string()),
    // Custom CSS injection (power users)
    customCss: v.optional(v.string()),
    // Assets
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    brandName: v.optional(v.string()),
    // White-label
    enableWhiteLabel: v.boolean(),
    hidePoweredBy: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_org', ['organizationId']),

  /**
   * Local payment-provider credentials (Idram, ArCa acquiring banks).
   * One row per provider. `secretKey` is write-only — queries strip it before
   * returning, the same convention integrations.ts uses for imidAccessToken.
   */
  paymentProviderConfigs: defineTable({
    provider: v.union(
      v.literal('idram'),
      v.literal('ameriabank'),
      v.literal('ardshinbank'),
      v.literal('fastbank'),
    ),
    isEnabled: v.boolean(),
    /** Merchant/shop identifier assigned by the PSP. */
    merchantId: v.optional(v.string()),
    /** HMAC secret for PSP webhook verification (server-only). */
    secretKey: v.optional(v.string()),
    /** Endpoint override for sandbox/testing. */
    apiUrl: v.optional(v.string()),
    /** Success/failure landing paths on the app (defaults when absent). */
    successPath: v.optional(v.string()),
    failPath: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_provider', ['provider']),

  /**
   * One row per local checkout. The PSP webhook flips `pending` → `paid`
   * (idempotent by `orderId`), and activation copies the plan onto the
   * subscription + organization exactly like the Stripe path does.
   */
  localPayments: defineTable({
    organizationId: v.optional(v.id('organizations')),
    provider: v.union(
      v.literal('idram'),
      v.literal('ameriabank'),
      v.literal('ardshinbank'),
      v.literal('fastbank'),
    ),
    /** PSP-agnostic short order id — unique, traceable in both systems. */
    orderId: v.string(),
    plan: v.union(v.literal('starter'), v.literal('professional'), v.literal('enterprise')),
    /** Months purchased up front (local PSPs rarely do true subscriptions). */
    months: v.optional(v.number()),
    amountUsd: v.number(),
    /** Amount converted to AMD by the client at the displayed FX rate. */
    amountAmd: v.optional(v.number()),
    status: v.union(
      v.literal('pending'),
      v.literal('paid'),
      v.literal('failed'),
      v.literal('cancelled'),
    ),
    providerRef: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_order', ['orderId'])
    .index('by_org', ['organizationId'])
    .index('by_status', ['status']),
};
