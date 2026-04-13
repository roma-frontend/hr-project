'use client';

import { useMaintenanceAutoLogout } from '@/hooks/useMaintenanceAutoLogout';
import { useConvexAuthReady } from '@/lib/convex';

/**
 * Component that handles auto-logout when maintenance mode is detected
 * This runs on all protected pages and logs out users when maintenance starts
 * Only activates when Convex is ready to prevent hook errors on static pages.
 */
export function MaintenanceAutoLogout() {
  const isConvexReady = useConvexAuthReady();

  if (!isConvexReady) {
    return null;
  }

  useMaintenanceAutoLogout();
  return null;
}
