#!/usr/bin/env node
/**
 * Provision the two Sentry issue-alert rules this project relies on.
 *
 * Why a script and not a click: a DSN with no rule collects errors nobody reads.
 * The rule is the difference between "we have error tracking" and "somebody is
 * told when production breaks" — and a click is lost the moment the Sentry
 * project is recreated. This is idempotent, so re-running it is safe.
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=… SENTRY_ORG=… SENTRY_PROJECT=… node scripts/sentry-alert-rules.mjs
 *   node scripts/sentry-alert-rules.mjs --strict   # exit 1 when unconfigured (CI)
 *
 * Requires a token with `project:read` **and** `project:write` (the first GET
 * lists existing rules to stay idempotent; `project:write` alone answers 403).
 * Any existing rule with the same name is left untouched — edit it in the UI and
 * this script will not fight you.
 */

const API = 'https://sentry.io/api/0';

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_ALERT_EMAIL } = process.env;
const strict = process.argv.includes('--strict');

const missing = [
  ['SENTRY_AUTH_TOKEN', SENTRY_AUTH_TOKEN],
  ['SENTRY_ORG', SENTRY_ORG],
  ['SENTRY_PROJECT', SENTRY_PROJECT],
].filter(([, value]) => !value);

if (missing.length > 0) {
  const names = missing.map(([name]) => name).join(', ');
  const message = `Sentry alert rules not provisioned: ${names} not set.`;
  if (strict) {
    console.error(`${message} Use --strict only where the variables must exist.`);
    process.exit(1);
  }
  console.warn(`${message} Skipping (pass --strict to fail instead).`);
  process.exit(0);
}

/** The project's default on-call target. `IssueOwners` = whoever is assigned. */
const emailAction = SENTRY_ALERT_EMAIL
  ? {
      id: 'sentry.mail.actions.NotifyEmailAction',
      targetType: 'Member',
      targetIdentifier: SENTRY_ALERT_EMAIL,
    }
  : {
      id: 'sentry.mail.actions.NotifyEmailAction',
      targetType: 'IssueOwners',
      targetIdentifier: '',
    };

const productionOnly = [
  {
    id: 'sentry.rules.filters.tagged_event.TaggedEventFilter',
    key: 'environment',
    match: 'eq',
    value: 'production',
  },
];

/** A brand-new issue in production — the "something broke that never broke". */
const newIssueRule = {
  name: 'Production errors — new issue',
  actionMatch: 'any',
  filterMatch: 'all',
  conditions: [{ id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' }],
  filters: productionOnly,
  actions: [emailAction],
  frequency: 30, // minutes between notifications while it keeps firing
};

/** An issue that suddenly fires a lot — usually a regression or a bad deploy. */
const spikeRule = {
  name: 'Production errors — spike',
  actionMatch: 'any',
  filterMatch: 'all',
  conditions: [
    {
      id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
      value: 20,
      interval: '1h',
    },
  ],
  filters: productionOnly,
  actions: [emailAction],
  frequency: 30,
};

const headers = {
  Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

async function main() {
  const base = `${API}/projects/${encodeURIComponent(SENTRY_ORG)}/${encodeURIComponent(SENTRY_PROJECT)}`;

  const listResponse = await fetch(`${base}/rules/`, { headers });
  if (!listResponse.ok) {
    const detail = await listResponse.text();
    if (listResponse.status === 403 || listResponse.status === 401) {
      throw new Error(
        `GET rules failed: ${listResponse.status} ${detail}\n` +
          'The token is missing read access. This script needs both `project:read` and ' +
          '`project:write` on the Sentry token — `project:write` alone cannot list rules.',
      );
    }
    throw new Error(`GET rules failed: ${listResponse.status} ${detail}`);
  }
  const existing = new Set((await listResponse.json()).map((rule) => rule.name));

  for (const rule of [newIssueRule, spikeRule]) {
    if (existing.has(rule.name)) {
      console.log(`• "${rule.name}" already exists — left alone.`);
      continue;
    }
    const createResponse = await fetch(`${base}/rules/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rule),
    });
    if (!createResponse.ok) {
      throw new Error(
        `POST rule "${rule.name}" failed: ${createResponse.status} ${await createResponse.text()}`,
      );
    }
    console.log(`✓ Created "${rule.name}".`);
  }

  console.log(
    'Done. Confirm the alert target (SENTRY_ALERT_EMAIL, else issue owners) reaches a human.',
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
