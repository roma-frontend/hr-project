/**
 * Integration marketplace catalog — the directory behind `/marketplace`
 * (in-app) and `/integrations` (public, SEO).
 *
 * This module holds NO human-readable prose: every string is resolved by key
 * from the `marketplace` locale namespace (en/ru/hy/de). What lives here is the
 * catalog shape, the honest availability status, and — most importantly — how
 * each app is actually installed.
 *
 * Availability is derived, never hand-written:
 *   - `webhook`  → installable right now from the marketplace: it creates a
 *                  real outbound endpoint on the existing delivery engine
 *                  (convex/webhooks/main.ts), with signing, retries, audit.
 *   - `settings` → shipped, but configured in an existing settings surface;
 *                  the catalog deep-links there instead of duplicating the form.
 *   - `coming`   → catalogued for discoverability and roadmap honesty only.
 *                  A `coming` app has no install path anywhere in the product.
 *
 * That derivation is what keeps the page from turning into a wish list: an app
 * can only claim to be installable if a code path behind it exists.
 */

/** Consumer-facing grouping on both the app and the public page. */
export type MarketplaceCategory =
  | 'communication'
  | 'automation'
  | 'productivity'
  | 'identity'
  | 'hr'
  | 'accounting';

/** Categories in display order. */
export const CATEGORY_ORDER: readonly MarketplaceCategory[] = [
  'communication',
  'automation',
  'productivity',
  'identity',
  'hr',
  'accounting',
];

/** Intent-neutral: what the row's setup kind is worth to a buyer. */
export type MarketplaceSetup =
  | {
      kind: 'webhook';
      /** Pre-selected subscriptions; admin can change them. */ defaultEvents: string[];
    }
  | { kind: 'settings'; /** Verified route (with tab) that configures this app. */ href: string }
  | { kind: 'coming' };

export interface MarketplaceApp {
  id: string;
  /** Trademark — never translated. */
  name: string;
  category: MarketplaceCategory;
  setup: MarketplaceSetup;
  /** Vendor documentation, opened in a new tab. */
  docsUrl?: string;
  /**
   * Directory weight for the "popular" ordering. Higher = shown earlier inside
   * its category. Purely presentational.
   */
  weight: number;
}

/** Shortcut aliases so the catalog below stays readable. */
const SLACK_EVENTS = [
  'leave.requested',
  'leave.approved',
  'expense.submitted',
  'expense.approved',
  'employee.created',
];

const HR_EVENTS = [
  'employee.created',
  'employee.updated',
  'employee.deactivated',
  'document.signed',
];

const TIME_EVENTS = ['attendance.clock_in', 'attendance.clock_out', 'leave.approved'];

