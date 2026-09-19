/**
 * emailMessage — what an outgoing email should say, and where it should go.
 *
 * Pure on purpose. Sending is one HTTP call, but *deciding* is where the
 * mistakes live: a recipient that is empty, a from-address on a domain that is
 * not verified, a body that turns a user-supplied name into raw HTML. Those
 * decisions are testable without a network, so they are tested.
 *
 * ── The routing rule, inherited from the existing sends ─────────────────────
 * Resend will only deliver from an unverified domain to the account owner's own
 * address. `src/app/api/auth/forgot-password/route.ts` already deals with this:
 * while the sending domain is unverified it redirects every message to
 * `RESEND_TEST_EMAIL` (falling back to the bootstrap superadmin) and marks the
 * subject `[For <real address>]`. This module reproduces that convention rather
 * than inventing a second one, including the marker, because the alternative is
 * a product that reports "email sent" while nothing arrives anywhere.
 *
 * A redirect is always reported (`redirected: true` + `intendedTo`), never
 * silent: a workflow that emails a new hire must not look delivered when it went
 * to the administrator's inbox instead.
 *
 * Note the API key and the redirect target are passed in rather than read from
 * `process.env` here — that is what keeps this module testable, and it keeps the
 * environment handling in one place (`convex/emails.ts`).
 */

/** The pieces of the environment this module cares about. */
export interface EmailEnv {
  apiKey?: string | null;
  /** `RESEND_DOMAIN_VERIFIED === 'true'` — the gate the existing sends use. */
  domainVerified?: boolean;
  /** `RESEND_TEST_EMAIL`, then `BOOTSTRAP_SUPERADMIN_EMAIL`. */
  testEmail?: string | null;
  fromEmail?: string | null;
}

/**
 * The literal placeholder shipped in `.env.example`. Treated as "not
 * configured" — the same guard the forgot-password route applies, so a copied
 * example file sends nothing instead of failing at Resend with a 401.
 */
const PLACEHOLDER_MARKER = 'your_api_key';

export const DEFAULT_FROM = 'Strata <onboarding@resend.dev>';
export const VERIFIED_FROM = 'Strata <hr@strata.work>';

/** Deliberately permissive: we are not the authority on what an address is. */
export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  // One @, something on each side, a dot-bearing domain, no whitespace.
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(trimmed);
}

export type RoutingProblem = 'no_api_key' | 'no_recipient' | 'invalid_recipient' | 'no_fallback';

export interface EmailRouting {
  /** False means "do not attempt a send" — see `problem`. */
  configured: boolean;
  problem?: RoutingProblem;
  from: string;
  /** Where the message will actually be sent. */
  to: string;
  /** Where it was meant to go, before any redirect. */
  intendedTo: string;
  /** True when an unverified domain forced the fallback inbox. */
  redirected: boolean;
  /** True when the domain is verified, so `to` is the real recipient. */
  domainVerified: boolean;
}

/**
 * Decide from/to for one message.
 *
 * Returns `configured: false` with a reason instead of throwing: the caller is a
 * workflow run, and "email is not set up on this deployment" is a result to
 * record, not an exception that should fail the whole run.
 */
export function resolveEmailRouting(intendedTo: string, env: EmailEnv): EmailRouting {
  const verified = env.domainVerified === true;
  const from = env.fromEmail?.trim() || (verified ? VERIFIED_FROM : DEFAULT_FROM);
  const wanted = intendedTo.trim();

  const key = env.apiKey?.trim() ?? '';
  const hasKey = key.length > 0 && !key.includes(PLACEHOLDER_MARKER);

  const base: EmailRouting = {
    configured: false,
    from,
    to: wanted,
    intendedTo: wanted,
    redirected: false,
    domainVerified: verified,
  };

  if (!hasKey) return { ...base, problem: 'no_api_key' };
  if (!wanted) return { ...base, problem: 'no_recipient' };
  if (!isValidEmailAddress(wanted)) return { ...base, problem: 'invalid_recipient' };

  if (verified) return { ...base, configured: true };

  // Unverified domain: only the account owner can receive. Without a fallback
  // there is nowhere legitimate to send, so the message is held rather than
  // dropped on the floor with a success status.
  const fallback = env.testEmail?.trim() ?? '';
  if (!isValidEmailAddress(fallback)) return { ...base, problem: 'no_fallback' };

  return { ...base, configured: true, to: fallback, redirected: true };
}

