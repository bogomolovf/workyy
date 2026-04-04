'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useMemo, useRef } from 'react';
import type { NodeProps } from 'reactflow';
import { usePaginatedSqlResult } from '../../hooks/usePaginatedSqlResult';
import { useExecutionStore } from '../../state/executionStore';
import { CellShell, type CellShellProps } from './CellShell';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-50 animate-pulse rounded" />,
});

export type SqlCellNodeData = {
  nodeId: string;
  /** When connected to a Database node via an edge, shows which DB the query runs against */
  upstreamConnectionName?: string;
  onRun?: () => void;
  onRunFull?: () => void;
  onCodeChange?: (code: string) => void;
  onDelete?: () => void;
  onAddCellBelow?: (type: 'pythonCell' | 'markdownCell') => void;
  cellPosition?: CellShellProps['cellPosition'];
  cellIndex?: number;
  chainName?: string;
  chainCellCount?: number;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunningAll?: boolean;
};

const DEBOUNCE_MS = 80;

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on' as const,
  lineNumbersMinChars: 3,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  folding: false,
  renderLineHighlight: 'line' as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: { vertical: 'hidden' as const, horizontal: 'hidden' as const },
  padding: { top: 4, bottom: 4 },
  automaticLayout: true,
  renderValidationDecorations: 'off' as const,
  quickSuggestions: false,
  parameterHints: { enabled: false },
  suggestOnTriggerCharacters: false,
  hover: { enabled: false },
  links: false,
  matchBrackets: 'never' as const,
  occurrencesHighlight: 'off' as const,
  selectionHighlight: false,
} as const;

function SqlCellNodeInner({ data, selected }: NodeProps<SqlCellNodeData>) {
  const status = useExecutionStore((s) => s.entries[data.nodeId]?.status ?? 'idle');
  const code = useExecutionStore((s) => s.entries[data.nodeId]?.code ?? '');
  const error = useExecutionStore((s) => s.entries[data.nodeId]?.error ?? null);
  const result = useExecutionStore((s) => {
    const e = s.entries[data.nodeId];
    return e?.output?.kind === 'sql' ? e.output.result : undefined;
  });
  const executedCode = useExecutionStore((s) => {
    const e = s.entries[data.nodeId];
    return e?.output?.kind === 'sql' ? e.output.code : undefined;
  });
  const hiddenError = useExecutionStore(
    (s) => s.entries[data.nodeId]?.hiddenOutputs?.error ?? false,
  );

  // Pagination: loads additional pages on scroll when the initial result is a preview
  const paginated = usePaginatedSqlResult(executedCode, result);

  const lineCount = Math.max(code.split('\n').length, 1);
  const editorHeight = Math.min(Math.max(lineCount * 19 + 10, 60), 400);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCodeChangeRef = useRef(data.onCodeChange);
  onCodeChangeRef.current = data.onCodeChange;

  const handleCodeChange = useCallback((val: string | undefined) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCodeChangeRef.current?.(val ?? '');
    }, DEBOUNCE_MS);
  }, []);

  const paginatedRows = paginated?.rows;
  const paginatedColumns = paginated?.columns;
  const paginatedTotalCount = paginated?.totalCount;
  const paginatedLoadedCount = paginated?.loadedCount;
  const paginatedIsFullyLoaded = paginated?.isFullyLoaded;
  const paginatedIsLoadingMore = paginated?.isLoadingMore;
  const paginatedLoadMoreRows = paginated?.loadMoreRows;

  const displayResult = useMemo(() => {
    if (paginatedRows && paginatedColumns) {
      return { columns: paginatedColumns, rows: paginatedRows };
    }
    return result;
  }, [paginatedRows, paginatedColumns, result]);

  const cellOutput = useMemo<CellShellProps['output']>(() => {
    if (!displayResult && !error) return undefined;
    return {
      table: displayResult,
      totalCount: paginatedTotalCount ?? result?.totalCount,
      isPreview: paginatedRows ? !paginatedIsFullyLoaded : result?.isPreview,
      onLoadAll: data.onRunFull,
      onLoadMore: paginatedLoadMoreRows,
      loadedCount: paginatedLoadedCount,
      isLoadingMore: paginatedIsLoadingMore,
    };
  }, [
    displayResult,
    error,
    data.onRunFull,
    result?.totalCount,
    result?.isPreview,
    paginatedTotalCount,
    paginatedRows,
    paginatedIsFullyLoaded,
    paginatedLoadMoreRows,
    paginatedLoadedCount,
    paginatedIsLoadingMore,
  ]);

  return (
    <CellShell
      nodeId={data.nodeId}
      selected={selected}
      language="sql"
      status={status}
      executionCount={data.cellIndex}
      error={!hiddenError ? error : null}
      cellPosition={data.cellPosition ?? 'standalone'}
      onRun={data.onRun}
      onDelete={data.onDelete}
      onAddCellBelow={data.onAddCellBelow}
      isRunning={status === 'running'}
      chainName={data.chainName}
      chainCellCount={data.chainCellCount}
      onRunAll={data.onRunAll}
      onStopAll={data.onStopAll}
      isRunningAll={data.isRunningAll}
      output={cellOutput}
    >
      {data.upstreamConnectionName && (
        <div className="flex items-center gap-1 px-3 py-1 text-[11px] text-emerald-600 bg-emerald-50 border-b border-emerald-100">
          <span className="font-medium">→ {data.upstreamConnectionName}</span>
        </div>
      )}
      <div style={{ height: editorHeight }}>
        <MonacoEditor
          language="sql"
          value={code}
          onChange={handleCodeChange}
          theme="light"
          options={MONACO_OPTIONS}
        />
      </div>
    </CellShell>
  );
}

export const SqlCellNode = memo(SqlCellNodeInner);
