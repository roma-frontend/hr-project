/**
 * Local PSP payments (Idram / ArCa acquiring).
 *
 * The webhook is the only thing standing between a public URL and a free
 * Enterprise plan, so the signature path is tested against Node's own
 * `crypto.createHmac` rather than against itself — a bug in the pure-TS HMAC
 * would otherwise be invisible, since both sides of the comparison would be
 * wrong in the same way.
 */

import { createHmac } from 'node:crypto';
import {
  PAYMENT_PROVIDERS,
  buildHandshake,
  extractOrderId,
  hmacSha256Hex,
  normalizePspSuccess,
  verifyPaymentSignature,
} from '../../convex/payments';

const SECRET = 'test-webhook-secret-0123456789';

function nodeSignature(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyPaymentSignature', () => {
  const body = JSON.stringify({ orderId: 'SABC123', success: true });

  it('accepts a signature produced by a standard HMAC-SHA256 implementation', () => {
    expect(verifyPaymentSignature(SECRET, body, nodeSignature(body))).toBe(true);
  });

  it('rejects a body that was modified after signing', () => {
    const signature = nodeSignature(body);
    const tampered = JSON.stringify({ orderId: 'SABC123', success: true, extra: 1 });
    expect(verifyPaymentSignature(SECRET, tampered, signature)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyPaymentSignature(SECRET, body, nodeSignature(body, 'other-secret'))).toBe(false);
  });

  it('rejects an empty signature', () => {
    expect(verifyPaymentSignature(SECRET, body, '')).toBe(false);
  });

  it('tolerates case and surrounding whitespace in the provided signature', () => {
    expect(verifyPaymentSignature(SECRET, body, `  ${nodeSignature(body).toUpperCase()}  `)).toBe(
      true,
    );
  });

  it('returns false (never throws) for a non-ASCII secret', () => {
    expect(() => verifyPaymentSignature('секрет', body, nodeSignature(body))).not.toThrow();
    expect(verifyPaymentSignature('секрет', body, nodeSignature(body))).toBe(false);
  });

  it('handles secrets longer than the 64-byte HMAC block', () => {
    const longSecret = 'k'.repeat(200);
    expect(verifyPaymentSignature(longSecret, body, nodeSignature(body, longSecret))).toBe(true);
  });

  it('handles an empty secret', () => {
    expect(verifyPaymentSignature('', body, nodeSignature(body, ''))).toBe(true);
  });

  it('signs a non-ASCII body as UTF-8', () => {
    // Amounts and payer names carry Armenian text; the bytes signed must be the
    // UTF-8 encoding of the decoded body, not a byte-per-code-unit reading.
    const unicodeBody = JSON.stringify({ orderId: 'S1', payer: 'Արամ' });
    expect(verifyPaymentSignature(SECRET, unicodeBody, nodeSignature(unicodeBody))).toBe(true);
  });
});

describe('hmacSha256Hex', () => {
  // RFC 2104 test vector, cross-checked against Node's createHmac.
  it('matches a reference implementation for arbitrary binary input', () => {
    const key = 'key';
    const message = 'The quick brown fox jumps over the lazy dog';
    expect(hmacSha256Hex(key, message)).toBe(nodeSignature(message, key));
  });
});

describe('PAYMENT_PROVIDERS', () => {
  it('exposes exactly the supported local rails', () => {
    expect([...PAYMENT_PROVIDERS].sort()).toEqual(
      ['ameriabank', 'ardshinbank', 'fastbank', 'idram'].sort(),
    );
  });
});

