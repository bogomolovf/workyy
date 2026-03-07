import { useExecutionStore } from '../state/executionStore';
import type { SqlResult } from '../state/executionStore';

/**
 * Returns persisted inputData for the given Plot node, if it has a successful
 * plot execution in executionStore (restored from payload.execution.output).
 * This acts as a snapshot (up to 10k rows) that survives page reloads.
 */
export function usePlotSnapshot(plotNodeId: string): SqlResult | undefined {
  return useExecutionStore((state) => {
    const entry = state.entries[plotNodeId];
    if (!entry?.output || entry.output.kind !== 'plot') return undefined;
    return entry.output.result.inputData;
  });
}

