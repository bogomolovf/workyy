'use client';

import { Download, CaretDown } from '@phosphor-icons/react';
import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useFullCsvDataForPlot } from '../../hooks/useFullCsvDataForPlot';
import { useFullSqlDataForPlot } from '../../hooks/useFullSqlDataForPlot';
import { usePlotData, getUpstreamNodeId } from '../../hooks/usePlotData';
import { usePlotSnapshot } from '../../hooks/usePlotSnapshot';
import type { PlotNodePayload } from '../../lib/visualization/chartTypes';
import { validatePlotConfig } from '../../lib/visualization/dataAnalyzer';
import { useExecutionStore, type SqlResult } from '../../state/executionStore';
import { DATA_NODE_HANDLE_CLASS } from '../BoardCanvas';
import { ChartRenderer } from '../visualizations/ChartRenderer';

type PlotNodeData = {
  nodeId: string;
  payload?: Record<string, unknown>;
  edges: Array<{ sourceId: string; targetId: string }>;
  width: number;
  /** When Plot is connected to CSV node - use limited data from DuckDB for visualization */
  upstreamCsvTableName?: string;
  /** When Plot is connected to SQL node - fetch up to PLOT_DATA_MAX_ROWS without loading into store */
  upstreamSqlNodeId?: string;
  /** ExecutionStore entry ID for notebook cell output (format: "notebookId__cellId") */
  notebookCellEntryId?: string;
  /** Direct inline data passed from BoardCanvas (e.g. CSV data through notebook) */
  inlineData?: { columns: string[]; rows: Array<Array<string | number | null>> };
  /** Callback to persist data snapshot to Yjs payload (survives page refresh) */
  onPayloadChange?: (nodeId: string, patch: Record<string, unknown>) => void;
};

