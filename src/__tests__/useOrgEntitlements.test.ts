/**
 * Tests for src/hooks/useOrgEntitlements.ts
 */

jest.mock('convex/react', () => ({ useQuery: jest.fn() }));

import { renderHook } from '@testing-library/react';
import { useQuery } from 'convex/react';
import { useOrgEntitlements } from '@/hooks/useOrgEntitlements';

const useQueryMock = useQuery as jest.Mock;

function makeEntitlements(moduleMap: Record<string, unknown>) {
  return {
    planKey: 'pro',
    planName: 'Professional',
    planVersion: 3,
    isTrial: false,
    source: 'billing',
    moduleMap,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useOrgEntitlements', () => {
  it('queries the my-entitlements endpoint', () => {
    useQueryMock.mockReturnValue(undefined);
    renderHook(() => useOrgEntitlements());
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything());
  });

  it('reports isLoading while the query is unresolved', () => {
    useQueryMock.mockReturnValue(undefined);
    const { result } = renderHook(() => useOrgEntitlements());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.entitlements).toBeNull();
  });

  it('returns the resolved entitlements', () => {
    const data = makeEntitlements({ chat: { included: true, overLimit: 'allow' } });
    useQueryMock.mockReturnValue(data);

    const { result } = renderHook(() => useOrgEntitlements());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.entitlements).toEqual(data);
  });

  describe('hasModule', () => {
    it('is permissive before entitlements load', () => {
      useQueryMock.mockReturnValue(undefined);
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.hasModule('anything')).toBe(true);
    });

    it('returns the included flag for a known module', () => {
      useQueryMock.mockReturnValue(
        makeEntitlements({
          chat: { included: true, overLimit: 'allow' },
          surveys: { included: false, overLimit: 'block' },
        }),
      );
      const { result } = renderHook(() => useOrgEntitlements());

      expect(result.current.hasModule('chat')).toBe(true);
      expect(result.current.hasModule('surveys')).toBe(false);
    });

    it('returns false for an unknown module', () => {
      useQueryMock.mockReturnValue(makeEntitlements({}));
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.hasModule('nope')).toBe(false);
    });

    it('returns false when included is missing', () => {
      useQueryMock.mockReturnValue(makeEntitlements({ chat: { overLimit: 'allow' } }));
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.hasModule('chat')).toBe(false);
    });
  });

  describe('getLimit', () => {
    it('returns a numeric limit', () => {
      useQueryMock.mockReturnValue(
        makeEntitlements({ chat: { included: true, overLimit: 'warn', limits: { seats: 25 } } }),
      );
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.getLimit('chat', 'seats')).toBe(25);
    });

    it('returns null for a boolean limit', () => {
      useQueryMock.mockReturnValue(
        makeEntitlements({
          chat: { included: true, overLimit: 'warn', limits: { sso: true } },
        }),
      );
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.getLimit('chat', 'sso')).toBeNull();
    });

    it('returns null for a missing usage key', () => {
      useQueryMock.mockReturnValue(
        makeEntitlements({ chat: { included: true, overLimit: 'warn', limits: { seats: 5 } } }),
      );
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.getLimit('chat', 'missing')).toBeNull();
    });

    it('returns null for an unknown module', () => {
      useQueryMock.mockReturnValue(makeEntitlements({}));
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.getLimit('nope', 'seats')).toBeNull();
    });

    it('returns null before entitlements load', () => {
      useQueryMock.mockReturnValue(undefined);
      const { result } = renderHook(() => useOrgEntitlements());
      expect(result.current.getLimit('chat', 'seats')).toBeNull();
    });
  });
});
