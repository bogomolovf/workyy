'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useFullCsvDataForPlot } from '../hooks/useFullCsvDataForPlot';
import { useFullSqlDataForPlot } from '../hooks/useFullSqlDataForPlot';
import { usePlotData } from '../hooks/usePlotData';
import { usePlotSnapshot } from '../hooks/usePlotSnapshot';
import type { PlotNodePayload } from '../lib/visualization/chartTypes';
import type { SqlResult, PythonResult, NodeStatus, ExecutionEntry } from '../state/executionStore';
import { PlotNodeConfigPanel } from './flowNodes/PlotNodeConfigPanel';
import { InteractiveResultTable } from './InteractiveResultTable';
import { PlotPreview } from './PlotPreview';

const MonacoEditor = dynamic(async () => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-sm text-slate-400">
      Loading editor…
    </div>
  ),
});

type CommonProps = {
  status: NodeStatus;
  error?: string | null;
  lastStartedAt?: number;
  lastFinishedAt?: number;
};

type SqlInspectorProps = CommonProps & {
  kind: 'sql';
  code: string;
  onChange: (code: string | undefined) => void;
  result?: SqlResult;
};

type PythonInspectorProps = CommonProps & {
  kind: 'python';
  code: string;
  onChange: (code: string | undefined) => void;
  result?: PythonResult;
};

type PlotInspectorProps = CommonProps & {
  kind: 'plot';
  code: string;
  onChange: (code: string | undefined) => void;
  nodeId: string;
  nodes: Array<{ id: string; type: string; payload?: Record<string, unknown> }>;
  edges: Array<{ sourceId: string; targetId: string }>;
  executionEntries: Record<string, ExecutionEntry | undefined>;
  onPlotConfigChange?: (nodeId: string, payload: Partial<PlotNodePayload>) => void;
};

type InspectorProps = (SqlInspectorProps | PythonInspectorProps | PlotInspectorProps) & {
  nodeLabel: string;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

const statusStyles: Record<NodeStatus, string> = {
  idle: 'bg-slate-200 text-slate-600',
  running: 'bg-amber-100 text-amber-600 border border-amber-300',
  success: 'bg-emerald-100 text-emerald-600 border border-emerald-300',
  error: 'bg-rose-100 text-rose-600 border border-rose-300',
};

const STATUS_LABELS_RU: Record<NodeStatus, string> = {
  idle: 'Ожидание',
  running: 'Выполняется',
  success: 'Успех',
  error: 'Ошибка',
};

function StatusBadge({ status, locale = 'en' }: { status: NodeStatus; locale?: 'en' | 'ru' }) {
  const label = locale === 'ru' ? STATUS_LABELS_RU[status] : status.toUpperCase();
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {label}
    </span>
  );
}

function PythonOutput({ result }: { result: PythonResult }) {
  const hasStdout = result.stdout && result.stdout.trim().length > 0;
  const hasStderr = result.stderr && result.stderr.trim().length > 0;
  return (
    <div className="flex flex-col gap-4">
      {hasStdout && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stdout
          </h4>
          <pre className="whitespace-pre-wrap break-words">{result.stdout}</pre>
        </div>
      )}
      {hasStderr && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">
            Stderr
          </h4>
          <pre className="whitespace-pre-wrap break-words">{result.stderr}</pre>
        </div>
      )}
      {result.table && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            result (DataFrame)
          </h4>
          <InteractiveResultTable result={result.table} />
        </div>
      )}
      {result.plotJson && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Plot
          </h4>
          <PlotPreview plotJson={result.plotJson} height={240} />
        </div>
      )}
      {!hasStdout && !hasStderr && !result.table && (
        <div className="rounded-md border border-slate-200 bg-slate-100 p-3 text-sm text-slate-500">
          Execution finished without output.
        </div>
      )}
    </div>
  );
}

type StatusSummaryProps = Pick<InspectorProps, 'status' | 'lastFinishedAt'> & {
  locale?: 'en' | 'ru';
};

