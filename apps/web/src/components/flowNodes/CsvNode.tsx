'use client';

import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from 'reactflow';
import { InteractiveResultTable } from '../InteractiveResultTable';
import { DATA_NODE_HANDLE_CLASS } from '../BoardCanvas';
import { FileArrowDown, Table } from '@phosphor-icons/react';
import type { SqlResult } from '../../state/executionStore';

export type CsvNodePayload = {
  filename?: string;
  tableName?: string; // DuckDB table name for SQL queries
  data?: SqlResult;
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
  const { filename, tableName, data: csvData, uploadedAt, fileType } = data.payload || {};
  const nodeWidth = data.width || 500;

  const hasData = useMemo(() => {
    return csvData && csvData.columns.length > 0 && csvData.rows.length > 0;
  }, [csvData]);

  const stats = useMemo(() => {
    if (!csvData) return null;
    return {
      rows: csvData.rows.length,
      columns: csvData.columns.length,
    };
  }, [csvData]);

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
                      {stats.rows.toLocaleString()} rows
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
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <InteractiveResultTable result={csvData!} compact maxHeight={350} />
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
