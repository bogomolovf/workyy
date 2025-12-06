import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { InteractiveResultTable } from '../InteractiveResultTable';
import { useExecutionStore } from '../../state/executionStore';
import type { NodeStatus } from '../../state/executionStore';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

type SqlNodeData = {
  nodeId: string;
  onRun: () => void;
  onChangeCode: (value: string) => void;
};

type StatusBadgeProps = {
  status: NodeStatus;
};

function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = useMemo(() => {
    switch (status) {
      case 'running':
        return {
          label: 'Running',
          className: 'bg-amber-500/20 text-amber-200 border border-amber-500/40',
        };
      case 'success':
        return {
          label: 'Success',
          className: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40',
        };
      case 'error':
        return {
          label: 'Error',
          className: 'bg-rose-500/20 text-rose-200 border border-rose-500/40',
        };
      default:
        return { label: 'Idle', className: 'bg-slate-700 text-slate-200' };
    }
  }, [status]);

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${className}`}>{label}</span>
  );
}

export function SqlNode({ data }: NodeProps<SqlNodeData>) {
  const entry = useExecutionStore((state) => state.entries[data.nodeId]);
  const status = entry?.status ?? 'idle';
  const code = entry?.code ?? '';
  const error = entry?.error ?? null;
  const result = entry?.output?.kind === 'sql' ? entry.output.result : undefined;

  return (
    <div className="w-[360px] rounded-2xl border border-slate-700 bg-slate-900/80 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          SQL Node
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            className="rounded-md bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-900/60"
            onClick={data.onRun}
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      <div className="h-44 border-b border-slate-800">
        <MonacoEditor
          language="sql"
          value={code}
          onChange={(value) => data.onChangeCode(value ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'off',
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {error && (
        <div className="border-b border-rose-700/40 bg-rose-900/30 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="px-4 py-3">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Result preview</span>
        {result && result.rows.length > 0 ? (
          <div className="mt-2">
            <InteractiveResultTable result={result} compact />
          </div>
        ) : (
          <div className="mt-2 rounded-md border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">
            Run the node to see results.
          </div>
        )}
      </div>
    </div>
  );
}
