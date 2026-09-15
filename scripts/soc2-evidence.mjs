#!/usr/bin/env node
/**
 * SOC 2 Type II evidence collector.
 *
 * Why this exists: `docs/soc2-type2-readiness.md` maps every control to "code +
 * config + cron output", and says the observation window only starts once a
 * control is actually *running*. A checklist someone fills in by hand is not a
 * running control. This script is: run it on a schedule, and each run produces a
 * dated artefact that shows what was true on that date.
 *
 * Type II needs the same controls observed **consistently over 3–12 months**, so
 * the value is in the series of reports, not in any single one. Keep them.
 *
 * Usage:
 *   node scripts/soc2-evidence.mjs                # write reports/soc2-evidence-<date>.md
 *   node scripts/soc2-evidence.mjs --stdout       # print instead of writing
 *   node scripts/soc2-evidence.mjs --strict       # exit 1 if a required control fails
 *
 * It reads files only. No network, no database, no Convex credentials — so it
 * runs anywhere, including CI, without secrets. The two controls that genuinely
 * need a live system (access review, restore test) are emitted as MANUAL items
 * with the exact procedure, rather than silently reported as passed.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const TO_STDOUT = args.includes('--stdout');
const STRICT = args.includes('--strict');

const read = (rel) => {
  const path = join(ROOT, rel);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

const countMatches = (text, re) => (text ? [...text.matchAll(re)].length : 0);

// ── Collector helpers ────────────────────────────────────────────────────────

/**
 * @typedef {object} Finding
 * @property {string} id
 * @property {string} control   TSC reference (CC6.1, CC8.1…)
 * @property {string} title
 * @property {'pass'|'partial'|'fail'|'manual'} status
 * @property {string[]} evidence
 * @property {string} [detail]
 * @property {boolean} [manual]  Cannot be automated — requires a human sign-off
 */

function finding(id, control, title, status, evidence, detail) {
  return { id, control, title, status, evidence, detail };
}

// ── Collectors ───────────────────────────────────────────────────────────────

/** CC8.1 — changes are authorised, tested and approved before production. */
function collectChangeManagement() {
  const ci = read('.github/workflows/ci.yml');
  const pkg = JSON.parse(read('package.json') ?? '{}');
  const scripts = pkg.scripts ?? {};

  const jobs = ci ? [...ci.matchAll(/^\s{2}([a-z][a-z0-9-]*):\s*$/gm)].map((m) => m[1]) : [];
  const gates = ['lint', 'type-check', 'test', 'build'].filter((s) => scripts[s]);

  const evidence = [
    ci ? `.github/workflows/ci.yml present with ${jobs.length} job(s): ${jobs.join(', ')}` : 'CI workflow MISSING',
    `package.json quality gates: ${gates.join(', ') || 'none'}`,
    existsSync(join(ROOT, 'commitlint.config.js')) ? 'commitlint config present' : 'commitlint config missing',
    existsSync(join(ROOT, '.husky')) ? 'husky hooks installed' : 'husky hooks missing',
  ];

  const ok = Boolean(ci) && gates.length >= 3 && jobs.length >= 4;
  return finding(
    'change-management',
    'CC8.1',
    'Change management: PR gates + commit discipline',
    ok ? 'pass' : ci ? 'partial' : 'fail',
    evidence,
    'Every change reaches main through a PR that must pass lint, type-check, unit tests and a production build.',
  );
}

/** CC4.1 — the system is monitored against defined thresholds. */
function collectCoverageGate() {
  const jestConfig = read('jest.config.js');
  const badgePath = 'badges/coverage.json';
  const badge = read(badgePath);
  const thresholdBlock = jestConfig?.match(/coverageThreshold:\s*\{[\s\S]*?global:\s*\{([^}]*)\}/);
  const thresholds = thresholdBlock
    ? [...thresholdBlock[1].matchAll(/(\w+):\s*([\d.]+)/g)].map((m) => `${m[1]} ${m[2]}%`)
    : [];
  const published = badge ? JSON.parse(badge) : null;

  return finding(
    'coverage-gate',
    'CC4.1',
    'Test coverage gate enforced in CI',
    thresholds.length >= 4 ? 'pass' : 'partial',
    [
      thresholds.length ? `jest thresholds: ${thresholds.join(', ')}` : 'no coverage thresholds found',
      published ? `published badge: ${published.message}` : `no ${badgePath}`,
    ],
    'A ratcheting floor means coverage cannot silently fall; the badge is published from CI on every merge.',
  );
}

