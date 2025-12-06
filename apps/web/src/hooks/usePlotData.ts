import { useState, useEffect, useRef, useMemo } from 'react';
import { useExecutionStore } from '../state/executionStore';
import type { SqlResult, ExecutionEntry } from '../state/executionStore';

type CanvasEdge = {
  sourceId: string;
  targetId: string;
};

/**
 * Simplified usePlotData hook that uses Zustand selectors directly.
 * This avoids passing large executionEntries objects through props.
 * All hooks are called unconditionally to maintain stable hook order.
 */
export function usePlotData(plotNodeId: string, edges: CanvasEdge[]): SqlResult | undefined {
  // All hooks must be called unconditionally at the top level
  const [data, setData] = useState<SqlResult | undefined>(undefined);
  const prevEntryRef = useRef<ExecutionEntry | undefined>(undefined);
  const prevUpstreamNodeIdRef = useRef<string | undefined>(undefined);

  // Memoize upstream node ID with stable comparison
  // Use JSON.stringify to create stable key for edges array
  const edgesKey = useMemo(
    () =>
      JSON.stringify(
        edges
          .filter((e) => e.targetId === plotNodeId)
          .map((e) => e.sourceId)
          .sort(),
      ),
    [edges, plotNodeId],
  );

  const upstreamNodeId = useMemo(
    () => edges.find((e) => e.targetId === plotNodeId)?.sourceId,
    [edgesKey, plotNodeId],
  );

  // Use Zustand selector to get only the specific entry we need
  // This avoids re-renders when other entries change
  // Use a stable selector function to prevent unnecessary re-renders
  const upstreamEntry = useExecutionStore(
    (state) => (upstreamNodeId ? state.entries[upstreamNodeId] : undefined),
    (a, b) => a === b, // Custom equality function - only re-render if entry reference actually changed
  );

  // Extract data from entry in a pure effect
  // This effect runs whenever upstreamEntry or upstreamNodeId changes
  useEffect(() => {
    // If upstream node changed, reset previous entry ref and clear data
    if (upstreamNodeId !== prevUpstreamNodeIdRef.current) {
      prevUpstreamNodeIdRef.current = upstreamNodeId;
      prevEntryRef.current = undefined;
      setData(undefined);
      // Early return to avoid processing with undefined upstreamNodeId
      if (!upstreamNodeId) {
        return;
      }
    }

    // Skip if entry hasn't actually changed (reference comparison)
    // This prevents unnecessary updates when entry object reference is the same
    if (upstreamEntry === prevEntryRef.current) {
      return;
    }

    // Update ref before processing to avoid infinite loops
    prevEntryRef.current = upstreamEntry;

    // No entry or no output
    if (!upstreamEntry?.output) {
      setData(undefined);
      return;
    }

    // Extract data based on output kind
    let result: SqlResult | undefined;

    if (upstreamEntry.output.kind === 'sql') {
      result = upstreamEntry.output.result;
    } else if (upstreamEntry.output.kind === 'python' && upstreamEntry.output.result?.table) {
      result = upstreamEntry.output.result.table;
    } else if (upstreamEntry.output.kind === 'plot') {
      result = upstreamEntry.output.result.inputData;
    }

    // Only update state if result actually changed
    // Use functional update to avoid stale closure issues
    setData((prevData) => {
      // Simple reference comparison - if result is the same object, don't update
      if (prevData === result) {
        return prevData;
      }
      return result;
    });
  }, [upstreamEntry, upstreamNodeId]);

  return data;
}
