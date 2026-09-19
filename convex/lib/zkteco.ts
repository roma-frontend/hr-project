/**
 * zkteco — the ZKTeco / Suprema "push SDK" (ADMS) wire protocol.
 *
 * Why this file exists next to `inboundPayload.ts`: that module already maps the
 * *field spellings* of vendor payloads (PIN vs emp_code vs employeeNumber) onto
 * one punch shape, and it is what the generic `/api/in/<token>` webhook uses.
 * What it cannot do is speak the protocol a ZKTeco terminal actually speaks out
 * of the box. A ZKTeco device is configured with a server address, then talks
 * ADMS on its own:
 *
 *   GET  /iclock/cdata?SN=<serial>&options=all     → handshake, device expects config text
 *   POST /iclock/cdata?SN=<serial>&table=ATTLOG    → tab-separated punch batch
 *   GET  /iclock/getrequest?SN=<serial>            → device polls for commands
 *   POST /iclock/devicecmd?SN=<serial>             → results of those commands
 *
 * So an ARM/HR team that already owns terminals could not point them at Strata
 * without a middleware box. This module is the parsing half of that fix: it is
 * pure, so every rule below is unit-testable without a device on the desk — and
 * the rules deserve tests, because the body format is positional, not named.
 *
 * ── Body format (`table=ATTLOG`) ─────────────────────────────────────────────
 * One record per line, tab-separated, positions significant:
 *
 *   PIN \t datetime \t status \t verify \t workcode \t reserved …
 *   `1   2026-09-18 09:01:22  0   1   -   0`
 *
 * `status` is the punch state: 0 = check-in, 1 = check-out, everything else
 * (2–5 break states, 255) is recorded as `unknown` rather than guessed at — the
 * HR review queue is where a human decides, and inventing a direction here would
 * move payroll on a wrong assumption.
 *
 * Times are the terminal's local wall clock, resolved against Armenia (UTC+4) by
 * `parseLocalDateTime` — the same helper the webhook path uses, so a punch from
 * ADMS and the same punch replayed as JSON land on the identical instant.
 */

import { parseLocalDateTime, type NormalizedPunch } from './inboundPayload';

/** Records the device pushes; only ATTLOG carries punches we ingest. */
export const ZK_ATTLOG_TABLE = 'ATTLOG';

/**
 * Tables a ZKTeco terminal may push that we deliberately acknowledge without
 * ingesting: operations log and punch photos. Answering `OK` matters — anything
 * else makes the terminal retry the same batch forever and fill its own queue.
 */
const ACKNOWLEDGED_TABLES = new Set(['OPERLOG', 'ATTPHOTO', 'USERINFO', 'FINGERTMP']);

/** Serial numbers are hand-typed into the terminal menu; compare them loosely. */
export function normalizeSerial(serial: string | null | undefined): string {
  return (serial ?? '').trim().toUpperCase();
}

/** Query parameters of an `/iclock/*` request, as the device sent them. */
export interface ZkQuery {
  serial: string;
  table: string;
  /** `options=all` on the first contact after a reboot. */
  options: string | null;
  /** Batch sequence the device reports; echoed back unchanged is fine. */
  stamp: string | null;
}

/**
 * Read the ADMS query string. `table` is absent on handshake and polling
 * requests, which is not an error — it is how the protocol distinguishes them.
 */
export function parseZkQuery(search: string): ZkQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    serial: normalizeSerial(params.get('SN')),
    table: (params.get('table') ?? '').trim().toUpperCase(),
    options: params.get('options'),
    stamp: params.get('Stamp'),
  };
}

/** True when this push carries attendance records we should parse. */
export function isAttlogPush(query: ZkQuery): boolean {
  return query.table === ZK_ATTLOG_TABLE;
}

/** True for tables we acknowledge but do not ingest (avoids device retry storms). */
export function isAcknowledgedOnlyPush(query: ZkQuery): boolean {
  return ACKNOWLEDGED_TABLES.has(query.table);
}

// ── Punch batch ──────────────────────────────────────────────────────────────

export interface AttlogParseResult {
  punches: NormalizedPunch[];
  /** Lines that carried no usable PIN or time — reported, never invented. */
  skipped: number;
  /** Total non-empty lines seen, so `skipped` has a denominator. */
  lines: number;
}

/**
 * Parse an ATTLOG batch.
 *
 * Lines that are empty, comment-like, or missing a usable PIN/time are counted
 * in `skipped` and dropped. Returning a punch with a guessed time would put an
 * invented timestamp in front of HR and, on import, in payroll.
 *
 * @param body raw request body (tab-separated, `\r\n` or `\n`)
 * @param now  injectable clock for deterministic tests
 */
