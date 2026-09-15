/**
 * Local PSP crypto and handshake helpers — deliberately free of any Convex
 * import.
 *
 * Why this file exists separately from `convex/payments.ts`: the HTTP router
 * (`convex/http.ts`) needs `verifyPaymentSignature` to authenticate a webhook,
 * but importing `payments.ts` would pull in its `query`/`mutation` registrations
 * at module load. That is fine at runtime and poison in tests — the HTTP router
 * suites mock `_generated/server` down to `httpAction` alone, so a transitive
 * `query()` call explodes before a single route is registered.
 *
 * Keeping the pure half here means: the router imports bytes and maths, nothing
 * else, and the whole thing is testable without a Convex runtime.
 */

import { sha256BytesHex, sha256Hex, utf8Bytes } from './sha256';

// ── Webhook signature verification ──────────────────────────────────────────
// HMAC-SHA256 (RFC 2104) built on the pure-TS SHA-256 the document-integrity
// path already uses — no Node crypto needed inside a mutation.
//
// It works on BYTE ARRAYS throughout, never strings. Routing a digest through a
// string corrupts every byte ≥ 0x80 on the way back in: `sha256Hex` UTF-8
// encodes its input, so digest byte 0xC8 would be hashed as the two bytes
// 0xC3 0x88. That is why `lib/sha256` exposes `sha256BytesHex`.
//
// Keys must be ASCII (PSP secrets are hex/base64). A non-ASCII key is rejected
// rather than silently mis-signed.

/** Hex digest → byte array. */
function hexToByteArray(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

/** HMAC-SHA256 over a UTF-8 message. Exported so it can be checked against a reference. */
export function hmacSha256Hex(key: string, message: string): string {
  if (!/^[\x00-\x7F]*$/.test(key)) {
    throw new Error('Payment webhook secret must be ASCII');
  }
  const block = 64;
  // RFC 2104 §2: a key longer than the block is replaced by its DIGEST — the
  // raw 32 bytes, not the 64-character hex rendering that would merely fill the
  // block and skip the shortening the spec asks for.
  let keyBytes = key.length > block ? hexToByteArray(sha256Hex(key)) : utf8Bytes(key);
  if (keyBytes.length < block) {
    keyBytes = keyBytes.concat(new Array<number>(block - keyBytes.length).fill(0));
  }

  const ipad = keyBytes.map((b) => b ^ 0x36);
  const opad = keyBytes.map((b) => b ^ 0x5c);

  const inner = sha256BytesHex(ipad.concat(utf8Bytes(message)));
  // The outer round hashes the RAW inner digest — the whole point of the byte
  // path. Hashing its hex string instead yields a MAC that verifies against
  // nothing.
  return sha256BytesHex(opad.concat(hexToByteArray(inner)));
}

/** Constant-time-ish comparison — never short-circuits on the first byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify a provider webhook signature over the raw request body. */
export function verifyPaymentSignature(
  secretKey: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  try {
    const expected = hmacSha256Hex(secretKey, rawBody);
    return safeEqual(expected, signatureHex.trim().toLowerCase());
  } catch {
    return false;
  }
}

export type PaymentProvider = 'idram' | 'ameriabank' | 'ardshinbank' | 'fastbank';

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  'idram',
  'ameriabank',
  'ardshinbank',
  'fastbank',
];

/** Published Idram payment endpoint; overridable per provider for sandbox. */
const IDRAM_DEFAULT_ENDPOINT = 'https://banking.idram.am/Payment/GetPayment';

/**
 * How the browser reaches the PSP's hosted payment page.
 *
 * Local PSPs split into two shapes and both are needed:
 *   - `form`     — Idram-style. The browser POSTs a field set (`EDP_*`) to the
 *                  PSP's payment endpoint.
 *   - `redirect` — ArCa / acquiring-bank style. The customer is sent to a
 *                  hosted URL carrying the order parameters.
 *
 * Field names below follow Idram's published EDP contract. The endpoint is
 * overridable per provider (`paymentProviderConfigs.apiUrl`) because sandbox
 * and production hosts differ — and because a bank's acquiring URL is only
 * known after merchant onboarding. Confirm the field list against the signed
 * merchant specification before taking real money.
 */
export type PaymentHandshake =
  | { mode: 'form'; action: string; fields: Record<string, string> }
  | { mode: 'redirect'; url: string };

/**
 * Order id field name differs per PSP; accept the common spellings.
 * Returns '' when the delivery carries none — the caller rejects it.
 */
export function extractOrderId(payload: Record<string, unknown>): string {
  return String(
    payload.orderId ?? payload.orderid ?? payload.EDP_ORDERID ?? payload.OrderID ?? '',
  ).trim();
}

/**
 * Normalize a PSP's success signalling into a boolean.
 *
 * Providers disagree three ways: an explicit boolean, Idram's numeric result
 * code where 0 is paid, and string statuses. Anything unrecognised is treated
 * as NOT paid — an ambiguous delivery must never activate a subscription, so
 * the failure direction is deliberate.
 */
export function normalizePspSuccess(payload: Record<string, unknown>): boolean {
  const raw = payload.success ?? payload.status ?? payload.result ?? payload.EDP_RESULT;
  if (typeof raw === 'boolean') return raw;
  if (raw === 0 || raw === '0') return true;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    return value === 'success' || value === 'paid' || value === 'ok' || value === 'completed';
  }
  return false;
}

export function buildHandshake(params: {
  provider: PaymentProvider;
  merchantId: string;
  orderId: string;
  amountAmd: number;
  description: string;
  successUrl: string;
  failUrl: string;
  apiUrl?: string;
}): PaymentHandshake {
  if (params.provider === 'idram') {
    return {
      mode: 'form',
      action: params.apiUrl || IDRAM_DEFAULT_ENDPOINT,
      fields: {
        EDP_LANGUAGE: 'EN',
        EDP_REC_ACCOUNT: params.merchantId,
        EDP_AMOUNT: params.amountAmd.toFixed(2),
        EDP_ORDERID: params.orderId,
        EDP_DESCRIPTION: params.description,
        EDP_SUCCESS_URL: params.successUrl,
        EDP_FAIL_URL: params.failUrl,
        EDP_RESULT_URL: params.successUrl,
      },
    };
  }

  if (!params.apiUrl) {
    // Refusing loudly beats sending a customer to a guessed host with a real
    // card number.
    throw new Error(
      `Provider ${params.provider} requires an API URL (paymentProviderConfigs.apiUrl)`,
    );
  }
  const url = new URL(params.apiUrl);
  url.searchParams.set('merchantId', params.merchantId);
  url.searchParams.set('orderId', params.orderId);
  url.searchParams.set('amount', params.amountAmd.toFixed(2));
  url.searchParams.set('currency', 'AMD');
  url.searchParams.set('description', params.description);
  url.searchParams.set('successUrl', params.successUrl);
  url.searchParams.set('failUrl', params.failUrl);
  return { mode: 'redirect', url: url.toString() };
}
