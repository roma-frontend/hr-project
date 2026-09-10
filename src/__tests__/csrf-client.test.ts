/**
 * Tests for src/lib/csrf-client.ts
 *
 * Covers token caching, in-flight de-duplication, the 403 retry dance and the
 * graceful degradation when the token endpoint is unavailable. The module keeps
 * module-level state, so every test re-requires it after `resetModules`.
 */

jest.mock('@/lib/logger', () => ({ logger: { log: jest.fn() } }));

type Csrf = { postJsonWithCsrf: typeof import('@/lib/csrf-client').postJsonWithCsrf };

function loadModule(): Csrf {
  return require('@/lib/csrf-client') as Csrf;
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ token: 'tok', signature: 'sig' }),
    ...overrides,
  };
}

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  fetchMock = jest.fn();
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

describe('postJsonWithCsrf', () => {
  it('fetches a token then POSTs with CSRF headers and JSON body', async () => {
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ status: 200 }));

    const { postJsonWithCsrf } = loadModule();
    const res = await postJsonWithCsrf('/api/thing', { a: 1 });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/csrf-token', { method: 'GET' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/thing',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ a: 1 }),
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'tok',
          'X-CSRF-Token-Signature': 'sig',
        },
      }),
    );
  });

  it('passes the AbortSignal through to the POST', async () => {
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response());
    const controller = new AbortController();

    const { postJsonWithCsrf } = loadModule();
    await postJsonWithCsrf('/api/thing', {}, controller.signal);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/thing',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('omits CSRF headers when the token endpoint fails', async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: false })).mockResolvedValueOnce(response());

    const { postJsonWithCsrf } = loadModule();
    await postJsonWithCsrf('/api/thing', {});

    const postCall = fetchMock.mock.calls[1][1] as { headers: Record<string, string> };
    expect(postCall.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('omits CSRF headers when the token payload is incomplete', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ json: async () => ({ token: 'only' }) }))
      .mockResolvedValueOnce(response());

    const { postJsonWithCsrf } = loadModule();
    await postJsonWithCsrf('/api/thing', {});

    const postCall = fetchMock.mock.calls[1][1] as { headers: Record<string, string> };
    expect(postCall.headers).not.toHaveProperty('X-CSRF-Token');
  });

  it('survives a throwing token request and logs', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response());

    const { postJsonWithCsrf } = loadModule();
    const res = await postJsonWithCsrf('/api/thing', {});

    expect(res.status).toBe(200);
    const { logger } = require('@/lib/logger');
    expect(logger.log).toHaveBeenCalledWith('CSRF token fetch failed:', 'Error: network');
  });

  it('caches the token across calls', async () => {
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response());

    const { postJsonWithCsrf } = loadModule();
    await postJsonWithCsrf('/api/a', {});
    await postJsonWithCsrf('/api/b', {});

    const tokenCalls = fetchMock.mock.calls.filter((c) => c[0] === '/api/csrf-token');
    expect(tokenCalls).toHaveLength(1);
  });

  it('shares one in-flight token request between concurrent callers', async () => {
    let resolveToken: (v: unknown) => void = () => {};
    const tokenPromise = new Promise((resolve) => {
      resolveToken = resolve;
    });
    fetchMock
      .mockReturnValueOnce(tokenPromise)
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response());

    const { postJsonWithCsrf } = loadModule();
    const p1 = postJsonWithCsrf('/api/a', {});
    const p2 = postJsonWithCsrf('/api/b', {});

    resolveToken(response());
    await Promise.all([p1, p2]);

    const tokenCalls = fetchMock.mock.calls.filter((c) => c[0] === '/api/csrf-token');
    expect(tokenCalls).toHaveLength(1);
  });

  it('retries once with a fresh token after a 403', async () => {
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ status: 403, ok: false }))
      .mockResolvedValueOnce(response({ json: async () => ({ token: 'new', signature: 'newS' }) }))
      .mockResolvedValueOnce(response({ status: 200 }));

    const { postJsonWithCsrf } = loadModule();
    const res = await postJsonWithCsrf('/api/thing', {});

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/csrf-token', { method: 'GET' });
    const retryCall = fetchMock.mock.calls[3][1] as { headers: Record<string, string> };
    expect(retryCall.headers['X-CSRF-Token']).toBe('new');
    expect(retryCall.headers['X-CSRF-Token-Signature']).toBe('newS');
  });

  it('returns the original 403 when the fresh token cannot be fetched', async () => {
    const forbidden = response({ status: 403, ok: false });
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(forbidden)
      .mockResolvedValueOnce(response({ ok: false }));

    const { postJsonWithCsrf } = loadModule();
    const res = await postJsonWithCsrf('/api/thing', {});

    expect(res).toBe(forbidden);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-403 responses', async () => {
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ status: 500, ok: false }));

    const { postJsonWithCsrf } = loadModule();
    const res = await postJsonWithCsrf('/api/thing', {});

    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
