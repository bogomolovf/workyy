import { create } from 'zustand';
import type { ChartType, PlotConfig } from '../lib/visualization/chartTypes';

export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

export type SqlResult = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  arrow?: Uint8Array;
  /** Total number of rows when using preview mode */
  totalCount?: number;
  /** Whether this is a preview (limited) result set */
  isPreview?: boolean;
};

export type PythonResult = {
  stdout: string;
  stderr?: string;
  table?: SqlResult | null;
  plotJson?: string | null;
};

export type PlotResult = {
  chartType: ChartType;
  config: PlotConfig;
  inputData: SqlResult;
  rendered?: {
    library: 'echarts';
    spec: unknown;
  };
};

type NodeExecutionOutput =
  | { kind: 'sql'; result: SqlResult; code: string }
  | { kind: 'python'; result: PythonResult; code: string }
  | { kind: 'plot'; result: PlotResult; code?: string };

type HiddenOutputs = {
  error?: boolean;
  warnings?: boolean;
};

export type ExecutionEntry = {
  nodeType: 'sql' | 'python' | 'table' | 'plot';
  status: NodeStatus;
  code: string;
  error?: string | null;
  startedAt?: number;
  finishedAt?: number;
  output?: NodeExecutionOutput;
  hiddenOutputs?: HiddenOutputs;
};

const DEFAULT_PYTHON_TEMPLATE = [
  'import pandas as pd',
  'import plotly.express as px',
  '',
  'if df is None:',
  "    print('⚠️ Run the upstream SQL node first.')",
  '    result = None',
  'else:',
  "    summary = df.groupby('region', as_index=False)['revenue'].sum()",
  '    result = summary',
  "    plot = px.bar(summary, x='region', y='revenue', title='Revenue by region')",
].join('\n');

const HIDDEN_ERROR_KEY_PREFIX = 'workyy:python:hidden-error:';
const HIDDEN_WARNING_KEY_PREFIX = 'workyy:python:hidden-warning:';

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readHiddenFlag(key: string): boolean | undefined {
  if (!hasBrowserStorage()) return undefined;
  try {
    return window.localStorage.getItem(key) === '1' ? true : undefined;
  } catch {
    return undefined;
  }
}

