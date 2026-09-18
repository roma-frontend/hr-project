/**
 * Strata Zapier app — REST hooks over the public API v1.
 *
 * The trigger is a REST hook: Zapier tells Strata its catch-hook URL on enable
 * and Strata pushes every subscribed event there through the same delivery
 * engine (HMAC signature, retries, delivery log) that Settings → Webhooks uses.
 * Strata needs no knowledge of Zapier, and the Zap keeps working if the user
 * rewrites the Zap.
 *
 * The app is deliberately thin: everything it can do, a customer's own service
 * can do with the same three calls (`POST/GET/DELETE /api/v1/webhooks`).
 */
const authentication = require('./authentication');
const newEvent = require('./triggers/new_event');

/** Every request carries the tenant's API key. */
const addBearerHeader = (request, z, bundle) => {
  if (bundle.authData.apiKey) {
    request.headers.Authorization = `Bearer ${bundle.authData.apiKey}`;
  }
  return request;
};

/** A 401/403 from the platform should read as an auth problem in the Zap editor. */
const handleAuthErrors = (response, z) => {
  if (response.status === 401 || response.status === 403) {
    throw new z.errors.Error(
      'Strata refused the API key. Create a key in Settings → API under Profile and check that it has the webhooks:write scope.',
      'AuthenticationError',
      response.status,
    );
  }
  return response;
};

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,
  beforeRequest: [addBearerHeader],
  afterResponse: [handleAuthErrors],

  triggers: {
    [newEvent.key]: newEvent,
  },

  // No searches/creates yet: the public API v1 is read-only for people data and
  // the only write surface is webhook subscriptions. Adding an action that
  // cannot really write would be worse than shipping without one.
};