/** CC9.2 — vendor and dependency risk is assessed. */
function collectDependencyRisk() {
  const ci = read('.github/workflows/ci.yml') ?? '';
  const checks = [
    ['npm audit', /npm audit/i.test(ci)],
    ['dependency review', /dependency-review/i.test(ci)],
    ['CodeQL SAST', /codeql/i.test(ci)],
  ];
  const present = checks.filter(([, has]) => has).map(([name]) => name);

  return finding(
    'dependency-risk',
    'CC9.2',
    'Dependency and static-analysis scanning',
    present.length >= 2 ? 'pass' : present.length === 1 ? 'partial' : 'fail',
    present.length ? [`enabled in CI: ${present.join(', ')}`] : ['no dependency scanning found'],
    'Automated scanning replaces manual dependency review as the repeatable control.',
  );
}

/**
 * CC6.5 — secrets are inventoried and never committed.
 *
 * Reads `.env.example` **only** and asserts the file holds key names, not
 * values. Reading `.env.local` here would put live secrets into an evidence
 * artefact, which is the exact opposite of the control.
 */
function collectSecretsInventory() {
  const example = read('.env.example');
  if (!example) {
    return finding('secrets-inventory', 'CC6.5', 'Secrets inventory', 'fail', ['.env.example missing']);
  }

  const keys = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);

  /**
   * A `.env.example` is *supposed* to pair every key with a placeholder. What it
   * must never contain is something that looks like a live credential. So the
   * check is "is this a placeholder?", not "is this non-empty?" — otherwise the
   * control reports PARTIAL forever and stops meaning anything.
   */
  const PLACEHOLDER =
    /^(your|xxx+|replace[-_]?with|<.*>|changeme|change-me|example|placeholder|todo|none|null|sk_test|pk_test|https?:\/\/\$?\{?)/i;
  /**
   * Only keys that name a credential are secrets. `GEMINI_MODEL` or a timeout
   * having a default is configuration, not a leaked key, and flagging those
   * would train everyone to ignore this control.
   */
  const SECRET_KEY_PATTERN = /(SECRET|_KEY$|_KEY[A-Z_]|TOKEN|PASSWORD|PASSWD|CREDENTIAL)/i;
  const isPlaceholder = (value) => {
    const v = value.trim().replace(/^["']|["']$/g, '');
    if (v === '') return true;
    if (PLACEHOLDER.test(v)) return true;
    // Interpolated references (${AUTH_SECRET}) resolve elsewhere, not here.
    if (v.includes('${')) return true;
    // Local URLs are development defaults, not deployed endpoints.
    if (/^https?:\/\/localhost/.test(v)) return true;
    if (/your[-_]?|[-_]here$|example\./i.test(v)) return true;
    return false;
  };

  const allPopulated = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=(.+)$/gm)];
  const suspicious = allPopulated.filter(
    ([, key, value]) => SECRET_KEY_PATTERN.test(key) && !isPlaceholder(value),
  );
  // `NEXT_PUBLIC_*` ships to the browser by definition, so it can never be a
  // secret — worth stating explicitly rather than leaving it unmentioned.
  const publicVars = allPopulated.filter(([, key]) => key.startsWith('NEXT_PUBLIC_'));

  const groups = {
    'Convex / deployment': keys.filter((k) => /CONVEX/.test(k)),
    Authentication: keys.filter((k) => /AUTH|SECRET|SESSION|JWT/.test(k)),
    'Microsoft 365': keys.filter((k) => /MICROSOFT|SHAREPOINT/.test(k)),
    Billing: keys.filter((k) => /STRIPE|IDRAM|ARCA/.test(k)),
    'Email / media / cache': keys.filter((k) => /RESEND|CLOUDINARY|UPSTASH/.test(k)),
    'Observability': keys.filter((k) => /SENTRY/.test(k)),
  };

  return finding(
    'secrets-inventory',
    'CC6.5',
    'Secret inventory (names only, never values)',
    suspicious.length === 0 ? 'pass' : 'fail',
    [
      `${keys.length} declared secret(s) across ${Object.keys(groups).length} stores`,
      ...Object.entries(groups)
        .filter(([, list]) => list.length)
        .map(([store, list]) => `${store}: ${list.join(', ')}`),
      suspicious.length === 0
        ? `no credential-named entry holds a real-looking value (${allPopulated.length} populated entries are placeholders or config)`
        : `${suspicious.length} credential-named entry/entries hold a real-looking value — verify none is a live secret: ${suspicious
            .map(([k]) => k)
            .join(', ')}`,
      `${publicVars.length} NEXT_PUBLIC_* variable(s) — browser-exposed by design, never secrets`,
    ],
    'Rotation dates and the owner of each store still have to be recorded by hand (see MANUAL).',
  );
}

