/**
 * Normalization for inbound payloads — pure, so the mapping rules for vendor
 * shapes are unit-testable without the Convex runtime.
 *
 * Terminals and SaaS webhooks all describe the same three facts differently
 * (`PIN` vs `employeeNumber` vs `emp_code` vs `user_id`; seconds vs milliseconds
 * vs ISO string; `0/1` vs `in/out`), and a device firmware update can change the
 * spelling overnight. Parsing here keeps `convex/inbound.ts` about what to *do*
 * with a punch instead of about which field name arrived today.
 */

/** Fields a ZKTeco/Suprema-style push uses for the табельный номер. */
const EMPLOYEE_NUMBER_KEYS = [
  'employeeNumber',
  'employee_number',
  'emp_code',
  'empCode',
  'employeeCode',
  'employeeNo',
  'personnelNumber',
  'pin',
  'user_id',
  'userId',
  'badge',
] as const;

const TIMESTAMP_KEYS = [
  'timestamp',
  'punchTime',
  'punch_time',
  'punchedAt',
  'occurredAt',
  'time',
  'datetime',
] as const;

// Firmware spells this one differently in every generation: `punch_state` and
// `punch_state_1` are the two ZKTeco uses most, `punchState` shows up in the
// Suprema docs, `state`/`type` in generic REST pushers.
const DIRECTION_KEYS = [
  'direction',
  'type',
  'state',
  'punch_state',
  'punch_state_1',
  'punchState',
  'punchType',
  'punch_type',
  'status',
] as const;

/** Plausible punch window, in ms epoch — rejects a device clock set to 1970 or 2099. */
const MIN_PUNCH_MS = Date.UTC(2000, 0, 1);
const MAX_PUNCH_FUTURE_MS = 1000 * 60 * 60 * 24; // one day of clock drift allowed

/**
 * A terminal reports local wall clock, and the deployments run in Armenia
 * (UTC+4) — the same zone `convex/timeTracking.ts` schedules against.
 *
 * A naive string MUST be resolved against a fixed offset rather than the runtime
 * zone: `Date.parse('2026-09-18 09:01:22')` means 09:01 in whatever zone the
 * process happens to be in, so a punch would land five hours away from reality
 * on a CI runner in UTC and four on a laptop in Yerevan. Timestamps carrying an
 * explicit zone (`Z`, `+02:00`) keep their own offset.
 */
const ARMENIA_OFFSET_MS = 4 * 60 * 60 * 1000;

const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseLocalDateTime(text: string): number | null {
  const match = NAIVE_DATETIME.exec(text.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  return utc - ARMENIA_OFFSET_MS;
}

export interface NormalizedPunch {
  employeeNumber: string;
  punchAt: number;
  direction: 'in' | 'out' | 'unknown';
}

function firstString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * Read a punch time out of whatever the device sent.
 *
 * Accepts epoch seconds, epoch milliseconds and ISO/`YYYY-MM-DD HH:mm:ss`
 * strings (devices like `2026-09-18 09:01:22`). Returns null when nothing
 * usable was sent — the caller records the raw payload as unmatched rather than
 * inventing a time.
 */
export function parsePunchTime(value: unknown, now = Date.now()): number | null {
  let ms: number | null = null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Seconds vs milliseconds: a 10-digit number is seconds, 13-digit is ms.
    ms = value < 1e11 ? value * 1000 : value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      ms = numeric < 1e11 ? numeric * 1000 : numeric;
    } else {
      const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
      if (hasZone) {
        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) ms = parsed;
      } else {
        // Local wall clock from the device (see ARMENIA_OFFSET_MS).
        ms = parseLocalDateTime(trimmed);
        if (ms === null) {
          // Date-only strings (`2026-09-18`) fall through to Date.parse, which
          // handles them as UTC midnight — close enough for a day-level punch.
          const parsed = Date.parse(trimmed.replace(' ', 'T'));
          if (!Number.isNaN(parsed)) ms = parsed;
        }
      }
    }
  }

  if (ms === null || !Number.isFinite(ms)) return null;
  if (ms < MIN_PUNCH_MS) return null;
  if (ms > now + MAX_PUNCH_FUTURE_MS) return null;
  return Math.round(ms);
}

