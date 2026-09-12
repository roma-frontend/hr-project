/**
 * Tests for useLastLoadedQuery / useLastLoadedPaginatedQuery — the
 * stale-while-refetch Convex hooks that keep the previous result on screen
 * while args change, so cards never collapse into loaders mid-navigation.
 *
 * Mocks: convex/react useQuery/usePaginatedQuery as controllable mocks.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';

const mockUseQuery = jest.fn();
const mockUsePaginatedQuery = jest.fn();

jest.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginatedQuery(...args),
}));

import { useLastLoadedQuery, useLastLoadedPaginatedQuery } from '@/hooks/useLastLoadedQuery';

const QUERY_REF = { _name: 'test:query' };

describe('useLastLoadedQuery', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it('returns undefined on first load (no cached data)', () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useLastLoadedQuery(QUERY_REF as never, { week: 1 }));
    expect(result.current).toBeUndefined();
  });

  it('stores the first loaded result', () => {
    mockUseQuery.mockReturnValue({ shifts: [] });
    const { result } = renderHook(() => useLastLoadedQuery(QUERY_REF as never, { week: 1 }));
    expect(result.current).toEqual({ shifts: [] });
  });

  it('keeps the previous result while new args are loading', () => {
    const first = { shifts: ['a'] };
    mockUseQuery.mockReturnValueOnce(first).mockReturnValueOnce(undefined);

    const { result, rerender } = renderHook(
      ({ week }: { week: number }) => useLastLoadedQuery(QUERY_REF as never, { week }),
      { initialProps: { week: 1 } },
    );
    expect(result.current).toEqual(first);

    // Args change → useQuery returns undefined while fetching.
    rerender({ week: 2 });
    expect(result.current).toEqual(first); // stale-but-visible, not undefined
  });

  it('swaps to fresh data when the new args resolve', () => {
    // Controlled by the test rather than positional mocks: the hook re-renders
    // synchronously when it stores a result (setState during render), so call
    // counts are not stable, but the "current backend answer" is.
    let current: { shifts: string[] } | undefined = { shifts: ['a'] };
    mockUseQuery.mockImplementation(() => current);

    const { result, rerender } = renderHook(
      ({ week }: { week: number }) => useLastLoadedQuery(QUERY_REF as never, { week }),
      { initialProps: { week: 1 } },
    );
    expect(result.current).toEqual({ shifts: ['a'] });

    // Args change while the backend is still fetching → stale data stays up.
    current = undefined;
    rerender({ week: 2 });
    expect(result.current).toEqual({ shifts: ['a'] });

    // Fresh data for the new args arrives → swap.
    current = { shifts: ['b'] };
    rerender({ week: 2 });
    expect(result.current).toEqual({ shifts: ['b'] });
  });

  it('passes live updates through for the same args', () => {
    const v1 = { shifts: ['a'] };
    const v2 = { shifts: ['a', 'b'] };
    mockUseQuery.mockReturnValueOnce(v1).mockReturnValueOnce(v2);

    const { result, rerender } = renderHook(
      ({ week }: { week: number }) => useLastLoadedQuery(QUERY_REF as never, { week }),
      { initialProps: { week: 1 } },
    );
    rerender({ week: 1 });
    expect(result.current).toEqual(v2);
  });

  it('returns undefined while skipped', () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useLastLoadedQuery(QUERY_REF as never, 'skip'));
    expect(result.current).toBeUndefined();
  });

  it('does not leak the previous result when args skip after loading', () => {
    mockUseQuery.mockReturnValueOnce({ shifts: ['a'] }).mockReturnValue(undefined);

    const { result, rerender } = renderHook(
      ({ on }: { on: boolean }) =>
        useLastLoadedQuery(QUERY_REF as never, on ? { week: 1 } : 'skip'),
      { initialProps: { on: true } },
    );
    expect(result.current).toEqual({ shifts: ['a'] });
    rerender({ on: false });
    expect(result.current).toBeUndefined();
  });
});

describe('useLastLoadedPaginatedQuery', () => {
  beforeEach(() => {
    mockUsePaginatedQuery.mockReset();
  });

  it('reports loading on the genuine first load', () => {
    mockUsePaginatedQuery.mockReturnValue({
      results: [],
      status: 'LoadingFirstPage',
      loadMore: jest.fn(),
    });
    const { result } = renderHook(() =>
      useLastLoadedPaginatedQuery(QUERY_REF as never, { range: '24h' }, { initialNumItems: 40 }),
    );
    expect(result.current.isLoadingFirstPage).toBe(true);
    expect(result.current.results).toEqual([]);
  });

  it('keeps previous rows visible while new filters load the first page', () => {
    const rows = [{ _id: 'r1' }];
    const freshRows = [{ _id: 'r2' }];
    let paged: {
      results: Array<{ _id: string }>;
      status: string;
      loadMore: () => void;
    } = { results: rows, status: 'CanLoadMore', loadMore: () => {} };
    mockUsePaginatedQuery.mockImplementation(() => paged);

    const { result, rerender } = renderHook(
      ({ range }: { range: string }) =>
        useLastLoadedPaginatedQuery(QUERY_REF as never, { range }, { initialNumItems: 40 }),
      { initialProps: { range: '24h' } },
    );
    expect(result.current.results).toEqual(rows);

    // New args → LoadingFirstPage: stale rows stay on screen, no loader.
    paged = { results: [], status: 'LoadingFirstPage', loadMore: () => {} };
    rerender({ range: '7d' });
    expect(result.current.isLoadingFirstPage).toBe(false);
    expect(result.current.results).toEqual(rows);

    // Fresh page for the new args arrives → swap in the new rows.
    paged = { results: freshRows, status: 'CanLoadMore', loadMore: () => {} };
    rerender({ range: '7d' });
    expect(result.current.results).toEqual(freshRows);
    expect(result.current.isLoadingFirstPage).toBe(false);
  });

  it('does not fabricate rows after a genuine first load with no results', () => {
    mockUsePaginatedQuery.mockReturnValue({
      results: [],
      status: 'Exhausted',
      loadMore: jest.fn(),
    });
    const { result } = renderHook(() =>
      useLastLoadedPaginatedQuery(QUERY_REF as never, { range: '24h' }, { initialNumItems: 40 }),
    );
    expect(result.current.isLoadingFirstPage).toBe(false);
    expect(result.current.results).toEqual([]);
  });
});
