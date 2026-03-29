/// <reference lib="webworker" />

import { tableFromIPC } from 'apache-arrow';
import { expose } from 'comlink';
import { cleanStderr, formatResultLine } from './pythonUtils';

declare const self: DedicatedWorkerGlobalScope & {
  loadPyodide?: (options: { indexURL: string }) => Promise<any>;
};

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const PYODIDE_JS_URL = `${PYODIDE_INDEX_URL}pyodide.js`;
// Prefer pyodide prebuilt packages; fallback to micropip with a compatible wheel
const PYTHON_WHEELS: string[] = [];
const CORE_PACKAGES = ['pandas', 'numpy', 'matplotlib', 'micropip'];
const DATA_STACK_BOOTSTRAP = `
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import plotly.express as px
import seaborn as sns
import builtins

from plotly.graph_objs import Figure
import plotly.io as pio
_workyy_last_plot = None
_original_show = pio.show
__workyy_last_df = None

def _workyy_capture_plot(fig=None, *args, **kwargs):
    global _workyy_last_plot
    if fig is not None and isinstance(fig, Figure):
        _workyy_last_plot = fig
    return _original_show(fig, *args, **kwargs)

pio.show = _workyy_capture_plot

def _workyy_pop_plot():
    global _workyy_last_plot
    fig = _workyy_last_plot
    _workyy_last_plot = None
    return fig

if not hasattr(builtins, "_workyy_original_print"):
    builtins._workyy_original_print = builtins.print

def _workyy_print(*args, **kwargs):
    global __workyy_last_df
    filtered_args = []
    for arg in args:
        if isinstance(arg, pd.DataFrame):
            __workyy_last_df = arg
            continue
        filtered_args.append(arg)
    return builtins._workyy_original_print(*filtered_args, **kwargs)

builtins.print = _workyy_print
`;

type PyodideInstance = Awaited<ReturnType<NonNullable<typeof self.loadPyodide>>>;

let pyodidePromise: Promise<PyodideInstance> | null = null;
let packagesReady: Promise<void> | null = null;
let dataStackReady: Promise<void> | null = null;

async function ensurePyodide(): Promise<PyodideInstance> {
  if (!pyodidePromise) {
    if (typeof self.loadPyodide !== 'function') {
      importScripts(PYODIDE_JS_URL);
    }
    if (typeof self.loadPyodide !== 'function') {
      throw new Error('Failed to load Pyodide runtime');
    }
    pyodidePromise = self.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  }
  return pyodidePromise;
}

async function ensurePackages(pyodide: PyodideInstance) {
  if (!packagesReady) {
    packagesReady = (async () => {
      await pyodide.loadPackage(CORE_PACKAGES);

      const ensureViaMicropip = async (moduleName: string, spec: string) => {
        let imported = true;
        try {
          pyodide.runPython(`import ${moduleName}`);
        } catch {
          imported = false;
        }
        if (imported) return;
        const micropip = pyodide.pyimport('micropip');
        try {
          await micropip.install(spec, { keep_going: true });
        } catch (error) {
          const message = String(error ?? '');
          if (!message.includes('already installed')) {
            console.warn(`Failed to install ${moduleName} via micropip`, error);
            throw error;
          }
        }
      };

      await ensureViaMicropip('seaborn', 'seaborn==0.13.2');
      await ensureViaMicropip('plotly', 'plotly==5.18.0');
    })();
  }
  await packagesReady;
}

async function ensureDataStack(pyodide: PyodideInstance) {
  if (!dataStackReady) {
    dataStackReady = pyodide.runPythonAsync(DATA_STACK_BOOTSTRAP);
  }
  await dataStackReady;
}

type WorkerTablePayload = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

type WorkerResponse =
  | {
      success: true;
      stdout: string;
      stderr: string;
      table: WorkerTablePayload | null;
      plotJson: string | null;
    }
  | {
      success: false;
      stdout: string;
      stderr: string;
      error?: string;
    };

function normalizeCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? Number(value.toString()) : asNumber;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

function buildArrowContext(buffer?: ArrayBuffer | null) {
  if (!buffer) return null;
  const table = tableFromIPC(new Uint8Array(buffer));
  const columns = table.schema.fields.map((field) => field.name);
  const columnPayload: Record<string, Array<string | number | null>> = {};
  for (const column of columns) {
    columnPayload[column] = [];
  }
  const rows: WorkerTablePayload['rows'] = [];
  const iterable = table.toArray() as Array<Record<string, unknown>>;
  for (const record of iterable) {
    const normalizedRow: Array<string | number | null> = [];
    for (const column of columns) {
      const cell = normalizeCell((record as Record<string, unknown>)[column]);
      columnPayload[column].push(cell);
      normalizedRow.push(cell);
    }
    rows.push(normalizedRow);
  }
  return { dataframePayload: columnPayload, snapshot: { columns, rows } };
}