/** `0`/`in`/`checkin` → in, `1`/`out`/`checkout` → out, anything else → unknown. */
export function parseDirection(value: unknown): 'in' | 'out' | 'unknown' {
  if (typeof value === 'number') {
    if (value === 0) return 'in';
    if (value === 1) return 'out';
    return 'unknown';
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['in', '0', 'check_in', 'checkin', 'i', 'entry', '0.0'].includes(normalized)) return 'in';
    if (['out', '1', 'check_out', 'checkout', 'o', 'exit', '1.0'].includes(normalized))
      return 'out';
  }
  return 'unknown';
}

/**
 * Normalize a terminal push into the three facts the journal stores.
 *
 * A payload may describe several punches at once (some firmware batches them);
 * `normalizePunches` handles both by accepting an array under `data`/`punches`.
 */
export function normalizePunch(
  payload: Record<string, unknown>,
  now = Date.now(),
): NormalizedPunch | null {
  const employeeNumber = firstString(payload, EMPLOYEE_NUMBER_KEYS);
  if (!employeeNumber) return null;

  const rawTime = firstString(payload, TIMESTAMP_KEYS);
  const punchAt = parsePunchTime(rawTime ?? payload.timestamp, now);
  if (punchAt === null) return null;

  return {
    employeeNumber,
    punchAt,
    direction: parseDirection(firstString(payload, DIRECTION_KEYS)),
  };
}

/** Every punch in a push: the payload itself, or the array it wraps. */
export function normalizePunches(body: unknown, now = Date.now()): NormalizedPunch[] {
  const records = collectRecords(body);
  return records
    .map((record) => normalizePunch(record, now))
    .filter((punch): punch is NormalizedPunch => punch !== null);
}

function collectRecords(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter((item): item is Record<string, unknown> => isRecord(item));
  }
  if (!isRecord(body)) return [];
  for (const key of ['punches', 'data', 'records', 'items'] as const) {
    const nested = body[key];
    if (Array.isArray(nested)) {
      const records = nested.filter((item): item is Record<string, unknown> => isRecord(item));
      if (records.length > 0) return records;
    }
  }
  return [body];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface NormalizedJiraEvent {
  issueKey: string;
  summary: string;
  url?: string;
  /** Jira's own event name, e.g. `jira:issue_created`. */
  event?: string;
  description?: string;
}

/**
 * Map a Jira webhook payload onto a task.
 *
 * Jira posts `{ webhookEvent, issue: { key, self, fields: { summary, description } } }`.
 * Only `issue.key` is mandatory: without it there is nothing to reference, and a
 * task titled "Untitled" would be noise in someone's board.
 */
export function normalizeJiraEvent(body: unknown): NormalizedJiraEvent | null {
  if (!isRecord(body)) return null;
  const issue = body.issue;
  if (!isRecord(issue)) return null;

  const issueKey = typeof issue.key === 'string' ? issue.key.trim() : '';
  if (!issueKey) return null;

  const fields = isRecord(issue.fields) ? issue.fields : {};
  const summary =
    typeof fields.summary === 'string' && fields.summary.trim() ? fields.summary.trim() : issueKey;

  const self = typeof issue.self === 'string' ? issue.self : undefined;
  const url = typeof body.issue_url === 'string' ? body.issue_url : self;

  const description =
    typeof fields.description === 'string' && fields.description.trim()
      ? fields.description.trim()
      : undefined;

  return {
    issueKey,
    summary,
    url,
    description,
    event: typeof body.webhookEvent === 'string' ? body.webhookEvent : undefined,
  };
}

/** Truncate a payload before storing it for debugging (never store megabytes). */
export function truncateRaw(body: unknown, max = 2000): string {
  let text: string;
  try {
    text = JSON.stringify(body);
  } catch {
    text = String(body);
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
