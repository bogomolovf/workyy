import { runPythonInPool, acquireDedicatedWorker } from '../workers/pythonClient';
import type { NotebookCell } from './notebookParser';

export type CellExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'queued';

export type CellExecutionResult = {
  cellId: string;
  status: CellExecutionStatus;
  stdout: string;
  stderr: string;
  error?: string;
  tableData?: { columns: string[]; rows: Array<Array<string | number | null>> } | null;
  plotJson?: string | null;
  executionCount: number;
  durationMs?: number;
};

export type UpstreamData = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
} | null;

type ProgressCallback = (state: {
  cellId: string;
  status: CellExecutionStatus;
  result?: CellExecutionResult;
  executionOrder: number;
  totalCells: number;
}) => void;

/**
 * Runs all code cells sequentially on a single dedicated worker,
 * sharing Python state between cells. Upstream CSV/SQL data is
 * injected as `data` variable in the first cell.
 */
export type CellDataEntry = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  filename?: string;
  tableName?: string;
};

export async function executeNotebookCells(
  codeCells: NotebookCell[],
  onProgress: ProgressCallback,
  upstreamData?: UpstreamData,
  signal?: AbortSignal,
  /** Per-cell CSV data keyed by cellId (when CSV is connected to a specific cell handle) */
  cellDataMap?: Record<string, CellDataEntry>,
  /** Filename of the global upstream CSV (creates a named variable, e.g. "NetflixShows") */
  globalUpstreamFilename?: string,
): Promise<Map<string, CellExecutionResult>> {
  const results = new Map<string, CellExecutionResult>();
  let executionCounter = 0;

  const hasUpstream = !!upstreamData;
  const sqlResultJson = upstreamData ? JSON.stringify(upstreamData) : null;
  const worker = acquireDedicatedWorker();

  try {
    for (let i = 0; i < codeCells.length; i++) {
      const cell = codeCells[i];
      if (signal?.aborted) break;

      executionCounter++;
      onProgress({
        cellId: cell.id,
        status: 'running',
        executionOrder: i + 1,
        totalCells: codeCells.length,
      });

      const startTime = performance.now();

      try {
        // Check if this cell has per-cell CSV data connected
        const cellData = cellDataMap?.[cell.id];
        const cellHasOwnData = !!cellData;
        const cellDataJson = cellData
          ? JSON.stringify({ columns: cellData.columns, rows: cellData.rows })
          : null;
        // Derive variable name from per-cell filename, or fall back to global upstream filename
        const cellDataVarName = cellData?.filename
          ? cellData.filename.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
          : i === 0 && globalUpstreamFilename
            ? globalUpstreamFilename.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
            : undefined;

        // For first cell: use global upstream OR per-cell data
        // For subsequent cells with per-cell data: isFirstCell=false, hasUpstream=true
        //   → wrapCellCode restores __nb_* state, then loads per-cell data from df
        const effectiveHasUpstream = i === 0 ? hasUpstream || cellHasOwnData : cellHasOwnData;
        const effectiveSqlJson = cellHasOwnData ? cellDataJson : i === 0 ? sqlResultJson : null;

        const wrappedCode = wrapCellCode(
          cell.source,
          i === 0,
          effectiveHasUpstream,
          cellDataVarName,
        );
        const response = await worker.runPython(
          {
            code: wrappedCode,
            sqlResultJson: effectiveSqlJson,
            sqlArrowIpc: null,
          },
          { timeoutMs: 120_000 },
        );

        const durationMs = Math.round(performance.now() - startTime);

        if (response.success) {
          const result: CellExecutionResult = {
            cellId: cell.id,
            status: 'success',
            stdout: response.stdout ?? '',
            stderr: response.stderr ?? '',
            tableData: response.table ?? null,
            plotJson: response.plotJson ?? null,
            executionCount: executionCounter,
            durationMs,
          };
          results.set(cell.id, result);
          onProgress({
            cellId: cell.id,
            status: 'success',
            result,
            executionOrder: i + 1,
            totalCells: codeCells.length,
          });
        } else {
          const result: CellExecutionResult = {
            cellId: cell.id,
            status: 'error',
            stdout: response.stdout ?? '',
            stderr: response.stderr ?? '',
            error: response.error ?? 'Execution failed',
            executionCount: executionCounter,
            durationMs,
          };
          results.set(cell.id, result);
          onProgress({
            cellId: cell.id,
            status: 'error',
            result,
            executionOrder: i + 1,
            totalCells: codeCells.length,
          });
          break;
        }
      } catch (err) {
        const durationMs = Math.round(performance.now() - startTime);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const result: CellExecutionResult = {
          cellId: cell.id,
          status: 'error',
          stdout: '',
          stderr: '',
          error: errorMessage,
          executionCount: executionCounter,
          durationMs,
        };
        results.set(cell.id, result);
        onProgress({
          cellId: cell.id,
          status: 'error',
          result,
          executionOrder: i + 1,
          totalCells: codeCells.length,
        });
        break;
      }
    }
  } finally {
    worker.release();
  }

  return results;
}