export function parseAttlogBody(body: string, now = Date.now()): AttlogParseResult {
  const punches: NormalizedPunch[] = [];
  let skipped = 0;
  let lines = 0;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    lines += 1;

    const fields = line.split('\t');
    const employeeNumber = (fields[0] ?? '').trim();
    const punchAt = parseLocalDateTime(fields[1] ?? '');

    if (!employeeNumber || punchAt === null || !isPlausiblePunchTime(punchAt, now)) {
      skipped += 1;
      continue;
    }

    punches.push({
      employeeNumber,
      punchAt,
      direction: directionFromStatus(fields[2]),
    });
  }

  return { punches, skipped, lines };
}

/** ADMS punch state → direction. Anything unrecognised stays `unknown`. */
export function directionFromStatus(status: string | undefined): 'in' | 'out' | 'unknown' {
  const text = (status ?? '').trim();
  // `Number('')` is 0, which would silently record a missing status as a
  // check-in. A column-shifted or truncated line must not invent a direction.
  if (!text) return 'unknown';
  const code = Number(text);
  if (!Number.isFinite(code)) return 'unknown';
  if (code === 0) return 'in';
  if (code === 1) return 'out';
  return 'unknown';
}

/** Reject a terminal clock set to 1970 or to next year — same rule as the webhook path. */
function isPlausiblePunchTime(punchAt: number, now: number): boolean {
  const MIN = Date.UTC(2000, 0, 1);
  const MAX_FUTURE = now + 1000 * 60 * 60 * 24;
  return punchAt >= MIN && punchAt <= MAX_FUTURE;
}

// ── Responses the device expects ─────────────────────────────────────────────

/**
 * Handshake configuration. Format is positional key=value lines and the device
 * parses it literally; the first line must be the `GET OPTION FROM:` banner.
 *
 * `TimeZone=4` is Armenia (UTC+4) — the zone every timestamp in this product is
 * resolved against. `Realtime=1` makes the terminal push a punch as it happens
 * instead of waiting for `TransInterval`, which is the difference between a live
 * attendance board and a batch that arrives an hour late. `TransFlag` keeps
 * attendance/operation/user-info uploads enabled and fingerprint templates off
 * (we never store biometric templates — descriptors stay on the device).
 */
export function buildHandshakeResponse(serial: string): string {
  return [
    `GET OPTION FROM: ${serial}`,
    'Stamp=9999',
    'OpStamp=9999',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=1111000000',
    'TimeZone=4',
    'Realtime=1',
    'Encrypt=0',
  ].join('\r\n');
}

/** Acknowledgement of a punch batch. Devices require the `OK:` prefix. */
export function buildAttlogAck(punchCount: number): string {
  return `OK: ${punchCount}`;
}

/** Plain `OK` — expected by getrequest/devicecmd/ping. */
export const ZK_OK = 'OK';

// Deliberately no `zkText()` helper here: this module stays free of web globals
// so it can be unit-tested without a fetch polyfill. The HTTP layer builds the
// `Response` (plain text is the only content type ADMS understands).

// ── Setup documentation (rendered in the inbound settings screen) ────────────

/** Mount point every ADMS request arrives on. Shown to the admin as the path. */
export const ZK_SERVER_PATH = '/iclock';

/**
 * What a terminal has to support to work with this endpoint.
 *
 * Stated as capabilities rather than as a model list on purpose. "Supported
 * models" would be a compatibility matrix, and a compatibility matrix nobody has
 * tested against real hardware is a promise with no evidence behind it — the
 * same reason the bank profiles ship unverified. A capability check is something
 * the admin can confirm by looking at their own terminal's menu in ten seconds.
 */
export interface ZkCapability {
  id: string;
  labelKey: string;
  /** Why it matters, in the admin's terms. */
  detailKey: string;
}

export const ZK_REQUIRED_CAPABILITIES: ZkCapability[] = [
  {
    id: 'push',
    labelKey: 'settings.inbound.zkteco.capabilities.push',
    detailKey: 'settings.inbound.zkteco.capabilityDetails.push',
  },
  {
    id: 'server_address',
    labelKey: 'settings.inbound.zkteco.capabilities.serverAddress',
    detailKey: 'settings.inbound.zkteco.capabilityDetails.serverAddress',
  },
  {
    id: 'serial',
    labelKey: 'settings.inbound.zkteco.capabilities.serial',
    detailKey: 'settings.inbound.zkteco.capabilityDetails.serial',
  },
];

