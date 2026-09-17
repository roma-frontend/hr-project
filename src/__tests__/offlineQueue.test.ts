/**
 * Offline punch queue.
 *
 * The queue is what makes "Check in" survive a dead zone, so the properties
 * that matter are: punches survive (localStorage), they keep the moment they
 * were pressed (not the sync time), replays are bounded, and a queue that
 * belongs to another user is dropped rather than replayed as them.
 */

import {
  MAX_ATTEMPTS,
  clearQueuedPunches,
  dropQueuedPunchesForOtherUsers,
  enqueuePunch,
  latestQueuedPunch,
  listQueuedPunches,
  queuedPunchCount,
  recordAttempt,
  removeQueuedPunch,
  subscribeQueue,
} from '@/lib/offlineQueue';

const USER = 'user_1';

beforeEach(() => {
  window.localStorage.clear();
});

describe('offline punch queue', () => {
  it('starts empty', () => {
    expect(listQueuedPunches()).toEqual([]);
    expect(queuedPunchCount()).toBe(0);
    expect(latestQueuedPunch()).toBeNull();
  });

  it('keeps the time the punch was pressed, not the time it was queued', () => {
    const pressedAt = Date.now() - 45 * 60 * 1000;
    const entry = enqueuePunch({
      type: 'attendance.checkIn',
      userId: USER,
      occurredAt: pressedAt,
    });

    expect(entry.occurredAt).toBe(pressedAt);
    expect(listQueuedPunches()[0]?.occurredAt).toBe(pressedAt);
  });

  it('persists across a reload (localStorage-backed)', () => {
    enqueuePunch({ type: 'attendance.checkIn', userId: USER });
    // A fresh read must see the entry — this is what survives a tab reload.
    expect(queuedPunchCount()).toBe(1);
    expect(window.localStorage.getItem('strata.offline.punches.v1')).toContain(
      'attendance.checkIn',
    );
  });

  it('returns punches oldest first and reports the newest as the optimistic state', () => {
    enqueuePunch({ type: 'attendance.checkIn', userId: USER, occurredAt: Date.now() - 5000 });
    enqueuePunch({ type: 'attendance.checkOut', userId: USER, occurredAt: Date.now() - 1000 });

    expect(listQueuedPunches().map((p) => p.type)).toEqual([
      'attendance.checkIn',
      'attendance.checkOut',
    ]);
    expect(latestQueuedPunch()?.type).toBe('attendance.checkOut');
  });

  it('removes a punch once the server has accepted it', () => {
    const entry = enqueuePunch({ type: 'attendance.checkIn', userId: USER });
    removeQueuedPunch(entry.id);
    expect(queuedPunchCount()).toBe(0);
  });

  it('drops a punch after MAX_ATTEMPTS failed replays instead of spinning forever', () => {
    const entry = enqueuePunch({ type: 'attendance.checkIn', userId: USER });

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(recordAttempt(entry.id)?.attempts).toBe(i);
    }
    // The MAX_ATTEMPTS-th failure evicts it.
    expect(recordAttempt(entry.id)).toBeNull();
    expect(queuedPunchCount()).toBe(0);
  });

  it('notifies subscribers on change', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeQueue(() => seen.push(queuedPunchCount()));
    enqueuePunch({ type: 'attendance.checkIn', userId: USER });
    unsubscribe();
    enqueuePunch({ type: 'attendance.checkIn', userId: USER });

    expect(seen).toContain(1);
    expect(seen).toHaveLength(1);
  });

  it('drops punches left behind by a different user', () => {
    enqueuePunch({ type: 'attendance.checkIn', userId: USER });
    enqueuePunch({ type: 'attendance.checkIn', userId: 'user_2' });

    expect(dropQueuedPunchesForOtherUsers(USER)).toBe(1);
    expect(listQueuedPunches().map((p) => p.userId)).toEqual([USER]);
  });

  it('ignores a corrupted queue instead of throwing', () => {
    window.localStorage.setItem('strata.offline.punches.v1', '{"not":"an array"}');
    expect(listQueuedPunches()).toEqual([]);
    clearQueuedPunches();
    expect(queuedPunchCount()).toBe(0);
  });
});
