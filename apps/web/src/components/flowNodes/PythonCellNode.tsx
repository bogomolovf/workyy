'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useMemo } from 'react';
import type { NodeProps } from 'reactflow';
import { useExecutionStore } from '../../state/executionStore';
import { CellShell, type CellShellProps } from './CellShell';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-50 animate-pulse rounded" />,
});

export type PythonCellNodeData = {
  nodeId: string;
  onRun?: () => void;
  onRunFull?: () => void;
  onCodeChange?: (code: string) => void;
  onDelete?: () => void;
  onAddCellBelow?: (type: 'pythonCell' | 'markdownCell') => void;
  cellPosition?: CellShellProps['cellPosition'];
  cellIndex?: number;
  /** Notebook header info */
  chainName?: string;
  chainCellCount?: number;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunningAll?: boolean;
};

function PythonCellNodeInner({ data, selected }: NodeProps<PythonCellNodeData>) {
  const entry = useExecutionStore((s) => s.entries[data.nodeId]);
  const status = entry?.status ?? 'idle';
  const code = entry?.code ?? '';
  const error = entry?.error ?? null;
  const output = entry?.output?.kind === 'python' ? entry.output.result : undefined;
  const hiddenOutputs = entry?.hiddenOutputs ?? { error: false, warnings: false };

  const lineCount = Math.max(code.split('\n').length, 1);
  const editorHeight = Math.min(Math.max(lineCount * 19 + 10, 60), 400);

  const handleCodeChange = useCallback(
    (val: string | undefined) => {
      data.onCodeChange?.(val ?? '');
    },
    [data.onCodeChange],
  );

  const cellOutput = useMemo<CellShellProps['output']>(() => {
    if (!output && !error) return undefined;
    return {
      stdout: output?.stdout,
      stderr: !hiddenOutputs.warnings ? output?.stderr : undefined,
      table: output?.table,
      plotJson: output?.plotJson,
    };
  }, [output, error, hiddenOutputs.warnings]);

  return (
    <CellShell
      nodeId={data.nodeId}
      selected={selected}
      language="python"
      status={status}
      executionCount={data.cellIndex}
      error={!hiddenOutputs.error ? error : null}
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
      <div style={{ height: editorHeight }}>
        <MonacoEditor
          language="python"
          value={code}
          onChange={handleCodeChange}
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
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            padding: { top: 4, bottom: 4 },
            automaticLayout: true,
          }}
        />
      </div>
    </CellShell>
  );
}

export const PythonCellNode = memo(PythonCellNodeInner);
