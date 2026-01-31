/**
 * Paginated Query Support for Large SQL Result Sets
 *
 * This module provides infrastructure for loading large SQL query results
 * in pages/chunks, enabling infinite scroll behavior for very large datasets.
 */

import { executeSqlPaginated, getSqlRowCount } from './duckdbClient';
import type { SqlResult } from '../state/executionStore';

/** Default page size for paginated queries */
export const DEFAULT_PAGE_SIZE = 500;

/** Maximum number of pages to keep in memory cache */
export const MAX_CACHED_PAGES = 20;

/** State for a paginated query */
export type PagedQueryState = {
  /** The original SQL query (without LIMIT/OFFSET) */
  query: string;
  /** Column names from the query result */
  columns: string[];
  /** Number of rows per page */
  pageSize: number;
  /** Total number of rows in the full result set */
  totalCount: number;
  /** Map of page index to loaded rows */
  loadedPages: Map<number, SqlResult['rows']>;
  /** Set of pages currently being fetched */
  loadingPages: Set<number>;
  /** Timestamp of when the query was initialized */
  createdAt: number;
};

/**
 * Create a new paginated query state.
 * This initializes the query, fetches the first page, and returns the state.
 */
export async function createPagedQuery(
  query: string,
  options?: { pageSize?: number },
): Promise<PagedQueryState> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;

  // Get total count and first page in parallel
  const [totalCount, firstPageResult] = await Promise.all([
    getSqlRowCount(query),
    executeSqlPaginated(query, { pageSize, offset: 0 }),
  ]);

  const state: PagedQueryState = {
    query,
    columns: firstPageResult.columns,
    pageSize,
    totalCount,
    loadedPages: new Map([[0, firstPageResult.rows]]),
    loadingPages: new Set(),
    createdAt: Date.now(),
  };

  return state;
}

/**
 * Fetch a specific page of results.
 * Returns the rows for the page, loading from cache if available.
 */
export async function fetchPage(
  state: PagedQueryState,
  pageIndex: number,
): Promise<SqlResult['rows']> {
  // Return from cache if available
  if (state.loadedPages.has(pageIndex)) {
    return state.loadedPages.get(pageIndex)!;
  }

  // Check if page is already being loaded
  if (state.loadingPages.has(pageIndex)) {
    // Wait for the page to be loaded (simple polling approach)
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (state.loadedPages.has(pageIndex)) {
          clearInterval(checkInterval);
          resolve(state.loadedPages.get(pageIndex)!);
        }
      }, 50);
    });
  }

  // Mark page as loading
  state.loadingPages.add(pageIndex);

  try {
    const offset = pageIndex * state.pageSize;
    const result = await executeSqlPaginated(state.query, {
      pageSize: state.pageSize,
      offset,
    });

    // Store in cache
    state.loadedPages.set(pageIndex, result.rows);

    // Evict old pages if cache is too large
    evictOldPages(state, pageIndex);

    return result.rows;
  } finally {
    state.loadingPages.delete(pageIndex);
  }
}

/**
 * Prefetch pages around the current viewport.
 * This improves scroll performance by loading nearby pages in advance.
 */
export async function prefetchPages(
  state: PagedQueryState,
  currentPageIndex: number,
  prefetchCount: number = 2,
): Promise<void> {
  const pagesToFetch: number[] = [];
  const maxPageIndex = Math.ceil(state.totalCount / state.pageSize) - 1;

  // Prefetch pages before and after current page
  for (let i = 1; i <= prefetchCount; i++) {
    const prevPage = currentPageIndex - i;
    const nextPage = currentPageIndex + i;

    if (prevPage >= 0 && !state.loadedPages.has(prevPage) && !state.loadingPages.has(prevPage)) {
      pagesToFetch.push(prevPage);
    }

    if (
      nextPage <= maxPageIndex &&
      !state.loadedPages.has(nextPage) &&
      !state.loadingPages.has(nextPage)
    ) {
      pagesToFetch.push(nextPage);
    }
  }

  // Fetch pages in parallel (but don't wait for them)
  for (const pageIndex of pagesToFetch) {
    void fetchPage(state, pageIndex);
  }
}

