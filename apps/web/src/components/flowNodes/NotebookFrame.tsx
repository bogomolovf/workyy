'use client';

import {
  Play,
  Stop,
  Plus,
  CaretDown,
  CaretRight,
  Notebook,
  Code,
  TextAa,
} from '@phosphor-icons/react';
import { memo, useCallback, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position, NodeResizer } from 'reactflow';
import { useChainStore } from '../../state/chainStore';

export type NotebookFrameData = {
  nodeId: string;
  frameName: string;
  onRunAll?: () => void;
  onStop?: () => void;
  onAddCell?: (afterIndex: number, type: 'pythonCell' | 'markdownCell') => void;
  onFrameNameChange?: (name: string) => void;
  upstreamNodeId?: string;
};

function NotebookFrameInner({ data, selected }: NodeProps<NotebookFrameData>) {
  const chain = useChainStore((s) => s.chains[data.nodeId]);
  const cellIds = chain?.cellIds ?? [];
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const totalCells = cellIds.length;

  const handleRunAll = useCallback(() => {
    if (isRunningAll) return;
    setIsRunningAll(true);
    data.onRunAll?.();
    setIsRunningAll(false);
  }, [isRunningAll, data.onRunAll]);

  const handleStop = useCallback(() => {
    data.onStop?.();
    setIsRunningAll(false);
  }, [data.onStop]);

  return (
    <div
      className="flex flex-col rounded-xl overflow-visible"
      style={{
        width: '100%',
        height: '100%',
        minWidth: 420,
        minHeight: 80,
        background: 'rgba(249, 250, 251, 0.3)',
        border: selected
          ? '1.5px dashed rgba(99, 102, 241, 0.4)'
          : '1px dashed rgba(209, 213, 219, 0.5)',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={420}
        minHeight={80}
        lineStyle={{ borderColor: '#6366f1', borderWidth: 1, opacity: 0.4 }}
        handleStyle={{ backgroundColor: '#6366f1', width: 8, height: 8, borderRadius: 4 }}
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

      {/* Minimal header — small strip above the cells */}
      <div
        className="flex items-center justify-between px-3 py-1.5 shrink-0 rounded-t-xl"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Notebook size={14} weight="duotone" className="text-orange-400 shrink-0" />
          <span className="text-xs font-medium text-gray-500 truncate">{data.frameName}</span>
          <span className="text-[10px] text-gray-400">({totalCells})</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isRunningAll ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-0.5 rounded bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-600 transition-colors"
            >
              <Stop size={10} weight="fill" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunAll}
              className="flex items-center gap-0.5 rounded bg-green-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Play size={10} weight="fill" />
              Run All
            </button>
          )}
        </div>
      </div>

      {/* The rest is transparent — child cell nodes are rendered by ReactFlow inside this parent */}
      <div className="flex-1 min-h-0 overflow-visible" />
    </div>
  );
}

export const NotebookFrameNode = memo(NotebookFrameInner);
