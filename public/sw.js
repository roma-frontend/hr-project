/* eslint-disable no-undef */
/**
 * Strata service worker — offline support, push notifications and app quick
 * actions.
 *
 * Strategy summary:
 *   - navigations (HTML): network-first, cache the response, fall back to the
 *     cached page, then to /offline. This is what makes the dashboard usable
 *     after a reload with no connection.
 *   - same-origin static assets (/_next/static, fonts, icons): cache-first with
 *     a background revalidate, so repeat visits paint instantly.
 *   - everything else (Convex queries, API routes, auth): network only — never
 *     cached, because stale HR data is worse than no data.
 *
 * Note: this file is served as-is (not bundled), so it must not import project
 * modules. The previous version called `logger` here, which does not exist in a
 * service-worker scope and threw on every push — replaced with `console`.
 */

const VERSION = 'v3';
const STATIC_CACHE = `strata-static-${VERSION}`;
const PAGE_CACHE = `strata-pages-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.json', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

/** Static assets that are safe to serve from cache first. */
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/models/') ||
    /\.(?:css|js|woff2?|ttf|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever handle GETs; let the browser deal with everything else.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache cross-origin or data requests (Convex, Stripe, auth…).
  if (url.origin !== self.location.origin) return;

  // ── Navigations: network-first with an offline page fallback ──────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(PAGE_CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return Response.error();
        }),
    );
    return;
  }

  // ── Static assets: cache-first, revalidate in the background ──────────────
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

// ── Messages from the app (e.g. activate an updated worker immediately) ──────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Strata',
    body: 'You have a new HR notification.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'strata-notification',
    requireInteraction: false,
    renotify: true,
    vibrate: [300, 100, 300],
    silent: false,
    data: { url: '/dashboard', timestamp: Date.now() },
    actions: [
      { action: 'dismiss', title: 'Dismiss' },
      { action: 'snooze', title: 'Snooze 5 min' },
    ],
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (error) {
      console.error('Failed to parse push data:', error);
    }
  }

  event.waitUntil(self.registration.showNotification(notificationData.title, notificationData));
});

// ── Notification click — also serves the manifest app shortcuts ─────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  if (event.action === 'snooze') {
    setTimeout(
      () => {
        self.registration.showNotification('Strata — snoozed reminder', {
          body: 'Your 5-minute snooze is up.',
          icon: '/icon-192x192.png',
          tag: 'strata-snooze',
        });
      },
      5 * 60 * 1000,
    );
    return;
  }

  // Quick-action deep links (see manifest `shortcuts`).
  const actionUrls = {
    'approve-leave': '/approvals',
    'mark-attendance': '/attendance',
  };
  const targetUrl = actionUrls[event.action] || event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(targetUrl);
          return undefined;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});

// ── Background sync placeholder ─────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    console.info('Background sync triggered');
  }
});