export const MARKETPLACE_APPS: readonly MarketplaceApp[] = [
  // ── Communication ───────────────────────────────────────────────────────
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    setup: { kind: 'webhook', defaultEvents: SLACK_EVENTS },
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    weight: 100,
  },
  {
    id: 'msteams',
    name: 'Microsoft Teams',
    category: 'communication',
    setup: { kind: 'webhook', defaultEvents: SLACK_EVENTS },
    docsUrl: 'https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/',
    weight: 95,
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    category: 'communication',
    setup: { kind: 'webhook', defaultEvents: SLACK_EVENTS },
    docsUrl: 'https://developers.google.com/workspace/chat/quickstart/webhooks',
    weight: 80,
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'communication',
    setup: { kind: 'webhook', defaultEvents: SLACK_EVENTS },
    docsUrl: 'https://discord.com/developers/docs/resources/webhook',
    weight: 70,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'communication',
    setup: { kind: 'settings', href: '/admin/integrations' },
    weight: 60,
  },

  // ── Automation ──────────────────────────────────────────────────────────
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'automation',
    setup: { kind: 'webhook', defaultEvents: [...HR_EVENTS, ...SLACK_EVENTS] },
    docsUrl: 'https://zapier.com/help/create/code-webhooks',
    weight: 100,
  },
  {
    id: 'make',
    name: 'Make',
    category: 'automation',
    setup: { kind: 'webhook', defaultEvents: [...HR_EVENTS, ...SLACK_EVENTS] },
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
    weight: 90,
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'automation',
    setup: { kind: 'webhook', defaultEvents: [...HR_EVENTS, ...SLACK_EVENTS] },
    docsUrl: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/',
    weight: 85,
  },
  {
    id: 'powerautomate',
    name: 'Power Automate',
    category: 'automation',
    setup: { kind: 'webhook', defaultEvents: [...HR_EVENTS, ...SLACK_EVENTS] },
    docsUrl: 'https://learn.microsoft.com/power-automate/',
    weight: 75,
  },
  {
    id: 'webhook',
    name: 'Custom webhook',
    category: 'automation',
    setup: { kind: 'webhook', defaultEvents: [] },
    weight: 60,
  },

  // ── Productivity ────────────────────────────────────────────────────────
  {
    id: 'googlecalendar',
    name: 'Google Calendar',
    category: 'productivity',
    setup: { kind: 'settings', href: '/settings?tab=integrations' },
    weight: 100,
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    category: 'productivity',
    setup: { kind: 'settings', href: '/settings?tab=integrations' },
    weight: 80,
  },
  {
    id: 'tasks',
    name: 'Tasks & approvals',
    category: 'productivity',
    setup: { kind: 'webhook', defaultEvents: ['task.created', 'task.completed'] },
    weight: 70,
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'productivity',
    setup: { kind: 'coming' },
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    weight: 40,
  },
  {
    id: 'outlook',
    name: 'Microsoft 365 Calendar',
    category: 'productivity',
    setup: { kind: 'coming' },
    docsUrl: 'https://learn.microsoft.com/graph/api/overview',
    weight: 30,
  },

  // ── Identity ────────────────────────────────────────────────────────────
  {
    id: 'saml',
    name: 'SAML 2.0 SSO',
    category: 'identity',
    setup: { kind: 'settings', href: '/settings?tab=saml' },
    weight: 100,
  },
  {
    id: 'oidc',
    name: 'OIDC / OAuth SSO',
    category: 'identity',
    setup: { kind: 'settings', href: '/settings?tab=sso' },
    weight: 95,
  },
  {
    id: 'scim',
    name: 'SCIM 2.0 provisioning',
    category: 'identity',
    setup: { kind: 'settings', href: '/settings?tab=scim' },
    weight: 90,
  },
  {
    id: 'imid',
    name: 'imID',
    category: 'identity',
    setup: { kind: 'settings', href: '/admin/integrations' },
    weight: 85,
  },
  {
    id: 'apikeys',
    name: 'API keys',
    category: 'identity',
    setup: { kind: 'settings', href: '/settings?tab=api' },
    weight: 70,
  },
  {
    id: 'entra',
    name: 'Microsoft Entra ID',
    category: 'identity',
    setup: { kind: 'coming' },
    docsUrl: 'https://learn.microsoft.com/entra/identity/',
    weight: 40,
  },
  {
    id: 'okta',
    name: 'Okta',
    category: 'identity',
    setup: { kind: 'coming' },
    docsUrl: 'https://developer.okta.com/docs/concepts/scim/',
    weight: 35,
  },
  {
    id: 'googleworkspace',
    name: 'Google Workspace directory',
    category: 'identity',
    setup: { kind: 'coming' },
    docsUrl: 'https://developers.google.com/workspace/admin/directory/v1/guides/manage-users',
    weight: 30,
  },

  // ── HR ──────────────────────────────────────────────────────────────────
  {
    id: 'luckycarrot',
    name: 'Lucky Carrot',
    category: 'hr',
    setup: { kind: 'settings', href: '/admin/integrations' },
    weight: 100,
  },
  {
    id: 'attendance',
    name: 'Time & attendance kiosk',
    category: 'hr',
    setup: { kind: 'webhook', defaultEvents: TIME_EVENTS },
    weight: 90,
  },
  {
    id: 'zkteco',
    name: 'ZKTeco / Suprema readers',
    category: 'hr',
    setup: { kind: 'coming' },
    weight: 50,
  },
  {
    id: 'staffam',
    name: 'Staff.am',
    category: 'hr',
    setup: { kind: 'coming' },
    docsUrl: 'https://staff.am',
    weight: 40,
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    category: 'hr',
    setup: { kind: 'coming' },
    docsUrl: 'https://developers.greenhouse.io/harvest.html',
    weight: 30,
  },

  // ── Accounting ──────────────────────────────────────────────────────────
  {
    id: 'armsoft',
    name: 'Armsoft (ՀԾ)',
    category: 'accounting',
    setup: { kind: 'settings', href: '/admin/integrations' },
    weight: 100,
  },
  {
    id: 'oneczup',
    name: '1C:ZUP',
    category: 'accounting',
    setup: { kind: 'coming' },
    docsUrl: 'https://1c.ru',
    weight: 60,
  },
  {
    id: 'xero',
    name: 'Xero',
    category: 'accounting',
    setup: { kind: 'coming' },
    docsUrl: 'https://developer.xero.com/documentation/api/accounting/overview',
    weight: 40,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    category: 'accounting',
    setup: { kind: 'coming' },
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    weight: 35,
  },
];

export type MarketplaceStatus = 'available' | 'coming';

/** Availability is derived from the setup path, never asserted by hand. */
export function appStatus(app: MarketplaceApp): MarketplaceStatus {
  return app.setup.kind === 'coming' ? 'coming' : 'available';
}

/** True when the marketplace can install the app itself (no separate form). */
export function isSelfInstallable(app: MarketplaceApp): boolean {
  return app.setup.kind === 'webhook';
}

/** Apps in a category, popular-first. */
export function appsByCategory(category: MarketplaceCategory): MarketplaceApp[] {
  return MARKETPLACE_APPS.filter((app) => app.category === category).sort(
    (a, b) => b.weight - a.weight,
  );
}

/** Categories that actually have apps, in display order. */
export function populatedCategories(): MarketplaceCategory[] {
  return CATEGORY_ORDER.filter((category) =>
    MARKETPLACE_APPS.some((app) => app.category === category),
  );
}

export function getApp(id: string): MarketplaceApp | undefined {
  return MARKETPLACE_APPS.find((app) => app.id === id);
}

/** Counts for the public page's hero and the app's filter chips. */
export function catalogStats(): { total: number; available: number; coming: number } {
  let available = 0;
  let coming = 0;
  for (const app of MARKETPLACE_APPS) {
    if (appStatus(app) === 'available') available += 1;
    else coming += 1;
  }
  return { total: MARKETPLACE_APPS.length, available, coming };
}

/** Case/space-insensitive match against the app name and its id. */
export function matchesQuery(app: MarketplaceApp, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return app.name.toLowerCase().includes(q) || app.id.includes(q);
}
