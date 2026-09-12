'use client';

/**
 * Convex queries that keep the previous result on screen while refetching.
 *
 * `useQuery` returns `undefined` whenever the args change (new week, new
 * period, new filters…). Naively rendering that `undefined` as "Loading…"
 * makes whole cards collapse into spinners and remount after every navigation,
 * which is exactly the janky behaviour these helpers remove:
 *
 * - the first-ever load still yields `undefined` (caller decides the skeleton),
 * - a refetch with new args keeps the LAST loaded result for the previous args
 *   on screen until the fresh data arrives, so blocks never unmount or flash,
 * - live updates from Convex (same args, new data) flow through immediately.
 *
 * `useLastLoadedPaginatedQuery` additionally exposes `isLoadingFirstPage` that
 * is only true before the very first page — subsequent filter switches keep
 * the old rows visible instead of collapsing the list into a loader.
 */

import { usePaginatedQuery, useQuery, type OptionalRestArgsOrSkip } from 'convex/react';
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  PaginationOptions,
  PaginationResult,
} from 'convex/server';
import { useState } from 'react';

export function useLastLoadedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query['_returnType'] | undefined {
  // The spread defeats Convex's overload resolution and widens `data` to `any`,
  // so pin the precise return type here once, at the boundary.
  const data: Query['_returnType'] | undefined = useQuery(query, ...args);

  // Key = the args the stored result belongs to. `skip` never stores anything.
  const firstArg = args[0];
  const argsKey = firstArg === undefined || firstArg === 'skip' ? '' : JSON.stringify(firstArg);

  // Last result + the args it belongs to (React's "adjust state when props
  // change" pattern: guarded setState during render, no extra pass).
  const [last, setLast] = useState<{
    argsKey: string;
    data: Query['_returnType'] | undefined;
  }>({ argsKey: '', data: undefined });
  if (data !== undefined && (last.argsKey !== argsKey || last.data !== data)) {
    setLast({ argsKey, data });
  }

  if (firstArg === undefined || firstArg === 'skip') return undefined;
  // Fresh data wins; while it loads (data === undefined for the NEW args) keep
  // showing the previous result — that's the whole point of the hook.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  if (data !== undefined) return data;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return last.data;
}

/** Mirrors Convex's `PaginatedQueryReference` constraint (not publicly exported). */
type PaginatedQueryRef = FunctionReference<
  'query',
  'public',
  { paginationOpts: PaginationOptions },
  PaginationResult<unknown>
>;

type PaginationStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';

/** Item type extracted from a paginated query's `PaginationResult<T>` return. */
type PagedItem<Query extends PaginatedQueryRef> =
  FunctionReturnType<Query> extends PaginationResult<infer T> ? T : never;

export function useLastLoadedPaginatedQuery<Query extends PaginatedQueryRef>(
  query: Query,
  args: Omit<FunctionArgs<Query>, 'paginationOpts'> | 'skip',
  options: { initialNumItems: number },
): {
  results: PagedItem<Query>[];
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  isLoadingFirstPage: boolean;
} {
  const paged = usePaginatedQuery(query, args as never, options);

  type Item = PagedItem<Query>;

  const argsKey = args === 'skip' ? '' : JSON.stringify(args);

  const [last, setLast] = useState<{ argsKey: string; results: Item[] }>({
    argsKey: '',
    results: [],
  });

  const gotFreshPage =
    paged.status !== 'LoadingFirstPage' &&
    (last.argsKey !== argsKey || paged.results !== (last.results as unknown[]));
  if (gotFreshPage) {
    setLast({ argsKey, results: paged.results as unknown as Item[] });
  }

  const loadingFirstPage = paged.status === 'LoadingFirstPage';
  // While a first page is in flight (genuine first load OR the args just
  // changed), keep showing the previously loaded rows; only a true first-ever
  // load has no rows to hold on to.
  const showingPrevious = loadingFirstPage && last.results.length > 0;
  const results = showingPrevious ? last.results : (paged.results as unknown as Item[]);

  return {
    results,
    status: paged.status,
    loadMore: paged.loadMore,
    // UI-facing loading state: never true while stale rows are on screen.
    isLoadingFirstPage: loadingFirstPage && !showingPrevious,
  };
}
