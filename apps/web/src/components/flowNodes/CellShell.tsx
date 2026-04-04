'use client';

import {
  Play,
  Plus,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  SpinnerGap,
  Trash,
  Code,
  TextAa,
  Notebook,
  Stop,
} from '@phosphor-icons/react';
import { memo, useCallback, useState, type ReactNode } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import type { NodeStatus } from '../../state/executionStore';
import type { SqlResult, PythonResult } from '../../state/executionStore';
import { InteractiveResultTable } from '../InteractiveResultTable';
import PlotlyPreview from './PlotlyPreview';

type CellPosition = 'standalone' | 'first' | 'middle' | 'last' | 'only';

export type CellShellProps = {
  nodeId: string;
  selected?: boolean;
  language: 'python' | 'sql' | 'markdown';
  status: NodeStatus;
  executionCount?: number | null;
  durationMs?: number;
  error?: string | null;
  cellPosition?: CellPosition;
  onRun?: () => void;
  onDelete?: () => void;
  onAddCellBelow?: (type: 'pythonCell' | 'markdownCell') => void;
  isRunning?: boolean;
  children: ReactNode;
  /** Notebook header info — shown above the first cell in a chain */
  chainName?: string;
  chainCellCount?: number;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunningAll?: boolean;
  output?: {
    stdout?: string;
    stderr?: string;
    table?: SqlResult | null;
    plotJson?: string | null;
    totalCount?: number;
    isPreview?: boolean;
    onLoadAll?: () => void;
    onLoadMore?: () => void;
    loadedCount?: number;
    isLoadingMore?: boolean;
  };
};

const LANGUAGE_CONFIG = {
  python: {
    label: 'Python',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    hoverBg: 'hover:bg-blue-50',
  },
  sql: {
    label: 'SQL',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    hoverBg: 'hover:bg-emerald-50',
  },
  markdown: {
    label: 'Markdown',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    hoverBg: 'hover:bg-purple-50',
  },
} as const;

function CellStatusIcon({ status }: { status: NodeStatus }) {
  switch (status) {
    case 'running':
      return <SpinnerGap size={14} className="animate-spin text-orange-500" />;
    case 'success':
      return <CheckCircle size={14} weight="fill" className="text-green-500" />;
    case 'error':
      return <XCircle size={14} weight="fill" className="text-red-500" />;
    default:
      return null;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getCellClasses(position: CellPosition, hasHeader: boolean) {
  switch (position) {
    case 'first':
      return hasHeader ? 'rounded-none border-b-0' : 'rounded-t-xl rounded-b-none border-b-0';
    case 'middle':
      return 'rounded-none border-b-0';
    case 'last':
      return 'rounded-b-xl rounded-t-none';
    case 'only':
      return hasHeader ? 'rounded-b-xl rounded-t-none' : 'rounded-xl';
    case 'standalone':
    default:
      return hasHeader ? 'rounded-b-xl rounded-t-none' : 'rounded-xl';
  }
}

/** Notebook header shown above the first cell in a chain */
function NotebookHeader({
  name,
  cellCount,
  onRunAll,
  onStopAll,
  isRunning,
}: {
  name: string;
  cellCount: number;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunning?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 rounded-t-xl border border-b-0 border-gray-200 shrink-0"
      style={{ background: 'rgba(255,255,255,0.95)', width: '100%' }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Notebook size={14} weight="duotone" className="text-orange-400 shrink-0" />
        <span className="text-xs font-medium text-gray-600 truncate">{name}</span>
        <span className="text-[10px] text-gray-400">({cellCount})</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isRunning ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStopAll?.();
            }}
            className="flex items-center gap-0.5 rounded bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-600 transition-colors"
          >
            <Stop size={10} weight="fill" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRunAll?.();
            }}
            className="flex items-center gap-0.5 rounded bg-green-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-600 transition-colors"
          >
            <Play size={10} weight="fill" />
            Run All
          </button>
        )}
      </div>
    </div>
  );
}

const MAX_OUTPUT_LINES = 40;

function truncateText(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}

function CellOutputArea({ output }: { output: NonNullable<CellShellProps['output']> }) {
  const hasStdout = output.stdout && output.stdout.trim().length > 0;
  const hasStderr = output.stderr && output.stderr.trim().length > 0;
  const hasTable = output.table && output.table.rows.length > 0;
  const hasPlot = Boolean(output.plotJson);
  if (!hasStdout && !hasStderr && !hasTable && !hasPlot) return null;

  return (
    <div className="border-t border-gray-200 bg-white">
      {hasStdout && (
        <pre className="px-4 py-2 text-[12px] text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
          {truncateText(output.stdout!, MAX_OUTPUT_LINES)}
        </pre>
      )}
      {hasStderr && (
        <pre className="px-4 py-2 text-[12px] text-red-600 font-mono whitespace-pre-wrap bg-red-50">
          {truncateText(output.stderr!, MAX_OUTPUT_LINES)}
        </pre>
      )}
      {hasTable && output.table && (
        <div className="nowheel nodrag max-h-64 overflow-auto border-t border-gray-100">
          <InteractiveResultTable
            result={output.table}
            compact
            totalCount={output.totalCount}
            isPreview={output.isPreview}
            onLoadAll={output.onLoadAll}
            onLoadMore={output.onLoadMore}
            loadedCount={output.loadedCount}
            isLoadingMore={output.isLoadingMore}
          />
        </div>
      )}
      {hasPlot && output.plotJson && (
        <div className="border-t border-gray-100 overflow-hidden">
          <PlotlyPreview plotJson={output.plotJson} />
        </div>
      )}
    </div>
  );
}

