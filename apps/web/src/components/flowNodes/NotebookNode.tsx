'use client';

import {
  Play,
  Stop,
  Plus,
  Trash,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  SpinnerGap,
  Code,
  TextAa,
  Database,
  Notebook,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position, NodeResizer, useUpdateNodeInternals } from 'reactflow';
import type {
  CellExecutionResult,
  CellExecutionStatus,
  UpstreamData,
} from '../../lib/notebookExecutor';
import { executeNotebookCells, executeSingleCell } from '../../lib/notebookExecutor';
import type {
  NotebookCell,
  NotebookCellOutput,
  NotebookCellType,
  ParsedNotebook,
} from '../../lib/notebookParser';
import { extractPlainText, getCodeCells, createEmptyCell } from '../../lib/notebookParser';
import { useExecutionStore } from '../../state/executionStore';
import { InteractiveResultTable } from '../InteractiveResultTable';
import PlotlyPreview from './PlotlyPreview';

/** Convert CellExecutionResult to NotebookCellOutput[] for persistence */
function cellResultToOutputs(result: CellExecutionResult): NotebookCellOutput[] {
  const outputs: NotebookCellOutput[] = [];
  if (result.stdout) {
    outputs.push({ outputType: 'stream', text: result.stdout });
  }
  if (result.error) {
    outputs.push({
      outputType: 'error',
      ename: 'ExecutionError',
      evalue: result.error,
      traceback: [result.error],
    });
  }
  if (result.tableData) {
    outputs.push({ outputType: 'execute_result', data: { 'application/json': result.tableData } });
  }
  if (result.plotJson) {
    outputs.push({ outputType: 'display_data', data: { 'application/json': result.plotJson } });
  }
  if (outputs.length === 0 && result.status === 'success') {
    outputs.push({ outputType: 'execute_result', text: '' });
  }
  return outputs;
}

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-50 animate-pulse rounded" />,
});

export type NotebookNodeData = {
  nodeId: string;
  notebook: ParsedNotebook;
  onNotebookChange?: (notebook: ParsedNotebook) => void;
  upstreamNodeId?: string;
  /** CSV/Excel data passed directly from connected source node payload (global) */
  csvUpstreamData?: { columns: string[]; rows: Array<Array<string | number | null>> };
  /** Filename of the global upstream CSV (e.g. "NetflixShows.xlsx") — used to create a named variable */
  csvUpstreamFilename?: string;
  /** Per-cell CSV data: cellId -> data + filename (when CSV is connected to a specific cell handle) */
  cellDataMap?: Record<
    string,
    {
      columns: string[];
      rows: Array<Array<string | number | null>>;
      filename?: string;
      tableName?: string;
    }
  >;
};

type CellResultMap = Map<string, CellExecutionResult>;

const MAX_OUTPUT_LINES = 40;

function truncateText(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}

