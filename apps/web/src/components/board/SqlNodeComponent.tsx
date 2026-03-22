import dynamic from 'next/dynamic';
import { NodeProps, NodeResizer } from 'reactflow';

import type { ExecutionStoreState, NodeStatus } from '../../state/executionStore';
import { useExecutionStore } from '../../state/executionStore';
import {
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
} from '../../state/canvasLayoutStore';
import { InteractiveResultTable } from '../InteractiveResultTable';
import type { NodeData } from './boardCanvas.types';
import { DataNodeHandles } from './DataNodeHandles';
import { statusColors, StatusBadge, ErrorMessage } from './nodeUtils';

const MonacoEditor = dynamic(async () => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-32 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-xs text-slate-400">
      Loading editor…
    </div>
  ),
});

export const SqlNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  const execution = useExecutionStore((state: ExecutionStoreState) => state.entries[data.nodeId]);
  const status: NodeStatus = execution?.status ?? 'idle';
  const result = execution?.output?.kind === 'sql' ? execution.output.result : undefined;
  const code = execution?.code ?? '';
  const error = execution?.error ?? null;
  const codeLines = code.split('\n').length;
  const expandedHeight = Math.max(240, codeLines * 18 + 60);
  const editorHeight = data.isCodeCollapsed ? Math.min(220, expandedHeight) : expandedHeight;
  return (
    <div
      className={`group rounded-md border bg-white shadow-lg px-5 pb-5 pt-4 transition-all ${statusColors[status]}`}
      style={{ width: '100%', minHeight: 320 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_WIDTH}
        maxWidth={MAX_NODE_WIDTH}
        minHeight={240}
        lineClassName="!border-indigo-200"
        handleStyle={{
          width: 12,
          height: 12,
          borderRadius: 6,
          border: '2px solid #6366f1',
          background: '#EEF2FF',
        }}
      />
      <DataNodeHandles selected={selected} />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">SQL Node</span>
          <span className="text-xs font-semibold text-slate-900">{data.nodeId.slice(0, 6)}</span>
        </div>
        <div
          className="flex items-center gap-2 nodrag"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <StatusBadge status={status} />
          <button
            onClick={data.onRun}
            disabled={status === 'running'}
            title="Run this cell only (Shift+Enter)"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
          >
            {status === 'running' ? 'Running…' : 'Run'}
          </button>
          <button
            onClick={data.onRunDownstream}
            disabled={status === 'running'}
            title="Run this cell and all cells below (Ctrl+Shift+Enter)"
            className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run downstream
          </button>
          <button
            onClick={data.onToggleCodeCollapsed}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-100"
          >
            {data.isCodeCollapsed ? 'Expand code' : 'Collapse code'}
          </button>
        </div>
      </div>

      <div
        className="nodrag"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
      >
        <MonacoEditor
          language="sql"
          theme="vs-light"
          value={code}
          height={`${editorHeight}px`}
          path={`${data.nodeId}-sql-${data.isCodeCollapsed ? 'compact' : 'full'}`}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none',
            padding: { top: 8 },
          }}
          onChange={(next) => data.onCodeChange(next ?? '')}
        />
      </div>

      {error && <ErrorMessage message={error} />}
      {result && (
        <div className="mt-3">
          <InteractiveResultTable
            result={result}
            compact
            totalCount={result.totalCount}
            isPreview={result.isPreview}
            onLoadAll={data.onRunFull}
          />
        </div>
      )}
    </div>
  );
};