function PlotNodeComponent({ data, selected }: NodeProps<PlotNodeData>) {
  // IMPORTANT: All hooks must be called unconditionally at the top level
  // Memoize payload to ensure stable reference
  const payload = useMemo(() => {
    return (
      (data.payload as PlotNodePayload | undefined) ??
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
      } satisfies PlotNodePayload)
    );
  }, [data.payload]);

  // Memoize edges to ensure stable reference for usePlotData
  // Only incoming edges matter for this node
  const incomingEdges = useMemo(
    () => data.edges.filter((e) => e.targetId === data.nodeId),
    [data.edges, data.nodeId],
  );

  // When connected to CSV: fetch limited dataset from DuckDB (not first 100 rows only)
  const { data: fullCsvData, loading: fullCsvLoading } = useFullCsvDataForPlot(
    data.upstreamCsvTableName,
  );
  // When connected to SQL: fetch up to PLOT_DATA_MAX_ROWS without putting in executionStore
  const { data: fullSqlData, loading: fullSqlLoading } = useFullSqlDataForPlot(
    data.upstreamSqlNodeId,
  );
  // Snapshot: persisted inputData of this Plot node (up to 10k rows),
  // restored from payload.execution.output on page reload.
  const snapshotData = usePlotSnapshot(data.nodeId);
  // When connected to a notebook cell: read cell output from executionStore
  const notebookCellData = useExecutionStore((state) => {
    if (!data.notebookCellEntryId) return undefined;
    const entry = state.entries[data.notebookCellEntryId];
    if (!entry?.output) return undefined;
    if (entry.output.kind === 'python' && entry.output.result?.table)
      return entry.output.result.table;
    return undefined;
  });
  // Fallback: data from executionStore for non-CSV/SQL chains (e.g. plot→plot, python)
  const storeData = usePlotData(data.nodeId, incomingEdges);

  // Reactively detect if upstream is a notebook with executed cell data.
  // When notebook cells have been run, their processed data should take
  // priority over the raw CSV passthrough (inlineData / fullCsvData).
  const upstreamNodeId = useMemo(
    () => getUpstreamNodeId(incomingEdges, data.nodeId),
    [incomingEdges, data.nodeId],
  );
  const hasNotebookCellOutput = useExecutionStore((state) => {
    if (!upstreamNodeId) return false;
    const prefix = `${upstreamNodeId}__`;
    return Object.keys(state.entries).some((k) => {
      if (!k.startsWith(prefix)) return false;
      const entry = state.entries[k];
      return entry?.output?.kind === 'python' && !!entry.output.result?.table;
    });
  });

  // Restore persisted data snapshot from payload (survives page refresh via Yjs)
  const payloadSnapshot = useMemo(() => {
    const snap = (data.payload as any)?._dataSnapshot;
    if (snap && snap.columns && snap.rows) return snap as SqlResult;
    return undefined;
  }, [(data.payload as any)?._dataSnapshot]);

  // When connected to a specific notebook cell (via cell-out-{cellId} handle),
  // use ONLY that cell's data. This prevents cross-contamination when multiple
  // PlotNodes are connected to different cells of the same notebook.
  // For generic connections (not cell-specific), use the full priority cascade.
  const plotData = data.notebookCellEntryId
    ? (notebookCellData ?? snapshotData ?? payloadSnapshot)
    : ((hasNotebookCellOutput ? storeData : undefined) ??
      data.inlineData ??
      (data.upstreamCsvTableName ? fullCsvData : undefined) ??
      (data.upstreamSqlNodeId ? fullSqlData : undefined) ??
      storeData ??
      snapshotData ??
      payloadSnapshot);

  // Persist data snapshot to Yjs payload when plotData changes (survives page refresh)
  const lastSnapshotKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!plotData || !plotData.columns || !plotData.rows || !data.onPayloadChange) return;
    const key = `${plotData.columns.join(',')}|${plotData.rows.length}`;
    if (lastSnapshotKeyRef.current === key) return;
    lastSnapshotKeyRef.current = key;
    const maxRows = 5000;
    const snapshot = {
      columns: plotData.columns,
      rows: plotData.rows.length > maxRows ? plotData.rows.slice(0, maxRows) : plotData.rows,
    };
    data.onPayloadChange(data.nodeId, { _dataSnapshot: snapshot });
  }, [plotData, data.nodeId, data.onPayloadChange]);

  const echartsInstanceRef = useRef<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Memoize status calculation to avoid unnecessary recalculations
  const { status, errorMessage } = useMemo(() => {
    let currentStatus: 'no-data' | 'config-needed' | 'ready' | 'error' = 'ready';
    let currentErrorMessage: string | undefined;

    if (!plotData) {
      // Check if there are incoming edges
      const hasIncomingEdges = incomingEdges.length > 0;
      if (hasIncomingEdges) {
        // If CSV data is being loaded from DuckDB, show loading message instead of "run upstream"
        if (data.upstreamCsvTableName && fullCsvLoading) {
          currentStatus = 'no-data';
          currentErrorMessage = 'Loading data from CSV…';
        } else {
          currentStatus = 'no-data';
          currentErrorMessage = 'Run upstream node to load data.';
        }
      } else {
        currentStatus = 'no-data';
        currentErrorMessage = 'Connect a SQL, Python, or CSV node to this chart.';
      }
    } else {
      const validation = validatePlotConfig(plotData, payload);
      if (!validation.valid) {
        currentStatus = 'config-needed';
        currentErrorMessage = validation.message;
      } else if (
        !payload.mapping.x ||
        (!payload.mapping.y && payload.chartType !== 'pie' && payload.chartType !== 'doughnut')
      ) {
        currentStatus = 'config-needed';
      } else {
        currentStatus = 'ready';
      }
    }

    return { status: currentStatus, errorMessage: currentErrorMessage };
  }, [
    plotData,
    payload,
    incomingEdges.length,
    data.nodeId,
    data.upstreamCsvTableName,
    fullCsvLoading,
  ]);

  const chartHeight = 360;
  const nodeWidth = data.width || 500;

  // Memoize callback to prevent unnecessary re-renders
  const handleEChartsInstance = useCallback((instance: any | null) => {
    echartsInstanceRef.current = instance;
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = () => setShowExportMenu(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

  const handleExport = async (format: 'png' | 'svg') => {
    if (!echartsInstanceRef.current) {
      return;
    }

    try {
      const dataUrl = echartsInstanceRef.current.getDataURL({
        type: format,
        pixelRatio: 2,
        backgroundColor: '#fff',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${payload.styling.title || 'chart'}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportMenu(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div
      className="group rounded-md border border-slate-200 bg-white shadow-lg transition-all"
      style={{ width: nodeWidth, minHeight: 400 }}
    >
      {/* Target handles on left for incoming data */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          left: -6,
          top: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          top: -6,
          left: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />

      {/* Source handles on right/bottom for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          right: -6,
          top: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          bottom: -6,
          left: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />

      <div className="px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Plot Node</span>
            <span className="text-xs font-semibold text-slate-900">{data.nodeId.slice(0, 6)}</span>
          </div>
          <div className="flex items-center gap-2">
            {status === 'no-data' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                No data
              </span>
            )}
            {status === 'config-needed' && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                Config needed
              </span>
            )}
            {((data.upstreamCsvTableName && fullCsvLoading) ||
              (data.upstreamSqlNodeId && fullSqlLoading)) && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Loading chart data…
              </span>
            )}
            {/* Export button - always visible when status is ready, regardless of selection */}
            {status === 'ready' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!echartsInstanceRef.current) {
                      // If instance is not ready yet, try to wait a bit and retry
                      setTimeout(() => {
                        if (echartsInstanceRef.current) {
                          setShowExportMenu(!showExportMenu);
                        }
                      }, 100);
                      return;
                    }
                    setShowExportMenu(!showExportMenu);
                  }}
                  disabled={!echartsInstanceRef.current}
                  className={`flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs ${
                    echartsInstanceRef.current
                      ? 'text-slate-600 hover:bg-slate-50'
                      : 'text-slate-400 cursor-not-allowed opacity-50'
                  }`}
                  title={echartsInstanceRef.current ? 'Export chart' : 'Chart is loading...'}
                >
                  <Download size={14} />
                  <CaretDown size={12} />
                </button>
                {showExportMenu && echartsInstanceRef.current && (
                  <div className="absolute right-0 top-full z-10 mt-1 rounded border border-slate-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExport('png')}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Export as PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('svg')}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Export as SVG
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
          {/* Always render ChartRenderer to maintain hook order */}
          <ChartRenderer
            key={`chart-${data.nodeId}`}
            chartType={payload.chartType}
            config={payload}
            data={status === 'ready' ? plotData : undefined}
            width={nodeWidth - 32 - 16} // Account for padding and border
            height={chartHeight}
            theme={payload.styling.theme || 'light'}
            onEChartsInstance={handleEChartsInstance}
          />
        </div>
      </div>
    </div>
  );
}

// Memoize PlotNode to avoid unnecessary re-renders
// Only re-render when node-specific props change, not when entire board state changes
export const PlotNode = memo(PlotNodeComponent, (prevProps, nextProps) => {
  // Always re-render if node ID changes (different node)
  if (prevProps.data.nodeId !== nextProps.data.nodeId) return false;

  // Re-render if selection state changes (affects visual appearance)
  if (prevProps.selected !== nextProps.selected) return false;

  // Re-render if width changes
  if (prevProps.data.width !== nextProps.data.width) return false;

  // Deep compare payload
  const prevPayload = prevProps.data.payload;
  const nextPayload = nextProps.data.payload;
  if (prevPayload !== nextPayload) {
    try {
      const areEqual = JSON.stringify(prevPayload) === JSON.stringify(nextPayload);
      if (!areEqual) return false;
    } catch {
      return false; // If comparison fails, re-render to be safe
    }
  }

  // Compare edges (only incoming edges matter for this node)
  // Create stable keys for comparison
  const prevIncomingKey = prevProps.data.edges
    .filter((e) => e.targetId === prevProps.data.nodeId)
    .map((e) => e.sourceId)
    .sort()
    .join(',');
  const nextIncomingKey = nextProps.data.edges
    .filter((e) => e.targetId === nextProps.data.nodeId)
    .map((e) => e.sourceId)
    .sort()
    .join(',');
  if (prevIncomingKey !== nextIncomingKey) return false;

  if (prevProps.data.upstreamCsvTableName !== nextProps.data.upstreamCsvTableName) return false;
  if (prevProps.data.upstreamSqlNodeId !== nextProps.data.upstreamSqlNodeId) return false;
  if (prevProps.data.notebookCellEntryId !== nextProps.data.notebookCellEntryId) return false;
  if (prevProps.data.inlineData !== nextProps.data.inlineData) return false;

  return true; // Props are equal, skip re-render
});
