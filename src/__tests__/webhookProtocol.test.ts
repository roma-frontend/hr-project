/**
 * Unit tests for the outbound webhook protocol helpers
 * (convex/webhooks/protocol.ts). These run in Node without any Convex
 * runtime — they pin the exact HMAC-SHA256 signing scheme consumers must
 * verify against, plus the URL/subscription validation rules.
 *
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';
import * as crypto from 'crypto';

import {
  WEBHOOK_EVENT_TYPES,
  isWebhookEventType,
  signPayload,
  buildEnvelope,
  generateEndpointSecret,
  isValidEndpointUrl,
  maskSecret,
  normalizeEventSubscription,
  RETRY_DELAYS_MS,
  MAX_CONSECUTIVE_FAILURES,
  DELIVERY_RETENTION_MS,
  OUTBOUND_SIGNATURE_HEADER,
  OUTBOUND_TIMESTAMP_HEADER,
  OUTBOUND_EVENT_HEADER,
} from '../../convex/webhooks/protocol';

describe('webhook protocol constants', () => {
  it('exposes the delivery headers consumers verify', () => {
    expect(OUTBOUND_SIGNATURE_HEADER).toBe('x-webhook-signature');
    expect(OUTBOUND_TIMESTAMP_HEADER).toBe('x-webhook-timestamp');
    expect(OUTBOUND_EVENT_HEADER).toBe('x-webhook-event');
  });

  it('has a sane retry schedule and limits', () => {
    // First entry is the immediate attempt; the last is the terminal one.
    expect(RETRY_DELAYS_MS[0]).toBe(0);
    expect(RETRY_DELAYS_MS.length).toBeGreaterThanOrEqual(3);
    expect(MAX_CONSECUTIVE_FAILURES).toBeGreaterThanOrEqual(5);
    expect(DELIVERY_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('includes the core leave lifecycle events', () => {
    for (const expected of ['leave.requested', 'leave.approved', 'leave.rejected']) {
      expect(WEBHOOK_EVENT_TYPES).toContain(expected);
    }
  });
});

describe('signPayload', () => {
  it('matches an independent node-crypto HMAC-SHA256 computation', async () => {
    const secret = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8';
    const timestamp = '1700000000';
    const body = JSON.stringify({ hello: 'world' });

    const actual = await signPayload(secret, timestamp, body);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    expect(actual).toBe(expected);
  });

  it('changes when the timestamp or body changes', async () => {
    const secret = 'secret';
    const a = await signPayload(secret, '111', 'body-a');
    const b = await signPayload(secret, '222', 'body-a');
    const c = await signPayload(secret, '111', 'body-b');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('produces 64 hex characters (sha256)', async () => {
    const sig = await signPayload('k', '1', 'b');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('buildEnvelope', () => {
  it('wraps event, org, delivery id and data with an occurredAt', () => {
    const occurredAt = 1_700_000_000_000;
    const parsed = JSON.parse(
      buildEnvelope({
        eventType: 'leave.approved',
        orgId: 'org123',
        deliveryId: 'del456',
        data: { leaveId: 'leave789' },
        occurredAt,
      }),
    ) as Record<string, unknown>;

    expect(parsed).toEqual({
      event: 'leave.approved',
      organizationId: 'org123',
      deliveryId: 'del456',
      occurredAt,
      data: { leaveId: 'leave789' },
    });
  });
});

describe('generateEndpointSecret', () => {
  it('produces 64 hex characters (256 bits) and is random', () => {
    const a = generateEndpointSecret();
    const b = generateEndpointSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('isValidEndpointUrl', () => {
  it('accepts https URLs', () => {
    expect(isValidEndpointUrl('https://example.com/hooks/hr')).toBe(true);
    expect(isValidEndpointUrl('https://hooks.zapier.com/hooks/catch/123/abc')).toBe(true);
  });

  it('rejects plain http, non-URLs and empty hosts', () => {
    expect(isValidEndpointUrl('http://example.com/hook')).toBe(false);
    expect(isValidEndpointUrl('ftp://example.com/hook')).toBe(false);
    expect(isValidEndpointUrl('not a url')).toBe(false);
    expect(isValidEndpointUrl('')).toBe(false);
  });
});

describe('maskSecret', () => {
  it('shows only the last four characters', () => {
    expect(maskSecret('abcd1234efgh5678')).toBe('••••••••5678');
  });

  it('fully masks short secrets', () => {
    expect(maskSecret('abc')).toBe('••••');
  });
});

describe('normalizeEventSubscription', () => {
  it('keeps only known event types and deduplicates', () => {
    expect(
      normalizeEventSubscription(['leave.approved', 'leave.approved', 'nonsense.event']),
    ).toStrictEqual(['leave.approved']);
  });

  it('returns an empty array when nothing valid is passed (all events)', () => {
    expect(normalizeEventSubscription(['bogus'])).toEqual([]);
  });

  it('treats membership via the type guard consistently', () => {
    expect(isWebhookEventType('leave.requested')).toBe(true);
    expect(isWebhookEventType('leave.nonsense')).toBe(false);
  });
});