describe('buildHandshake', () => {
  const base = {
    merchantId: '123456789',
    orderId: 'SABC123',
    amountAmd: 30500,
    description: 'Strata professional plan, 1 month(s)',
    successUrl: 'https://app.example.com/checkout/local/success',
    failUrl: 'https://app.example.com/checkout/local/fail',
  };

  it('builds an Idram form POST to the published endpoint by default', () => {
    const hs = buildHandshake({ ...base, provider: 'idram' });
    expect(hs.mode).toBe('form');
    if (hs.mode !== 'form') throw new Error('expected form handshake');
    expect(hs.action).toBe('https://banking.idram.am/Payment/GetPayment');
    expect(hs.fields.EDP_REC_ACCOUNT).toBe('123456789');
    expect(hs.fields.EDP_ORDERID).toBe('SABC123');
    // PSPs expect a 2-decimal money string, not a raw number.
    expect(hs.fields.EDP_AMOUNT).toBe('30500.00');
    expect(hs.fields.EDP_SUCCESS_URL).toBe(base.successUrl);
    expect(hs.fields.EDP_FAIL_URL).toBe(base.failUrl);
  });

  it('lets a sandbox endpoint override the Idram default', () => {
    const hs = buildHandshake({
      ...base,
      provider: 'idram',
      apiUrl: 'https://sandbox.idram.am/Payment/GetPayment',
    });
    if (hs.mode !== 'form') throw new Error('expected form handshake');
    expect(hs.action).toBe('https://sandbox.idram.am/Payment/GetPayment');
  });

  it('refuses an acquiring provider with no endpoint instead of guessing a host', () => {
    expect(() => buildHandshake({ ...base, provider: 'ameriabank' })).toThrow(/API URL/);
  });

  it('builds a redirect handshake for an acquiring provider', () => {
    const hs = buildHandshake({
      ...base,
      provider: 'ameriabank',
      apiUrl: 'https://payments.ameriabank.am/register',
    });
    expect(hs.mode).toBe('redirect');
    if (hs.mode !== 'redirect') throw new Error('expected redirect handshake');
    const url = new URL(hs.url);
    expect(url.searchParams.get('merchantId')).toBe('123456789');
    expect(url.searchParams.get('orderId')).toBe('SABC123');
    expect(url.searchParams.get('amount')).toBe('30500.00');
    expect(url.searchParams.get('currency')).toBe('AMD');
    expect(url.searchParams.get('successUrl')).toBe(base.successUrl);
  });

  it('never reports a USD amount as the PSP charge — AMD is what is sent', () => {
    const hs = buildHandshake({ ...base, provider: 'idram', amountAmd: 386 });
    if (hs.mode !== 'form') throw new Error('expected form handshake');
    expect(hs.fields.EDP_AMOUNT).toBe('386.00');
  });
});

describe('extractOrderId', () => {
  it.each([
    ['orderId', { orderId: 'A1' }],
    ['orderid', { orderid: 'A2' }],
    ['EDP_ORDERID', { EDP_ORDERID: 'A3' }],
    ['OrderID', { OrderID: 'A4' }],
  ])('reads the %s spelling', (_label, payload) => {
    expect(extractOrderId(payload)).not.toBe('');
  });

  it('returns an empty string when the delivery carries no order id', () => {
    expect(extractOrderId({ amount: 100 })).toBe('');
  });
});

describe('normalizePspSuccess', () => {
  it('passes through an explicit boolean', () => {
    expect(normalizePspSuccess({ success: true })).toBe(true);
    expect(normalizePspSuccess({ success: false })).toBe(false);
  });

  it('treats Idram result code 0 as paid, and any other code as not paid', () => {
    expect(normalizePspSuccess({ EDP_RESULT: 0 })).toBe(true);
    expect(normalizePspSuccess({ EDP_RESULT: '0' })).toBe(true);
    expect(normalizePspSuccess({ EDP_RESULT: '1' })).toBe(false);
    expect(normalizePspSuccess({ EDP_RESULT: -1 })).toBe(false);
  });

  it('accepts the common string statuses case-insensitively', () => {
    expect(normalizePspSuccess({ status: 'PAID' })).toBe(true);
    expect(normalizePspSuccess({ status: 'Success' })).toBe(true);
    expect(normalizePspSuccess({ status: 'completed' })).toBe(true);
  });

  it('treats an unrecognized or absent status as NOT paid', () => {
    // Ambiguity must fail closed — a wrong `true` here hands out a paid plan.
    expect(normalizePspSuccess({ status: 'pending' })).toBe(false);
    expect(normalizePspSuccess({ status: 'weird' })).toBe(false);
    expect(normalizePspSuccess({})).toBe(false);
  });
});
