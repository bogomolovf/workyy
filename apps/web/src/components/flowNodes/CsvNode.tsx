'use client';

import { FileArrowDown, Table, SpinnerGap, ArrowDown } from '@phosphor-icons/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { queryTablePaginated, normalizeColumnName } from '../../lib/duckdbClient';
import type { SqlResult } from '../../state/executionStore';
import { useExecutionStore } from '../../state/executionStore';
import { DATA_NODE_HANDLE_CLASS } from '../BoardCanvas';
import { InteractiveResultTable } from '../InteractiveResultTable';

// Number of rows to load per batch
const ROWS_PER_BATCH = 100;

export type CsvNodePayload = {
  filename?: string;
  tableName?: string; // DuckDB table name for SQL queries
  data?: SqlResult;
  totalRowCount?: number; // Total rows in DuckDB (for lazy loading)
  originalColumns?: string[]; // Original column names before normalization
  uploadedAt?: string;
  fileType?: 'csv' | 'excel';
};

type CsvNodeData = {
  nodeId: string;
  payload?: CsvNodePayload;
  width: number;
  onResize?: (nodeId: string, width: number, height: number) => void;
};

function CsvNodeComponent({ data, selected }: NodeProps<CsvNodeData>) {
  const {
    filename,
    tableName,
    data: initialData,
    totalRowCount,
    uploadedAt,
    fileType,
  } = data.payload || {};
  const nodeWidth = data.width || 500;

  // Get executionStore methods to sync data for PlotNode access
  const registerNode = useExecutionStore((state) => state.registerNode);
  const setSuccess = useExecutionStore((state) => state.setSuccess);
  const entryExists = useExecutionStore((state) => !!state.entries[data.nodeId]);

  // Ensure CSV node is registered in executionStore on mount (for PlotNode to find data)
  useEffect(() => {
    if (!entryExists && (initialData?.columns?.length ?? 0) > 0) {
      registerNode({
        id: data.nodeId,
        type: 'csv',
        payload: data.payload as Record<string, unknown>,
      });
    }
  }, [data.nodeId, data.payload, entryExists, initialData?.columns?.length, registerNode]);

  // When tableName is set the DuckDB table uses normalizeColumnName on every column.
  // Normalise columns from the payload so that storeData always uses the same names
  // as queryTablePaginated / queryTableFullForPlot return from DuckDB.
  const normalizeColumnsIfNeeded = useCallback(
    (cols: string[]) => (tableName ? cols.map(normalizeColumnName) : cols),
    [tableName],
  );

  // State for lazy-loaded data; columns can come from initial payload or from first DuckDB fetch
  const [loadedRows, setLoadedRows] = useState<Array<Array<string | number | null>>>(
    initialData?.rows || [],
  );
  const [columns, setColumns] = useState<string[]>(
    normalizeColumnsIfNeeded(initialData?.columns || []),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Sync columns from payload when they appear (e.g. after Yjs sync)
  useEffect(() => {
    if (initialData?.columns?.length && columns.length === 0) {
      setColumns(normalizeColumnsIfNeeded(initialData.columns));
    }
  }, [initialData?.columns, columns.length, normalizeColumnsIfNeeded]);

  // Create SqlResult from loaded rows
  const csvData: SqlResult | undefined = useMemo(() => {
    if (columns.length === 0) return undefined;
    return { columns, rows: loadedRows };
  }, [columns, loadedRows]);

  // Sync data to executionStore whenever csvData changes (so PlotNode can read it)
  useEffect(() => {
    if (csvData && csvData.columns.length > 0 && csvData.rows.length > 0) {
      setSuccess(data.nodeId, {
        kind: 'sql',
        result: csvData,
        code: '',
      });
    }
  }, [csvData, data.nodeId, setSuccess]);

  const hasData = useMemo(() => {
    return csvData && csvData.columns.length > 0 && csvData.rows.length > 0;
  }, [csvData]);

  // Check if there are more rows to load
  const hasMoreRows = useMemo(() => {
    if (!totalRowCount) return false;
    return loadedRows.length < totalRowCount;
  }, [loadedRows.length, totalRowCount]);

  // Load more rows from DuckDB
  const loadMoreRows = useCallback(
    async (loadAll = false) => {
      if (!tableName || isLoading) return;
      const canLoadMore = loadedRows.length < (totalRowCount ?? Number.MAX_SAFE_INTEGER);
      if (!canLoadMore && loadedRows.length > 0) return;

      setIsLoading(true);
      setLoadError(null);

      try {
        const offset = loadedRows.length;
        const remaining = (totalRowCount ?? 0) - offset;
        const batchSize = loadAll && remaining > 0 ? remaining : ROWS_PER_BATCH;
        const result = await queryTablePaginated(tableName, offset, batchSize);
        if (result.columns.length > 0 && columns.length === 0) {
          setColumns(result.columns);
        }
        setLoadedRows((prev) => [...prev, ...result.rows]);
      } catch (err) {
        console.error('Failed to load more rows:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load more rows');
      } finally {
        setIsLoading(false);
      }
    },
    [tableName, loadedRows.length, columns.length, isLoading, totalRowCount],
  );

  // Auto-load ALL rows when we have tableName but no rows (e.g. board loaded from server)
  // For datasets up to 10k rows this is fast and avoids pagination
  useEffect(() => {
    if (!tableName || initialLoadDoneRef.current || loadedRows.length > 0 || isLoading) {
      return;
    }
    initialLoadDoneRef.current = true;
    loadMoreRows(true); // Load all rows at once
  }, [tableName, loadedRows.length, isLoading, loadMoreRows]);

  const stats = useMemo(() => {
    if (!csvData) return null;
    return {
      rows: csvData.rows.length,
      columns: csvData.columns.length,
      total: totalRowCount || csvData.rows.length,
    };
  }, [csvData, totalRowCount]);

  const fileTypeLabel = useMemo(() => {
    if (fileType === 'excel') return 'Excel';
    return 'CSV';
  }, [fileType]);

  const fileTypeIcon = useMemo(() => {
    if (fileType === 'excel') {
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-emerald-600"
        >
          <path
            d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 2V8H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 13H10L12 17L14 13H16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    return <FileArrowDown size={18} weight="duotone" className="text-cyan-600" />;
  }, [fileType]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={360}
        maxWidth={920}
        minHeight={200}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: '2px solid #06b6d4',
          background: '#ffffff',
        }}
        lineStyle={{ borderWidth: 1 }}
        onResize={(_, params) => {
          data.onResize?.(data.nodeId, params.width, params.height);
        }}
      />
      <div
        className={`group rounded-xl border bg-white shadow-lg transition-all ${
          selected
            ? 'ring-2 ring-cyan-400 border-cyan-300'
            : 'border-slate-200 hover:border-slate-300'
        }`}
        style={{ width: '100%', minHeight: 200 }}
      >
        {/* Source handles for outgoing connections to Plot nodes */}
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
        {/* Target handles for incoming connections */}
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

        {/* Header */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-cyan-50 via-emerald-50 to-teal-50 px-4 py-3 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fileTypeIcon}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                  {fileTypeLabel} Data
                </span>
                <span className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">
                  {filename || 'Untitled'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stats && (
                <>
                  <div className="flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5">
                    <Table size={12} weight="bold" className="text-cyan-700" />
                    <span className="text-[10px] font-semibold text-cyan-700">
                      {stats.rows.toLocaleString()}
                      {stats.total > stats.rows ? ` / ${stats.total.toLocaleString()}` : ''} rows
                    </span>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {stats.columns} cols
                  </div>
                </>
              )}
            </div>
          </div>
          {tableName && (
            <div className="mt-2 rounded-md bg-slate-100 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">SQL:</span>
                <code className="text-[11px] font-mono font-medium text-indigo-600">
                  SELECT * FROM {tableName}
                </code>
              </div>
              {csvData && csvData.columns.length > 0 && (
                <div className="mt-1 text-[10px] text-slate-500">
                  Columns: {csvData.columns.slice(0, 5).join(', ')}
                  {csvData.columns.length > 5 && ` +${csvData.columns.length - 5} more`}
                </div>
              )}
            </div>
          )}
          {uploadedAt && !tableName && (
            <div className="mt-1 text-[10px] text-slate-500">
              Loaded {new Date(uploadedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Data Preview */}
        <div className="p-3">
          {hasData ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <InteractiveResultTable result={csvData!} compact maxHeight={350} />
              </div>

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500">
                  <SpinnerGap size={16} weight="bold" className="animate-spin" />
                  Loading data...
                </div>
              )}

              {/* Error message */}
              {loadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {loadError}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500 gap-2">
              <FileArrowDown size={32} weight="light" className="text-slate-400" />
              <span>No data loaded</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const CsvNode = memo(CsvNodeComponent, (prevProps, nextProps) => {
  if (prevProps.data.nodeId !== nextProps.data.nodeId) return false;
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.data.width !== nextProps.data.width) return false;

  const prevPayload = prevProps.data.payload;
  const nextPayload = nextProps.data.payload;
  if (prevPayload !== nextPayload) {
    // Quick check for data reference
    if (prevPayload?.data !== nextPayload?.data) return false;
    if (prevPayload?.filename !== nextPayload?.filename) return false;
  }

  return true;
});
