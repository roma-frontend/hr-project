/**
 * Publication bundles (`integrations/`) must not drift from the platform they
 * talk to.
 *
 * These files are not compiled by the web build, so nothing else would catch a
 * Zapier app still calling a removed route, a Slack manifest whose scope no
 * longer matches, or a partner event list that forgot about half of
 * `WEBHOOK_EVENT_TYPES`. That drift only surfaces once a customer installs the
 * published app — the most expensive moment to find out.
 *
 * @jest-environment node
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { WEBHOOK_EVENT_TYPES } from '../../convex/webhooks/protocol';
import { MARKETPLACE_APPS, appStatus } from '../../src/lib/marketplace';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');
const readJson = (relative: string) => JSON.parse(read(relative));

describe('Slack app manifest', () => {
  const manifest = readJson('integrations/slack/manifest.json');

  it('is a versioned manifest that enables Incoming Webhooks', () => {
    expect(manifest._metadata.major_version).toBe(2);
    expect(manifest.settings.incoming_webhooks.incoming_webhooks_enabled).toBe(true);
    expect(manifest.oauth_config.scopes.bot).toContain('incoming-webhook');
  });

  it('requests nothing beyond posting, and no outbound-only settings', () => {
    // Every extra scope is something a reviewer has to justify; Strata reads
    // nothing from the workspace, so anything else is a mistake.
    expect(manifest.oauth_config.scopes.bot).toStrictEqual(['incoming-webhook']);
    expect(manifest.settings.socket_mode_enabled).toBe(false);
    expect(manifest.settings.event_subscriptions).toBeUndefined();
  });

  it('omits long_description rather than shipping one Slack would reject', () => {
    // Slack errors on a long_description shorter than 174 characters.
    const long = manifest.display_information.long_description;
    expect(long === undefined || long.length >= 174).toBe(true);
  });
});

describe('Zapier app', () => {
  const index = read('integrations/zapier/index.js');
  const trigger = read('integrations/zapier/triggers/new_event.js');
  const auth = read('integrations/zapier/authentication.js');

  it('wires the trigger and the auth module through the app definition', () => {
    expect(index).toContain('./triggers/new_event');
    expect(index).toContain('./authentication');
    expect(index).toContain('beforeRequest');
  });

  it('registers and removes its callback URL through the public API v1', () => {
    // The REST-hook pair the platform exposes; a rename here breaks every Zap.
    expect(trigger).toContain('/webhooks');
    expect(trigger).toMatch(/method: 'POST'/);
    expect(trigger).toMatch(/method: 'DELETE'/);
    expect(trigger).toContain("appId: 'zapier'");
    expect(auth).toContain('/me');
  });

  it('sends the key as a bearer token', () => {
    expect(index).toContain('Bearer');
  });

  it('documents every event type the platform can emit', () => {
    // The help text is the only place a Zap author sees the list, so a new
    // event type that is missing there is invisible to integrators.
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      expect(trigger).toContain(eventType);
    }
  });
});

describe('catalog ↔ bundles', () => {
  const appFor = (id: string) => MARKETPLACE_APPS.find((app) => app.id === id);

  it('publishes bundles only for apps the product can actually install', () => {
    for (const id of ['zapier', 'slack']) {
      const app = appFor(id);
      expect(app).toBeDefined();
      expect(appStatus(app!)).toBe('available');
      expect(app!.setup.kind).toBe('webhook');
    }
  });

  it('keeps the installed app id in the catalog vocabulary', () => {
    // `webhookEndpoints.appId` is matched against these ids in the marketplace.
    const zapierTrigger = read('integrations/zapier/triggers/new_event.js');
    const declared = zapierTrigger.match(/appId: '([a-z0-9-]+)'/)?.[1];
    expect(declared).toBe('zapier');
    expect(appFor(declared!)).toBeDefined();
  });
});

describe('documentation', () => {
  it('documents the delivery protocol the partners integrate against', () => {
    const doc = read('docs/webhooks.md');
    // The dedupe header and the signing recipe are the two things a receiver
    // cannot guess; both must stay documented.
    expect(doc).toContain('x-webhook-id');
    expect(doc).toContain('x-webhook-signature');
    expect(doc).toContain('HMAC-SHA256');
  });

  it('keeps a runbook for the vendor directories', () => {
    expect(existsSync(join(root, 'docs/integration-publishing.md'))).toBe(true);
    expect(read('docs/integration-publishing.md')).toContain('api/v1/webhooks');
  });
});
