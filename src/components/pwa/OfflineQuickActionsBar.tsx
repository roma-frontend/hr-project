'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';
import { CheckSquare, ClipboardCheck, CloudOff, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrgEntitlements } from '@/hooks/useOrgEntitlements';
import {
  dropQueuedPunchesForOtherUsers,
  enqueuePunch,
  isOnline,
  latestQueuedPunch,
  listQueuedPunches,
  recordAttempt,
  removeQueuedPunch,
  subscribeQueue,
  type PunchType,
  type QueuedPunch,
} from '@/lib/offlineQueue';

/** `HH:MM` in the device's locale — used to say *when* a queued punch was taken. */
function shortTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Mobile quick-action bar: the two actions people actually open the app for,
 * without a navigation.
 *
 * Clock in / clock out is a *single* button that reflects today's real state
 * (queued punches included), so it can never be tapped into the server's
 * "Already checked in today" error. It is the only action that works offline:
 * `offlineQueue` persists the punch with the time it was pressed, the bar shows
 * a pending badge, and the punch is replayed against Convex on reconnect —
 * carrying that original `occurredAt`, so an offline 09:00 arrival is not
 * recorded as a late sync-time check-in. The badge is a button: tapping it
 * flushes the queue by hand. Approvals and tasks stay as plain links.
 */
