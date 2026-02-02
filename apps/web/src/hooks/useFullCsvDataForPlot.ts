import { useState, useEffect, useRef } from 'react';
import { queryTableFull } from '../lib/duckdbClient';
import type { SqlResult } from '../state/executionStore';

/** Cache for full CSV data by tableName to avoid refetching when switching views */
const fullDataCache = new Map<string, { data: SqlResult; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches full dataset from DuckDB when Plot is connected to CSV node.
 * Uses cache to avoid redundant fetches and prevent UI glitches with large data.
 * Returns full data for building visualizations (not limited to first 100 rows).
 */
export function useFullCsvDataForPlot(
  tableName: string | undefined,
): { data: SqlResult | undefined; loading: boolean; error: string | null } {
  const [data, setData] = useState<SqlResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedTableRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tableName || tableName.trim() === '') {
      setData(undefined);
      setLoading(false);
      setError(null);
      fetchedTableRef.current = null;
      return;
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

    queryTableFull(tableName)
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
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setData(undefined);
        setLoading(false);
        fetchedTableRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [tableName]);

  return { data, loading, error };
}
