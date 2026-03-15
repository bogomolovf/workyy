/**
 * Execution engine for cell chains (notebook frames) and standalone cells.
 *
 * Reuses the wrapCellCode logic from notebookExecutor for Jupyter-like
 * variable sharing between cells in the same frame.
 */

import { useChainStore } from '../state/chainStore';
import { useExecutionStore, type NodeStatus } from '../state/executionStore';
import { runPythonInPool, acquireDedicatedWorker } from '../workers/pythonClient';

export type UpstreamData = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
} | null;

export type ChainCellResult = {
  cellId: string;
  status: 'success' | 'error';
  stdout: string;
  stderr: string;
  error?: string;
  table?: { columns: string[]; rows: Array<Array<string | number | null>> } | null;
  plotJson?: string | null;
  durationMs: number;
};

function toHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Wraps cell code for Jupyter-like execution within a chain.
 * Identical to notebookExecutor's wrapCellCode — kept here for chain-specific use.
 */
function wrapCellCode(code: string, isFirstCell: boolean, hasUpstream: boolean): string {
  const codeHex = toHex(code);

  let prefix: string;
  if (isFirstCell) {
    prefix = hasUpstream
      ? `
import pandas as _pd
if 'df' in dir() and df is not None and isinstance(df, _pd.DataFrame):
    data = df.copy()
`
      : '';
  } else {
    prefix = `
if '__nb_data' in globals() and __nb_data is not None:
    data = __nb_data
if '__nb_df' in globals() and __nb_df is not None:
    df = __nb_df
`;
  }

  const cellExec = `
import ast as _ast
_nb_code = bytes.fromhex("${codeHex}").decode("utf-8")
_nb_had_last_expr = False
try:
    _nb_tree = _ast.parse(_nb_code)
    if _nb_tree.body and isinstance(_nb_tree.body[-1], _ast.Expr):
        _nb_had_last_expr = True
        _nb_last = _nb_tree.body[-1]
        _nb_assign = _ast.Assign(
            targets=[_ast.Name(id="result", ctx=_ast.Store())],
            value=_nb_last.value,
        )
        _ast.fix_missing_locations(_nb_assign)
        _nb_tree.body[-1] = _nb_assign
        _ast.fix_missing_locations(_nb_tree)
    exec(compile(_nb_tree, "<cell>", "exec"), globals())
except SyntaxError:
    exec(compile(_nb_code, "<cell>", "exec"), globals())

if _nb_had_last_expr and "result" in globals() and result is not None:
    import pandas as _pd
    _nb_is_df = isinstance(result, _pd.DataFrame)
    _nb_is_plot = False
    try:
        from plotly.graph_objs import Figure as _PlotlyFig
        _nb_is_plot = isinstance(result, _PlotlyFig)
    except Exception:
        pass
    if not _nb_is_df and not _nb_is_plot:
        print(repr(result))
        result = None
`;

  const suffix = `
import pandas as _pd
__nb_data = globals().get("data") if ("data" in globals() and isinstance(globals().get("data"), _pd.DataFrame)) else globals().get("__nb_data")
__nb_df = globals().get("df") if ("df" in globals() and isinstance(globals().get("df"), _pd.DataFrame)) else globals().get("__nb_df")
df = None
`;

  return `${prefix}\n${cellExec}\n${suffix}`;
}

/**
 * Execute all Python cells in a frame sequentially on a dedicated worker.
 * Cells share state (variables persist). Non-Python cells are skipped.
 */
