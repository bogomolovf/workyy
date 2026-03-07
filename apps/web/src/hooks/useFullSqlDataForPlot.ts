import { useState, useEffect, useRef } from 'react';
import { executeSqlWithPreview } from '../lib/duckdbClient';
import type { SqlResult } from '../state/executionStore';
import { useExecutionStore } from '../state/executionStore';

/** Cache for plot data by upstream node + code to avoid refetching */
const sqlPlotCache = new Map<
  string,
  { data: SqlResult; fetchedAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(nodeId: string, code: string): string {
  return `${nodeId}:${code}`;
}

/**
 * Fetches the full result from the upstream SQL node for plot visualization.
 * Does not write to executionStore — chart is built from the full dataset volume.
 */
export function useFullSqlDataForPlot(
  upstreamNodeId: string | undefined,
): { data: SqlResult | undefined; loading: boolean; error: string | null } {
  const code = useExecutionStore((state) =>
    upstreamNodeId ? state.entries[upstreamNodeId]?.code ?? '' : '',
  );

  const [data, setData] = useState<SqlResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!upstreamNodeId || !code.trim()) {
      setData(undefined);
      setLoading(false);
      setError(null);
      fetchedKeyRef.current = null;
      return;
    }

    const key = cacheKey(upstreamNodeId, code);
    const cached = sqlPlotCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      fetchedKeyRef.current = key;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    executeSqlWithPreview(code, { fullLoad: true })
      .then((result) => {
        if (cancelled) return;
        const sqlResult: SqlResult = {
          columns: result.columns,
          rows: result.rows,
          arrow: result.arrow,
          totalCount: result.totalCount,
          isPreview: result.isPreview,
        };
        sqlPlotCache.set(key, { data: sqlResult, fetchedAt: Date.now() });
        setData(sqlResult);
        setLoading(false);
        setError(null);
        fetchedKeyRef.current = key;
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch SQL data for plot:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setData(undefined);
        setLoading(false);
        fetchedKeyRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [upstreamNodeId, code]);

  return { data, loading, error };
}