function CellStatusIcon({ status }: { status: CellExecutionStatus }) {
  switch (status) {
    case 'running':
      return <SpinnerGap size={14} className="animate-spin text-orange-500" />;
    case 'success':
      return <CheckCircle size={14} weight="fill" className="text-green-500" />;
    case 'error':
      return <XCircle size={14} weight="fill" className="text-red-500" />;
    case 'queued':
      return <SpinnerGap size={14} className="text-gray-400" />;
    default:
      return null;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ExecutionResultView({ result }: { result: CellExecutionResult }) {
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const hasParts = result.stdout.trim() || result.error || result.tableData || result.plotJson;
  if (!hasParts) return null;

  return (
    <div className="border-t border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setIsOutputCollapsed((p) => !p)}
        className="w-full flex items-center justify-center gap-1 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {isOutputCollapsed ? (
          <>
            <CaretRight size={10} /> Show output
          </>
        ) : (
          <>
            <CaretDown size={10} /> Hide output
          </>
        )}
      </button>
      {!isOutputCollapsed && (
        <>
          {result.stdout.trim() && (
            <pre className="px-4 py-2 text-[12px] text-gray-700 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
              {truncateText(result.stdout, MAX_OUTPUT_LINES)}
            </pre>
          )}
          {result.error && (
            <pre className="px-4 py-2 text-[12px] text-red-600 font-mono whitespace-pre-wrap bg-red-50 max-h-32 overflow-auto">
              {result.error}
            </pre>
          )}
          {result.tableData && result.tableData.rows.length > 0 && (
            <div className="max-h-64 overflow-auto border-t border-gray-100">
              <InteractiveResultTable result={result.tableData} compact />
            </div>
          )}
          {result.plotJson && (
            <div className="border-t border-gray-100 overflow-hidden">
              <PlotlyPreview plotJson={result.plotJson} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OriginalOutputView({ originalOutputs }: { originalOutputs: NotebookCellOutput[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const textParts = originalOutputs.map(extractPlainText).filter(Boolean);
  // Extract table data from persisted outputs
  const tableData = useMemo(() => {
    for (const out of originalOutputs) {
      const json = out.data?.['application/json'] as any;
      if (json && json.columns && json.rows)
        return json as { columns: string[]; rows: Array<Array<string | number | null>> };
    }
    return null;
  }, [originalOutputs]);
  const errorOutput = originalOutputs.find((o) => o.outputType === 'error');
  const hasContent = textParts.length > 0 || tableData || errorOutput;
  if (!hasContent) return null;
  const text = textParts.join('\n');

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-center gap-1 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {collapsed ? (
          <>
            <CaretRight size={10} /> Show output
          </>
        ) : (
          <>
            <CaretDown size={10} /> Hide output
          </>
        )}
      </button>
      {!collapsed && (
        <>
          {text && (
            <pre className="px-4 py-2 text-[12px] text-gray-500 font-mono whitespace-pre-wrap max-h-48 overflow-auto">
              {truncateText(text, MAX_OUTPUT_LINES)}
            </pre>
          )}
          {errorOutput && (
            <pre className="px-4 py-2 text-[12px] text-red-600 font-mono whitespace-pre-wrap bg-red-50 max-h-32 overflow-auto">
              {errorOutput.ename}: {errorOutput.evalue}
            </pre>
          )}
          {tableData && tableData.rows.length > 0 && (
            <div className="max-h-64 overflow-auto border-t border-gray-100">
              <InteractiveResultTable result={tableData} compact />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CellOutputView({
  result,
  originalOutputs,
}: {
  result?: CellExecutionResult;
  originalOutputs?: NotebookCellOutput[];
}) {
  if (result) {
    return <ExecutionResultView result={result} />;
  }
  if (originalOutputs && originalOutputs.length > 0) {
    return <OriginalOutputView originalOutputs={originalOutputs} />;
  }
  return null;
}

function CodeCellView({
  cell,
  cellIndex,
  result,
  onRunCell,
  onDeleteCell,
  onSourceChange,
  onToggleCellType,
  isRunning,
  connectedData,
}: {
  cell: NotebookCell;
  cellIndex: number;
  result?: CellExecutionResult;
  onRunCell: () => void;
  onDeleteCell: () => void;
  onSourceChange: (source: string) => void;
  onToggleCellType: () => void;
  isRunning: boolean;
  connectedData?: { columns: string[]; rows: Array<Array<string | number | null>> };
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const status = result?.status ?? 'idle';
  const execCount = result?.executionCount ?? cell.executionCount;

  const lineCount = Math.max(cell.source.split('\n').length, 1);
  const editorHeight = Math.min(Math.max(lineCount * 19 + 10, 40), 300);

  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
      {/* Cell toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setIsExpanded((p) => !p)}
          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
        >
          {isExpanded ? (
            <CaretDown size={12} className="text-gray-500" />
          ) : (
            <CaretRight size={12} className="text-gray-500" />
          )}
        </button>
        <span className="text-[11px] text-gray-400 font-mono w-10 text-right shrink-0">
          [{execCount ?? ' '}]
        </span>
        <button
          type="button"
          onClick={onToggleCellType}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="Toggle cell type"
        >
          <Code size={12} />
          Code
        </button>
        {connectedData && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-green-600 bg-green-50 border border-green-200">
            <Database size={9} />
            {connectedData.columns.length} cols · {connectedData.rows.length} rows
          </span>
        )}
        <div className="flex-1" />
        <CellStatusIcon status={status} />
        {result?.durationMs !== undefined && (
          <span className="text-[10px] text-gray-400">{formatDuration(result.durationMs)}</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRunCell();
          }}
          disabled={isRunning}
          className="p-1 hover:bg-green-100 rounded transition-colors disabled:opacity-30"
          title="Run cell (Shift+Enter)"
        >
          <Play size={14} weight="fill" className="text-green-600" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCell();
          }}
          className="p-1 hover:bg-red-100 rounded transition-colors"
          title="Delete cell"
        >
          <Trash size={13} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>

      {/* Editor area — nodrag prevents accidental node dragging;
           handleMouseWheel always false so wheel/trackpad gestures
           pass through to ReactFlow for board pan/zoom even while editing */}
      {isExpanded && (
        <div className="nodrag" style={{ height: editorHeight }}>
          <MonacoEditor
            language="python"
            value={cell.source}
            onChange={(val) => onSourceChange(val ?? '')}
            theme="light"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              folding: false,
              renderLineHighlight: 'line',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
                handleMouseWheel: false,
              },
              padding: { top: 4, bottom: 4 },
              automaticLayout: true,
            }}
          />
        </div>
      )}

      <CellOutputView result={result} originalOutputs={cell.outputs} />
    </div>
  );
}

function MarkdownCellView({
  cell,
  cellIndex,
  onDeleteCell,
  onSourceChange,
  onToggleCellType,
}: {
  cell: NotebookCell;
  cellIndex: number;
  onDeleteCell: () => void;
  onSourceChange: (source: string) => void;
  onToggleCellType: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const lineCount = Math.max(cell.source.split('\n').length, 1);
  const editorHeight = Math.min(Math.max(lineCount * 19 + 10, 40), 200);

  return (
    <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1 bg-blue-50/50 border-b border-gray-200">
        <button
          type="button"
          onClick={onToggleCellType}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-purple-600 hover:bg-purple-50 rounded transition-colors"
          title="Toggle cell type"
        >
          <TextAa size={12} />
          Markdown
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setIsEditing((p) => !p)}
          className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded transition-colors"
        >
          {isEditing ? 'Preview' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCell();
          }}
          className="p-1 hover:bg-red-100 rounded transition-colors"
          title="Delete cell"
        >
          <Trash size={13} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>

      {isEditing ? (
        <div className="nowheel nodrag" style={{ height: editorHeight }}>
          <MonacoEditor
            language="markdown"
            value={cell.source}
            onChange={(val) => onSourceChange(val ?? '')}
            theme="light"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              folding: false,
              overviewRulerLanes: 0,
              scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
              padding: { top: 4, bottom: 4 },
              automaticLayout: true,
            }}
          />
        </div>
      ) : (
        <div
          className="px-4 py-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap cursor-text min-h-[32px]"
          onClick={() => setIsEditing(true)}
        >
          {cell.source || '(empty markdown cell — click to edit)'}
        </div>
      )}
    </div>
  );
}

function AddCellButton({ onAdd }: { onAdd: (type: NotebookCellType) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="flex items-center justify-center py-1 group relative">
      <div className="flex-1 h-px bg-gray-200 group-hover:bg-blue-300 transition-colors" />
      <button
        type="button"
        onClick={() => setShowMenu((p) => !p)}
        className="mx-2 p-0.5 rounded-full border border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        title="Add cell"
      >
        <Plus size={14} />
      </button>
      <div className="flex-1 h-px bg-gray-200 group-hover:bg-blue-300 transition-colors" />

      {showMenu && (
        <div className="absolute top-full z-50 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 mt-0.5">
          <button
            type="button"
            onClick={() => {
              onAdd('code');
              setShowMenu(false);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-blue-50 rounded transition-colors"
          >
            <Code size={14} className="text-blue-500" />
            Code
          </button>
          <button
            type="button"
            onClick={() => {
              onAdd('markdown');
              setShowMenu(false);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-purple-50 rounded transition-colors"
          >
            <TextAa size={14} className="text-purple-500" />
            Markdown
          </button>
        </div>
      )}
    </div>
  );
}

function NotebookNodeInner({ data, selected, id }: NodeProps<NotebookNodeData>) {
  const {
    notebook,
    onNotebookChange,
    upstreamNodeId,
    csvUpstreamData,
    csvUpstreamFilename,
    cellDataMap,
  } = data;
  const updateNodeInternals = useUpdateNodeInternals();

  // Force ReactFlow to re-measure node dimensions whenever content changes
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      updateNodeInternals(id);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, updateNodeInternals]);

  const upstreamEntry = useExecutionStore((s) =>
    upstreamNodeId ? s.entries[upstreamNodeId] : undefined,
  );
  const upstreamData: UpstreamData = useMemo(() => {
    // CSV/Excel data from connected node payload (highest priority)
    if (csvUpstreamData?.columns && csvUpstreamData?.rows) {
      return {
        columns: csvUpstreamData.columns,
        rows: csvUpstreamData.rows,
      };
    }
    if (!upstreamEntry?.output) return null;
    if (upstreamEntry.output.kind === 'sql') {
      return {
        columns: upstreamEntry.output.result.columns,
        rows: upstreamEntry.output.result.rows,
      };
    }
    if (upstreamEntry.output.kind === 'python' && upstreamEntry.output.result.table) {
      return {
        columns: upstreamEntry.output.result.table.columns,
        rows: upstreamEntry.output.result.table.rows,
      };
    }
    return null;
  }, [upstreamEntry, csvUpstreamData]);

  const codeCells = useMemo(() => getCodeCells(notebook), [notebook]);
  const [cellResults, setCellResults] = useState<CellResultMap>(new Map());
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [currentCellId, setCurrentCellId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const totalCodeCells = codeCells.length;
  const completedCells = useMemo(
    () => Array.from(cellResults.values()).filter((r) => r.status === 'success').length,
    [cellResults],
  );
  const errorCells = useMemo(
    () => Array.from(cellResults.values()).filter((r) => r.status === 'error').length,
    [cellResults],
  );

  // Use ref to always have the latest notebook state — avoids stale-closure
  // issues during sequential cell execution in handleRunAll where React
  // batches state updates and the captured `notebook` value may be outdated.
  const notebookRef = useRef(notebook);
  notebookRef.current = notebook;

  const updateNotebook = useCallback(
    (updater: (nb: ParsedNotebook) => ParsedNotebook) => {
      if (!onNotebookChange) return;
      const latest = updater(notebookRef.current);
      notebookRef.current = latest;
      onNotebookChange(latest);
    },
    [onNotebookChange],
  );

  const handleCellSourceChange = useCallback(
    (cellId: string, source: string) => {
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((c) => (c.id === cellId ? { ...c, source } : c)),
      }));
    },
    [updateNotebook],
  );

  const handleAddCell = useCallback(
    (afterIndex: number, cellType: NotebookCellType) => {
      updateNotebook((nb) => {
        const newCell = createEmptyCell(cellType);
        const next = [...nb.cells];
        next.splice(afterIndex + 1, 0, newCell);
        return { ...nb, cells: next };
      });
    },
    [updateNotebook],
  );

  const handleDeleteCell = useCallback(
    (cellId: string) => {
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.filter((c) => c.id !== cellId),
      }));
    },
    [updateNotebook],
  );

  const handleToggleCellType = useCallback(
    (cellId: string) => {
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((c) =>
          c.id === cellId
            ? {
                ...c,
                cellType: c.cellType === 'code' ? 'markdown' : ('code' as NotebookCellType),
                outputs: [],
              }
            : c,
        ),
      }));
    },
    [updateNotebook],
  );

  const handleRunAll = useCallback(async () => {
    if (isRunningAll) return;
    setIsRunningAll(true);
    setCellResults(new Map());
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await executeNotebookCells(
        codeCells,
        ({ cellId, status, result }) => {
          setCurrentCellId(cellId);
          if (result) {
            setCellResults((prev) => {
              const next = new Map(prev);
              next.set(cellId, result);
              return next;
            });
            // Sync to executionStore for PlotNode
            const cellEntryId = `${data.nodeId}__${cellId}`;
            const store = useExecutionStore.getState();
            if (!store.entries[cellEntryId]) {
              store.registerNode({ id: cellEntryId, type: 'python' });
            }
            store.setSuccess(cellEntryId, {
              kind: 'python',
              result: {
                stdout: result.stdout,
                stderr: '',
                table: result.tableData ?? null,
                plotJson: result.plotJson ?? null,
              },
              code: '',
            });

            // Persist cell output to notebook payload (survives page refresh)
            updateNotebook((nb) => ({
              ...nb,
              cells: nb.cells.map((c) =>
                c.id === cellId
                  ? {
                      ...c,
                      outputs: cellResultToOutputs(result),
                      executionCount: result.executionCount,
                    }
                  : c,
              ),
            }));
          }
        },
        upstreamData,
        controller.signal,
        cellDataMap,
        csvUpstreamFilename,
      );
    } finally {
      setIsRunningAll(false);
      setCurrentCellId(null);
      abortRef.current = null;
    }
  }, [
    isRunningAll,
    codeCells,
    upstreamData,
    cellDataMap,
    csvUpstreamFilename,
    updateNotebook,
    data.nodeId,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRunSingleCell = useCallback(
    async (cell: NotebookCell) => {
      if (isRunningAll) return;
      setCurrentCellId(cell.id);
      const existing = cellResults.get(cell.id);
      const execCount = existing ? existing.executionCount + 1 : 1;
      // Use per-cell data if available, otherwise fall back to global upstream
      const cellData = cellDataMap?.[cell.id];
      const effectiveUpstream: UpstreamData = cellData
        ? { columns: cellData.columns, rows: cellData.rows }
        : upstreamData;
      // Derive variable name from filename (e.g. "aboba.csv" → "aboba")
      // Fall back to global upstream filename when no per-cell data
      const dataVarName = cellData?.filename
        ? cellData.filename.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
        : csvUpstreamFilename
          ? csvUpstreamFilename.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
          : undefined;
      const result = await executeSingleCell(cell, execCount, effectiveUpstream, dataVarName);
      setCellResults((prev) => {
        const next = new Map(prev);
        next.set(cell.id, result);
        return next;
      });
      // Always sync cell result to executionStore so PlotNode can access it
      const cellEntryId = `${data.nodeId}__${cell.id}`;
      const store = useExecutionStore.getState();
      if (!store.entries[cellEntryId]) {
        store.registerNode({ id: cellEntryId, type: 'python' });
      }
      store.setSuccess(cellEntryId, {
        kind: 'python',
        result: {
          stdout: result.stdout,
          stderr: '',
          table: result.tableData ?? null,
          plotJson: result.plotJson ?? null,
        },
        code: cell.source,
      });

      // Persist cell output to notebook payload (survives page refresh)
      updateNotebook((nb) => ({
        ...nb,
        cells: nb.cells.map((c) =>
          c.id === cell.id
            ? { ...c, outputs: cellResultToOutputs(result), executionCount: result.executionCount }
            : c,
        ),
      }));

      setCurrentCellId(null);
    },
    [
      isRunningAll,
      cellResults,
      upstreamData,
      cellDataMap,
      csvUpstreamFilename,
      updateNotebook,
      data.nodeId,
    ],
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col rounded-xl border border-gray-300 bg-white shadow-sm overflow-visible"
      style={{ width: '100%', minWidth: 420 }}
    >
      {/* Only horizontal resize — vertical auto-sizes from content */}
      <NodeResizer
        isVisible={selected}
        minWidth={420}
        minHeight={100}
        lineStyle={{ borderColor: '#3b82f6', borderWidth: 1 }}
        handleStyle={{ backgroundColor: '#3b82f6', width: 8, height: 8, borderRadius: 4 }}
        shouldResize={(_event, params) => {
          // Block vertical-only resize (top/bottom handles)
          if (params.direction[0] === 0) return false;
          return true;
        }}
      />

      {/* Target handles — always connectable so CSV/data nodes can connect */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-blue-500 !w-3 !h-3"
        style={{ left: -6, top: '50%' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-blue-500 !w-3 !h-3"
        style={{
          top: -6,
          left: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />
      {/* Source handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-blue-500 !w-3 !h-3"
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
        className="!bg-blue-500 !w-3 !h-3"
        style={{
          bottom: -6,
          left: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />

      {/* Header — drag handle for moving the notebook on canvas */}
      <div className="drag-handle flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shrink-0 rounded-t-xl cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 min-w-0">
          <Notebook size={20} weight="duotone" className="text-orange-500 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 truncate">{notebook.name}</h3>
            <span className="text-[10px] text-gray-400">
              {totalCodeCells} code
              {notebook.cells.length > totalCodeCells
                ? ` · ${notebook.cells.length - totalCodeCells} md`
                : ''}
            </span>
          </div>
          {upstreamData && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-green-600 bg-green-50 border border-green-200">
              <Database size={10} />
              {upstreamData.columns.length} cols · {upstreamData.rows.length} rows
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isRunningAll && (
            <span className="text-[10px] text-orange-600 font-medium mr-1">
              {completedCells}/{totalCodeCells}
            </span>
          )}
          {!isRunningAll && completedCells > 0 && (
            <span className="text-[10px] text-green-600 mr-1">
              {completedCells}/{totalCodeCells}
              {errorCells > 0 && <span className="text-red-500"> · {errorCells} err</span>}
            </span>
          )}
          {isRunningAll ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
            >
              <Stop size={12} weight="fill" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunAll}
              className="flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Play size={12} weight="fill" />
              Run All
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((p) => !p)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isCollapsed ? (
              <CaretRight size={14} className="text-gray-500" />
            ) : (
              <CaretDown size={14} className="text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {isRunningAll && (
        <div className="h-1 bg-gray-100 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-green-400 transition-all duration-300"
            style={{
              width: `${((completedCells + errorCells * 0.5) / Math.max(totalCodeCells, 1)) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Cells */}
      {!isCollapsed && (
        <div className="px-3 py-2 space-y-0 bg-gray-50/50 overflow-visible rounded-b-xl">
          <AddCellButton onAdd={(type) => handleAddCell(-1, type)} />

          {notebook.cells.map((cell, idx) => (
            <div key={cell.id} className="relative">
              {/* Per-cell target handle on the left (for data input) */}
              <Handle
                type="target"
                position={Position.Left}
                id={`cell-${cell.id}`}
                className="!bg-orange-400 !w-2.5 !h-2.5 !border-2 !border-white"
                style={{ left: -18, top: '50%', position: 'absolute' }}
              />
              {/* Per-cell source handle on the right (for plot output) */}
              {cell.cellType === 'code' && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`cell-out-${cell.id}`}
                  className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-white"
                  style={{ right: -18, top: '50%', position: 'absolute' }}
                />
              )}
              {cell.cellType === 'code' ? (
                <CodeCellView
                  cell={cell}
                  cellIndex={idx}
                  result={cellResults.get(cell.id)}
                  onRunCell={() => handleRunSingleCell(cell)}
                  onDeleteCell={() => handleDeleteCell(cell.id)}
                  onSourceChange={(src) => handleCellSourceChange(cell.id, src)}
                  onToggleCellType={() => handleToggleCellType(cell.id)}
                  isRunning={isRunningAll || currentCellId === cell.id}
                  connectedData={cellDataMap?.[cell.id]}
                />
              ) : (
                <MarkdownCellView
                  cell={cell}
                  cellIndex={idx}
                  onDeleteCell={() => handleDeleteCell(cell.id)}
                  onSourceChange={(src) => handleCellSourceChange(cell.id, src)}
                  onToggleCellType={() => handleToggleCellType(cell.id)}
                />
              )}

              <AddCellButton onAdd={(type) => handleAddCell(idx, type)} />
            </div>
          ))}
        </div>
      )}

      {/* Collapsed footer */}
      {isCollapsed && (
        <div className="px-3 py-2 text-[11px] text-gray-400 text-center bg-gray-50 shrink-0">
          {notebook.cells.length} cells — click to expand
        </div>
      )}
    </div>
  );
}

export const NotebookNode = memo(NotebookNodeInner);
