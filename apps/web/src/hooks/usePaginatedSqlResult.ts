/**
 * Hook that wraps paginatedQuery.ts for incremental batch loading in SQL Cell.
 *
 * On first render it seeds page 0 from the rows already in executionStore
 * (avoiding a redundant DuckDB round-trip). Subsequent pages are fetched
 * on demand when the consumer calls `loadMoreRows`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type PagedQueryState,
  DEFAULT_PAGE_SIZE,
  fetchPage,
  prefetchPages,
  getAllLoadedRows,
} from '../lib/paginatedQuery';
import type { SqlResult } from '../state/executionStore';

export interface PaginatedSqlResult {
  rows: SqlResult['rows'];
  columns: string[];
  totalCount: number;
  loadedCount: number;
  isLoadingMore: boolean;
  isFullyLoaded: boolean;
  loadMoreRows: () => void;
}

export function usePaginatedSqlResult(
  query: string | undefined,
  initialResult: SqlResult | undefined,
): PaginatedSqlResult | null {
  const stateRef = useRef<PagedQueryState | null>(null);
  const [rows, setRows] = useState<SqlResult['rows']>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const mountedRef = useRef(true);

  const totalCount = initialResult?.totalCount ?? initialResult?.rows.length ?? 0;
  const columns = initialResult?.columns ?? [];
  const isPaginated = !!(
    query &&
    initialResult &&
    initialResult.isPreview &&
    totalCount > (initialResult.rows.length ?? 0)
  );

  useEffect(() => {
    if (!isPaginated || !query || !initialResult) {
      stateRef.current = null;
      return;
    }

    const pageSize = DEFAULT_PAGE_SIZE;
    const state: PagedQueryState = {
      query,
      columns: initialResult.columns,
      pageSize,
      totalCount,
      loadedPages: new Map([[0, initialResult.rows]]),
      loadingPages: new Set(),
      createdAt: Date.now(),
    };
    stateRef.current = state;
    setRows(initialResult.rows);

    void prefetchPages(state, 0, 1).then(() => {
      if (!mountedRef.current) return;
      const allRows = getAllLoadedRows(state);
      if (allRows.length > initialResult.rows.length) {
        setRows(allRows);
      }
    });
  }, [query, isPaginated, totalCount]);  

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMoreRows = useCallback(() => {
    const state = stateRef.current;
    if (!state || isLoadingMore) return;

    const loadedCount = getAllLoadedRows(state).length;
    if (loadedCount >= state.totalCount) return;

    const nextPageIndex = Math.floor(loadedCount / state.pageSize);

    setIsLoadingMore(true);
    void (async () => {
      try {
        await fetchPage(state, nextPageIndex);
        void prefetchPages(state, nextPageIndex, 1);
        if (mountedRef.current) {
          setRows(getAllLoadedRows(state));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoadingMore(false);
        }
      }
    })();
  }, [isLoadingMore]);

  const loadedCount = rows.length;
  const isFullyLoaded = loadedCount >= totalCount;

  // Return a stable object via useMemo to prevent infinite re-render cascades
  return useMemo(() => {
    if (!isPaginated) return null;
    return {
      rows,
      columns,
      totalCount,
      loadedCount,
      isLoadingMore,
      isFullyLoaded,
      loadMoreRows,
    };
  }, [
    isPaginated,
    rows,
    columns,
    totalCount,
    loadedCount,
    isLoadingMore,
    isFullyLoaded,
    loadMoreRows,
  ]);
}