export async function executeSingleCell(
  cell: NotebookCell,
  executionCount: number,
  upstreamData?: UpstreamData,
  /** Optional variable name to assign upstream data to (e.g. filename without extension) */
  dataVarName?: string,
): Promise<CellExecutionResult> {
  const startTime = performance.now();
  const hasUpstream = !!upstreamData;
  const sqlResultJson = upstreamData ? JSON.stringify(upstreamData) : null;
  try {
    // Single-cell execution always runs in a fresh worker, so treat it as "first cell"
    // to properly load upstream data into `data` variable
    const wrappedCode = wrapCellCode(cell.source, true, hasUpstream, dataVarName);
    const response = await runPythonInPool(
      { code: wrappedCode, sqlResultJson, sqlArrowIpc: null },
      { timeoutMs: 120_000 },
    );
    const durationMs = Math.round(performance.now() - startTime);
    if (response.success) {
      return {
        cellId: cell.id,
        status: 'success',
        stdout: response.stdout ?? '',
        stderr: response.stderr ?? '',
        tableData: response.table ?? null,
        plotJson: response.plotJson ?? null,
        executionCount,
        durationMs,
      };
    }
    return {
      cellId: cell.id,
      status: 'error',
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      error: response.error ?? 'Execution failed',
      executionCount,
      durationMs,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      cellId: cell.id,
      status: 'error',
      stdout: '',
      stderr: '',
      error: err instanceof Error ? err.message : String(err),
      executionCount,
      durationMs,
    };
  }
}

function toHex(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Wraps cell code for Jupyter-like execution:
 *
 * 1. Uses Python ast to detect if the last statement is an expression
 *    (e.g. `data.head()`, `x + 1`, `data`). If so, transforms it into
 *    `result = <expr>` so the worker captures and displays it — exactly
 *    like Jupyter's auto-display of the last expression.
 *
 * 2. Preserves `data` / `df` across cells via __nb_* backup globals.
 *
 * 3. Nulls out `df` after each cell so the worker's auto-table probe
 *    doesn't return stale upstream data.
 */
function wrapCellCode(
  code: string,
  isFirstCell: boolean,
  hasUpstream: boolean,
  dataVarName?: string,
): string {
  const codeHex = toHex(code);

  let prefix: string;

  // For first cell: load data from `df` (set by worker from sql_result_json)
  const extraAssignDf = dataVarName ? `\n    ${dataVarName} = df.copy()` : '';
  const firstCellLoadSnippet = `
import pandas as _pd
if 'df' in dir() and df is not None and isinstance(df, _pd.DataFrame):
    data = df.copy()${extraAssignDf}
`;

  // For non-first cell with per-cell data: read from `sql_df` directly
  // (because the __nb_df restore would overwrite df with previous cell's data)
  const extraAssignSqlDf = dataVarName ? `\n    ${dataVarName} = sql_df.copy()` : '';
  const perCellLoadSnippet = `
import pandas as _pd
if 'sql_df' in dir() and sql_df is not None and isinstance(sql_df, _pd.DataFrame):
    data = sql_df.copy()${extraAssignSqlDf}
`;

  if (isFirstCell && !hasUpstream) {
    // First cell, no data at all
    prefix = '';
  } else if (isFirstCell) {
    // First cell with upstream data
    prefix = firstCellLoadSnippet;
  } else if (hasUpstream) {
    // Non-first cell WITH per-cell data: restore previous state, then load per-cell data from sql_df
    prefix = `
if '__nb_data' in globals() and __nb_data is not None:
    data = __nb_data
if '__nb_df' in globals() and __nb_df is not None:
    df = __nb_df
${perCellLoadSnippet}`;
  } else {
    // Non-first cell, no per-cell data: just restore previous state
    prefix = `
if '__nb_data' in globals() and __nb_data is not None:
    data = __nb_data
if '__nb_df' in globals() and __nb_df is not None:
    df = __nb_df
`;
  }

  // AST-based last-expression capture: parse user code, and if the last
  // statement is a bare expression, rewrite it as `result = <expr>`.
  // Also detects assignments (e.g. `da = df.head()`) — if the assigned
  // value turns out to be a DataFrame at runtime, it is captured as
  // `result` so that downstream PlotNodes can consume it.
  // The code is passed as hex to avoid any string escaping issues.
  // After exec, non-DataFrame/non-Plot results are printed via repr()
  // and `result` is nulled so the worker doesn't add a JSON-formatted line.
  const cellExec = `
import ast as _ast
_nb_code = bytes.fromhex("${codeHex}").decode("utf-8")
_nb_had_last_expr = False
_nb_assign_var = None
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
    elif _nb_tree.body and isinstance(_nb_tree.body[-1], _ast.Assign):
        _nb_last_a = _nb_tree.body[-1]
        if len(_nb_last_a.targets) == 1 and isinstance(_nb_last_a.targets[0], _ast.Name):
            _nb_assign_var = _nb_last_a.targets[0].id
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

# If last statement was an assignment (e.g. da = NetflixShows),
# capture the assigned value as result when it is a DataFrame or Plotly Figure.
# This allows downstream PlotNodes to consume data produced by assignment cells.
if _nb_assign_var is not None and globals().get("result") is None:
    import pandas as _pd
    _nb_assigned_val = globals().get(_nb_assign_var)
    if isinstance(_nb_assigned_val, _pd.DataFrame):
        result = _nb_assigned_val
    else:
        try:
            from plotly.graph_objs import Figure as _PlotlyFig
            if isinstance(_nb_assigned_val, _PlotlyFig):
                result = _nb_assigned_val
        except Exception:
            pass
`;

  const suffix = `
import pandas as _pd
__nb_data = globals().get("data") if ("data" in globals() and isinstance(globals().get("data"), _pd.DataFrame)) else globals().get("__nb_data")
__nb_df = globals().get("df") if ("df" in globals() and isinstance(globals().get("df"), _pd.DataFrame)) else globals().get("__nb_df")
df = None
`;

  return `${prefix}\n${cellExec}\n${suffix}`;
}
