'use client';

import {
  CaretDown,
  CaretRight,
  TextAa,
  Trash,
  PencilSimple,
  Eye,
  Plus,
  Code,
  Notebook,
  Play,
  Stop,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { memo, useCallback, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position, NodeResizer } from 'reactflow';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-10 bg-gray-50 animate-pulse rounded" />,
});

type CellPosition = 'standalone' | 'first' | 'middle' | 'last' | 'only';

export type MarkdownCellNodeData = {
  nodeId: string;
  source: string;
  onSourceChange?: (source: string) => void;
  onDelete?: () => void;
  onAddCellBelow?: (type: 'pythonCell' | 'markdownCell') => void;
  cellPosition?: CellPosition;
  /** Notebook header info */
  chainName?: string;
  chainCellCount?: number;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunningAll?: boolean;
};

function getCellClasses(position: CellPosition, hasHeader: boolean) {
  switch (position) {
    case 'first':
      return hasHeader ? 'rounded-none border-b-0' : 'rounded-t-xl rounded-b-none border-b-0';
    case 'middle':
      return 'rounded-none border-b-0';
    case 'last':
      return 'rounded-b-xl rounded-t-none';
    case 'only':
      return hasHeader ? 'rounded-b-xl rounded-t-none' : 'rounded-xl';
    case 'standalone':
    default:
      return hasHeader ? 'rounded-b-xl rounded-t-none' : 'rounded-xl';
  }
}

function MarkdownNotebookHeader({
  name,
  cellCount,
  onRunAll,
  onStopAll,
  isRunning,
}: {
  name: string;
  cellCount: number;
  onRunAll?: () => void;
  onStopAll?: () => void;
  isRunning?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 rounded-t-xl border border-b-0 border-gray-200 shrink-0"
      style={{ background: 'rgba(255,255,255,0.95)', width: '100%' }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Notebook size={14} weight="duotone" className="text-orange-400 shrink-0" />
        <span className="text-xs font-medium text-gray-600 truncate">{name}</span>
        <span className="text-[10px] text-gray-400">({cellCount})</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isRunning ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStopAll?.();
            }}
            className="flex items-center gap-0.5 rounded bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-600 transition-colors"
          >
            <Stop size={10} weight="fill" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRunAll?.();
            }}
            className="flex items-center gap-0.5 rounded bg-green-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-600 transition-colors"
          >
            <Play size={10} weight="fill" />
            Run All
          </button>
        )}
      </div>
    </div>
  );
}

function MarkdownCellNodeInner({ data, selected }: NodeProps<MarkdownCellNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const source = data.source ?? '';
  const cellPosition = data.cellPosition ?? 'standalone';
  const showHeader =
    !!data.chainName &&
    (cellPosition === 'first' || cellPosition === 'only' || cellPosition === 'standalone');
  const cellClasses = getCellClasses(cellPosition, showHeader);
  const isConnected = cellPosition !== 'standalone';
  const isLastInChain =
    cellPosition === 'last' || cellPosition === 'only' || cellPosition === 'standalone';

  const lineCount = Math.max(source.split('\n').length, 1);
  const editorHeight = Math.min(Math.max(lineCount * 19 + 10, 40), 200);

  const handleChange = useCallback(
    (val: string | undefined) => {
      data.onSourceChange?.(val ?? '');
    },
    [data.onSourceChange],
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Notebook header — above the first cell */}
      {showHeader && (
        <MarkdownNotebookHeader
          name={data.chainName!}
          cellCount={data.chainCellCount ?? 1}
          onRunAll={data.onRunAll}
          onStopAll={data.onStopAll}
          isRunning={data.isRunningAll}
        />
      )}
      <div
        className={`flex flex-col bg-white overflow-hidden border border-gray-200 transition-colors ${cellClasses} ${isConnected || showHeader ? '' : 'shadow-sm'}`}
        style={{ width: '100%', minHeight: 50 }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={360}
          minHeight={80}
          lineStyle={{ borderColor: '#a855f7', borderWidth: 1 }}
          handleStyle={{ backgroundColor: '#a855f7', width: 8, height: 8, borderRadius: 4 }}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!bg-purple-500 !w-3 !h-3"
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
          className="!bg-purple-500 !w-3 !h-3"
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
          className="!bg-purple-500 !w-3 !h-3"
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
          className="!bg-purple-500 !w-3 !h-3"
          style={{
            bottom: -6,
            left: '50%',
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'auto' : 'none',
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50/50 border-b border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed((p) => !p)}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
          >
            {isCollapsed ? (
              <CaretRight size={12} className="text-gray-500" />
            ) : (
              <CaretDown size={12} className="text-gray-500" />
            )}
          </button>
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-purple-600 bg-purple-50 rounded font-medium">
            <TextAa size={12} />
            Markdown
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setIsEditing((p) => !p)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded transition-colors"
          >
            {isEditing ? <Eye size={12} /> : <PencilSimple size={12} />}
            {isEditing ? 'Preview' : 'Edit'}
          </button>
          {data.onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete!();
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Delete cell"
            >
              <Trash size={13} className="text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="nowheel nodrag">
            {isEditing ? (
              <div style={{ height: editorHeight }}>
                <MonacoEditor
                  language="markdown"
                  value={source}
                  onChange={handleChange}
                  theme="light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'off',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    folding: false,
                    overviewRulerLanes: 0,
                    scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                    padding: { top: 4, bottom: 4 },
                    automaticLayout: true,
                  }}
                />
              </div>
            ) : (
              <div
                className="px-4 py-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap cursor-text min-h-[32px]"
                onClick={() => setIsEditing(true)}
              >
                {source || '(empty markdown cell — click to edit)'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* "+" button: absolute overlay on middle cells (no gap), in-flow on last cell */}
      {data.onAddCellBelow &&
        (() => {
          const addContent = (
            <>
              <div className="flex-1 h-px bg-purple-200 transition-colors" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddMenu((p) => !p);
                }}
                className="mx-1 p-0.5 rounded-full border border-purple-300 text-purple-400 hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 transition-all"
                title="Add cell below"
              >
                <Plus size={14} />
              </button>
              <div className="flex-1 h-px bg-purple-200 transition-colors" />
              {showAddMenu && (
                <div className="absolute top-full z-50 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 mt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onAddCellBelow!('pythonCell');
                      setShowAddMenu(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Code size={14} className="text-blue-500" />
                    Python
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onAddCellBelow!('markdownCell');
                      setShowAddMenu(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-purple-50 rounded transition-colors"
                  >
                    <TextAa size={14} className="text-purple-500" />
                    Markdown
                  </button>
                </div>
              )}
            </>
          );

          if (isLastInChain) {
            return (
              <div
                className="flex items-center justify-center py-1 relative nodrag nowheel"
                style={{ width: '100%' }}
              >
                {addContent}
              </div>
            );
          }

          return (
            <div
              className="absolute left-0 right-0 flex items-center justify-center nodrag nowheel transition-opacity z-10"
              style={{
                bottom: -12,
                height: 24,
                opacity: isHovered || showAddMenu ? 1 : 0,
                pointerEvents: isHovered || showAddMenu ? 'auto' : 'none',
              }}
            >
              {addContent}
            </div>
          );
        })()}
    </div>
  );
}

export const MarkdownCellNode = memo(MarkdownCellNodeInner);
