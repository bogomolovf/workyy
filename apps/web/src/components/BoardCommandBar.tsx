'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  ChartBar,
  Cursor,
  Cylinder,
  Database,
  FileArrowUp,
  NotePencil,
  PencilSimple,
  Play,
  Plus,
  SpinnerGap,
  SquaresFour,
  Terminal,
  TextT,
  Trash,
} from '@phosphor-icons/react';
import type { NodeStatus } from '../state/executionStore';
import { ShapePalette } from './ShapePalette';
import type { ShapeType } from './flowNodes/ShapeNode';

export type CanvasTool = 'select' | 'note' | 'pen' | 'text' | 'shape';

type BoardCommandBarProps = {
  currentTool: CanvasTool;
  onChangeTool: (tool: CanvasTool) => void;
  selectedShape?: ShapeType | null;
  onSelectShape?: (shape: ShapeType) => void;
  selectedNodeType?: 'sql' | 'python' | null;
  selectedNodeStatus?: NodeStatus;
  onRunSelectedNode?: () => void;
  onRunDownstreamSelectedNode?: () => void;
  canRunSelectedNode?: boolean;
  canRunDownstream?: boolean;
  onAddSqlNode?: () => void;
  onAddPythonNode?: () => void;
  onAddDatabaseNode?: () => void;
  onAddPlotNode?: () => void;
  onUploadSpreadsheet?: (file: File) => void;
  onDeleteSelection?: () => void;
  hasSelection?: boolean;
  portalRoot?: HTMLElement | null;
};

type CanvasToolConfig = {
  id: CanvasTool;
  label: string;
  icon: typeof Cursor;
  hotkey: string;
};

const canvasTools: CanvasToolConfig[] = [
  { id: 'select', label: 'Select', icon: Cursor, hotkey: 'V' },
  { id: 'note', label: 'Sticky', icon: NotePencil, hotkey: 'N' },
  { id: 'pen', label: 'Pen', icon: PencilSimple, hotkey: 'P' },
  { id: 'text', label: 'Text', icon: TextT, hotkey: 'T' },
  { id: 'shape', label: 'Shape', icon: SquaresFour, hotkey: 'S' },
];

const statusToneClasses: Record<NodeStatus, string> = {
  idle: 'bg-slate-100 text-slate-600 border border-slate-200',
  running: 'bg-amber-100 text-amber-700 border border-amber-200',
  success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  error: 'bg-rose-100 text-rose-700 border border-rose-200',
};

