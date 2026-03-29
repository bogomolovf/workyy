'use client';

import {
  ArrowRight,
  ChatCircle,
  ChartBar,
  Code,
  Cursor,
  Cylinder,
  Database,
  Eraser,
  FileArrowUp,
  Microphone,
  Notebook,
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
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../hooks/useTranslation';
import type { NodeStatus } from '../state/executionStore';
import type { ShapeType } from './flowNodes/ShapeNode';
import { ShapePalette } from './ShapePalette';

export type CanvasTool =
  | 'hand'
  | 'select'
  | 'note'
  | 'pen'
  | 'text'
  | 'shape'
  | 'eraser'
  | 'voice'
  | 'comment';

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
  onAddDatabaseNode?: () => void;
  onAddPlotNode?: () => void;
  onAddVoiceNode?: () => void;
  onAddPythonCell?: () => void;
  onAddSqlCell?: () => void;
  onAddMarkdownCell?: () => void;
  onUploadSpreadsheet?: (file: File) => void;
  onUploadNotebook?: (file: File) => void;
  onDeleteSelection?: () => void;
  hasSelection?: boolean;
  portalRoot?: HTMLElement | null;
};

/* ── Canvas drawing tools ─────────────────────────────── */
const canvasToolIds: Array<{ id: CanvasTool; icon: typeof Cursor; hotkey: string }> = [
  { id: 'select', icon: Cursor, hotkey: 'V' },
  { id: 'note', icon: NotePencil, hotkey: 'N' },
  { id: 'pen', icon: PencilSimple, hotkey: 'P' },
  { id: 'text', icon: TextT, hotkey: 'T' },
  { id: 'shape', icon: SquaresFour, hotkey: 'S' },
];

const TOOL_LABEL_KEYS: Record<
  string,
  'toolSelect' | 'toolSticky' | 'toolPen' | 'toolText' | 'toolShape' | 'toolVoice'
> = {
  select: 'toolSelect',
  note: 'toolSticky',
  pen: 'toolPen',
  text: 'toolText',
  shape: 'toolShape',
  voice: 'toolVoice',
};

const statusToneClasses: Record<NodeStatus, string> = {
  idle: 'bg-slate-100 text-slate-600 border border-slate-200',
  running: 'bg-amber-100 text-amber-700 border border-amber-200',
  success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  error: 'bg-rose-100 text-rose-700 border border-rose-200',
};

const STATUS_LABEL_KEYS: Record<
  NodeStatus,
  'statusIdle' | 'statusRunning' | 'statusSuccess' | 'statusError'
> = {
  idle: 'statusIdle',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusError',
};

