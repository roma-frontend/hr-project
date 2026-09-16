import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Succession planning (ROADMAP 2.7).
 *
 * Four tables: nine-box ratings (performance × potential), key positions,
 * successor assignments, and development plans that can point at a learning
 * course. Risk assessment is computed on read from positions + successors —
 * storing it would go stale the moment a successor is reassigned.
 */
export const succession = {
  /** 3×3 grid: performance 1..3 × potential 1..3, rated per employee per cycle. */
  nineBoxRatings: defineTable({
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    /** Cycle label, e.g. '2026-H1' — free text so the org controls cadence. */
    period: v.string(),
    /** 1 = below expectations, 2 = meets, 3 = exceeds. */
    performance: v.union(v.literal(1), v.literal(2), v.literal(3)),
    /** 1 = limited, 2 = growing, 3 = high. */
    potential: v.union(v.literal(1), v.literal(2), v.literal(3)),
    notes: v.optional(v.string()),
    ratedBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org_period', ['organizationId', 'period'])
    .index('by_org_employee', ['organizationId', 'employeeId']),

  /** A role whose vacancy would hurt: the thing succession exists to protect. */
  keyPositions: defineTable({
    organizationId: v.id('organizations'),
    /** Position title snapshot — positions are free text in the org's users. */
    positionTitle: v.string(),
    department: v.optional(v.string()),
    /** How much the role matters to continuity. */
    criticality: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
    /** How damaging an unplanned vacancy would be. */
    vacancyRisk: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
    incumbentId: v.optional(v.id('users')),
    notes: v.optional(v.string()),
    /** Soft-archive so historical successors stay attached. */
    isArchived: v.optional(v.boolean()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_org_archived', ['organizationId', 'isArchived'])
    .index('by_incumbent', ['incumbentId']),

  /** Who could step into a key position, and how soon. */
  successors: defineTable({
    organizationId: v.id('organizations'),
    keyPositionId: v.id('keyPositions'),
    successorId: v.id('users'),
    readiness: v.union(
      v.literal('ready_now'),
      v.literal('ready_within_year'),
      v.literal('ready_within_two_years'),
      v.literal('development_needed'),
    ),
    notes: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org', ['organizationId'])
    .index('by_position', ['keyPositionId'])
    .index('by_successor', ['successorId']),

  /** A growth plan for one employee; actions are small, dated steps. */
  developmentPlans: defineTable({
    organizationId: v.id('organizations'),
    employeeId: v.id('users'),
    title: v.string(),
    description: v.optional(v.string()),
    /** Optional learning course that carries the skill part of the plan. */
    courseId: v.optional(v.id('courses')),
    actions: v.array(
      v.object({
        key: v.string(),
        title: v.string(),
        dueDate: v.optional(v.number()),
        completed: v.boolean(),
        completedAt: v.optional(v.number()),
      }),
    ),
    status: v.union(v.literal('draft'), v.literal('active'), v.literal('completed')),
    dueDate: v.optional(v.number()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_org_status', ['organizationId', 'status'])
    .index('by_org_employee', ['organizationId', 'employeeId']),
};
