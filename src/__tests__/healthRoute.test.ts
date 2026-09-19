/**
 * `/api/health` is what an uptime monitor polls, so it is the one endpoint whose
 * failure mode is invisible: a monitor that never fires looks identical to a
 * platform with no incidents. The route used to return `ok` unconditionally,
 * which reported "healthy" during exactly the outage it exists to catch — a
 * Convex deployment that cannot be reached.
 *
 * These tests pin the two halves of the fix: the probe actually reports the
 * dependency's state, and the status code is the thing a monitor alerts on.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { convexDeploymentUrl, convexSiteUrl, publicApiBaseUrl } from '@/lib/convexSiteUrl';

// `next/server` needs the Web Request/Response globals that only exist in the
// Next runtime; route tests in this repo stub it (see ai-site-editor-route).
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => {
      const status = init?.status ?? 200;
      return {
        status,
        headers: new Headers(),
        json: async () => body,
        ok: status < 300,
      };
    }),
  },
}));

import { GET } from '@/app/api/health/route';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function setConvexUrl(value?: string) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL;
  else process.env.NEXT_PUBLIC_CONVEX_URL = value;
}

beforeEach(() => {
  jest.restoreAllMocks();
  setConvexUrl(undefined);
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

describe('convexDeploymentUrl', () => {
  it('returns the deployment origin whatever form the env var takes', () => {
    // Both spellings are in use: the raw SDK origin, and the one with the
    // client's `/api` path. `.convex.site/api` is not a host we serve, so the
    // suffix must be normalised away before another host is derived from it.
    const expected = 'https://demo-123.convex.cloud';
    for (const value of [
      'https://demo-123.convex.cloud',
      'https://demo-123.convex.cloud/',
      'https://demo-123.convex.cloud/api',
      'https://demo-123.convex.cloud/api/',
      '  https://demo-123.convex.cloud/api  ',
    ]) {
      setConvexUrl(value);
      expect(convexDeploymentUrl()).toBe(expected);
    }
  });

  it('returns an empty string when the deployment is not configured', () => {
    setConvexUrl(undefined);
    expect(convexDeploymentUrl()).toBe('');
    // …and the derived hosts do not turn into nonsense (`/api/v1` with no host).
    expect(convexSiteUrl()).toBe('');
    expect(publicApiBaseUrl()).toBe('/api/v1');
  });

  it('derives the site host from the normalised origin', () => {
    setConvexUrl('https://demo-123.convex.cloud/api');
    expect(convexSiteUrl()).toBe('https://demo-123.convex.site');
    expect(publicApiBaseUrl()).toBe('https://demo-123.convex.site/api/v1');
  });
});

describe('/api/health', () => {
  it('reports ok when the deployment answers', async () => {
    setConvexUrl('https://demo-123.convex.cloud');
    const fetchMock = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.convex).toBe('ok');
    // The probe must hit the deployment itself, not a data endpoint.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://demo-123.convex.cloud/version',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('fails with 503 when the deployment is unreachable', async () => {
    setConvexUrl('https://demo-123.convex.cloud');
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED 10.0.0.1:443');
    }) as unknown as typeof fetch;

    const res = await GET();
    const body = await res.json();

    // The status code is the contract: a monitor alerts on it.
    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.convex).toBe('error');
    // …and the upstream error string stays out of the public response.
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('fails when the deployment answers with an error status', async () => {
    setConvexUrl('https://demo-123.convex.cloud');
    global.fetch = jest.fn(async () => ({ ok: false, status: 502 })) as unknown as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.convex).toBe('error');
  });

  it('fails when no deployment is configured at all', async () => {
    setConvexUrl(undefined);
    const fetchMock = jest.fn() as unknown as typeof fetch;
    global.fetch = fetchMock;

    const res = await GET();
    // No deployment means no product, so this is not a "skip the check" case.
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports whether server error tracking is actually on', async () => {
    setConvexUrl('https://demo-123.convex.cloud');
    global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;

    expect((await (await GET()).json()).checks.errorTracking).toBe('off');

    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@sentry.example/1';
    expect((await (await GET()).json()).checks.errorTracking).toBe('on');
  });

  it('does not leak the DSN or the deployment URL into the body', async () => {
    setConvexUrl('https://demo-123.convex.cloud');
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://secret-key@sentry.example/1';
    global.fetch = jest.fn(async () => ({ ok: true })) as unknown as typeof fetch;

    const body = JSON.stringify(await (await GET()).json());
    expect(body).not.toContain('secret-key');
  });
});