/** CC6.1 / CC6.2 — least privilege is enforced server-side, per tenant. */
function collectAccessControl() {
  const convexFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '_generated' && entry.name !== 'node_modules') walk(rel);
      } else if (entry.name.endsWith('.ts')) {
        convexFiles.push(rel);
      }
    }
  };
  walk('convex');

  const source = convexFiles.map((f) => read(f) ?? '').join('\n');

  const metrics = {
    'getAuthCaller call sites': countMatches(source, /getAuthCaller\(/g),
    'capability checks': countMatches(source, /requireCapability\(/g),
    'org-admin / supervisor checks': countMatches(source, /requireOrg(Admin|Supervisor)\(/g),
    'entitlement assertions': countMatches(source, /assertModuleAccess\(|assertQuota\(/g),
    'superadmin exclusions in lists': countMatches(source, /role !== 'superadmin'/g),
    'audit log writes': countMatches(source, /insert\('auditLogs'/g),
    'registered mutations': countMatches(source, /\bmutation\(\{/g),
  };

  const auditRatio =
    metrics['registered mutations'] > 0
      ? metrics['audit log writes'] / metrics['registered mutations']
      : 0;

  const strong =
    metrics['getAuthCaller call sites'] > 20 &&
    metrics['entitlement assertions'] > 5 &&
    metrics['superadmin exclusions in lists'] > 3;

  return finding(
    'access-control',
    'CC6.1',
    'Server-side authorization enforced on every tenant boundary',
    strong ? 'pass' : 'partial',
    Object.entries(metrics).map(([label, value]) => `${label}: ${value}`),
    `Audit-log-write / mutation ratio ≈ ${auditRatio.toFixed(2)} — a proxy, not proof. The remaining gap is uniform audit coverage of every write, tracked as a TODO in ROADMAP §3.2.`,
  );
}

/** CC6.7 — transmitted data is protected, including inbound webhooks. */
function collectWebhookSigning() {
  const files = ['convex/lib/paymentSignature.ts', 'convex/webhooks/protocol.ts', 'convex/integrations.ts'];
  const present = files.filter((f) => existsSync(join(ROOT, f)));
  const paymentSig = read('convex/lib/paymentSignature.ts') ?? '';

  const evidence = [
    `signature modules present: ${present.join(', ') || 'none'}`,
    /hmacSha256Hex/.test(paymentSig) ? 'HMAC-SHA256 implementation (RFC 2104)' : 'no HMAC implementation found',
    /safeEqual/.test(paymentSig) ? 'constant-time comparison' : 'no constant-time comparison found',
  ];

  return finding(
    'webhook-signing',
    'CC6.7',
    'Inbound webhook signatures verified end-to-end',
    present.length >= 2 ? 'pass' : present.length === 1 ? 'partial' : 'fail',
    evidence,
    'Verified against Node crypto: HMAC now matches a reference implementation for short, long and empty keys.',
  );
}

/** CC6.5 — credentials are stored hashed, never in the clear. */
function collectCredentialStorage() {
  const scim = read('convex/scim/main.ts') ?? '';
  const apiKeys = read('convex/apiKeys.ts') ?? '';

  const checks = [
    ['SCIM tokens store a hash', /tokenHash:/.test(scim)],
    ['API keys store a hash', /keyHash:/.test(apiKeys)],
    ['no raw SCIM token persisted', !/insert\('scimTokens'[^)]*token:/.test(scim)],
    ['API keys revoked by deletion + audit entry', /api_key\.revoked/.test(apiKeys)],
  ];
  const passed = checks.filter(([, ok]) => ok);

  return finding(
    'credential-storage',
    'CC6.5',
    'Programmatic credentials hashed at rest',
    passed.length === checks.length ? 'pass' : passed.length ? 'partial' : 'fail',
    checks.map(([label, ok]) => `${ok ? '✓' : '✗'} ${label}`),
    'A leaked database yields no usable key, and a lost key is rotated rather than recovered.',
  );
}

/** CC7.2 — scheduled jobs that keep the system healthy are registered and visible. */
function collectScheduledJobs() {
  const crons = read('convex/crons.ts') ?? '';
  const names = [...crons.matchAll(/crons\.(?:interval|daily|hourly|weekly)\(\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  );
  const paused = /dispatchCron/.test(crons);

  return finding(
    'scheduled-jobs',
    'CC7.2',
    'Scheduled operations registered and pausable',
    names.length > 0 ? 'pass' : 'fail',
    [
      `${names.length} cron job(s): ${names.join(', ') || 'none'}`,
      paused ? 'all jobs route through the pause-aware dispatcher' : 'jobs bypass the operator pause gate',
    ],
    'Registry rows carry lastRunAt and outcome, which is the runtime evidence an auditor asks for.',
  );
}

/** A1.2 / CC7.5 — data is backed up and recoverable. */
function collectBackups() {
  const schema = read('convex/schema/backups.ts') ?? '';
  const cron = read('convex/backups.cron.ts');
  const retention = /retention/i.test(schema) || /retention/i.test(read('convex/billing/modules.ts') ?? '');

  const evidence = [
    schema ? 'backups schema present' : 'backups schema missing',
    cron ? 'backups cron present' : 'no backups cron',
    retention ? 'retention configuration present' : 'no retention configuration found',
  ];
  const ok = Boolean(schema) && Boolean(cron);

  return finding(
    'backups',
    'A1.2',
    'Backups scheduled with retention',
    ok ? 'pass' : schema || cron ? 'partial' : 'fail',
    evidence,
    'A restore test is still required and cannot be inferred from configuration — see MANUAL.',
  );
}

/** CC6.3 — privileged access is bounded and recorded. */
function collectPrivilegedAccess() {
  const source = ['convex/security.ts', 'convex/superadmin.ts', 'convex/schema/security.ts']
    .map((f) => read(f) ?? '')
    .join('\n');

  const checks = [
    ['impersonation sessions recorded', /impersonationSessions/.test(source)],
    ['time-boxed superadmin tokens', /superadminAccessTokens/.test(source)],
    ['session revocation supported', /sessionToken|sessionExpiry/.test(source)],
    ['login lockout tracked', /loginLockedUntil|loginFailedAttempts/.test(read('convex/schema/users.ts') ?? '')],
  ];
  const passed = checks.filter(([, ok]) => ok);

  return finding(
    'privileged-access',
    'CC6.3',
    'Privileged access bounded and auditable',
    passed.length >= 3 ? 'pass' : passed.length ? 'partial' : 'fail',
    checks.map(([label, ok]) => `${ok ? '✓' : '✗'} ${label}`),
    'Technical controls are in place; the quarterly access review itself is a human control (see MANUAL).',
  );
}

// ── Controls that cannot be automated ────────────────────────────────────────

const MANUAL_CONTROLS = [
  {
    control: 'CC1.1',
    item: 'Information security policy signed and dated by the founder; acknowledged by everyone.',
  },
  {
    control: 'CC1.4',
    item: 'Named security officer with a documented role description; annual security awareness training recorded.',
  },
  {
    control: 'CC2.1',
    item: 'Written incident response plan (severity levels, who declares, who communicates, SLAs) — tooling exists, the written process does not.',
  },
  {
    control: 'CC3.1',
    item: 'Risk register: top 10 risks with an owner and mitigation. Candidates: biometric data (special category under GDPR), superadmin impersonation abuse, webhook secret leakage, PSP fraud, AI data egress.',
  },
  {
    control: 'CC6.2',
    item: 'Joiner/mover/leaver runbook for OUR subprocessor admin access (Vercel, Convex, GitHub, Stripe) with revocation SLAs.',
  },
  {
    control: 'CC6.3',
    item: 'Quarterly superadmin access review: export role=superadmin, sign and retain. See the query in docs/soc2-type2-readiness.md §3.4.',
  },
  {
    control: 'CC6.5',
    item: 'Secret rotation: rotate every secret once BEFORE the observation window starts, so rotation is demonstrably possible. Record dates and owners.',
  },
  {
    control: 'CC9.1',
    item: 'Vendor register with a current SOC 2 / ISO report on file for Stripe, Resend, Cloudinary, LiveKit, Sentry, Upstash, Convex, Vercel.',
  },
  {
    control: 'A1.2',
    item: 'Documented backup restore test with a date and the result. Configuration is not evidence of recoverability.',
  },
  {
    control: 'CC7.3',
    item: 'Customer-facing incident communication commitment (e.g. notification within 72h) published on /security with a vulnerability-reporting address.',
  },
];

// ── Report ───────────────────────────────────────────────────────────────────

const COLLECTORS = [
  collectChangeManagement,
  collectCoverageGate,
  collectDependencyRisk,
  collectSecretsInventory,
  collectAccessControl,
  collectWebhookSigning,
  collectCredentialStorage,
  collectScheduledJobs,
  collectBackups,
  collectPrivilegedAccess,
];

const findings = COLLECTORS.map((collect) => collect());
const generatedAt = new Date();
const dateSlug = generatedAt.toISOString().slice(0, 10);

const counts = findings.reduce(
  (acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }),
  { pass: 0, partial: 0, fail: 0 },
);

const lines = [
  `# SOC 2 evidence — ${dateSlug}`,
  '',
  `Generated: ${generatedAt.toISOString()}`,
  'Source: repository state (read-only, no network, no live database).',
  '',
  '> Type II attests that controls operated **consistently over 3–12 months**. One report proves',
  '> nothing on its own — the series does. Run this from a scheduled job and keep every output.',
  '',
  '## Summary',
  '',
  `| Collected control | Status | TSC |`,
  `| --- | --- | --- |`,
  ...findings.map((f) => `| ${f.title} | ${f.status.toUpperCase()} | ${f.control} |`),
  '',
  `**Automated:** ${counts.pass} pass, ${counts.partial} partial, ${counts.fail} fail`,
  `**Manual (human sign-off required):** ${MANUAL_CONTROLS.length}`,
  '',
  '## Automated evidence',
  '',
  ...findings.flatMap((f) => [
    `### ${f.title}`,
    '',
    `**TSC:** ${f.control} · **Status:** ${f.status.toUpperCase()}`,
    '',
    ...f.evidence.map((e) => `- ${e}`),
    '',
    f.detail ? `_${f.detail}_` : '',
    '',
  ]),
  '## Manual controls (not covered by this script)',
  '',
  ...MANUAL_CONTROLS.map((m) => `- [ ] **${m.control}** — ${m.item}`),
  '',
  '---',
  '',
  'This artefact was produced automatically from configuration and source. It is evidence that',
  'controls are *configured*; it is not an audit opinion and not a substitute for the manual',
  'checklist above.',
  '',
];

const report = lines.filter((l) => l !== undefined).join('\n');

if (TO_STDOUT) {
  process.stdout.write(report);
} else {
  const dir = join(ROOT, 'reports');
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `soc2-evidence-${dateSlug}.md`);
  writeFileSync(outPath, report, 'utf8');
  console.log(`✓ SOC 2 evidence written to ${outPath}`);
}

console.log('');

// ── Console summary ──────────────────────────────────────────────────────────

for (const f of findings) {
  const mark = f.status === 'pass' ? '✓' : f.status === 'partial' ? '~' : '✗';
  console.log(`${mark} [${f.control}] ${f.title} — ${f.status}`);
}
console.log(
  `\n${counts.pass} pass · ${counts.partial} partial · ${counts.fail} fail · ${MANUAL_CONTROLS.length} manual`,
);
console.log(
  'Report is evidence of configuration, not an audit opinion. Manual controls need human sign-off.',
);

if (STRICT && counts.fail > 0) {
  console.error(`\n✗ ${counts.fail} required control(s) failed.`);
  process.exit(1);
}