function writeHiddenFlag(key: string, value: boolean) {
  if (!hasBrowserStorage()) return;
  try {
    if (value) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

function createHiddenOutputs(overrides?: HiddenOutputs): HiddenOutputs {
  return {
    error: overrides?.error ?? false,
    warnings: overrides?.warnings ?? false,
  };
}

function resolveInitialHiddenOutputs(nodeId: string, overrides?: HiddenOutputs): HiddenOutputs {
  const error = readHiddenFlag(`${HIDDEN_ERROR_KEY_PREFIX}${nodeId}`);
  const warnings = readHiddenFlag(`${HIDDEN_WARNING_KEY_PREFIX}${nodeId}`);
  return {
    error: error ?? overrides?.error ?? false,
    warnings: warnings ?? overrides?.warnings ?? false,
  };
}

function persistHiddenOutputs(nodeId: string, hiddenOutputs?: HiddenOutputs) {
  writeHiddenFlag(`${HIDDEN_ERROR_KEY_PREFIX}${nodeId}`, hiddenOutputs?.error ?? false);
  writeHiddenFlag(`${HIDDEN_WARNING_KEY_PREFIX}${nodeId}`, hiddenOutputs?.warnings ?? false);
}

function normalizeMultiline(value?: string) {
  if (!value) return value;
  return value.replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
}

export type ExecutionStoreState = {
  entries: Record<string, ExecutionEntry>;
  initFromNodes: (
    nodes: Array<{
      id: string;
      type: 'sql' | 'python' | 'table' | 'plot';
      payload?: Record<string, unknown>;
    }>,
  ) => void;
  registerNode: (node: {
    id: string;
    type: 'sql' | 'python' | 'table' | 'plot';
    payload?: Record<string, unknown>;
  }) => void;
  setCode: (nodeId: string, code: string) => void;
  setStatus: (nodeId: string, status: NodeStatus) => void;
  setSuccess: (nodeId: string, output: NodeExecutionOutput) => void;
  setError: (nodeId: string, message: string) => void;
  reset: (nodeId: string) => void;
  resetOutput: (nodeId: string) => void;
  dismissError: (nodeId: string) => void;
  dismissWarnings: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
};

function getInitialCode(node: {
  type: 'sql' | 'python' | 'table' | 'plot';
  payload?: Record<string, unknown>;
}) {
  if (node.type === 'sql') {
    const sqlPayload = node.payload?.sql as string | undefined;
    return normalizeMultiline(sqlPayload) ?? 'SELECT 1;';
  }
  if (node.type === 'python') {
    const pythonPayload = node.payload?.python as string | undefined;
    const normalized = normalizeMultiline(pythonPayload);
    return normalized ?? DEFAULT_PYTHON_TEMPLATE;
  }
  if (node.type === 'plot') {
    // Plot nodes don't have code, but we return empty string for consistency
    return '';
  }
  return '';
}

export const useExecutionStore = create<ExecutionStoreState>((set, get) => ({
  entries: {},
  initFromNodes: (nodes) => {
    const existing = get().entries;
    if (Object.keys(existing).length > 0) {
      return;
    }
    const entries: Record<string, ExecutionEntry> = {};
    for (const node of nodes) {
      const code = getInitialCode(node);
      // Восстанавливаем результаты выполнения из payload, если они есть
      const savedExecution = (node.payload as Record<string, unknown> | undefined)?.execution as
        | {
            status?: NodeStatus;
            output?: NodeExecutionOutput;
            error?: string | null;
            hiddenOutputs?: HiddenOutputs;
          }
        | undefined;

      const hiddenOutputs = resolveInitialHiddenOutputs(node.id, savedExecution?.hiddenOutputs);
      entries[node.id] = {
        nodeType: node.type,
        status: savedExecution?.status ?? 'idle',
        code,
        error: savedExecution?.error ?? null,
        output: savedExecution?.output,
        hiddenOutputs,
      };
    }
    set({ entries });
  },
  registerNode: (node) => {
    const entries = get().entries;
    if (entries[node.id]) return;
    const hiddenOutputs = resolveInitialHiddenOutputs(node.id);
    set({
      entries: {
        ...entries,
        [node.id]: {
          nodeType: node.type,
          status: 'idle',
          code: getInitialCode(node),
          error: null,
          hiddenOutputs,
        },
      },
    });
  },
  setCode: (nodeId, code) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [nodeId]: {
          ...state.entries[nodeId],
          code,
        },
      },
    })),
  setStatus: (nodeId, status) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      const hiddenOutputs = status === 'running' ? createHiddenOutputs() : entry.hiddenOutputs;
      if (status === 'running') {
        persistHiddenOutputs(nodeId, hiddenOutputs);
      }
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            status,
            startedAt: status === 'running' ? Date.now() : entry.startedAt,
            finishedAt: status !== 'running' ? Date.now() : undefined,
            error: status === 'running' ? null : entry.error,
            ...(status === 'running' ? { output: undefined } : { output: entry.output }),
            hiddenOutputs,
          },
        },
      };
    }),
  setSuccess: (nodeId, output) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      let normalizedOutput: NodeExecutionOutput = output;
      if (output.kind === 'python') {
        normalizedOutput = {
          kind: 'python',
          code: output.code,
          result: {
            stdout: output.result.stdout ?? '',
            stderr: output.result.stderr ?? '',
            table: output.result.table ?? null,
            plotJson: output.result.plotJson ?? null,
          },
        };
      }
      const hiddenOutputs = createHiddenOutputs(entry.hiddenOutputs);
      hiddenOutputs.error = false;
      hiddenOutputs.warnings = false;
      persistHiddenOutputs(nodeId, hiddenOutputs);
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            status: 'success',
            output: normalizedOutput,
            error: null,
            finishedAt: Date.now(),
            hiddenOutputs,
          },
        },
      };
    }),
  setError: (nodeId, message) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      const hiddenOutputs = createHiddenOutputs(entry.hiddenOutputs);
      hiddenOutputs.error = false;
      persistHiddenOutputs(nodeId, hiddenOutputs);
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            status: 'error',
            error: message,
            output: undefined, // Clear previous output when error occurs
            finishedAt: Date.now(),
            hiddenOutputs,
          },
        },
      };
    }),
  reset: (nodeId) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      const hiddenOutputs = createHiddenOutputs();
      persistHiddenOutputs(nodeId, hiddenOutputs);
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            status: 'idle',
            error: null,
            output: undefined,
            hiddenOutputs,
          },
        },
      };
    }),
  resetOutput: (nodeId) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      if (entry.nodeType === 'python') {
        const hiddenOutputs = createHiddenOutputs();
        persistHiddenOutputs(nodeId, hiddenOutputs);
        return {
          entries: {
            ...state.entries,
            [nodeId]: {
              ...entry,
              status: 'idle',
              error: null,
              startedAt: undefined,
              finishedAt: undefined,
              output: {
                kind: 'python',
                code: entry.code,
                result: {
                  stdout: '',
                  stderr: '',
                  table: null,
                  plotJson: null,
                },
              },
              hiddenOutputs,
            },
          },
        };
      }
      if (entry.nodeType === 'plot') {
        // Plot nodes don't need special reset handling
        const hiddenOutputs = createHiddenOutputs();
        persistHiddenOutputs(nodeId, hiddenOutputs);
        return {
          entries: {
            ...state.entries,
            [nodeId]: {
              ...entry,
              status: 'idle',
              error: null,
              startedAt: undefined,
              finishedAt: undefined,
              output: undefined,
              hiddenOutputs,
            },
          },
        };
      }
      const hiddenOutputs = createHiddenOutputs();
      persistHiddenOutputs(nodeId, hiddenOutputs);
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            status: 'idle',
            error: null,
            startedAt: undefined,
            finishedAt: undefined,
            output: undefined,
            hiddenOutputs,
          },
        },
      };
    }),
  dismissError: (nodeId) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      const hiddenOutputs = createHiddenOutputs(entry.hiddenOutputs);
      if (hiddenOutputs.error) return state;
      hiddenOutputs.error = true;
      persistHiddenOutputs(nodeId, hiddenOutputs);
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            hiddenOutputs,
          },
        },
      };
    }),
  dismissWarnings: (nodeId) =>
    set((state) => {
      const entry = state.entries[nodeId];
      if (!entry) return state;
      const hiddenOutputs = createHiddenOutputs(entry.hiddenOutputs);
      if (hiddenOutputs.warnings) return state;
      hiddenOutputs.warnings = true;
      persistHiddenOutputs(nodeId, hiddenOutputs);
      return {
        entries: {
          ...state.entries,
          [nodeId]: {
            ...entry,
            hiddenOutputs,
          },
        },
      };
    }),
  removeNode: (nodeId) =>
    set((state) => {
      if (!(nodeId in state.entries)) {
        return state;
      }
      const nextEntries = { ...state.entries };
      delete nextEntries[nodeId];
      persistHiddenOutputs(nodeId, createHiddenOutputs());
      return { entries: nextEntries };
    }),
}));