const workerApi = {
  async runPython(params: {
    code: string;
    sqlResultJson?: string | null;
    sqlArrowIpc?: ArrayBuffer | null;
  }): Promise<WorkerResponse> {
    const pyodide = await ensurePyodide();
    await ensurePackages(pyodide);
    await ensureDataStack(pyodide);
    let stdout = '';
    let stderr = '';
    const restoreStdout = pyodide.setStdout({
      batched: (msg: string) => {
        stdout += msg + '\n';
      },
    });
    const restoreStderr = pyodide.setStderr({
      batched: (msg: string) => {
        stderr += msg + '\n';
      },
    });

    try {
      const arrowContext = buildArrowContext(params.sqlArrowIpc);
      if (arrowContext) {
        pyodide.globals.set('arrow_context', arrowContext.dataframePayload);
        pyodide.globals.set('arrow_snapshot', arrowContext.snapshot);
        pyodide.globals.set('sql_result_json', null);
      } else {
        pyodide.globals.set('arrow_context', null);
        pyodide.globals.set('arrow_snapshot', null);
        pyodide.globals.set('sql_result_json', params.sqlResultJson ?? null);
      }

      await pyodide.runPythonAsync(`
import json
import pandas as pd
_arrow_payload = None  # Arrow disabled (JSON-only transport)
_sql_json = globals().get("sql_result_json")
sql_df = None
# JSON-first: always build from rows/columns
if _sql_json:
    try:
        _sql_payload = json.loads(_sql_json)
        _df = pd.DataFrame(_sql_payload["rows"], columns=_sql_payload["columns"])
        if isinstance(_df, pd.DataFrame) and len(_df.columns) > 0:
            # попытка автоматически привести числовые столбцы к числовому типу
            for _col in _df.columns:
                try:
                    _df[_col] = pd.to_numeric(_df[_col])
                except (TypeError, ValueError):
                    pass
            sql_df = _df
    except Exception:
        sql_df = None
    
`);

      pyodide.runPython(`
df = sql_df
result = None
plot = None
fig = None
figure = None
if "_workyy_last_plot" in globals():
    _workyy_last_plot = None
`);

      await pyodide.runPythonAsync(params.code);

      // #region agent log
      try {
        const dfCols = pyodide.runPython(
          'list(df.columns) if "df" in globals() and df is not None else []',
        );
        const dfShape = pyodide.runPython(
          'df.shape if "df" in globals() and df is not None else (0,0)',
        );
        fetch('http://127.0.0.1:7242/ingest/6e6ee5ce-7ada-48d4-be5c-54bb656f1b89', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'python.worker.ts:afterCode',
            message: 'After user code execution',
            data: {
              dfColumns: Array.isArray(dfCols) ? dfCols : [],
              dfShape: Array.isArray(dfShape) ? dfShape : [],
              hasDf: 'df' in pyodide.runPython('"df" in globals()'),
            },
            timestamp: Date.now(),
            hypothesisId: 'A',
          }),
        }).catch(() => {});
      } catch (_) {}
      // #endregion

      let plotJson: string | null = null;
      try {
        const plotProbe = pyodide.runPython(`
import json
from plotly.graph_objs import Figure

def _resolve_plot():
    candidates = ["plot", "fig", "figure"]
    for name in candidates:
        if name in globals():
            value = globals()[name]
            if isinstance(value, Figure):
                return value
    if "_workyy_pop_plot" in globals():
        fallback = _workyy_pop_plot()
        if isinstance(fallback, Figure):
            return fallback
    return None

_candidate = _resolve_plot()
json.dumps({"has": _candidate is not None, "json": _candidate.to_json() if _candidate is not None else None})
`);
        const parsed = JSON.parse(plotProbe);
        if (parsed?.has && typeof parsed.json === 'string') {
          plotJson = parsed.json;
        }
      } catch (error) {
        console.warn('Failed to capture plot payload', error);
      }

      let resolvedResultPayload: {
        hasCandidate?: boolean;
        hasExplicitResult?: boolean;
        table?: WorkerTablePayload;
        payload?: unknown;
      } | null = null;
      try {
        // Debug: check df state before candidate selection
        const dfDebug = pyodide.runPython(`
import json
from pandas import DataFrame

_debug_info = {}
if "df" in globals():
    _df = globals()["df"]
    if _df is None:
        _debug_info["df"] = "None"
    elif isinstance(_df, DataFrame):
        _debug_info["df"] = {"type": "DataFrame", "columns": list(_df.columns), "shape": _df.shape}
    else:
        _debug_info["df"] = {"type": str(type(_df))}
else:
    _debug_info["df"] = "not in globals"

if "result" in globals():
    _result = globals()["result"]
    if _result is None:
        _debug_info["result"] = "None"
    elif isinstance(_result, DataFrame):
        _debug_info["result"] = {"type": "DataFrame", "columns": list(_result.columns)}
    else:
        _debug_info["result"] = {"type": str(type(_result))}
else:
    _debug_info["result"] = "not in globals"

json.dumps(_debug_info)
`);
        const dfDebugParsed = JSON.parse(dfDebug);

        const candidateProbe = pyodide.runPython(`
import json
from pandas import DataFrame

_has_explicit = False
_candidate = None
if "result" in globals():
    _candidate = globals()["result"]
    if _candidate is not None:
        _has_explicit = True
if _candidate is None:
    _candidate = globals().get("__workyy_last_df")
if _candidate is None and "df" in globals():
    _candidate = globals()["df"]

def _serialize_candidate(candidate, has_explicit_result):
    if candidate is None or str(candidate) == "None":
        return {"hasCandidate": False, "hasExplicitResult": has_explicit_result, "error": "candidate is None"}
    if isinstance(candidate, DataFrame):
        try:
            _shape = candidate.shape
            _max_rows = 100000
            _df_to_serialize = candidate.head(_max_rows) if _shape[0] > _max_rows else candidate.copy()
            # So that groupby().count() and other index-carrying results show index as columns in the UI,
            # always flatten the index into columns (reset_index). to_json(orient='split') only exposes
            # "columns" and "data", not the index.
            _df_to_serialize = _df_to_serialize.reset_index()
            _cols = list(_df_to_serialize.columns)
            _json_str = _df_to_serialize.to_json(orient='split', date_format='iso', default_handler=str)
            _parsed = json.loads(_json_str)
            _rows = _parsed["data"]
            return {
                "hasCandidate": True,
                "hasExplicitResult": has_explicit_result,
                "table": {
                    "columns": _cols,
                    "rows": _rows
                },
                "originalRowCount": _shape[0],
                "serializedRowCount": len(_rows)
            }
        except Exception as e:
            return {"hasCandidate": False, "hasExplicitResult": has_explicit_result, "error": str(e), "errorType": type(e).__name__}
    if hasattr(candidate, "to_dict"):
        try:
            return {
                "hasCandidate": True,
                "hasExplicitResult": has_explicit_result,
                "payload": candidate.to_dict()
            }
        except Exception:
            pass
    return {
        "hasCandidate": True,
        "hasExplicitResult": has_explicit_result,
        "payload": {"value": str(candidate)}
    }

json.dumps(_serialize_candidate(_candidate, _has_explicit))
`);
        resolvedResultPayload = JSON.parse(candidateProbe);

        // #region agent log
        if (resolvedResultPayload?.error) {
          console.error('[WORKER ERROR] Serialization failed:', resolvedResultPayload.error);
        }
        // #endregion
      } catch (error) {
        console.warn('Failed to interpret python result payload', error);
      }

      let tablePayload: WorkerTablePayload | null = null;
      if (
        resolvedResultPayload?.table &&
        Array.isArray(resolvedResultPayload.table.columns) &&
        Array.isArray(resolvedResultPayload.table.rows)
      ) {
        tablePayload = resolvedResultPayload.table as WorkerTablePayload;
      }

      if (tablePayload) {
        const cleanedStderr = cleanStderr(stderr);
        return {
          success: true,
          stdout,
          stderr: cleanedStderr,
          table: tablePayload,
          plotJson: plotJson ?? null,
        };
      }

      if (
        resolvedResultPayload?.hasCandidate &&
        resolvedResultPayload.hasExplicitResult &&
        resolvedResultPayload.payload
      ) {
        const formattedLine = formatResultLine(resolvedResultPayload.payload);
        if (formattedLine) {
          stdout += `\nresult = ${formattedLine}\n`;
        }
      }

      const cleanedStderr = cleanStderr(stderr);
      return {
        success: true,
        stdout,
        stderr: cleanedStderr,
        table: null,
        plotJson: plotJson ?? null,
      };
    } catch (error) {
      const cleanedStderr = cleanStderr(stderr);
      return {
        success: false,
        stdout,
        stderr: cleanedStderr,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (typeof restoreStdout === 'function') restoreStdout();
      if (typeof restoreStderr === 'function') restoreStderr();
      pyodide.globals.set('sql_result_json', null);
      pyodide.globals.set('arrow_context', null);
      pyodide.globals.set('arrow_snapshot', null);
      pyodide.globals.set('result', null);
      pyodide.globals.set('plot', null);
      pyodide.globals.set('fig', null);
      pyodide.globals.set('figure', null);
      pyodide.globals.set('_workyy_last_plot', null);
      pyodide.globals.set('__workyy_last_df', null);
    }
  },
};

export type PythonWorkerApi = typeof workerApi;

expose(workerApi);
