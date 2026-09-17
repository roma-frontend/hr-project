/**
 * Offline queue for quick actions (currently attendance clock-in/out).
 *
 * When a user taps "Check in" with no connection, the punch cannot reach
 * Convex. Rather than losing it, we persist it locally and replay it the moment
 * the browser comes back online. The queue is deliberately tiny and
 * localStorage-backed: it is testable in jsdom, survives a reload, and never
 * touches the network itself (the UI owns the Convex calls, so the queue stays
 * a pure data structure).
 *
 * `occurredAt` is the moment the user pressed the button, not the moment the
 * punch synced — the server accepts it as `occurredAt` so a 09:00 arrival
 * recorded in a lift with no signal is not stored as an 11:40 late check-in.
 *
 * Punches are capped at `MAX_ATTEMPTS` replays so a punch that the server will
 * never accept (session expired, duplicate) cannot grow into an infinite loop.
 */

export type PunchType = 'attendance.checkIn' | 'attendance.checkOut';

export interface QueuedPunch {
  id: string;
  type: PunchType;
  userId: string;
  /** Wall-clock when the user pressed the button (ms). */
  occurredAt: number;
  /** Wall-clock when it entered the queue (ms). */
  queuedAt: number;
  /** Replay attempts so far. */
  attempts: number;
}

const STORAGE_KEY = 'strata.offline.punches.v1';
const CHANGE_EVENT = 'strata:offline-queue-change';
export const MAX_ATTEMPTS = 5;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readQueue(): QueuedPunch[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is QueuedPunch =>
        Boolean(p) &&
        typeof (p as QueuedPunch).id === 'string' &&
        typeof (p as QueuedPunch).userId === 'string' &&
        typeof (p as QueuedPunch).occurredAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedPunch[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: queue.length }));
  } catch {
    /* storage full / disabled — the action simply is not queued */
  }
}

/** All punches waiting to be synced, oldest first. */
export function listQueuedPunches(): QueuedPunch[] {
  return readQueue().sort((a, b) => a.occurredAt - b.occurredAt);
}

export function queuedPunchCount(): number {
  return readQueue().length;
}

/**
 * The most recent punch still waiting to sync, or null.
 *
 * The bar reads it to paint an optimistic status: a queued check-in must show
 * as "at work" even though the server has not heard about it yet.
 */
export function latestQueuedPunch(): QueuedPunch | null {
  const queue = listQueuedPunches();
  return queue.length > 0 ? (queue[queue.length - 1] as QueuedPunch) : null;
}

/** Add a punch to the queue. Returns the stored entry. */
export function enqueuePunch(input: {
  type: PunchType;
  userId: string;
  occurredAt?: number;
}): QueuedPunch {
  const now = Date.now();
  const entry: QueuedPunch = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    userId: input.userId,
    occurredAt: input.occurredAt ?? now,
    queuedAt: now,
    attempts: 0,
  };
  writeQueue([...readQueue(), entry]);
  return entry;
}

/**
 * Drop punches the server can never accept, e.g. a queued pair from before the
 * user signed out. Called on flush so a stale queue does not block the badge
 * forever.
 */
export function dropQueuedPunchesForOtherUsers(userId: string): number {
  const queue = readQueue();
  const kept = queue.filter((p) => p.userId === userId);
  if (kept.length !== queue.length) writeQueue(kept);
  return queue.length - kept.length;
}

export function removeQueuedPunch(id: string): void {
  writeQueue(readQueue().filter((p) => p.id !== id));
}

/**
 * Record a failed replay. Removes the punch once it has exhausted its attempts
 * so the queue cannot spin forever on an action the server rejects.
 */
export function recordAttempt(id: string): QueuedPunch | null {
  const queue = readQueue();
  const entry = queue.find((p) => p.id === id);
  if (!entry) return null;
  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS) {
    writeQueue(queue.filter((p) => p.id !== id));
    return null;
  }
  writeQueue(queue);
  return entry;
}

export function clearQueuedPunches(): void {
  writeQueue([]);
}

/** Subscribe to queue changes; returns an unsubscribe function. */
export function subscribeQueue(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
