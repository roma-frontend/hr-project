/**
 * Marketplace catalog invariants.
 *
 * The catalog is the source of truth for two very different surfaces — the
 * in-app installer and the public SEO page — so a bad entry is a marketing
 * claim, not just a broken card. These tests guard the properties that make the
 * "available" badge honest.
 */
import {
  MARKETPLACE_APPS,
  CATEGORY_ORDER,
  appStatus,
  appsByCategory,
  catalogStats,
  getApp,
  isSelfInstallable,
  matchesQuery,
  populatedCategories,
  type MarketplaceApp,
} from '@/lib/marketplace';
import { WEBHOOK_EVENT_TYPES } from '../../convex/webhooks/protocol';
import enMarketplace from '../../public/locales/en/marketplace.json';

/**
 * Tab values the settings page actually renders. Kept in sync with the `tabs`
 * array in `src/app/(dashboard)/settings/page.tsx`: a marketplace deep link to a
 * tab that no longer exists would silently drop the admin on the default tab, so
 * the test fails instead.
 */
const SETTINGS_TABS = [
  'productivity',
  'notifications',
  'security',
  'advanced-security',
  'appearance',
  'dashboard',
  'localization',
  'integrations',
  'billing',
  'admin',
  'branding',
  'ai-governance',
  'meeting-rooms',
  'sso',
  'saml',
  'webhooks',
  'scim',
  'api',
];

const webhookApps = MARKETPLACE_APPS.filter(
  (app): app is MarketplaceApp & { setup: { kind: 'webhook'; defaultEvents: string[] } } =>
    app.setup.kind === 'webhook',
);

const settingsApps = MARKETPLACE_APPS.filter(
  (app): app is MarketplaceApp & { setup: { kind: 'settings'; href: string } } =>
    app.setup.kind === 'settings',
);

describe('marketplace catalog', () => {
  it('has unique, url-safe ids', () => {
    const ids = MARKETPLACE_APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9]*$/);
    }
  });

  it('assigns every app to a known category', () => {
    for (const app of MARKETPLACE_APPS) {
      expect(CATEGORY_ORDER).toContain(app.category);
    }
  });

  it('exposes one locale key path per app, so no card can render raw keys', () => {
    // The i18n parity check guarantees all four locales carry the same keys; this
    // asserts the catalog and the namespace agree on the key names themselves.
    const apps = enMarketplace.marketplace.apps as Record<string, { description?: string }>;
    for (const app of MARKETPLACE_APPS) {
      const entry = apps[app.id];
      expect(entry).toBeDefined();
      expect(typeof entry?.description).toBe('string');
      expect(entry?.description?.length).toBeGreaterThan(0);
    }
  });

  it('never marks a "coming" app as installable', () => {
    for (const app of MARKETPLACE_APPS) {
      if (app.setup.kind === 'coming') {
        expect(appStatus(app)).toBe('coming');
        expect(isSelfInstallable(app)).toBe(false);
        // No href anywhere: a coming app must not link to a setup surface.
        expect((app.setup as { href?: string }).href).toBeUndefined();
      } else {
        expect(appStatus(app)).toBe('available');
      }
    }
  });

  it('subscribes webhook apps only to real event types', () => {
    expect(webhookApps.length).toBeGreaterThan(0);
    for (const app of webhookApps) {
      for (const event of app.setup.defaultEvents) {
        expect(WEBHOOK_EVENT_TYPES as readonly string[]).toContain(event);
      }
    }
  });

  it('keeps every settings deep link on a route that exists', () => {
    expect(settingsApps.length).toBeGreaterThan(0);
    for (const app of settingsApps) {
      expect(app.setup.href.startsWith('/')).toBe(true);
      const [path, query] = app.setup.href.split('?');
      expect(['/settings', '/admin/integrations']).toContain(path);
      if (query) {
        const tab = new URLSearchParams(query).get('tab');
        expect(tab).not.toBeNull();
        expect(SETTINGS_TABS).toContain(tab as string);
      }
    }
  });

  it('derives stats from the same rule the badges use', () => {
    const stats = catalogStats();
    expect(stats.total).toBe(MARKETPLACE_APPS.length);
    expect(stats.available + stats.coming).toBe(stats.total);
    expect(stats.available).toBe(
      MARKETPLACE_APPS.filter((app) => appStatus(app) === 'available').length,
    );
  });

  it('orders each category popular-first and lists only populated ones', () => {
    for (const category of CATEGORY_ORDER) {
      const apps = appsByCategory(category);
      const weights = apps.map((app) => app.weight);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
    }
    const populated = populatedCategories();
    expect(populated).toEqual(CATEGORY_ORDER.filter((c) => appsByCategory(c).length > 0));
    expect(populated.length).toBeGreaterThan(0);
  });

  it('finds apps by name or id, case-insensitively', () => {
    const slack = getApp('slack');
    expect(slack).toBeDefined();
    expect(matchesQuery(slack!, 'sla')).toBe(true);
    expect(matchesQuery(slack!, 'SLACK')).toBe(true);
    expect(matchesQuery(slack!, 'nope')).toBe(false);
    expect(matchesQuery(slack!, '   ')).toBe(true);
    expect(getApp('does-not-exist')).toBeUndefined();
  });
});