/**
 * Get a row from the paginated data by absolute row index.
 * Returns undefined if the row is not yet loaded.
 */
export function getRow(
  state: PagedQueryState,
  rowIndex: number,
): Array<string | number | null> | undefined {
  const pageIndex = Math.floor(rowIndex / state.pageSize);
  const rowWithinPage = rowIndex % state.pageSize;

  const page = state.loadedPages.get(pageIndex);
  if (!page) {
    return undefined;
  }

  return page[rowWithinPage];
}

/**
 * Check if a specific row is loaded.
 */
export function isRowLoaded(state: PagedQueryState, rowIndex: number): boolean {
  const pageIndex = Math.floor(rowIndex / state.pageSize);
  return state.loadedPages.has(pageIndex);
}

/**
 * Get the range of loaded rows (contiguous from the start).
 */
export function getLoadedRowRange(state: PagedQueryState): { start: number; end: number } {
  const loadedPageIndices = Array.from(state.loadedPages.keys()).sort((a, b) => a - b);

  if (loadedPageIndices.length === 0) {
    return { start: 0, end: 0 };
  }

  // Find contiguous range from page 0
  let end = 0;
  for (const pageIndex of loadedPageIndices) {
    if (pageIndex !== Math.floor(end / state.pageSize)) {
      break;
    }
    const pageRows = state.loadedPages.get(pageIndex)!;
    end = pageIndex * state.pageSize + pageRows.length;
  }

  return { start: 0, end };
}

/**
 * Get all loaded rows as a flat array.
 * Useful for converting back to SqlResult format.
 */
export function getAllLoadedRows(state: PagedQueryState): SqlResult['rows'] {
  const pageIndices = Array.from(state.loadedPages.keys()).sort((a, b) => a - b);
  const rows: SqlResult['rows'] = [];

  for (const pageIndex of pageIndices) {
    const pageRows = state.loadedPages.get(pageIndex)!;
    rows.push(...pageRows);
  }

  return rows;
}

/**
 * Convert PagedQueryState back to SqlResult format.
 * Only includes loaded rows.
 */
export function toSqlResult(state: PagedQueryState): SqlResult & {
  totalCount: number;
  isPreview: boolean;
  loadedCount: number;
} {
  const rows = getAllLoadedRows(state);
  return {
    columns: state.columns,
    rows,
    totalCount: state.totalCount,
    isPreview: rows.length < state.totalCount,
    loadedCount: rows.length,
  };
}

/**
 * Evict old pages from cache to keep memory usage reasonable.
 * Keeps pages near the current page.
 */
function evictOldPages(state: PagedQueryState, currentPageIndex: number): void {
  if (state.loadedPages.size <= MAX_CACHED_PAGES) {
    return;
  }

  const pageIndices = Array.from(state.loadedPages.keys());

  // Sort by distance from current page
  pageIndices.sort((a, b) => {
    const distA = Math.abs(a - currentPageIndex);
    const distB = Math.abs(b - currentPageIndex);
    return distB - distA; // Furthest first
  });

  // Remove pages that are furthest from current page
  while (state.loadedPages.size > MAX_CACHED_PAGES && pageIndices.length > 0) {
    const pageToEvict = pageIndices.shift()!;
    // Don't evict current page or immediate neighbors
    if (Math.abs(pageToEvict - currentPageIndex) > 2) {
      state.loadedPages.delete(pageToEvict);
    }
  }
}

/**
 * Reset the paginated query state.
 * Clears all cached pages but keeps the query configuration.
 */
export function resetPagedQuery(state: PagedQueryState): void {
  state.loadedPages.clear();
  state.loadingPages.clear();
}

/**
 * Calculate the page index for a given row index.
 */
export function getPageIndexForRow(state: PagedQueryState, rowIndex: number): number {
  return Math.floor(rowIndex / state.pageSize);
}

/**
 * Calculate the total number of pages.
 */
export function getTotalPages(state: PagedQueryState): number {
  return Math.ceil(state.totalCount / state.pageSize);
}
