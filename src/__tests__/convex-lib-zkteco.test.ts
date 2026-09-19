/**
 * Tests for convex/lib/zkteco.ts — the ZKTeco / Suprema ADMS push protocol.
 *
 * The ATTLOG body is positional (tab-separated) and the device reports its own
 * wall clock, so both facts need locking down: a field shifted by one column
 * would read a workcode as a timestamp, and a mis-resolved clock would put a
 * punch five hours away from when the person walked in.
 */

import { describe, it, expect } from '@jest/globals';
import {
  ZK_ATTLOG_TABLE,
  ZK_OK,
  buildAttlogAck,
  buildHandshakeResponse,
  directionFromStatus,
  isAcknowledgedOnlyPush,
  isAttlogPush,
  normalizeSerial,
  parseAttlogBody,
  parseZkQuery,
} from '../../convex/lib/zkteco';
import { parseLocalDateTime } from '../../convex/lib/inboundPayload';

/** A batch as the terminal sends it: tab-separated, CRLF line endings. */
const BATCH = [
  '1\t2026-09-18 09:01:22\t0\t1\t\t0',
  '2\t2026-09-18 09:03:10\t0\t15\t\t0',
  '1\t2026-09-18 18:05:44\t1\t1\t\t0',
].join('\r\n');

describe('normalizeSerial', () => {
  it('trims and uppercases — the SN is typed into the terminal menu by hand', () => {
    expect(normalizeSerial(' c3f2-001 ab ')).toBe('C3F2-001 AB');
  });

  it('returns an empty string for a missing serial rather than "null"', () => {
    expect(normalizeSerial(null)).toBe('');
    expect(normalizeSerial(undefined)).toBe('');
  });
});

describe('parseZkQuery', () => {
  it('reads the handshake request', () => {
    const q = parseZkQuery('?SN=ABC123&options=all&pushver=2.2.14&language=69');
    expect(q).toEqual({
      serial: 'ABC123',
      table: '',
      options: 'all',
      stamp: null,
    });
  });

  it('reads an ATTLOG push and upper-cases the table name', () => {
    const q = parseZkQuery('SN=abc123&table=attlog&Stamp=9999');
    expect(q.serial).toBe('ABC123');
    expect(q.table).toBe(ZK_ATTLOG_TABLE);
    expect(q.stamp).toBe('9999');
  });

  it('accepts a query string with or without the leading question mark', () => {
    expect(parseZkQuery('?SN=X').serial).toBe('X');
    expect(parseZkQuery('SN=X').serial).toBe('X');
  });
});

describe('table routing', () => {
  it('treats AT TLOG as the only punch-carrying table', () => {
    expect(isAttlogPush(parseZkQuery('SN=X&table=ATTLOG'))).toBe(true);
    expect(isAttlogPush(parseZkQuery('SN=X&table=OPERLOG'))).toBe(false);
  });

  it('acknowledges OPERLOG/ATTPHOTO/USERINFO without ingesting them', () => {
    // Answering anything but OK makes the terminal retry the same batch forever.
    for (const table of ['OPERLOG', 'ATTPHOTO', 'USERINFO']) {
      expect(isAcknowledgedOnlyPush(parseZkQuery(`SN=X&table=${table}`))).toBe(true);
      expect(isAttlogPush(parseZkQuery(`SN=X&table=${table}`))).toBe(false);
    }
  });

  it('does not claim to handle an unknown table', () => {
    expect(isAcknowledgedOnlyPush(parseZkQuery('SN=X&table=WHATEVER'))).toBe(false);
  });
});

describe('directionFromStatus', () => {
  it('maps 0/1 to in/out', () => {
    expect(directionFromStatus('0')).toBe('in');
    expect(directionFromStatus('1')).toBe('out');
  });

  it('keeps break states and 255 as unknown instead of guessing a direction', () => {
    for (const status of ['2', '3', '4', '5', '255']) {
      expect(directionFromStatus(status)).toBe('unknown');
    }
  });

  it('is unknown for a missing or non-numeric status', () => {
    expect(directionFromStatus(undefined)).toBe('unknown');
    expect(directionFromStatus('')).toBe('unknown');
    expect(directionFromStatus('in')).toBe('unknown');
  });
});

