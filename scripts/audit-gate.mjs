#!/usr/bin/env node
/**
 * npm audit gate — fails when a NEW critical/high advisory appears.
 *
 * How it works:
 *   1. Reads the baseline of ACCEPTED advisory IDs from
 *      `audit-baseline.json` (committed; each entry needs a reason).
 *   2. Runs `npm audit --json` on the current lockfile.
 *   3. Any critical/high advisory NOT in the baseline → exit 1 (CI fails).
 *   4. Baseline entries that no longer appear are reported as removable
 *      (non-blocking reminder to keep the baseline honest).
 *
 * Usage:
 *   node scripts/audit-gate.mjs            # gate mode (CI)
 *   node scripts/audit-gate.mjs --update   # rewrite baseline from current audit
 *
 * Low/moderate advisories never fail the gate — they are tracked by
 * Dependabot alerts and reviewed periodically.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'audit-baseline.json');
const GATE_LEVELS = new Set(['critical', 'high']);

/**
 * Resolve a way to run npm that works the same on Windows and POSIX.
 *
 * Node ≥ 18.20 refuses to spawn `.cmd` shims without `shell: true`
 * (CVE-2024-27980), and shell + argument array is deprecated (DEP0190) because
 * the arguments are concatenated unescaped. So prefer npm's JS entry point run
 * by the current node binary — `npm_execpath` is set whenever this executes
 * under `npm run`, which is how CI invokes it.
 */
function npmRunner() {
  const candidates = [
    process.env.npm_execpath,
    join(process.execPath, '..', '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    // Windows layout: <nodejs>\node_modules\npm\bin\npm-cli.js
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    // POSIX layout for a CI tool cache: <prefix>/bin/node + <prefix>/lib/node_modules
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.endsWith('.js') && existsSync(candidate)) {
      return { cmd: process.execPath, prefix: [candidate], shell: false };
    }
  }
  // Last resort: the shim. Windows needs a shell, so pass one command string
  // (no argument array) to stay clear of DEP0190.
  const shim = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return { cmd: shim, prefix: [], shell: process.platform === 'win32' };
}

function runAudit() {
  const runner = npmRunner();
  const args = [...runner.prefix, 'audit', '--json'];
  let out;
  try {
    out = runner.shell
      ? execFileSync([runner.cmd, ...args].join(' '), {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        })
      : execFileSync(runner.cmd, args, {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
  } catch (e) {
    // `npm audit` exits non-zero when vulnerabilities exist while still
    // printing the full JSON report to stdout — parse it. A genuinely
    // failed run (network down, ENOENT) has no usable JSON.
    const stdout = e.stdout;
    if (typeof stdout === 'string' && stdout.trim().startsWith('{')) {
      return JSON.parse(stdout);
    }
    throw new Error(`npm audit failed to run: ${e.message}`);
  }
  return JSON.parse(out);
}

/** Flatten npm audit v2 output to a list of { id, title, severity, fixAvailable }. */
function collectAdvisories(report) {
  const advisories = [];
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !via.url) continue; // `via` may name a vulnerable dep
      advisories.push({
        id: via.url,
        title: via.title ?? via.url,
        severity: String(via.severity ?? 'unknown').toLowerCase(),
        packageName: vuln.name,
        range: via.range ?? '',
      });
    }
  }
  return advisories;
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { advisories: {} };

// ── --update: rewrite baseline, keep reasons for surviving entries ──────────
if (process.argv.includes('--update')) {
  const report = runAudit();
  const current = collectAdvisories(report).filter((a) => GATE_LEVELS.has(a.severity));
  const next = { $schemaNote: 'Accepted critical/high advisories. id = GHSA advisory URL. Each entry needs a reason; remove entries once the advisory no longer applies.' , advisories: {} };
  for (const a of current) {
    next.advisories[a.id] = {
      package: a.packageName,
      severity: a.severity,
      title: a.title,
      reason: baseline.advisories[a.id]?.reason ?? 'TODO: document why this is accepted',
      acceptedOn: new Date().toISOString().slice(0, 10),
    };
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`audit-baseline.json updated: ${current.length} accepted advisory(ies).`);
  process.exit(0);
}

// ── gate mode ────────────────────────────────────────────────────────────────
const report = runAudit();
const gateable = collectAdvisories(report).filter((a) => GATE_LEVELS.has(a.severity));
const accepted = new Set(Object.keys(baseline.advisories ?? {}));

const violations = gateable.filter((a) => !accepted.has(a.id));
const stale = [...accepted].filter((id) => !gateable.some((a) => a.id === id));

for (const id of stale) {
  console.log(`✓ advisory no longer present — remove from audit-baseline.json: ${id}`);
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} NEW critical/high advisory(ies) not in the accepted baseline:\n`);
  for (const v of violations) {
    console.error(`  [${v.severity}] ${v.packageName} — ${v.title}`);
    console.error(`           ${v.id} (range: ${v.range})`);
  }
  console.error('\nOptions:');
  console.error('  1. Fix: run `npm audit fix` (or bump the dependency) — preferred.');
  console.error('  2. Accept: run `node scripts/audit-gate.mjs --update`, fill in the');
  console.error('     "reason" for each entry in audit-baseline.json, commit it.');
  process.exit(1);
}

console.log(`✓ audit gate passed: ${gateable.length} critical/high advisory(ies), all in the accepted baseline (violations: 0, removable baseline entries: ${stale.length}).`);
