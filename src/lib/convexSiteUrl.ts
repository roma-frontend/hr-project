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

/**
 * Deployment origin, normalised: `https://<deployment>.convex.cloud`.
 *
 * `NEXT_PUBLIC_CONVEX_URL` is written two ways in the wild — with and without
 * the client's `/api` path (`convex/_generated` and the client SDK accept
 * either). For building another host out of it, and for probing the deployment
 * itself, the suffix has to go: `.convex.site/api` is not a host we serve.
 */
export function convexDeploymentUrl(): string {
  return (process.env.NEXT_PUBLIC_CONVEX_URL ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
    .replace(/\/+$/, '');
}

export function convexSiteUrl(): string {
  return convexDeploymentUrl().replace(/\.convex\.cloud$/, '.convex.site');
}

/** Base URL of the public API v1 surface. */
export function publicApiBaseUrl(): string {
  return `${convexSiteUrl()}/api/v1`;
}