describe('parseAttlogBody', () => {
  it('parses a batch into punches with the right direction', () => {
    const { punches, skipped, lines } = parseAttlogBody(BATCH);
    expect(lines).toBe(3);
    expect(skipped).toBe(0);
    expect(punches).toHaveLength(3);
    expect(punches.map((p) => p.employeeNumber)).toEqual(['1', '2', '1']);
    expect(punches.map((p) => p.direction)).toEqual(['in', 'in', 'out']);
  });

  it('resolves the device clock against Armenia (UTC+4), not the runtime zone', () => {
    const { punches } = parseAttlogBody('1\t2026-09-18 09:01:22\t0\t1\t\t0');
    // Same helper the JSON webhook path uses, so a punch replayed either way
    // lands on the identical instant.
    expect(punches[0]!.punchAt).toBe(parseLocalDateTime('2026-09-18 09:01:22'));
    expect(new Date(punches[0]!.punchAt).toISOString()).toBe('2026-09-18T05:01:22.000Z');
  });

  it('ignores blank lines without counting them as skipped records', () => {
    const { punches, skipped, lines } = parseAttlogBody(`${BATCH}\r\n\r\n  \r\n`);
    expect(punches).toHaveLength(3);
    expect(lines).toBe(3);
    expect(skipped).toBe(0);
  });

  it('reports a line with no usable time instead of inventing one', () => {
    const { punches, skipped, lines } = parseAttlogBody('7\tnot-a-date\t0\t1');
    expect(punches).toHaveLength(0);
    expect(lines).toBe(1);
    expect(skipped).toBe(1);
  });

  it('reports a line with no PIN instead of attributing it to nobody', () => {
    const { punches, skipped } = parseAttlogBody('\t2026-09-18 09:01:22\t0\t1');
    expect(punches).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('drops a batch from a terminal whose clock is set to 1970', () => {
    const { punches, skipped } = parseAttlogBody('9\t1970-01-01 00:00:01\t0\t1');
    expect(punches).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('drops a punch dated far in the future (misconfigured clock)', () => {
    const now = Date.UTC(2026, 8, 18);
    const { punches, skipped } = parseAttlogBody('9\t2049-01-01 00:00:00\t0\t1', now);
    expect(punches).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('keeps a punch from a device a few minutes ahead (allowed clock drift)', () => {
    const now = Date.UTC(2026, 8, 18, 5, 0, 0);
    // 09:05 Yerevan = 05:05 UTC, five minutes after `now`.
    const { punches } = parseAttlogBody('9\t2026-09-18 09:05:00\t0\t1', now);
    expect(punches).toHaveLength(1);
  });

  it('tolerates LF-only line endings (older firmware)', () => {
    const { punches } = parseAttlogBody(
      '1\t2026-09-18 09:01:22\t0\t1\n2\t2026-09-18 09:02:22\t0\t1',
    );
    expect(punches).toHaveLength(2);
  });

  it('returns an empty result for an empty body rather than throwing', () => {
    expect(parseAttlogBody('')).toEqual({ punches: [], skipped: 0, lines: 0 });
  });
});

describe('responses', () => {
  it('opens the handshake with the banner the device parses literally', () => {
    const text = buildHandshakeResponse('ABC123');
    expect(text.startsWith('GET OPTION FROM: ABC123\r\n')).toBe(true);
  });

  it('hands the terminal Armenia time and real-time push', () => {
    const text = buildHandshakeResponse('ABC123');
    expect(text).toContain('TimeZone=4');
    expect(text).toContain('Realtime=1');
    // Never ask for fingerprint templates — descriptors stay on the device.
    expect(text).toContain('TransFlag=1111000000');
    expect(text.split('\r\n')).toHaveLength(11);
  });

  it('acknowledges a batch with the OK: prefix the firmware requires', () => {
    expect(buildAttlogAck(3)).toBe('OK: 3');
    expect(buildAttlogAck(0)).toBe('OK: 0');
    expect(ZK_OK).toBe('OK');
  });
});
