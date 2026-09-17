/**
 * Mobile quick-action bar.
 *
 * The bar is the only place in the product where an action has to work with no
 * connection, so the behaviours under test are:
 *   - one button that reflects today's state (never the "already checked in" error),
 *   - offline taps are queued with the time they happened, not the sync time,
 *   - reconnect replays the queue through Convex with that timestamp,
 *   - the attendance action disappears when the plan does not include the module.
 */

import React from 'react';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'object' && fallback !== null ? key : ((fallback as string) ?? key),
  }),
}));

const mockUser = { id: 'user_1', name: 'Aram', email: 'a@b.c', role: 'employee' as const };
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

let mockHasAttendanceModule = true;
jest.mock('@/hooks/useOrgEntitlements', () => ({
  useOrgEntitlements: () => ({ hasModule: () => mockHasAttendanceModule }),
}));

const mockMutations: Record<string, jest.Mock> = {};
let todayStatus: { status: string } | null = null;
jest.mock('convex/react', () => ({
  useMutation: (m: { _name?: string }) => mockMutations[m?._name ?? ''] ?? jest.fn(),
  useQuery: (q: { _name?: string }, args: unknown) =>
    args === 'skip' || q?._name !== 'getTodayStatus' ? undefined : todayStatus,
}));

jest.mock('@/convex/_generated/api', () => ({
  api: {
    timeTracking: {
      checkIn: { _name: 'checkIn' },
      checkOut: { _name: 'checkOut' },
      getTodayStatus: { _name: 'getTodayStatus' },
    },
  },
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() },
}));

import { OfflineQuickActionsBar } from '@/components/pwa/OfflineQuickActionsBar';
import { enqueuePunch, listQueuedPunches, queuedPunchCount } from '@/lib/offlineQueue';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  mockMutations.checkIn = jest.fn().mockResolvedValue('rec_1');
  mockMutations.checkOut = jest.fn().mockResolvedValue('rec_1');
  mockHasAttendanceModule = true;
  todayStatus = null;
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe('OfflineQuickActionsBar', () => {
  it('shows "Check in" when nothing has been recorded today', () => {
    render(<OfflineQuickActionsBar />);
    expect(screen.getByRole('button', { name: 'mobileQuickActions.checkIn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'mobileQuickActions.checkOut' })).toBeNull();
  });

  it('flips to "Check out" once the caller is at work', () => {
    todayStatus = { status: 'checked_in' };
    render(<OfflineQuickActionsBar />);
    expect(screen.getByRole('button', { name: 'mobileQuickActions.checkOut' })).toBeInTheDocument();
  });

  it('shows a terminal state instead of a button once the day is closed', () => {
    todayStatus = { status: 'checked_out' };
    render(<OfflineQuickActionsBar />);
    expect(screen.getByText('mobileQuickActions.doneForToday')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'mobileQuickActions.checkIn' })).toBeNull();
  });

  it('records a punch through Convex when online', async () => {
    render(<OfflineQuickActionsBar />);
    fireEvent.click(screen.getByRole('button', { name: 'mobileQuickActions.checkIn' }));

    await waitFor(() => expect(mockMutations.checkIn).toHaveBeenCalledTimes(1));
    expect(mockMutations.checkIn).toHaveBeenCalledWith({ userId: 'user_1' });
    expect(queuedPunchCount()).toBe(0);
  });

  it('queues the punch with its pressed time when offline instead of calling the server', async () => {
    setOnline(false);
    const before = Date.now();
    render(<OfflineQuickActionsBar />);
    fireEvent.click(screen.getByRole('button', { name: 'mobileQuickActions.checkIn' }));

    const [queued] = listQueuedPunches();
    expect(mockMutations.checkIn).not.toHaveBeenCalled();
    expect(queued?.type).toBe('attendance.checkIn');
    expect(queued?.userId).toBe('user_1');
    expect(queued?.occurredAt).toBeGreaterThanOrEqual(before);
    await screen.findByRole('button', { name: 'mobileQuickActions.syncNowCount' });
  });

  it('replays a queued punch on mount with its original timestamp', async () => {
    const pressedAt = Date.now() - 30 * 60 * 1000;
    enqueuePunch({ type: 'attendance.checkIn', userId: 'user_1', occurredAt: pressedAt });

    render(<OfflineQuickActionsBar />);

    await waitFor(() => expect(mockMutations.checkIn).toHaveBeenCalledTimes(1));
    // The whole point of the queue: 09:00 must not become the sync time.
    expect(mockMutations.checkIn).toHaveBeenCalledWith({
      userId: 'user_1',
      occurredAt: pressedAt,
    });
    await waitFor(() => expect(queuedPunchCount()).toBe(0));
  });

  it('replays check-out through the check-out mutation', async () => {
    enqueuePunch({ type: 'attendance.checkOut', userId: 'user_1', occurredAt: Date.now() - 1000 });

    render(<OfflineQuickActionsBar />);

    await waitFor(() => expect(mockMutations.checkOut).toHaveBeenCalledTimes(1));
    expect(mockMutations.checkIn).not.toHaveBeenCalled();
  });

  it('hides the attendance action when the plan does not include the module', () => {
    mockHasAttendanceModule = false;
    render(<OfflineQuickActionsBar />);
    expect(screen.queryByText('mobileQuickActions.checkIn')).toBeNull();
    expect(screen.getByText('mobileQuickActions.approvals')).toBeInTheDocument();
    expect(screen.getByText('mobileQuickActions.tasks')).toBeInTheDocument();
  });
});
