'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { InteractiveResultTable } from '../InteractiveResultTable';
import { DATA_NODE_HANDLE_CLASS } from '../BoardCanvas';
import { FileArrowDown, Table, SpinnerGap, ArrowDown } from '@phosphor-icons/react';
import type { SqlResult } from '../../state/executionStore';
import { useExecutionStore } from '../../state/executionStore';
import { queryTablePaginated } from '../../lib/duckdbClient';

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
  const { filename, tableName, data: initialData, totalRowCount, uploadedAt, fileType } = data.payload || {};
  const nodeWidth = data.width || 500;
  
  // Get executionStore methods to sync data for PlotNode access
  const registerNode = useExecutionStore((state) => state.registerNode);
  const setSuccess = useExecutionStore((state) => state.setSuccess);
  const entryExists = useExecutionStore(
    (state) => !!state.entries[data.nodeId],
  );

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

  // State for lazy-loaded data
  const [loadedRows, setLoadedRows] = useState<Array<Array<string | number | null>>>(
    initialData?.rows || []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Combine columns from initial data
  const columns = initialData?.columns || [];
  
  // Create SqlResult from loaded rows
  const csvData: SqlResult | undefined = useMemo(() => {
    if (columns.length === 0) return undefined;
    return { columns, rows: loadedRows };
  }, [columns, loadedRows]);
  
  // Sync data to executionStore whenever csvData changes
  // This allows PlotNode to access the data via usePlotData hook
  useEffect(() => {
    if (csvData && csvData.columns.length > 0 && csvData.rows.length > 0) {
      setSuccess(data.nodeId, {
        kind: 'sql',
        result: csvData,
        code: '', // CSV nodes don't have code
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
  const loadMoreRows = useCallback(async (loadAll = false) => {
    if (!tableName || isLoading || !hasMoreRows) return;
    
    setIsLoading(true);
    setLoadError(null);
    
    try {
      const remaining = (totalRowCount || 0) - loadedRows.length;
      const batchSize = loadAll ? remaining : ROWS_PER_BATCH;
      const result = await queryTablePaginated(tableName, loadedRows.length, batchSize);
      setLoadedRows(prev => [...prev, ...result.rows]);
    } catch (err) {
      console.error('Failed to load more rows:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load more rows');
    } finally {
      setIsLoading(false);
    }
  }, [tableName, loadedRows.length, isLoading, hasMoreRows, totalRowCount]);

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
        minWidth={300}
        maxWidth={1000}
        minHeight={200}
        handleStyle={{ width: 8, height: 8 }}
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
        style={{ width: nodeWidth, minHeight: 200 }}
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
                      {stats.rows.toLocaleString()}{stats.total > stats.rows ? ` / ${stats.total.toLocaleString()}` : ''} rows
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
              
              {/* Load more buttons */}
              {hasMoreRows && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadMoreRows(false)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <SpinnerGap size={16} weight="bold" className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ArrowDown size={16} weight="bold" />
                        Load {Math.min(ROWS_PER_BATCH, (totalRowCount || 0) - loadedRows.length).toLocaleString()} more
                      </>
                    )}
                  </button>
                  {((totalRowCount || 0) - loadedRows.length) > ROWS_PER_BATCH && (
                    <button
                      type="button"
                      onClick={() => loadMoreRows(true)}
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Load all ({((totalRowCount || 0) - loadedRows.length).toLocaleString()})
                    </button>
                  )}
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
