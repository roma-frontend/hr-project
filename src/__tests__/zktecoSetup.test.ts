/**
 * Tests for the terminal setup guide carried in `convex/lib/zkteco.ts`.
 *
 * The guide is data, not prose, so that it can be rendered in the app, printed,
 * and checked by a test. What is worth checking:
 *
 *   - every key it references resolves in all four languages, because a missing
 *     one shows the admin a raw `settings.inbound.zkteco.steps.mint` at the exact
 *     moment they are standing at a terminal with a screwdriver;
 *   - Suprema is routed to the generic webhook, not to `/iclock` — BioStar pushes
 *     its own format, and sending it to the ADMS parser would be guesswork;
 *   - the numbers in the guide match the handshake the HTTP layer actually
 *     sends, so "UTC+4" and "10s" cannot drift away from the response body.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  ZK_DEVICE_FAMILIES,
  ZK_HANDSHAKE_SETTINGS,
  ZK_REQUIRED_CAPABILITIES,
  ZK_SERVER_PATH,
  ZK_SETUP_STEPS,
  buildHandshakeResponse,
  describeZkSetup,
} from '../../convex/lib/zkteco';

const LOCALES = ['en', 'ru', 'hy', 'de'] as const;

function settingsJson(lng: string): Record<string, unknown> {
  const file = path.join(process.cwd(), 'public', 'locales', lng, 'settings.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function lookup(lng: string, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, settingsJson(lng));
}

/** Every key the guide renders. */
function guideKeys(): string[] {
  return [
    ...ZK_SETUP_STEPS.flatMap((step) => [step.labelKey, step.detailKey]),
    ...ZK_REQUIRED_CAPABILITIES.flatMap((cap) => [cap.labelKey, cap.detailKey]),
    ...ZK_DEVICE_FAMILIES.flatMap((family) => [family.labelKey, family.noteKey]),
    'settings.inbound.zkteco.title',
    'settings.inbound.zkteco.intro',
  ];
}

describe('zkteco setup guide', () => {
  it('translates every step, capability and family in all four languages', () => {
    const missing: string[] = [];
    for (const lng of LOCALES) {
      for (const key of guideKeys()) {
        const value = lookup(lng, key);
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${lng}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps every key inside the zkteco namespace', () => {
    for (const key of guideKeys()) {
      expect(key.startsWith('settings.inbound.zkteco.')).toBe(true);
    }
  });

  it('numbers the steps in the order the device has to be configured', () => {
    expect(ZK_SETUP_STEPS.map((step) => step.id)).toEqual([
      'mint',
      'serial',
      'bind',
      'server',
      'clock',
      'review',
    ]);
  });

  it('routes Suprema to the generic webhook rather than the ADMS endpoints', () => {
    const suprema = ZK_DEVICE_FAMILIES.find((family) => family.id === 'suprema');
    expect(suprema).toBeDefined();
    // BioStar 2 speaks its own device-to-server format. Claiming ADMS support for
    // it would send a real device's payloads to a parser that cannot read them.
    expect(suprema!.endpoint).toBe('generic');
    const adms = ZK_DEVICE_FAMILIES.filter((family) => family.endpoint === 'adms');
    expect(adms.length).toBeGreaterThan(0);
    for (const family of adms) {
      expect(family.id.startsWith('zkteco')).toBe(true);
    }
  });

  it('gives each family concrete menu labels to look for', () => {
    for (const family of ZK_DEVICE_FAMILIES) {
      expect(family.menuHints.length).toBeGreaterThan(0);
      for (const hint of family.menuHints) {
        expect(hint.trim()).not.toBe('');
      }
    }
  });

  it('documents the same mount point the HTTP layer serves', () => {
    expect(ZK_SERVER_PATH).toBe('/iclock');
  });

  it('agrees with the handshake response about the time zone and poll delay', () => {
    const handshake = buildHandshakeResponse('TEST-SN-1');
    expect(handshake).toContain(`TimeZone=${ZK_HANDSHAKE_SETTINGS.timeZone}`);
    expect(handshake).toContain(`Delay=${ZK_HANDSHAKE_SETTINGS.pollSeconds}`);
  });

  it('renders a plain-text guide from the caller’s translations', () => {
    const text = describeZkSetup((key) => `[${key}]`);
    // Steps are numbered, and the capabilities are listed after them.
    expect(text).toMatch(/^1\. \[settings\.inbound\.zkteco\.steps\.mint\]/);
    expect(text).toContain('[settings.inbound.zkteco.stepDetails.review]');
    expect(text).toContain('- [settings.inbound.zkteco.capabilities.push]');
  });

  it('does not claim a verified device list', () => {
    // The guide deliberately states capabilities instead of a model matrix.
    // If somebody adds a model list, this test makes them decide about the
    // verification note at the same time.
    const text = fs.readFileSync(
      path.join(process.cwd(), 'public', 'locales', 'en', 'settings.json'),
      'utf8',
    );
    expect(text).toContain('We do not publish a certified model list');
  });
});