/**
 * "+" button between cells.
 * For middle cells: absolutely positioned overlay (no layout impact → no gaps between cells).
 * For last/only cells: in normal flow so it's always visible below the notebook.
 */
function AddCellBelowButton({
  onAdd,
  visible,
  isLast,
}: {
  onAdd: (type: 'pythonCell' | 'markdownCell') => void;
  visible: boolean;
  isLast: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const content = (
    <>
      <div className="flex-1 h-px bg-blue-200 transition-colors" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((p) => !p);
        }}
        className="mx-1 p-0.5 rounded-full border border-blue-300 text-blue-400 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
        title="Add cell below"
      >
        <Plus size={14} />
      </button>
      <div className="flex-1 h-px bg-blue-200 transition-colors" />
      {showMenu && (
        <div className="absolute top-full z-50 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 mt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd('pythonCell');
              setShowMenu(false);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-blue-50 rounded transition-colors"
          >
            <Code size={14} className="text-blue-500" />
            Python
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd('markdownCell');
              setShowMenu(false);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-purple-50 rounded transition-colors"
          >
            <TextAa size={14} className="text-purple-500" />
            Markdown
          </button>
        </div>
      )}
    </>
  );

  // Last cell: normal flow, always visible
  if (isLast) {
    return (
      <div
        className="flex items-center justify-center py-1 relative nodrag nowheel"
        style={{ width: '100%' }}
      >
        {content}
      </div>
    );
  }

  // Middle cells: absolutely positioned overlay, no layout impact
  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center nodrag nowheel transition-opacity z-10"
      style={{
        bottom: -12,
        height: 24,
        opacity: visible || showMenu ? 1 : 0,
        pointerEvents: visible || showMenu ? 'auto' : 'none',
      }}
    >
      {content}
    </div>
  );
}

function CellShellInner({
  nodeId,
  selected,
  language,
  status,
  executionCount,
  durationMs,
  error,
  cellPosition = 'standalone',
  onRun,
  onDelete,
  onAddCellBelow,
  isRunning,
  children,
  chainName,
  chainCellCount,
  onRunAll,
  onStopAll,
  isRunningAll,
  output,
}: CellShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const lang = LANGUAGE_CONFIG[language];
  const showHeader =
    !!chainName &&
    (cellPosition === 'first' || cellPosition === 'only' || cellPosition === 'standalone');
  const cellClasses = getCellClasses(cellPosition, showHeader);
  const isConnected = cellPosition !== 'standalone';
  const isLastInChain =
    cellPosition === 'last' || cellPosition === 'only' || cellPosition === 'standalone';

  const statusBorder =
    status === 'running'
      ? 'border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
      : status === 'success'
        ? 'border-emerald-300'
        : status === 'error'
          ? 'border-rose-300'
          : 'border-gray-200';

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Notebook header — above the first cell */}
      {showHeader && (
        <NotebookHeader
          name={chainName!}
          cellCount={chainCellCount ?? 1}
          onRunAll={onRunAll}
          onStopAll={onStopAll}
          isRunning={isRunningAll}
        />
      )}
      <div
        className={`flex flex-col bg-white overflow-hidden transition-colors ${cellClasses} border ${statusBorder} ${isConnected || showHeader ? '' : 'shadow-sm'}`}
        style={{ width: '100%', minHeight: 60 }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={360}
          minHeight={100}
          lineStyle={{ borderColor: '#3b82f6', borderWidth: 1 }}
          handleStyle={{ backgroundColor: '#3b82f6', width: 8, height: 8, borderRadius: 4 }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!bg-blue-500 !w-3 !h-3"
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
          className="!bg-blue-500 !w-3 !h-3"
          style={{
            top: -6,
            left: '50%',
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'auto' : 'none',
          }}
        />
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

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed((p) => !p)}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
          >
            {isCollapsed ? (
              <CaretRight size={12} className="text-gray-500" />
            ) : (
              <CaretDown size={12} className="text-gray-500" />
            )}
          </button>

          <span className="text-[11px] text-gray-400 font-mono w-10 text-right shrink-0">
            [{executionCount ?? ' '}]
          </span>

          <span
            className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] ${lang.color} ${lang.bg} rounded font-medium`}
          >
            {lang.label}
          </span>

          <div className="flex-1" />

          <CellStatusIcon status={status} />
          {durationMs !== undefined && (
            <span className="text-[10px] text-gray-400">{formatDuration(durationMs)}</span>
          )}

          {onRun && language !== 'markdown' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
              disabled={isRunning}
              className="p-1 hover:bg-green-100 rounded transition-colors disabled:opacity-30"
              title="Run cell (Shift+Enter)"
            >
              <Play size={14} weight="fill" className="text-green-600" />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Delete cell"
            >
              <Trash size={13} className="text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>

        {/* Editor area */}
        {!isCollapsed && <div className="nowheel nodrag">{children}</div>}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-[12px] text-red-600 font-mono whitespace-pre-wrap bg-red-50 border-t border-red-200">
            {error}
          </div>
        )}

        {/* Output */}
        {output && <CellOutputArea output={output} />}
      </div>

      {/* "+" button: absolute overlay on middle cells (no gap), in-flow on last cell */}
      {onAddCellBelow && (
        <AddCellBelowButton onAdd={onAddCellBelow} visible={isHovered} isLast={isLastInChain} />
      )}
    </div>
  );
}

export const CellShell = memo(CellShellInner);