function StatusPill({ status, label }: { status: NodeStatus; label: string }) {
  return (
    <span
      className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide ${statusToneClasses[status]}`}
    >
      {status === 'running' && <SpinnerGap className="animate-spin" size={12} weight="bold" />}
      {label}
    </span>
  );
}

const TOOLTIP_DELAY = 150;

/* ── Divider between groups ───────────────────────────── */
function Divider() {
  return <div className="h-6 w-px bg-slate-200" />;
}

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
  onAddDatabaseNode,
  onAddPlotNode,
  onAddVoiceNode,
  onAddPythonCell,
  onAddSqlCell,
  onAddMarkdownCell,
  onUploadSpreadsheet,
  onUploadNotebook,
  onDeleteSelection,
  hasSelection,
  portalRoot,
}: BoardCommandBarProps) {
  const { t } = useTranslation();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [isShapePaletteOpen, setIsShapePaletteOpen] = useState(false);
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notebookInputRef = useRef<HTMLInputElement>(null);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadSpreadsheet) {
      onUploadSpreadsheet(file);
    }
    e.target.value = '';
  };

  const handleNotebookUploadClick = () => {
    notebookInputRef.current?.click();
  };

  const handleNotebookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadNotebook) {
      onUploadNotebook(file);
    }
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

  // Close shape palette when tool changes
  useEffect(() => {
    if (currentTool !== 'shape') {
      setIsShapePaletteOpen(false);
    }
  }, [currentTool]);

  // Close shape palette on outside click
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

  const btnBase =
    'grid h-8 w-8 place-items-center rounded-lg border border-transparent text-slate-700 transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';
  const btnActive =
    'bg-indigo-600 text-white border-indigo-600 shadow-[0_4px_12px_rgba(79,70,229,0.3)]';
  const btnDisabled = 'opacity-50 cursor-not-allowed hover:bg-transparent';
  const btnDanger = 'text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600';

  const card = (
    <div className={`pointer-events-none ${positioningClass}`} data-board-command-bar="true">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
        {/* ── Group 1: Canvas Tools (Select, Note, Pen, Text, Shape) ── */}
        <div className="flex items-center gap-0.5">
          {canvasToolIds.map((tool) => {
            const Icon = tool.icon;
            const isActive = currentTool === tool.id;
            const isShapeTool = tool.id === 'shape';
            const label = TOOL_LABEL_KEYS[tool.id] ? t[TOOL_LABEL_KEYS[tool.id]] : tool.id;

            return (
              <div key={tool.id} className="relative">
                <button
                  ref={isShapeTool ? shapeButtonRef : undefined}
                  type="button"
                  className={`${btnBase} ${isActive ? btnActive : ''}`}
                  onClick={() => {
                    if (isShapeTool) {
                      if (isActive) {
                        if (isShapePaletteOpen) {
                          setIsShapePaletteOpen(false);
                          onChangeTool('hand');
                        } else {
                          setIsShapePaletteOpen(true);
                        }
                      } else {
                        onChangeTool(tool.id);
                        setIsShapePaletteOpen(true);
                      }
                      return;
                    }
                    if (isActive) {
                      onChangeTool('hand');
                    } else {
                      onChangeTool(tool.id);
                    }
                    setIsShapePaletteOpen(false);
                  }}
                  title={`${label} (${tool.hotkey.toUpperCase()})`}
                  data-delay={TOOLTIP_DELAY}
                >
                  <Icon size={17} weight={isActive ? 'fill' : 'regular'} />
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

          {/* Eraser */}
          <button
            type="button"
            className={`${btnBase} ${currentTool === 'eraser' ? btnActive : ''}`}
            onClick={() => {
              if (currentTool === 'eraser') {
                onChangeTool('hand');
              } else {
                onChangeTool('eraser');
              }
              setIsShapePaletteOpen(false);
            }}
            title={`${t.toolEraser} (E)`}
          >
            <Eraser size={17} weight={currentTool === 'eraser' ? 'fill' : 'regular'} />
          </button>
        </div>

        <Divider />

        {/* ── Group 2: Collaboration (Voice, Comment) ── */}
        <div className="flex items-center gap-0.5">
          {onAddVoiceNode && (
            <button
              type="button"
              className={`${btnBase} ${currentTool === 'voice' ? btnActive : ''}`}
              onClick={() => {
                if (currentTool === 'voice') {
                  onChangeTool('hand');
                } else {
                  onChangeTool('voice');
                }
              }}
              title={`${t.toolVoice} (M)`}
            >
              <Microphone size={17} weight={currentTool === 'voice' ? 'fill' : 'regular'} />
            </button>
          )}
          <button
            type="button"
            className={`${btnBase} ${currentTool === 'comment' ? btnActive : ''}`}
            onClick={() => {
              if (currentTool === 'comment') {
                onChangeTool('hand');
              } else {
                onChangeTool('comment');
              }
            }}
            title="Comment (C)"
          >
            <ChatCircle size={17} weight={currentTool === 'comment' ? 'fill' : 'regular'} />
          </button>
        </div>

        <Divider />

        {/* ── Group 3: Data & Code (SQL Cell, Python Cell, Database, Plot) ── */}
        <div className="flex items-center gap-0.5">
          {onAddSqlCell && (
            <button
              type="button"
              className={`${btnBase} relative`}
              onClick={onAddSqlCell}
              title={t.sqlCell}
            >
              <Database size={17} weight="regular" />
              <Plus
                size={9}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-px"
              />
            </button>
          )}
          {onAddPythonCell && (
            <button
              type="button"
              className={`${btnBase} relative`}
              onClick={onAddPythonCell}
              title={t.pythonCell}
            >
              <Code size={17} weight="regular" />
              <Plus
                size={9}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-px"
              />
            </button>
          )}
          {onAddDatabaseNode && (
            <button
              type="button"
              className={`${btnBase} relative`}
              onClick={onAddDatabaseNode}
              title={t.addDatabaseNode}
            >
              <Cylinder size={17} weight="regular" />
              <Plus
                size={9}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-px"
              />
            </button>
          )}
          {onAddPlotNode && (
            <button
              type="button"
              className={`${btnBase} relative`}
              onClick={onAddPlotNode}
              title={t.addPlotNode}
            >
              <ChartBar size={17} weight="regular" />
              <Plus
                size={9}
                weight="bold"
                className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-px"
              />
            </button>
          )}
        </div>

        <Divider />

        {/* ── Group 4: Import (CSV/Excel, Notebook) ── */}
        <div className="flex items-center gap-0.5">
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
                className={`${btnBase} relative`}
                onClick={handleFileUploadClick}
                title={t.uploadCsvExcel}
              >
                <FileArrowUp size={17} weight="regular" />
                <Plus
                  size={9}
                  weight="bold"
                  className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-px"
                />
              </button>
            </>
          )}
          {onUploadNotebook && (
            <>
              <input
                ref={notebookInputRef}
                type="file"
                accept=".ipynb,application/x-ipynb+json"
                onChange={handleNotebookFileChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={`${btnBase} relative`}
                onClick={handleNotebookUploadClick}
                title={t.uploadNotebook ?? 'Upload Jupyter Notebook'}
              >
                <Notebook size={17} weight="regular" />
                <Plus
                  size={9}
                  weight="bold"
                  className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white rounded-full p-px"
                />
              </button>
            </>
          )}
        </div>

        {/* ── Delete selection (contextual) ── */}
        {onDeleteSelection && hasSelection && (
          <>
            <Divider />
            <button
              type="button"
              className={`${btnBase} ${btnDanger}`}
              onClick={onDeleteSelection}
              title={t.deleteSelection}
            >
              <Trash size={17} weight="regular" />
            </button>
          </>
        )}

        {/* ── Group 5: Execution controls (contextual — shown when data node selected) ── */}
        {showDataCluster && selectedNodeStatus && (
          <>
            <Divider />
            <div className="flex items-center gap-1">
              {NodeTypeIcon && (
                <span
                  className={`${btnBase}`}
                  title={selectedNodeType === 'sql' ? t.sqlCell : t.pythonCell}
                >
                  <NodeTypeIcon size={15} weight="regular" />
                </span>
              )}
              <StatusPill
                status={selectedNodeStatus}
                label={t[STATUS_LABEL_KEYS[selectedNodeStatus]]}
              />
              <button
                type="button"
                className={`${btnBase} ${dataRunDisabled ? btnDisabled : ''}`}
                onClick={onRunSelectedNode}
                disabled={dataRunDisabled}
                title={t.runCell}
              >
                <Play size={17} weight={selectedNodeStatus === 'running' ? 'fill' : 'regular'} />
              </button>
              {onRunDownstreamSelectedNode && (
                <button
                  type="button"
                  className={`${btnBase} ${downstreamDisabled ? btnDisabled : ''}`}
                  onClick={onRunDownstreamSelectedNode}
                  disabled={downstreamDisabled}
                  title={t.runDownstream}
                >
                  <ArrowRight size={17} weight="regular" />
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
