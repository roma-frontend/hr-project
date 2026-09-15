/**
 * The Convex deployment serves two different hosts and it matters which one a
 * URL points at:
 *
 *   - `NEXT_PUBLIC_CONVEX_URL`  → `https://<deployment>.convex.cloud` — queries,
 *     mutations, subscriptions (the client SDK).
 *   - the "site" host           → `https://<deployment>.convex.site` — the HTTP
 *     actions registered in `convex/http.ts` (webhooks, SCIM, `/api/v1`).
 *
 * Handing a customer the `.convex.cloud` URL for a webhook or an API call looks
 * plausible and fails opaquely, so both places that display such a URL derive it
 * from here rather than each re-deriving it.
 */
export function convexSiteUrl(): string {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
  return cloud.replace(/\.convex\.cloud\/?$/, '.convex.site').replace(/\/$/, '');
}

/** Base URL of the public API v1 surface. */
export function publicApiBaseUrl(): string {
  return `${convexSiteUrl()}/api/v1`;
}
