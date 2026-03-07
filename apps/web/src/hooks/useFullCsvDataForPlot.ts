import { useState, useEffect, useRef } from 'react';
import { queryTableFullForPlot } from '../lib/duckdbClient';
import type { SqlResult } from '../state/executionStore';

/** Cache for full CSV data by tableName to avoid refetching when switching views */
const fullDataCache = new Map<string, { data: SqlResult; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

/**
 * Fetches full dataset from DuckDB when Plot is connected to CSV node.
 * Uses cache to avoid redundant fetches and prevent UI glitches with large data.
 * Returns full table data for building visualizations (no row limit).
 */
export function useFullCsvDataForPlot(
  tableName: string | undefined,
): { data: SqlResult | undefined; loading: boolean; error: string | null } {
  const [data, setData] = useState<SqlResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const fetchedTableRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!tableName || tableName.trim() === '') {
      setData(undefined);
      setLoading(false);
      setError(null);
      fetchedTableRef.current = null;
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    // Clear any pending retry when we start a fresh fetch
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Check cache first
    const cached = fullDataCache.get(tableName);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      fetchedTableRef.current = tableName;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    queryTableFullForPlot(tableName)
      .then((result) => {
        if (cancelled) return;
        fullDataCache.set(tableName, { data: result, fetchedAt: Date.now() });
        setData(result);
        setLoading(false);
        setError(null);
        fetchedTableRef.current = tableName;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch full CSV data for plot:', err);
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        setData(undefined);
        setLoading(false);
        fetchedTableRef.current = null;

        // If DuckDB tables for this board haven't been restored yet, the first query
        // can fail with "table does not exist". In that case we retry a few times
        // so that after restoreDatasetsForBoard completes, the Plot can still
        // build its 10k-rows visualization automatically after page reload.
        const isMissingTable =
          typeof message === 'string' &&
          /no such table|does not exist|catalog error|catalogexception/i.test(message);
        if (isMissingTable && retryAttempt < MAX_RETRIES) {
          retryTimeoutRef.current = window.setTimeout(() => {
            setRetryAttempt((prev) => prev + 1);
          }, RETRY_DELAY_MS);
        }
      });

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [tableName, retryAttempt]);

  // Reset retry counter when tableName changes
  useEffect(() => {
    setRetryAttempt(0);
  }, [tableName]);

  // After reload, restoreDatasetsForBoard may run after Yjs observer populates localStorage.
  // Listen for restore completion so we refetch and build the 10k-rows plot without user action.
  useEffect(() => {
    if (!tableName?.trim()) return;
    const onRestored = () => {
      setRetryAttempt(0);
      setError(null);
    };
    window.addEventListener('workyy:datasetsRestored', onRestored);
    return () => window.removeEventListener('workyy:datasetsRestored', onRestored);
  }, [tableName]);

  return { data, loading, error };
}
