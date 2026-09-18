/**
 * Authentication — a Strata API key (Settings → API).
 *
 * The key needs `webhooks:read` + `webhooks:write` for the REST-hook trigger,
 * and the read scopes for the sample-data calls (`leaves:read` for the test
 * payload). `webhooks:write` is a separate scope on purpose: the customer has to
 * agree that a Zap may register a callback URL on their tenant.
 *
 * `baseUrl` is a field rather than a constant because the API lives on the
 * customer's own Convex deployment (`https://<deployment>.convex.site/api/v1`).
 */
const testAuth = async (z, bundle) => {
  const response = await z.request({
    url: `${bundle.authData.baseUrl.replace(/\/$/, '')}/me`,
    method: 'GET',
  });
  return response.json;
};

module.exports = {
  type: 'custom',
  test: testAuth,
  fields: [
    {
      key: 'baseUrl',
      label: 'API base URL',
      required: true,
      helpText:
        'Your Strata deployment, e.g. `https://happy-otter-123.convex.site/api/v1` — the value shown in Settings → API.',
      default: 'https://your-deployment.convex.site/api/v1',
    },
    {
      key: 'apiKey',
      label: 'API key',
      required: true,
      helpText:
        'Create one in Settings → API. It needs the webhooks:write scope so the Zap can register its callback URL.',
    },
  ],
  connectionLabel: '{{bundle.authData.baseUrl}}',
};