/**
 * `[For ada@example.com] Leave approved` — the same marker the password-reset
 * email uses, so a redirected message is obvious in the inbox it landed in.
 */
export function markRedirectedSubject(subject: string, intendedTo: string): string {
  return `[For ${intendedTo}] ${subject}`;
}

// ── Content ─────────────────────────────────────────────────────────────────

export interface EmailContentInput {
  subject: string;
  /** Plain text the workflow author wrote. Rendered as paragraphs. */
  body: string;
  /** Shown in the header and the footer, so the mail is from the org. */
  organizationName?: string;
  /** Greeting name, when we know it. */
  recipientName?: string;
  /** Deep link back into the product, rendered as a button. */
  actionUrl?: string;
  actionLabel?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** Escape for HTML text nodes. The body is author-written but still data. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) is allowed as a button target — `javascript:` is not a link. */
function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Build the message.
 *
 * The visual shell mirrors the existing password-reset email (dark card, same
 * type ramp) so product mail looks like one product, and the body is escaped:
 * a workflow can interpolate a person's name, and a name is data, not markup.
 */
export function buildEmailContent(input: EmailContentInput): EmailContent {
  const subject = input.subject.trim() || '(no subject)';
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('(no message)');

  const org = input.organizationName?.trim();
  const greeting = input.recipientName?.trim();
  const url = safeUrl(input.actionUrl);
  const label = (input.actionLabel?.trim() || 'Open').slice(0, 40);

  const safeParagraphs = paragraphs.map((p) => escapeHtml(p).replace(/\n/g, '<br>'));
  const intro = greeting ? `Hi ${escapeHtml(greeting)},` : null;

  const button = url
    ? `<a href="${escapeHtml(url)}" style="display:block;text-align:center;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-size:15px;margin:24px 0;">${escapeHtml(label)} →</a>`
    : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f14;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:#1a1a2e;border:1px solid rgba(99,102,241,0.2);border-radius:16px;padding:36px;">
      ${org ? `<p style="color:#93c5fd;font-size:13px;font-weight:600;margin:0 0 12px;letter-spacing:0.02em;">${escapeHtml(org)}</p>` : ''}
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 16px;">${escapeHtml(subject)}</h1>
      ${intro ? `<p style="color:#9ca3af;font-size:15px;margin:0 0 12px;">${intro}</p>` : ''}
      ${safeParagraphs.map((p) => `<p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 12px;">${p}</p>`).join('')}
      ${button}
    </div>
    <p style="text-align:center;color:#4b5563;font-size:12px;margin-top:20px;">
      ${org ? `${escapeHtml(org)} · ` : ''}Sent via Strata
    </p>
  </div>
</body></html>`;

  // Plain-text alternative: some clients and every corporate spam filter want it,
  // and it is also what a person reads when HTML is stripped.
  const text = [
    org ? `${org}` : null,
    subject,
    '',
    greeting ? `Hi ${greeting},` : null,
    ...paragraphs,
    url ? `\n${label}: ${url}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return { subject, html, text };
}

/**
 * One safe header value.
 *
 * Newlines are collapsed to spaces and runs of whitespace are collapsed to one:
 * a subject containing `\r\n` is header injection — a second `Bcc:` header the
 * author never wrote — and the collapsed form is also what a reader expects.
 * Length is capped because subjects this long are a bug in the step, not a
 * deliberate choice.
 */
export function normalizeSubject(subject: string): string {
  const single = subject.replace(/\s+/g, ' ').trim();
  return single.length > 200 ? `${single.slice(0, 197)}...` : single;
}
