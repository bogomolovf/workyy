import dynamic from 'next/dynamic';
import { NodeProps, NodeResizer } from 'reactflow';

import type { ExecutionStoreState, NodeStatus } from '../../state/executionStore';
import { useExecutionStore } from '../../state/executionStore';
import {
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
} from '../../state/canvasLayoutStore';
import { InteractiveResultTable } from '../InteractiveResultTable';
import { PlotPreview } from '../PlotPreview';
import type { NodeData } from './boardCanvas.types';
import { DataNodeHandles } from './DataNodeHandles';
import { statusColors, StatusBadge, ErrorMessage, StdoutBlock } from './nodeUtils';

const MonacoEditor = dynamic(async () => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-32 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-xs text-slate-400">
      Loading editor…
    </div>
  ),
});

export const PythonNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  const execution = useExecutionStore((state: ExecutionStoreState) => state.entries[data.nodeId]);
  const status: NodeStatus = execution?.status ?? 'idle';
  const output = execution?.output?.kind === 'python' ? execution.output.result : undefined;
  const code = execution?.code ?? '';
  const hiddenOutputs = execution?.hiddenOutputs ?? { error: false, warnings: false };
  const dismissError = useExecutionStore((state: ExecutionStoreState) => state.dismissError);
  const dismissWarnings = useExecutionStore((state: ExecutionStoreState) => state.dismissWarnings);

  const codeLines = code.split('\n').length;
  const expandedHeight = Math.max(240, codeLines * 18 + 60);
  const editorHeight = data.isCodeCollapsed ? Math.min(220, expandedHeight) : expandedHeight;
  const stdoutContent = output?.stdout && output.stdout.trim().length > 0 ? output.stdout : '';
  const stderrContent =
    output?.stderr && output.stderr.trim().length > 0 ? output.stderr.trim() : '';
  const stderrTone = execution?.error ? 'stderr' : 'warning';
  const stderrTitle = execution?.error ? 'Stderr' : 'Warnings';
  const shouldShowError = Boolean(execution?.error) && !hiddenOutputs.error;
  const shouldShowWarnings = Boolean(stderrContent) && !hiddenOutputs.warnings;
  return (
    <div
      className={`group rounded-md border bg-white shadow-lg px-5 pb-5 pt-4 transition-all ${statusColors[status]}`}
      style={{ width: '100%', minHeight: 320 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_WIDTH}
        maxWidth={MAX_NODE_WIDTH}
        minHeight={260}
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
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Python Node</span>
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
          language="python"
          theme="vs-light"
          value={code}
          height={`${editorHeight}px`}
          path={`${data.nodeId}-python-${data.isCodeCollapsed ? 'compact' : 'full'}`}
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

      {shouldShowError && execution?.error && (
        <ErrorMessage message={execution.error} onDismiss={() => dismissError(data.nodeId)} />
      )}
      {stdoutContent && (
        <div className="mt-3">
          <StdoutBlock title="Stdout" content={stdoutContent} tone="stdout" />
        </div>
      )}
      {shouldShowWarnings && (
        <div className="mt-3">
          <StdoutBlock
            title={stderrTitle}
            content={stderrContent}
            tone={stderrTone}
            onDismiss={() => dismissWarnings(data.nodeId)}
          />
        </div>
      )}
      {output?.table && (
        <div className="mt-3">
          <InteractiveResultTable result={output.table} />
        </div>
      )}
      {output?.plotJson && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <PlotPreview plotJson={output.plotJson} height={480} />
        </div>
      )}
      {status === 'success' &&
        !output?.stdout &&
        !output?.stderr &&
        !output?.table &&
        !output?.plotJson && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
            Execution finished without captured output. Use <code>print()</code>, assign to{' '}
            <code>result</code>, or set <code>plot</code>.
          </div>
        )}
    </div>
  );
};
