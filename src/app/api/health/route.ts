import { NextResponse } from 'next/server';
import { convexDeploymentUrl } from '@/lib/convexSiteUrl';

/**
 * Health check for uptime monitors and load balancers.
 *
 * This endpoint used to answer `ok` unconditionally, which made it useless for
 * the one job it has. The product is unusable when the Convex deployment is
 * unreachable — every page reads from it — and that is exactly the failure it
 * kept reporting as healthy: an uptime monitor pointed here stayed green while
 * everyone saw errors. It now probes the dependency it cannot work without and
 * answers 503 when that probe fails, so the alert fires on the outage rather
 * than on the first customer call.
 *
 * What it deliberately does NOT do:
 *   - run a database query. Convex's own `/version` answers from the deployment
 *     without touching any table, so a probe every 30 seconds costs nothing and
 *     cannot be mistaken for an incident of its own;
 *   - report *why* the probe failed. An upstream error string belongs in logs,
 *     not on a public, unauthenticated endpoint;
 *   - claim anything about services it cannot see from here (Resend, Stripe,
 *     Sentry ingestion). A health check that guesses is worse than a narrow one.
 */

/** Short enough for a monitor's own timeout, long enough for a cold deployment. */
const PROBE_TIMEOUT_MS = 2500;

async function probeConvex(): Promise<'ok' | 'error'> {
  const deployment = convexDeploymentUrl();
  if (!deployment) return 'error';

  try {
    const res = await fetch(`${deployment}/version`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const convex = await probeConvex();

  // Whether server errors are actually being captured. `sentry.server.config.ts`
  // disables the SDK when the DSN is absent, so a production deploy without it
  // fails silently into the void. Reported, not fatal: the product still works
  // for users, and a 503 here would take the whole platform out of a monitor's
  // view for a config warning.
  const errorTracking = process.env.NEXT_PUBLIC_SENTRY_DSN ? 'on' : 'off';

  const healthy = convex === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: Date.now(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime ? Math.round(process.uptime()) : 0,
      checks: { convex, errorTracking },
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