/** One numbered step of the onboarding walkthrough. */
export interface ZkSetupStep {
  id: string;
  labelKey: string;
  detailKey: string;
}

/**
 * The order the terminal and the platform have to be configured in.
 *
 * Mint the token before touching the device: the device authenticates by serial
 * number against a bound token, so a terminal pointed at this deployment before
 * a token exists will simply be ignored (by design — an unauthenticated device
 * must not be able to write punches).
 */
export const ZK_SETUP_STEPS: ZkSetupStep[] = [
  {
    id: 'mint',
    labelKey: 'settings.inbound.zkteco.steps.mint',
    detailKey: 'settings.inbound.zkteco.stepDetails.mint',
  },
  {
    id: 'serial',
    labelKey: 'settings.inbound.zkteco.steps.serial',
    detailKey: 'settings.inbound.zkteco.stepDetails.serial',
  },
  {
    id: 'bind',
    labelKey: 'settings.inbound.zkteco.steps.bind',
    detailKey: 'settings.inbound.zkteco.stepDetails.bind',
  },
  {
    id: 'server',
    labelKey: 'settings.inbound.zkteco.steps.server',
    detailKey: 'settings.inbound.zkteco.stepDetails.server',
  },
  {
    id: 'clock',
    labelKey: 'settings.inbound.zkteco.steps.clock',
    detailKey: 'settings.inbound.zkteco.stepDetails.clock',
  },
  {
    id: 'review',
    labelKey: 'settings.inbound.zkteco.steps.review',
    detailKey: 'settings.inbound.zkteco.stepDetails.review',
  },
];

/**
 * Device families known to speak this protocol, given as examples to look for in
 * a terminal's own menu.
 *
 * `ADMS` is the name ZKTeco uses for the push protocol; "Cloud Server" and
 * "Webserver" are how the same setting is labelled on different firmware.
 * Suprema is listed separately and honestly: BioStar devices push their own
 * format, so they belong on the generic webhook token rather than here.
 */
export interface ZkDeviceFamily {
  id: string;
  labelKey: string;
  /** Menu labels to look for, shown verbatim because firmware wording differs. */
  menuHints: string[];
  /** i18n key for the caveat that applies to this family. */
  noteKey: string;
  /** Whether this family uses the `/iclock` endpoints or the generic webhook. */
  endpoint: 'adms' | 'generic';
}

export const ZK_DEVICE_FAMILIES: ZkDeviceFamily[] = [
  {
    id: 'zkteco_face',
    labelKey: 'settings.inbound.zkteco.families.face',
    menuHints: ['Comm → Cloud Server', 'Comm → ADMS', 'Comm → Webserver'],
    noteKey: 'settings.inbound.zkteco.familyNotes.face',
    endpoint: 'adms',
  },
  {
    id: 'zkteco_fingerprint',
    labelKey: 'settings.inbound.zkteco.families.fingerprint',
    menuHints: ['Comm → Ethernet → Cloud Server', 'Comm → ADMS'],
    noteKey: 'settings.inbound.zkteco.familyNotes.fingerprint',
    endpoint: 'adms',
  },
  {
    id: 'suprema',
    labelKey: 'settings.inbound.zkteco.families.suprema',
    menuHints: ['BioStar 2 → Device → Server', 'BioStar 2 → Push'],
    noteKey: 'settings.inbound.zkteco.familyNotes.suprema',
    // BioStar has its own device-to-server format. Sending it to /iclock would
    // be guesswork; the generic webhook exists to map those field spellings.
    endpoint: 'generic',
  },
];

/**
 * Settings the handshake imposes on the device, shown next to the steps so the
 * admin does not have to infer them from the response body.
 */
export const ZK_HANDSHAKE_SETTINGS = {
  /** Armenia (UTC+4) — the zone every timestamp in the product is resolved in. */
  timeZone: 4,
  /** Seconds between polls; matches `Delay` in the handshake response. */
  pollSeconds: 10,
  /** Terminal-local wall clock, which is why the clock step matters. */
  clockSource: 'device' as const,
};

/** Setup guide as plain text, for the printable/copyable view and the docs. */
export function describeZkSetup(translate: (key: string) => string): string {
  const steps = ZK_SETUP_STEPS.map(
    (step, index) => `${index + 1}. ${translate(step.labelKey)}\n   ${translate(step.detailKey)}`,
  ).join('\n');
  const capabilities = ZK_REQUIRED_CAPABILITIES.map(
    (cap) => `- ${translate(cap.labelKey)}: ${translate(cap.detailKey)}`,
  ).join('\n');
  return `${steps}\n\n${capabilities}`;
}
