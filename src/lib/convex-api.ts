/**
 * Safe Convex API wrapper to prevent TS2589 "Type instantiation is excessively deep" errors.
 * 
 * This utility isolates Convex API references to break recursive type instantiation chains.
 * Use these typed helpers instead of direct `api.module.function` access.
 */

import { api } from '@/convex/_generated/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = any;

/**
 * Type-safe API reference extractor.
 * Breaks the recursive type chain by casting to a simpler type.
 */
function safeApiRef<T extends string>(path: T): AnyFunction {
  // Navigate the API tree at runtime, but break type recursion
  const parts = path.split('.');
  let current: unknown = api;
  
  for (const part of parts) {
    current = (current as Record<string, unknown>)[part];
  }
  
  return current as AnyFunction;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pre-typed API references for common modules
// Add new references here as needed
// ═══════════════════════════════════════════════════════════════════════════

// Drivers module
export const driversApi = {
  addFavorite: safeApiRef('drivers.driver_registration.addFavoriteDriver'),
  removeFavorite: safeApiRef('drivers.driver_registration.removeFavoriteDriver'),
  getDriverSchedule: safeApiRef('drivers.queries.getDriverSchedule'),
  registerDriver: safeApiRef('drivers.driver_registration.registerDriver'),
  getDrivers: safeApiRef('drivers.queries.getDrivers'),
  getDriverById: safeApiRef('drivers.queries.getDriverById'),
  createRequest: safeApiRef('drivers.requests_mutations.createRequest'),
  getRequests: safeApiRef('drivers.requests_queries.getRequests'),
  updateRequestStatus: safeApiRef('drivers.requests_mutations.updateRequestStatus'),
} as const;

// Chat module
export const chatApi = {
  getConversations: safeApiRef('chat.queries.getConversations'),
  getMessages: safeApiRef('chat.queries.getMessages'),
  sendMessage: safeApiRef('chat.mutations.sendMessage'),
  createConversation: safeApiRef('chat.mutations.createConversation'),
  markAsRead: safeApiRef('chat.mutations.markAsRead'),
} as const;

// Tickets/Help module
export const ticketsApi = {
  getMyTickets: safeApiRef('tickets.getMyTickets'),
  createTicket: safeApiRef('tickets.createTicket'),
  updateTicket: safeApiRef('tickets.updateTicket'),
  getTicketById: safeApiRef('tickets.getTicketById'),
} as const;

// Users module
export const usersApi = {
  getUserByEmail: safeApiRef('users.queries.getUserByEmail'),
  getUserById: safeApiRef('users.queries.getUserById'),
  updateUser: safeApiRef('users.mutations.updateUser'),
} as const;

// Leaves module
export const leavesApi = {
  getUserLeaves: safeApiRef('leaves.getUserLeaves'),
  createLeaveRequest: safeApiRef('leaves.mutations.createLeaveRequest'),
  approveLeave: safeApiRef('leaves.mutations.approveLeave'),
} as const;

// Organizations module
export const organizationsApi = {
  getOrganization: safeApiRef('organizations.getOrganization'),
  updateOrganization: safeApiRef('organizations.updateOrganization'),
} as const;

// Automation module
export const automationApi = {
  runAutomation: safeApiRef('automation.runAutomation'),
  getAutomations: safeApiRef('automation.getAutomations'),
  createAutomation: safeApiRef('automationMutations.createAutomation'),
} as const;

// Superadmin module
export const superadminApi = {
  globalSearch: safeApiRef('superadmin.search.globalSearch'),
  getStats: safeApiRef('superadmin.dashboard.getStats'),
} as const;

/**
 * Generic escape hatch - use sparingly when pre-typed references aren't available.
 * 
 * @example
 * const myApiRef = getSafeApiRef('myModule.myFunction');
 */
export function getSafeApiRef(path: string): AnyFunction {
  return safeApiRef(path);
}