function StatusPill({ status }: { status: NodeStatus }) {
  return (
    <span
      className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide ${statusToneClasses[status]}`}
    >
      {status === 'running' && <SpinnerGap className="animate-spin" size={12} weight="bold" />}
      {status.toUpperCase()}
    </span>
  );
}

const TOOLTIP_DELAY = 150;

export const BoardCommandBar = memo(function BoardCommandBar({
  currentTool,
  onChangeTool,
  selectedShape,
  onSelectShape,
  selectedNodeType,
  selectedNodeStatus,
  onRunSelectedNode,
  onRunDownstreamSelectedNode,
  canRunSelectedNode,
  canRunDownstream,
  onAddSqlNode,
  onAddPythonNode,
  onAddDatabaseNode,
  onAddPlotNode,
  onUploadSpreadsheet,
  onDeleteSelection,
  hasSelection,
  portalRoot,
}: BoardCommandBarProps) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [isShapePaletteOpen, setIsShapePaletteOpen] = useState(false);
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadSpreadsheet) {
      onUploadSpreadsheet(file);
    }
    // Reset input to allow re-uploading same file
    e.target.value = '';
  };

  useEffect(() => {
    if (portalRoot) {
      setRoot(portalRoot);
      return;
    }
    if (typeof window === 'undefined') return;
    const id = 'workyy-board-commandbar';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    setRoot(el);
  }, [portalRoot]);

  const showDataCluster = useMemo(
    () => Boolean(selectedNodeType && canRunSelectedNode),
    [selectedNodeType, canRunSelectedNode],
  );

  const NodeTypeIcon =
    selectedNodeType === 'sql' ? Database : selectedNodeType === 'python' ? Terminal : null;

  const dataRunDisabled = !canRunSelectedNode || selectedNodeStatus === 'running';
  const downstreamDisabled = !canRunDownstream || selectedNodeStatus === 'running';

  // Закрываем палитру при изменении инструмента
  useEffect(() => {
    if (currentTool !== 'shape') {
      setIsShapePaletteOpen(false);
    }
  }, [currentTool]);

  // Закрываем палитру при клике вне её
  useEffect(() => {
    if (!isShapePaletteOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        shapeButtonRef.current &&
        !shapeButtonRef.current.contains(target) &&
        !target.closest('.shape-palette-popover')
      ) {
        setIsShapePaletteOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isShapePaletteOpen]);

  const positioningClass =
    portalRoot != null
      ? 'absolute left-1/2 bottom-4 -translate-x-1/2 z-[100]'
      : 'fixed left-1/2 bottom-4 -translate-x-1/2 z-[100000]';

  const baseButtonClass =
    'grid h-9 w-9 place-items-center rounded-lg border border-transparent text-black transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';
  const activeButtonClass =
    'bg-indigo-600 text-white border-indigo-600 shadow-[0_4px_12px_rgba(79,70,229,0.3)]';
  const disabledButtonClass = 'opacity-50 cursor-not-allowed hover:bg-transparent';
  const ghostButtonClass = 'border border-slate-200 text-black';
  const dangerButtonClass = 'text-black hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600';

  const card = (
    <div className={`pointer-events-none ${positioningClass}`}>
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.15)]">
        <div className="flex items-center gap-1.5">
          {canvasTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = currentTool === tool.id;
            const isShapeTool = tool.id === 'shape';

            return (
              <div key={tool.id} className="relative">
                <button
                  ref={isShapeTool ? shapeButtonRef : undefined}
                  type="button"
                  className={`${baseButtonClass} ${isActive ? activeButtonClass : ''}`}
                  onClick={() => {
                    if (tool.id === 'select') {
                      onChangeTool('select');
                      setIsShapePaletteOpen(false);
                      return;
                    }
                    if (isShapeTool) {
                      if (isActive) {
                        setIsShapePaletteOpen(!isShapePaletteOpen);
                      } else {
                        onChangeTool(tool.id);
                        setIsShapePaletteOpen(true);
                      }
                      return;
                    }
                    if (isActive) {
                      onChangeTool('select');
                    } else {
                      onChangeTool(tool.id);
                    }
                    setIsShapePaletteOpen(false);
                  }}
                  title={`${tool.label} (${tool.hotkey.toUpperCase()})`}
                  data-delay={TOOLTIP_DELAY}
                >
                  <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                </button>
                {isShapeTool && isShapePaletteOpen && onSelectShape && (
                  <div className="shape-palette-popover absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100001] pointer-events-auto">
                    <ShapePalette
                      selectedShape={selectedShape ?? null}
                      onSelectShape={(shape) => {
                        onSelectShape(shape);
                        setIsShapePaletteOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          {onAddSqlNode && (
            <button
              type="button"
              className={`${baseButtonClass} ${ghostButtonClass} relative`}
              onClick={onAddSqlNode}
              title="Add SQL node"
            >
              <Database size={18} weight="regular" />
              <Plus
                size={10}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-0.5"
              />
            </button>
          )}
          {onAddPythonNode && (
            <button
              type="button"
              className={`${baseButtonClass} ${ghostButtonClass} relative`}
              onClick={onAddPythonNode}
              title="Add Python node"
            >
              <Terminal size={18} weight="regular" />
              <Plus
                size={10}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-0.5"
              />
            </button>
          )}
          {onAddDatabaseNode && (
            <button
              type="button"
              className={`${baseButtonClass} ${ghostButtonClass} relative`}
              onClick={onAddDatabaseNode}
              title="Add Database node (D)"
            >
              <Cylinder size={18} weight="regular" />
              <Plus
                size={10}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-0.5"
              />
            </button>
          )}
          {onAddPlotNode && (
            <button
              type="button"
              className={`${baseButtonClass} ${ghostButtonClass} relative`}
              onClick={onAddPlotNode}
              title="Add Plot node (P)"
            >
              <ChartBar size={18} weight="regular" />
              <Plus
                size={10}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-0.5"
              />
            </button>
          )}
          {onUploadSpreadsheet && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsb,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={`${baseButtonClass} ${ghostButtonClass} relative`}
                onClick={handleFileUploadClick}
                title="Upload CSV/Excel"
              >
                <FileArrowUp size={18} weight="regular" />
                <Plus
                  size={10}
                  weight="bold"
                  className="absolute -top-0.5 -right-0.5 bg-emerald-600 text-white rounded-full p-0.5"
                />
              </button>
            </>
          )}
          {onDeleteSelection && hasSelection && (
            <button
              type="button"
              className={`${baseButtonClass} ${dangerButtonClass}`}
              onClick={onDeleteSelection}
              title="Delete selection (Delete)"
            >
              <Trash size={18} weight="regular" />
            </button>
          )}
        </div>
        {showDataCluster && selectedNodeStatus && (
          <>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              {NodeTypeIcon && (
                <span
                  className={`${baseButtonClass} ${ghostButtonClass}`}
                  title={selectedNodeType === 'sql' ? 'SQL cell' : 'Python cell'}
                >
                  <NodeTypeIcon size={16} weight="regular" />
                </span>
              )}
              <StatusPill status={selectedNodeStatus} />
              <button
                type="button"
                className={`${baseButtonClass} ${dataRunDisabled ? disabledButtonClass : ''}`}
                onClick={onRunSelectedNode}
                disabled={dataRunDisabled}
                title="Run cell (Shift+Enter)"
              >
                <Play size={18} weight={selectedNodeStatus === 'running' ? 'fill' : 'regular'} />
              </button>
              {onRunDownstreamSelectedNode && (
                <button
                  type="button"
                  className={`${baseButtonClass} ${downstreamDisabled ? disabledButtonClass : ''}`}
                  onClick={onRunDownstreamSelectedNode}
                  disabled={downstreamDisabled}
                  title="Run downstream (Ctrl+Shift+Enter)"
                >
                  <ArrowRight size={18} weight="regular" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (!root) return null;
  return createPortal(card, root);
});
