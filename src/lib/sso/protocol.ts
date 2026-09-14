/**
 * Client-safe re-export of the pure SSO protocol helpers.
 *
 * Next.js routes are bundled from the client graph and the `convex/` directory
 * is outside the webpack root, so the routes under src/app/api/sso/* import
 * from here. The single implementation lives in convex/sso/protocol.ts.
 */
export { randomToken, timingSafeEqual, normalizeIssuer } from '../../../convex/sso/protocol';
