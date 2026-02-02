import { useMemo } from 'react';
import { useExecutionStore } from '../state/executionStore';
import type { SqlResult } from '../state/executionStore';

type CanvasEdge = {
  sourceId?: string;
  targetId?: string;
  source?: string;
  target?: string;
};

/**
 * Get upstream node ID from edge - supports both sourceId/targetId (Canvas) and source/target (React Flow) formats
 */
function getUpstreamNodeId(edges: CanvasEdge[], plotNodeId: string): string | undefined {
  const edge = edges.find(
    (e) => (e.targetId ?? (e as { target?: string }).target) === plotNodeId,
  );
  if (!edge) return undefined;
  return (edge.sourceId ?? (edge as { source?: string }).source) as string | undefined;
}

/**
 * Simplified usePlotData hook that uses Zustand selectors directly.
 * This avoids passing large executionEntries objects through props.
 * Supports SQL, Python, and CSV nodes as data sources.
 */
export function usePlotData(plotNodeId: string, edges: CanvasEdge[]): SqlResult | undefined {
  // Support both sourceId/targetId (Canvas) and source/target (React Flow) edge formats
  const upstreamNodeId = useMemo(
    () => getUpstreamNodeId(edges, plotNodeId),
    [
      plotNodeId,
      JSON.stringify(
        edges
          .filter((e) => (e.targetId ?? (e as { target?: string }).target) === plotNodeId)
          .map((e) => e.sourceId ?? (e as { source?: string }).source)
          .sort(),
      ),
    ],
  );

  // Subscribe directly to the result data - ensures we re-render when CSV/SQL/Python output changes
  const data = useExecutionStore((state) => {
    if (!upstreamNodeId) return undefined;
    const entry = state.entries[upstreamNodeId];
    if (!entry?.output) return undefined;
    if (entry.output.kind === 'sql') return entry.output.result;
    if (entry.output.kind === 'python' && entry.output.result?.table)
      return entry.output.result.table;
    if (entry.output.kind === 'plot') return entry.output.result.inputData;
    return undefined;
  });

  return data;
}
