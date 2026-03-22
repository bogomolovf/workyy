import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import PlotlyPreview from './PlotlyPreview';
import { InteractiveResultTable } from '../InteractiveResultTable';
import { useExecutionStore } from '../../state/executionStore';
import type { NodeStatus } from '../../state/executionStore';
import { useNodeEditing } from '../../context/EditingPresenceContext';
import { EditingIndicator } from '../EditingIndicator';
import type { editor } from 'monaco-editor';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

type PythonNodeData = {
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

export function PythonNode({ data }: NodeProps<PythonNodeData>) {
  const entry = useExecutionStore((state) => state.entries[data.nodeId]);
  const status = entry?.status ?? 'idle';
  const code = entry?.code ?? '';
  const error = entry?.error ?? null;
  const output = entry?.output?.kind === 'python' ? entry.output.result : undefined;
  const stderrContent = output?.stderr ?? '';
  const hasWarnings = Boolean(stderrContent.trim());
  const dismissError = useExecutionStore((state) => state.dismissError);
  const dismissWarnings = useExecutionStore((state) => state.dismissWarnings);
  const hiddenOutputs = entry?.hiddenOutputs ?? { error: false, warnings: false };
  const shouldShowError = Boolean(error) && !hiddenOutputs.error;
  const shouldShowWarnings = hasWarnings && !hiddenOutputs.warnings;

  // Use editing presence to show who is editing this Python node
  const {
    otherEditors,
    isBeingEdited,
    onFocus: handleEditingFocus,
    onChange: handleEditingChange,
    onBlur: handleEditingBlur,
  } = useNodeEditing(data.nodeId);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // Handle code change and update editing presence
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      data.onChangeCode(value ?? '');
      handleEditingChange();
    },
    [data.onChangeCode, handleEditingChange],
  );

  // Handle Monaco editor mount to set up focus/blur listeners
  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;

      // Disable wheel capture initially so board zoom works over unfocused editor
      editor.updateOptions({ scrollbar: { handleMouseWheel: false } });

      // Track focus — enable wheel capture for in-editor scrolling
      editor.onDidFocusEditorWidget(() => {
        handleEditingFocus();
        setIsEditorFocused(true);
        editor.updateOptions({ scrollbar: { handleMouseWheel: true } });
      });

      // Track blur — disable wheel capture so board zoom resumes
      editor.onDidBlurEditorWidget(() => {
        handleEditingBlur();
        setIsEditorFocused(false);
        editor.updateOptions({ scrollbar: { handleMouseWheel: false } });
      });
    },
    [handleEditingFocus, handleEditingBlur],
  );

  return (
    <div
      className="w-[380px] rounded-2xl border bg-slate-900/80 shadow-lg relative"
      style={{
        borderColor: isBeingEdited ? otherEditors[0]?.color || '#6366f1' : '#334155',
        borderWidth: isBeingEdited ? 2 : 1,
      }}
    >
      {/* Show editing indicator when others are editing this Python node */}
      {isBeingEdited && <EditingIndicator editors={otherEditors} position="top-right" />}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Python Node
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

      <div className={`h-48 border-b border-slate-800 nodrag${isEditorFocused ? ' nowheel' : ''}`}>
        <MonacoEditor
          language="python"
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'off',
            scrollBeyondLastLine: false,
            scrollbar: { handleMouseWheel: false },
          }}
        />
      </div>

      {shouldShowError && error && (
        <div className="relative border-b border-rose-700/40 bg-rose-900/30 px-4 py-2 text-xs text-rose-200">
          <button
            type="button"
            className="absolute right-3 top-2 text-slate-200/70 transition hover:text-white"
            aria-label="Hide error"
            onClick={() => dismissError(data.nodeId)}
          >
            ×
          </button>
          {error}
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        <section>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Stdout</span>
          <div className="mt-1 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 whitespace-pre-wrap">
            {output?.stdout?.trim() ? output.stdout : '(no output)'}
          </div>
        </section>

        {shouldShowWarnings && (
          <section>
            <span className="text-[10px] uppercase tracking-wide text-rose-300">Stderr</span>
            <div className="relative mt-1 rounded-md border border-rose-700/40 bg-rose-900/30 px-3 py-2 text-xs text-rose-200 whitespace-pre-wrap">
              <button
                type="button"
                className="absolute right-1.5 top-1 text-rose-100/70 transition hover:text-white"
                aria-label="Hide warnings"
                onClick={() => dismissWarnings(data.nodeId)}
              >
                ×
              </button>
              {stderrContent}
            </div>
          </section>
        )}

        <section>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Result preview</span>
          {output?.table && output.table.rows.length > 0 ? (
            <div className="mt-2">
              <InteractiveResultTable result={output.table} compact />
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">
              Run the node to see results.
            </div>
          )}
        </section>

        {output?.plotJson && (
          <section>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Visualization
            </span>
            <div className="mt-1 rounded-md border border-slate-800 bg-slate-950/60">
              <PlotlyPreview plotJson={output.plotJson} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
