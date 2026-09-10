/**
 * Tests for src/hooks/useFeatureFlags.ts
 *
 * Renders the hook with mocked Convex + auth store to exercise the flag map,
 * the loading/signed-out defaults and the href filter.
 */

jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthUser: jest.fn(),
}));

import { renderHook } from '@testing-library/react';
import { useQuery } from 'convex/react';
import { useAuthUser } from '@/store/useAuthStore';
import { useFeatureFlags, MODULE_TOGGLE_BY_HREF } from '@/hooks/useFeatureFlags';

const useQueryMock = useQuery as jest.Mock;
const useAuthUserMock = useAuthUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthUserMock.mockReturnValue({ id: 'user-1' });
  useQueryMock.mockReturnValue([{ key: 'chat.realtime', enabled: true }]);
});

describe('MODULE_TOGGLE_BY_HREF', () => {
  it('maps every gated module route to a flag', () => {
    expect(MODULE_TOGGLE_BY_HREF).toMatchObject({
      '/chat': 'chat.realtime',
      '/drivers': 'drivers.module',
      '/expenses': 'expenses.module',
      '/recruitment': 'recruitment.module',
      '/surveys': 'surveys.module',
      '/compensation': 'compensation.module',
    });
  });
});

describe('useFeatureFlags', () => {
  it('queries the caller flags when signed in', () => {
    renderHook(() => useFeatureFlags());
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), {});
  });

  it('skips the query when signed out', () => {
    useAuthUserMock.mockReturnValue(null);
    renderHook(() => useFeatureFlags());
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), 'skip');
  });

  it('builds a map from the returned flags', () => {
    useQueryMock.mockReturnValue([
      { key: 'chat.realtime', enabled: true },
      { key: 'surveys.module', enabled: false },
    ]);

    const { result } = renderHook(() => useFeatureFlags());

    expect(result.current.flags.get('chat.realtime')).toBe(true);
    expect(result.current.flags.get('surveys.module')).toBe(false);
  });

  it('treats unknown flags as enabled', () => {
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.isEnabled('drivers.module')).toBe(true);
  });

  it('honours an explicit disabled flag', () => {
    useQueryMock.mockReturnValue([{ key: 'drivers.module', enabled: false }]);
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.isEnabled('drivers.module')).toBe(false);
  });

  it('treats an undefined key as enabled', () => {
    useQueryMock.mockReturnValue([{ key: 'chat.realtime', enabled: false }]);
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.isEnabled(undefined)).toBe(true);
  });

  it('defaults to enabled when the query has not resolved', () => {
    useQueryMock.mockReturnValue(undefined);
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.isEnabled('expenses.module')).toBe(true);
  });

  it('filters out disabled module destinations', () => {
    useQueryMock.mockReturnValue([{ key: 'surveys.module', enabled: false }]);
    const { result } = renderHook(() => useFeatureFlags());

    const items = [{ href: '/chat' }, { href: '/surveys' }, { href: '/dashboard' }];

    expect(result.current.filterByHref(items)).toEqual([{ href: '/chat' }, { href: '/dashboard' }]);
  });

  it('keeps all destinations when flags are missing', () => {
    useQueryMock.mockReturnValue(undefined);
    const { result } = renderHook(() => useFeatureFlags());
    const items = [{ href: '/chat' }, { href: '/surveys' }];
    expect(result.current.filterByHref(items)).toEqual(items);
  });
});
