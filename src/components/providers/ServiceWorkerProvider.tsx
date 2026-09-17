'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker for the whole app (landing + dashboard).
 *
 * Before this existed, `/sw.js` was only registered when a user explicitly
 * subscribed to push notifications, so offline caching and the install
 * experience never activated for anyone else. Mounted once in `AppProviders`.
 *
 * Registration is skipped in development: the SW's network-first navigations
 * would still cache Turbopack's hashed chunks between runs and serve stale
 * modules. Set `NEXT_PUBLIC_ENABLE_SW=true` to test it locally on purpose.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const explicitlyEnabled = process.env.NEXT_PUBLIC_ENABLE_SW === 'true';
    if (process.env.NODE_ENV !== 'production' && !explicitlyEnabled) return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Pick up a new worker on the next load instead of waiting for every
          // tab to close.
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(() => {
          /* Registration is best-effort — the app works without it. */
        });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