function StatusSummary({ status, lastFinishedAt, locale = 'en' }: StatusSummaryProps) {
  const lastRunText = useMemo(() => {
    if (!lastFinishedAt) return locale === 'ru' ? 'Ещё не запускался' : 'Not run yet';
    const diff = Date.now() - lastFinishedAt;
    if (diff < 1000) return locale === 'ru' ? 'Только что' : 'Just now';
    if (diff < 60_000) {
      const s = Math.round(diff / 1000);
      return locale === 'ru' ? `${s} с назад` : `${s}s ago`;
    }
    const minutes = Math.round(diff / 60_000);
    return locale === 'ru' ? `${minutes} мин назад` : `${minutes}m ago`;
  }, [lastFinishedAt, locale]);

  const lastRunLabel = locale === 'ru' ? 'Последний запуск: ' : 'Last run: ';

  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <StatusBadge status={status} locale={locale} />
      <span className="text-xs text-slate-500">
        {lastRunLabel}
        {lastRunText}
      </span>
    </div>
  );
}

export function BoardInspector(props: InspectorProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    props.onCollapseChange?.(collapsed);
  };

  // IMPORTANT: All hooks must be called unconditionally at the top level
  // Memoize edges for plot nodes to ensure stable reference
  // Always provide valid values to maintain hook order, even for non-plot nodes
  const plotEdges = useMemo(() => {
    if (props.kind === 'plot') {
      return props.edges;
    }
    return [];
  }, [props.kind, props.kind === 'plot' ? props.edges : null]);

  // Call usePlotData unconditionally to maintain stable hook order
  // Pass valid nodeId and edges even for non-plot nodes (result will be ignored)
  const plotNodeId = props.kind === 'plot' ? props.nodeId : '';
  const plotData = usePlotData(plotNodeId, plotEdges);
  const plotSnapshot = usePlotSnapshot(plotNodeId);

  // When Plot is connected to CSV: fetch limited dataset for config panel (not only 100 rows)
  const upstreamCsvTableName = useMemo(() => {
    if (props.kind !== 'plot') return undefined;
    const edge = props.edges.find((e) => e.targetId === props.nodeId);
    if (!edge) return undefined;
    const sourceNode = props.nodes.find((n) => n.id === edge.sourceId);
    const isCsv = sourceNode?.type === 'csv' || sourceNode?.type === 'csvNode';
    if (!isCsv) return undefined;
    return (sourceNode.payload as { tableName?: string })?.tableName;
  }, [props.kind, props.nodeId, props.edges, props.nodes]);
  const upstreamSqlNodeId = useMemo(() => {
    if (props.kind !== 'plot') return undefined;
    const edge = props.edges.find((e) => e.targetId === props.nodeId);
    if (!edge) return undefined;
    const sourceNode = props.nodes.find((n) => n.id === edge.sourceId);
    return sourceNode?.type === 'sql' ? edge.sourceId : undefined;
  }, [props.kind, props.nodeId, props.edges, props.nodes]);
  const { data: fullCsvData } = useFullCsvDataForPlot(upstreamCsvTableName);
  const { data: fullSqlData } = useFullSqlDataForPlot(upstreamSqlNodeId);
  // For config panel mirror chart behavior: CSV/SQL → full data or snapshot; иначе → snapshot/preview.
  // Include plotData (from executionStore with normalized column names) as fallback so that
  // field mapping is shown even when fullCsvData / fullSqlData are not yet available.
  const plotDataForConfig = upstreamCsvTableName
    ? (fullCsvData ?? plotData ?? plotSnapshot)
    : upstreamSqlNodeId
      ? (fullSqlData ?? plotData ?? plotSnapshot)
      : (plotSnapshot ?? plotData);

  // Handle plot node configuration
  if (props.kind === 'plot') {
    const payload =
      (props.nodes.find((n) => n.id === props.nodeId)?.payload as PlotNodePayload | undefined) ??
      ({
        chartType: 'bar',
        mapping: {},
        styling: {
          title: 'New Chart',
          theme: 'light',
          showLegend: true,
          legendPosition: 'top',
          showGrid: true,
          enableZoomPan: false,
          enableTooltips: true,
        },
        version: '1',
        autoConfigured: false,
      } satisfies PlotNodePayload);

    const handlePlotConfigChange = (nodeId: string, newPayload: Partial<PlotNodePayload>) => {
      props.onPlotConfigChange?.(nodeId, newPayload);
    };

    if (isCollapsed) {
      return (
        <aside
          className="board-inspector flex h-full min-h-0 flex-none flex-col border-l border-slate-200 bg-white shadow-inner relative"
          style={{ width: '100%', maxWidth: '480px' }}
        >
          <button
            onClick={() => handleCollapse(false)}
            className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[60%] z-10 w-10 h-16 rounded-l-full bg-white border border-l-0 border-slate-200 shadow-lg hover:bg-slate-50 transition-colors flex items-center justify-center group"
            title="Развернуть инспектор"
            aria-label="Развернуть инспектор"
          >
            <svg
              className="h-5 w-5 text-black group-hover:text-slate-700 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </aside>
      );
    }

    return (
      <aside
        className="board-inspector flex h-full min-h-0 w-full flex-none flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white px-5 py-6 shadow-inner"
        style={{ width: '480px', maxWidth: '480px' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Выбранный узел</span>
            <h2 className="text-lg font-semibold text-slate-900">{props.nodeLabel}</h2>
          </div>
          <button
            onClick={() => handleCollapse(true)}
            className="flex-shrink-0 rounded p-1 hover:bg-slate-100 transition-colors"
            title="Свернуть инспектор"
            aria-label="Свернуть инспектор"
          >
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
        <StatusSummary status={props.status} lastFinishedAt={props.lastFinishedAt} locale="ru" />
        <PlotNodeConfigPanel
          nodeId={props.nodeId}
          payload={payload}
          data={plotDataForConfig}
          onChange={handlePlotConfigChange}
        />
      </aside>
    );
  }

  if (isCollapsed) {
    return (
      <aside
        className="board-inspector flex h-full min-h-0 flex-none flex-col border-l border-slate-200 bg-white shadow-inner relative"
        style={{ width: '100%', maxWidth: '480px' }}
      >
        {/* Полукруглая кнопка посередине правой грани */}
        <button
          onClick={() => handleCollapse(false)}
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[60%] z-10 w-10 h-16 rounded-l-full bg-white border border-l-0 border-slate-200 shadow-lg hover:bg-slate-50 transition-colors flex items-center justify-center group"
          title="Развернуть инспектор"
          aria-label="Развернуть инспектор"
        >
          <svg
            className="h-5 w-5 text-black group-hover:text-slate-700 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="board-inspector flex h-full min-h-0 w-full flex-none flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white px-5 py-6 shadow-inner"
      style={{ width: '480px', maxWidth: '480px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-500">Selected node</span>
          <h2 className="text-lg font-semibold text-slate-900">{props.nodeLabel}</h2>
        </div>
        <button
          onClick={() => handleCollapse(true)}
          className="flex-shrink-0 rounded p-1 hover:bg-slate-100 transition-colors"
          title="Свернуть инспектор"
          aria-label="Свернуть инспектор"
        >
          <svg
            className="h-5 w-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>
      <StatusSummary status={props.status} lastFinishedAt={props.lastFinishedAt} />
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-500">
          {props.kind === 'sql' ? 'SQL Statement' : 'Python Cell'}
        </label>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <MonacoEditor
            language={props.kind === 'sql' ? 'sql' : 'python'}
            height="220px"
            theme="vs-light"
            value={props.code}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
            onChange={(value) => props.onChange(value ?? '')}
          />
        </div>
      </div>
      {props.error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          {props.error}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {props.kind === 'sql' && props.result && <InteractiveResultTable result={props.result} />}
        {props.kind === 'sql' && !props.result && props.status === 'success' && (
          <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
            Query executed successfully. No tabular output returned.
          </div>
        )}
        {props.kind === 'python' && props.result && <PythonOutput result={props.result} />}
        {props.kind === 'python' && !props.result && props.status === 'success' && (
          <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
            Execution finished without captured output. Use `print()` or assign to `result`.
          </div>
        )}
      </div>
    </aside>
  );
}