export async function executeFrameCells(
  cellIds: string[],
  upstreamData?: UpstreamData,
  startFromIndex = 0,
  signal?: AbortSignal,
): Promise<Map<string, ChainCellResult>> {
  const store = useExecutionStore.getState();
  const results = new Map<string, ChainCellResult>();
  let executionCounter = 0;

  const hasUpstream = !!upstreamData;
  const sqlResultJson = upstreamData ? JSON.stringify(upstreamData) : null;
  const worker = acquireDedicatedWorker();

  try {
    for (let i = 0; i < cellIds.length; i++) {
      const cellId = cellIds[i];
      if (signal?.aborted) break;

      const entry = store.entries[cellId];
      if (!entry) continue;

      // Only execute python cells in the chain; skip markdown
      if (entry.nodeType !== 'pythonCell') continue;

      // If startFromIndex is set, skip cells before it but still run them
      // to maintain shared state (just don't update the store for pre-start cells
      // unless they haven't been run yet)
      const isBeforeStart = i < startFromIndex;
      const code = entry.code || '';
      if (!code.trim() && isBeforeStart) continue;

      executionCounter++;
      const isFirst = executionCounter === 1;

      if (!isBeforeStart) {
        useExecutionStore.getState().setStatus(cellId, 'running');
      }

      const startTime = performance.now();

      try {
        const wrappedCode = wrapCellCode(code, isFirst, hasUpstream);
        const response = await worker.runPython(
          {
            code: wrappedCode,
            sqlResultJson: isFirst ? sqlResultJson : null,
            sqlArrowIpc: null,
          },
          { timeoutMs: 120_000 },
        );

        const durationMs = Math.round(performance.now() - startTime);

        if (response.success) {
          const result: ChainCellResult = {
            cellId,
            status: 'success',
            stdout: response.stdout ?? '',
            stderr: response.stderr ?? '',
            table: response.table ?? null,
            plotJson: response.plotJson ?? null,
            durationMs,
          };
          results.set(cellId, result);

          if (!isBeforeStart) {
            useExecutionStore.getState().setSuccess(cellId, {
              kind: 'python',
              result: {
                stdout: result.stdout,
                stderr: result.stderr,
                table: result.table,
                plotJson: result.plotJson,
              },
              code,
            });
          }
        } else {
          const result: ChainCellResult = {
            cellId,
            status: 'error',
            stdout: response.stdout ?? '',
            stderr: response.stderr ?? '',
            error: response.error ?? 'Execution failed',
            durationMs,
          };
          results.set(cellId, result);

          if (!isBeforeStart) {
            useExecutionStore.getState().setError(cellId, result.error ?? 'Execution failed');
          }
          break;
        }
      } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const result: ChainCellResult = {
          cellId,
          status: 'error',
          stdout: '',
          stderr: '',
          error: errorMessage,
          durationMs,
        };
        results.set(cellId, result);

        if (!isBeforeStart) {
          useExecutionStore.getState().setError(cellId, errorMessage);
        }
        break;
      }
    }
  } finally {
    worker.release();
  }

  return results;
}

/**
 * Execute a standalone Python cell (not in a frame).
 * Uses the worker pool instead of a dedicated worker.
 */
export async function executeStandalonePythonCell(
  cellId: string,
  code: string,
  upstreamData?: UpstreamData,
): Promise<ChainCellResult> {
  const hasUpstream = !!upstreamData;
  const sqlResultJson = upstreamData ? JSON.stringify(upstreamData) : null;
  const startTime = performance.now();

  try {
    const wrappedCode = wrapCellCode(code, true, hasUpstream);
    const response = await runPythonInPool(
      { code: wrappedCode, sqlResultJson, sqlArrowIpc: null },
      { timeoutMs: 120_000 },
    );
    const durationMs = Math.round(performance.now() - startTime);

    if (response.success) {
      return {
        cellId,
        status: 'success',
        stdout: response.stdout ?? '',
        stderr: response.stderr ?? '',
        table: response.table ?? null,
        plotJson: response.plotJson ?? null,
        durationMs,
      };
    }
    return {
      cellId,
      status: 'error',
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      error: response.error ?? 'Execution failed',
      durationMs,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      cellId,
      status: 'error',
      stdout: '',
      stderr: '',
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    };
  }
}

/**
 * Helper to find the upstream data for a cell from edges and execution store.
 */
export function resolveUpstreamDataForCell(
  cellId: string,
  edges: Array<{ sourceId: string; targetId: string }>,
  nodes: Array<{ id: string; type: string; payload?: Record<string, unknown> }>,
): UpstreamData {
  const store = useExecutionStore.getState();

  const incomingEdges = edges.filter((e) => e.targetId === cellId);
  for (const edge of incomingEdges) {
    const sourceEntry = store.entries[edge.sourceId];
    if (!sourceEntry?.output) continue;

    if (sourceEntry.output.kind === 'sql' && sourceEntry.output.result) {
      return {
        columns: sourceEntry.output.result.columns,
        rows: sourceEntry.output.result.rows,
      };
    }
    if (sourceEntry.output.kind === 'python' && sourceEntry.output.result.table) {
      return {
        columns: sourceEntry.output.result.table.columns,
        rows: sourceEntry.output.result.table.rows,
      };
    }

    // CSV node
    const sourceNode = nodes.find((n) => n.id === edge.sourceId);
    if (sourceNode?.type === 'csv') {
      const csvData = (
        sourceNode.payload as
          | { data?: { columns: string[]; rows: Array<Array<string | number | null>> } }
          | undefined
      )?.data;
      if (csvData) return csvData;
    }
  }

  return null;
}
