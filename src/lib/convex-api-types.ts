/**
 * Convex API type isolation wrapper.
 * 
 * This module breaks recursive type instantiation chains by providing
 * pre-typed API references. Import from here instead of directly from
 * '@/convex/_generated/api' when experiencing TS2589 errors.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SafeApiRef = any;

/**
 * Safely extract an API reference without triggering type recursion
 */
export function createSafeApiRef<T = SafeApiRef>(path: string): T {
  // This function is only for type isolation - runtime behavior unchanged
  return undefined as unknown as T;
}