export function OfflineQuickActionsBar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { hasModule } = useOrgEntitlements();
  const checkIn = useMutation(api.timeTracking.checkIn);
  const checkOut = useMutation(api.timeTracking.checkOut);

  const todayStatus = useQuery(
    api.timeTracking.getTodayStatus,
    user?.id ? { userId: user.id as Id<'users'> } : 'skip',
  );

  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState<QueuedPunch[]>([]);
  const [syncing, setSyncing] = useState(false);
  const busyRef = useRef(false);

  // Store the queue only when it really changed. `listQueuedPunches()` returns a
  // fresh array every call, and a new reference here would re-render (and
  // re-run the effect below) on every sync pass with nothing to sync.
  const refreshQueue = useCallback(() => {
    setQueued((previous) => {
      const next = listQueuedPunches();
      const unchanged =
        previous.length === next.length &&
        previous.every(
          (punch, i) => punch.id === next[i]?.id && punch.attempts === next[i]?.attempts,
        );
      return unchanged ? previous : next;
    });
  }, []);

  /** Replay every queued punch, oldest first. */
  const flush = useCallback(async () => {
    if (busyRef.current || !user?.id || !isOnline()) return;
    busyRef.current = true;
    try {
      dropQueuedPunchesForOtherUsers(user.id);
      const queue = listQueuedPunches();
      if (queue.length === 0) {
        refreshQueue();
        return;
      }
      setSyncing(true);
      let synced = 0;
      let dropped = 0;
      for (const punch of queue) {
        try {
          if (punch.type === 'attendance.checkIn') {
            await checkIn({ userId: punch.userId as Id<'users'>, occurredAt: punch.occurredAt });
          } else {
            await checkOut({ userId: punch.userId as Id<'users'>, occurredAt: punch.occurredAt });
          }
          removeQueuedPunch(punch.id);
          synced += 1;
        } catch (error) {
          // A punch the server keeps rejecting is dropped after MAX_ATTEMPTS
          // instead of blocking the queue behind it — but never silently, an
          // attendance record is payroll input.
          if (recordAttempt(punch.id) === null) {
            dropped += 1;
            continue;
          }
          const message = error instanceof Error ? error.message : '';
          // "Already checked in/out" means the server is ahead of us: the state
          // exists, so the punch is redundant rather than failed.
          if (/already checked/i.test(message)) {
            removeQueuedPunch(punch.id);
            synced += 1;
            continue;
          }
          break;
        }
      }
      if (synced > 0) toast.success(t('mobileQuickActions.synced', { count: synced }));
      if (dropped > 0) toast.error(t('mobileQuickActions.dropped', { count: dropped }));
    } finally {
      setSyncing(false);
      busyRef.current = false;
      refreshQueue();
    }
  }, [checkIn, checkOut, refreshQueue, t, user?.id]);

  // The online/offline listeners must be installed once per signed-in user, not
  // re-installed whenever `flush` gets a new identity (it closes over `t`).
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flushRef.current();
    };
    const goOffline = () => setOnline(false);

    setOnline(isOnline());
    refreshQueue();
    const unsubscribe = subscribeQueue(refreshQueue);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (isOnline()) void flushRef.current();

    return () => {
      unsubscribe();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshQueue, user?.id]);

  const punch = useCallback(
    async (type: PunchType) => {
      if (!user?.id) return;
      if (!isOnline()) {
        enqueuePunch({ type, userId: user.id });
        refreshQueue();
        toast.message(t('mobileQuickActions.offlineSavedAt', { time: shortTime(Date.now()) }));
        return;
      }
      try {
        if (type === 'attendance.checkIn') {
          await checkIn({ userId: user.id as Id<'users'> });
        } else {
          await checkOut({ userId: user.id as Id<'users'> });
        }
        toast.success(
          type === 'attendance.checkIn'
            ? t('mobileQuickActions.checkedIn')
            : t('mobileQuickActions.checkedOut'),
        );
      } catch (error) {
        toast.error(
          (error instanceof Error ? error.message : '') || t('mobileQuickActions.failed'),
        );
      }
    },
    [checkIn, checkOut, refreshQueue, t, user?.id],
  );

  const showAttendance = hasModule('attendance');

  if (!user) return null;

  const pending = queued.length;
  // A queued punch is newer than anything the server has seen, so it wins.
  const optimistic = latestQueuedPunch();
  const status = optimistic
    ? optimistic.type === 'attendance.checkIn'
      ? 'checked_in'
      : 'checked_out'
    : (todayStatus?.status ?? null);
  const doneForToday = status === 'checked_out';
  const nextAction: PunchType =
    status === 'checked_in' ? 'attendance.checkOut' : 'attendance.checkIn';

  const actionClass =
    'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors';
  const mutedActionClass = `${actionClass} bg-(--background-subtle) text-(--text-secondary)`;

  return (
    <div
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-2xl border border-(--border) bg-(--card)/95 p-2 shadow-lg backdrop-blur lg:hidden"
      role="toolbar"
      aria-label={t('mobileQuickActions.title')}
    >
      {showAttendance &&
        (doneForToday ? (
          <span
            className={`${actionClass} bg-(--success-quiet) text-(--success-text)`}
            aria-live="polite"
          >
            <LogOut className="h-4 w-4" />
            {t('mobileQuickActions.doneForToday')}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void punch(nextAction)}
            className={`${actionClass} ${
              nextAction === 'attendance.checkIn'
                ? 'bg-(--success-bg) text-(--success-text)'
                : 'bg-(--brand-quiet) text-(--brand-text)'
            }`}
            aria-label={
              nextAction === 'attendance.checkIn'
                ? t('mobileQuickActions.checkIn')
                : t('mobileQuickActions.checkOut')
            }
          >
            {nextAction === 'attendance.checkIn' ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {nextAction === 'attendance.checkIn'
              ? t('mobileQuickActions.checkIn')
              : t('mobileQuickActions.checkOut')}
          </button>
        ))}

      <Link href="/approvals" className={mutedActionClass}>
        <ClipboardCheck className="h-4 w-4" />
        {t('mobileQuickActions.approvals')}
      </Link>
      <Link href="/tasks" className={mutedActionClass}>
        <CheckSquare className="h-4 w-4" />
        {t('mobileQuickActions.tasks')}
      </Link>

      {(!online || pending > 0) && (
        <button
          type="button"
          onClick={() => void flush()}
          disabled={!online || syncing}
          className="flex items-center gap-1 rounded-lg bg-(--warning-bg) px-2 py-1 text-[10px] font-bold text-(--warning-text) disabled:cursor-default"
          title={
            pending > 0 && optimistic
              ? t('mobileQuickActions.pendingTitleAt', { time: shortTime(optimistic.occurredAt) })
              : t('mobileQuickActions.pendingTitle')
          }
          aria-label={
            pending > 0
              ? t('mobileQuickActions.syncNowCount', { count: pending })
              : t('mobileQuickActions.offline')
          }
        >
          {syncing ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <CloudOff className="h-3 w-3" />
          )}
          {pending}
        </button>
      )}
    </div>
  );
}
