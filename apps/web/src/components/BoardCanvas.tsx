'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Connection,
  OnConnectStartParams,
  Edge,
  EdgeChange,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  NodeChange,
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
  applyNodeChanges,
  NodeResizer,
  useReactFlow,
  useViewport,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { type UploadedFile } from '../lib/api';
import {
  getDefaultNodeWidth,
  useCanvasLayoutStore,
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
  type CanvasLayoutState,
} from '../state/canvasLayoutStore';
import type { ExecutionEntry, NodeStatus, ExecutionStoreState } from '../state/executionStore';
import { useExecutionStore } from '../state/executionStore';
import { useAddNode } from '../state/useAddNode';
import { BoardCommandBar, type CanvasTool } from './BoardCommandBar';
import { BoardInspector } from './BoardInspector';
import { ConnectionArrow } from './ConnectionArrow';
import {
  resolveConnectionEndpoints,
  type ConnectionOrigin,
  findNearestHandleId,
} from './connectionUtils';
import { FileDropOverlay } from './FileDropOverlay';
import CustomConnectionLine from './flowEdges/CustomConnectionLine';
import { DatabaseNode } from './flowNodes/DatabaseNode';
import { InteractiveResultTable } from './InteractiveResultTable';
import { PlotPreview } from './PlotPreview';
import { FreehandOverlay } from './pen/FreehandOverlay';
import { ShapeDragOverlay } from './shape/ShapeDragOverlay';
import { PenNode } from './pen/PenNode';
import { PenToolbar } from './pen/PenToolbar';
import { EraserOverlay } from './pen/EraserOverlay';
// Undo/Redo now handled at page level via Yjs UndoManager (per-user undo)
import { TextNode } from './TextNode';
import { PlotNode } from './flowNodes/PlotNode';
import { CsvNode } from './flowNodes/CsvNode';
import ShapeNode, { type ShapeType } from './flowNodes/ShapeNode';
import { VoiceNode } from './flowNodes/VoiceNode';
import { ImageNode } from './flowNodes/ImageNode';
import { VideoNode } from './flowNodes/VideoNode';
import { DocumentNode } from './flowNodes/DocumentNode';
import CollaborativeCursors from './CollaborativeCursors';
import { useCursorStateSynced } from '../hooks/useCursorStateSynced';
import { EditingPresenceProvider } from '../context/EditingPresenceContext';
import { canvasNodeToReactFlowNode } from '../lib/yjs/adapters';
import { parseSpreadsheetFile } from '../lib/spreadsheetParser';
import { registerDatasetFromCsvNode } from '../lib/duckdbClient';

// SessionStorage-backed cache for voice audio data
// Persists across HMR, re-renders, and component remounts (until tab close)
const VOICE_AUDIO_STORAGE_KEY = 'workyy_voice_audio_cache';

const getVoiceAudioFromStorage = (nodeId: string): { audioData: string; duration: number; mimeType: string } | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const cached = sessionStorage.getItem(`${VOICE_AUDIO_STORAGE_KEY}_${nodeId}`);
    return cached ? JSON.parse(cached) : undefined;
  } catch { return undefined; }
};

const setVoiceAudioToStorage = (nodeId: string, data: { audioData: string; duration: number; mimeType: string }) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${VOICE_AUDIO_STORAGE_KEY}_${nodeId}`, JSON.stringify(data));
  } catch { /* quota exceeded or other error */ }
};

const getVoiceAudioKeysFromStorage = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(VOICE_AUDIO_STORAGE_KEY + '_')) {
        keys.push(key.replace(VOICE_AUDIO_STORAGE_KEY + '_', ''));
      }
    }
    return keys;
  } catch { return []; }
};

// Wrapper object to match previous API
const globalVoiceAudioCache = {
  get: getVoiceAudioFromStorage,
  set: setVoiceAudioToStorage,
  keys: getVoiceAudioKeysFromStorage,
  get size() { return getVoiceAudioKeysFromStorage().length; }
};

const MonacoEditor = dynamic(async () => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-32 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-xs text-slate-400">
      Loading editor…
    </div>
  ),
});

type CanvasNodeType =
  | 'sql'
  | 'python'
  | 'table'
  | 'plot'
  | 'note'
  | 'text'
  | 'shape'
  | 'image'
  | 'video'
  | 'document'
  | 'pen'
  | 'database'
  | 'voice';

type BoardCanvasProps = {
  board: {
    id: string;
    workspaceId: string;
    title: string;
    userInfo?: { userId?: string; userName?: string };
  };
  nodes: Array<{
    id: string;
    boardId?: string;
    type: CanvasNodeType;
    position: { x: number; y: number };
    payload?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }>;
  executionEntries: Record<string, ExecutionEntry | undefined>;
  onCodeChange: (nodeId: string, code: string) => void;
  onRunNode: (nodeId: string) => void;
  onRunNodeFull?: (nodeId: string) => void; // Run without preview limit (load all data)
  onRunDownstream: (nodeId: string) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onNodesChange?: (nodes: BoardCanvasProps['nodes']) => void;
  onEdgesChange?: (edges: BoardCanvasProps['edges']) => void;
  yjsOnNodesChange?: (changes: NodeChange[]) => void; // Direct Yjs handler for ReactFlow format
  yjsOnEdgesChange?: (changes: EdgeChange[]) => void; // Direct Yjs handler for ReactFlow format
  cursorsMap?: any; // YMap for cursors (from Yjs)
  editingMap?: any; // YMap for editing presence (from Yjs)
  clientId?: string; // Client ID for cursor tracking
  userInfo?: { userId?: string; userName?: string }; // User information for cursor display
  /** Called when a CSV node is added via spreadsheet upload; syncs dataset to Yjs so Load more / Plot work */
  onCsvDatasetAdded?: (dataset: {
    tableName: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
  }) => void;
};

type NodeData = {
  nodeId: string;
  nodeType: 'sql' | 'python';
  nodeKind: 'sql' | 'python' | 'table' | 'plot';
  execution?: ExecutionEntry;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onRunFull?: () => void; // Load all data without preview limit
  onRunDownstream: () => void;
  width: number;
  isCodeCollapsed: boolean;
  onToggleCodeCollapsed: () => void;
};

const statusColors: Record<NodeStatus, string> = {
  idle: 'border-slate-200',
  running: 'border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.18)]',
  success: 'border-emerald-300 shadow-[0_0_14px_rgba(34,197,94,0.18)]',
  error: 'border-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.2)]',
};

export const DATA_NODE_HANDLE_CLASS = '!h-3 !w-3 !bg-slate-400';
const dataNodeHandles = [
  { id: 'left', type: 'target' as const, position: Position.Left },
  { id: 'top', type: 'target' as const, position: Position.Top },
  { id: 'right', type: 'source' as const, position: Position.Right },
  { id: 'bottom', type: 'source' as const, position: Position.Bottom },
];

export function DataNodeHandles({ selected }: { selected?: boolean }) {
  return (
    <>
      {dataNodeHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          className={DATA_NODE_HANDLE_CLASS}
          data-handle-id={handle.id}
          style={{ opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }}
        />
      ))}
    </>
  );
}

function getNodeColor(type: string) {
  switch (type) {
    case 'sql':
      return '#3b82f6';
    case 'python':
      return '#22c55e';
    case 'plot':
      return '#a855f7';
    default:
      return '#f97316';
  }
}

function createEdgeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function StatusBadge({ status }: { status: NodeStatus }) {
  const text =
    status === 'idle'
      ? 'IDLE'
      : status === 'running'
        ? 'RUNNING'
        : status === 'success'
          ? 'SUCCESS'
          : 'ERROR';
  const tone =
    status === 'running'
      ? 'bg-amber-100 text-amber-600 border border-amber-200'
      : status === 'success'
        ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
        : status === 'error'
          ? 'bg-rose-100 text-rose-600 border border-rose-200'
          : 'bg-slate-200 text-slate-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{text}</span>
  );
}

function ErrorMessage({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="relative mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
      {onDismiss && (
        <button
          type="button"
          className="absolute right-2 top-1 text-rose-400 transition hover:text-rose-600"
          aria-label="Hide error"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
      {message}
    </div>
  );
}

function StdoutBlock({
  title,
  content,
  tone,
  onDismiss,
}: {
  title: string;
  content: string;
  tone: 'stdout' | 'stderr' | 'warning';
  onDismiss?: () => void;
}) {
  const styles =
    tone === 'stderr'
      ? 'border border-rose-200 bg-rose-50 text-rose-600'
      : tone === 'warning'
        ? 'border border-amber-200 bg-amber-50 text-amber-700'
        : 'border border-slate-200 bg-slate-100 text-slate-600';
  return (
    <div className={`relative rounded-lg px-4 py-2 text-xs ${styles}`}>
      {onDismiss && (
        <button
          type="button"
          className="absolute right-2 top-1 text-slate-400 transition hover:text-slate-600"
          aria-label="Hide output"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{title}</div>
      <pre className="max-h-40 whitespace-pre-wrap break-words">{content}</pre>
    </div>
  );
}

const SqlNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  // Fetch execution state directly from store
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
      style={{ width: data.width, minHeight: 320 }}
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
        onMouseDown={(e) => {
          // Предотвращаем dragging узла при взаимодействии с редактором
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          // Предотвращаем dragging узла при взаимодействии с редактором
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          // Предотвращаем drag события на редакторе
          e.preventDefault();
        }}
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

const PythonNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  // Fetch execution state directly from store
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
      style={{ width: data.width, minHeight: 320 }}
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
        onMouseDown={(e) => {
          // Предотвращаем dragging узла при взаимодействии с редактором
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          // Предотвращаем dragging узла при взаимодействии с редактором
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          // Предотвращаем drag события на редакторе
          e.preventDefault();
        }}
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

// Define nodeTypes outside component to prevent React Flow warning
// This is the recommended pattern from React Flow documentation
const nodeTypes = {
  sqlNode: SqlNodeComponent,
  pythonNode: PythonNodeComponent,
  pen: PenNode,
  textNode: TextNode,
  databaseNode: DatabaseNode,
  plotNode: PlotNode,
  csvNode: CsvNode,
  shapeNode: ShapeNode, // Заметки теперь тоже shape nodes
  voiceNode: VoiceNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  documentNode: DocumentNode,
};

type ConnectionArrowsOverlayProps = {
  edges: Edge[];
};

function ConnectionArrowsOverlay({ edges }: ConnectionArrowsOverlayProps) {
  const { getNode } = useReactFlow();
  const viewport = useViewport();

  const segments = useMemo(() => {
    const pairs: Array<{
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }> = [];

    for (const edge of edges) {
      const source = getNode(edge.source);
      const target = getNode(edge.target);
      if (!source || !target) continue;
      if (source.hidden || target.hidden) continue;
      const sourceWidth = source.width ?? 0;
      const sourceHeight = source.height ?? 0;
      const targetWidth = target.width ?? 0;
      const targetHeight = target.height ?? 0;
      const sourcePos = source.positionAbsolute ?? source.position ?? { x: 0, y: 0 };
      const targetPos = target.positionAbsolute ?? target.position ?? { x: 0, y: 0 };

      pairs.push({
        id: edge.id,
        from: {
          x: sourcePos.x + sourceWidth / 2,
          y: sourcePos.y + sourceHeight / 2,
        },
        to: {
          x: targetPos.x + targetWidth / 2,
          y: targetPos.y + targetHeight / 2,
        },
      });
    }

    return pairs;
  }, [edges, getNode]);

  if (segments.length === 0) {
    return null;
  }

  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      style={{ transform, transformOrigin: '0 0' }}
      role="presentation"
    >
      {segments.map((segment) => (
        <ConnectionArrow key={segment.id} id={segment.id} from={segment.from} to={segment.to} />
      ))}
    </svg>
  );
}

export function BoardCanvas({
  nodes,
  edges,
  board,
  executionEntries,
  onCodeChange,
  onRunNode,
  onRunNodeFull,
  onRunDownstream,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
  onEdgesChange,
  yjsOnNodesChange,
  yjsOnEdgesChange,
  cursorsMap,
  editingMap,
  clientId,
  onCsvDatasetAdded,
}: BoardCanvasProps) {
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const inspectorEntry = selectedNode ? executionEntries[selectedNode.id] : undefined;
  const inspectorKind =
    selectedNode &&
    (selectedNode.type === 'sql' || selectedNode.type === 'python' || selectedNode.type === 'plot')
      ? selectedNode.type
      : null;
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);

  // Сбрасываем состояние свернутости, когда инспектор закрывается (меняется выбранный узел)
  useEffect(() => {
    if (!inspectorKind || !selectedNode) {
      setInspectorCollapsed(true);
    }
  }, [inspectorKind, selectedNode]);

  // Вычисляем ширину инспектора: 480px когда открыт, 0px когда закрыт (кнопка выходит за пределы)
  const inspectorWidth = inspectorKind && selectedNode ? (inspectorCollapsed ? 0 : 480) : 0;

  return (
    <ReactFlowProvider>
      <EditingPresenceProvider
        editingMap={editingMap}
        clientId={clientId}
        userInfo={board.userInfo ? { ...board.userInfo, color: '#6366f1' } : undefined}
      >
        <div className="flex h-full w-full flex-1 min-h-0">
          <InnerBoardCanvas
            board={board}
            nodes={nodes}
            edges={edges}
            executionEntries={executionEntries}
            onCodeChange={onCodeChange}
            onRunNode={onRunNode}
            onRunNodeFull={onRunNodeFull}
            onRunDownstream={onRunDownstream}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            yjsOnNodesChange={yjsOnNodesChange}
            yjsOnEdgesChange={yjsOnEdgesChange}
            cursorsMap={cursorsMap}
            editingMap={editingMap}
            clientId={clientId}
            userInfo={board.userInfo}
            onCsvDatasetAdded={onCsvDatasetAdded}
          />
        {/* Всегда резервируем фиксированную ширину для инспектора, чтобы тулбары не перескакивали */}
        <div
          className="flex-none transition-all duration-200"
          style={{
            width: `${inspectorWidth}px`,
            minWidth: `${inspectorWidth}px`,
            maxWidth: `${inspectorWidth}px`,
          }}
        >
          {inspectorKind && selectedNode ? (
            <BoardInspector
              nodeLabel={
                (selectedNode.payload?.label as string | undefined) ??
                `${inspectorKind === 'sql' ? 'SQL' : inspectorKind === 'python' ? 'Python' : 'Plot'} ${selectedNode.id.slice(0, 6)}`
              }
              kind={inspectorKind}
              status={inspectorEntry?.status ?? 'idle'}
              error={inspectorEntry?.error}
              lastStartedAt={inspectorEntry?.startedAt}
              lastFinishedAt={inspectorEntry?.finishedAt}
              code={inspectorEntry?.code ?? ''}
              onChange={(value) => onCodeChange(selectedNode.id, value ?? '')}
              onCollapseChange={setInspectorCollapsed}
              result={
                inspectorKind === 'sql'
                  ? inspectorEntry?.output?.kind === 'sql'
                    ? inspectorEntry.output.result
                    : undefined
                  : inspectorKind === 'python'
                    ? inspectorEntry?.output?.kind === 'python'
                      ? inspectorEntry.output.result
                      : undefined
                    : undefined
              }
              nodeId={selectedNode.id}
              nodes={nodes}
              edges={edges}
              executionEntries={executionEntries}
              onPlotConfigChange={
                inspectorKind === 'plot'
                  ? (nodeId, newPayload) => {
                      // Update nodes through onNodesChange callback
                      const updatedNodes = nodes.map((n) =>
                        n.id === nodeId
                          ? {
                              ...n,
                              payload: {
                                ...(n.payload ?? {}),
                                ...newPayload,
                              },
                            }
                          : n,
                      );
                      onNodesChange?.(updatedNodes);
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      </div>
      </EditingPresenceProvider>
    </ReactFlowProvider>
  );
}

type InnerProps = BoardCanvasProps;

function InnerBoardCanvas({
  board,
  nodes,
  edges,
  executionEntries,
  onCodeChange,
  onRunNode,
  onRunNodeFull,
  onRunDownstream,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
  onEdgesChange,
  yjsOnNodesChange,
  yjsOnEdgesChange,
  cursorsMap,
  editingMap,
  clientId,
  userInfo,
  onCsvDatasetAdded,
}: InnerProps) {
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const nodeSizes = useCanvasLayoutStore((state: CanvasLayoutState) => state.nodeSizes);
  const setNodeWidth = useCanvasLayoutStore((state: CanvasLayoutState) => state.setNodeWidth);
  const codeCollapsedMap = useCanvasLayoutStore((state: CanvasLayoutState) => state.codeCollapsed);
  const toggleCodeCollapsed = useCanvasLayoutStore(
    (state: CanvasLayoutState) => state.toggleCodeCollapsed,
  );
  const registerNode = useExecutionStore((state: ExecutionStoreState) => state.registerNode);
  const addNodeHelpers = useAddNode();
  const rf = useReactFlow();
  const connectOriginRef = useRef<ConnectionOrigin | null>(null);
  const connectionCreatedRef = useRef<boolean>(false);
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseMoveCleanupRef = useRef<(() => void) | null>(null);

  // Track if cursor is hovering over toolbars (Controls, MiniMap, BoardCommandBar, PenToolbar)
  // When hovering toolbars, hide own cursor but keep updating position for other users
  const [isHoveringToolbar, setIsHoveringToolbar] = useState(false);

  // Tool state - defined early because it's needed for cursor visibility
  const [tool, setTool] = useState<CanvasTool>('hand');

  // Use cursor syncing hook (must be inside ReactFlowProvider)
  // Hide own cursor when hovering toolbars (like Miro behavior)
  // Also hide own cursor when using eraser (eraser has its own cursor indicator)
  // Show own cursor normally, but hide it when hovering over toolbars or using eraser
  const showOwnCursor = !isHoveringToolbar && tool !== 'eraser';
  const [cursors, onMouseMove] = cursorsMap && clientId
    ? useCursorStateSynced(cursorsMap, clientId, userInfo, { showOwnCursor })
    : ([[], () => {}] as const);

  // Editing presence is provided via EditingPresenceProvider context
  // Individual nodes use useNodeEditing hook to access editing state

  // Debug logging for cursor synchronization
  useEffect(() => {
    if (cursorsMap && clientId && process.env.NODE_ENV === 'development') {
      const allCursorsInMap = [...cursorsMap.values()];
      console.log('[CursorSync] Initialized:', {
        clientId,
        cursorsCount: cursors.length,
        cursorsMapSize: cursorsMap.size,
        allCursorsInMap: allCursorsInMap.map((c) => ({
          id: c.id,
          hasUserName: !!c.userName,
          timestamp: c.timestamp,
        })),
        showOwnCursor,
        userInfo,
      });
    }
  }, [cursorsMap, clientId, cursors.length, showOwnCursor, userInfo]);

  const [localNodes, setLocalNodes] = useState(nodes);
  const localNodesRef = useRef(localNodes);
  /** Ids we just deleted locally; avoid restoring them when nodes prop is still stale (Yjs observer not yet applied). */
  const recentlyDeletedIdsRef = useRef<Set<string>>(new Set());
  const [localEdges, setLocalEdges] = useState(edges);
  const textNodeResizeTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const shapeNodeResizeTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Undo/Redo now handled at page level via Yjs UndoManager (per-user undo)
  // Changes are automatically tracked through Yjs transactions with clientId origin

  // Voice audio data is stored in globalVoiceAudioCache (module-level)
  // to persist across component remounts

  useEffect(() => {
    // Merge incoming nodes with local state, using ref for voice audio data
    const merged = nodes.map((incomingNode) => {
      // For voice nodes, check if we have cached audioData in ref
      if (incomingNode.type === 'voice') {
        const incomingPayload = (incomingNode.payload ?? {}) as Record<string, unknown>;
        const cachedAudio = globalVoiceAudioCache.get(incomingNode.id);
        
        // If incoming has audioData, update cache
        if (incomingPayload.audioData) {
          globalVoiceAudioCache.set(incomingNode.id, {
            audioData: incomingPayload.audioData as string,
            duration: (incomingPayload.duration as number) || 0,
            mimeType: (incomingPayload.mimeType as string) || 'audio/webm',
          });
          return incomingNode;
        }
        
        // If we have cached audioData but incoming doesn't, use cached
        if (cachedAudio && !incomingPayload.audioData) {
          return {
            ...incomingNode,
            payload: {
              ...incomingPayload,
              audioData: cachedAudio.audioData,
              duration: cachedAudio.duration,
              mimeType: cachedAudio.mimeType,
            },
          };
        }
      }
      
      return incomingNode;
    });
    // Don't restore nodes we just deleted: nodes prop can be stale (Yjs observer not yet applied).
    const filtered = merged.filter((n) => !recentlyDeletedIdsRef.current.has(n.id));
    // Clear deleted id from ref once it's no longer in prop (Yjs caught up)
    const nodeIdSet = new Set(nodes.map((n) => n.id));
    const toClear: string[] = [];
    recentlyDeletedIdsRef.current.forEach((id) => {
      if (!nodeIdSet.has(id)) toClear.push(id);
    });
    toClear.forEach((id) => recentlyDeletedIdsRef.current.delete(id));
    setLocalNodes(() => filtered);
  }, [nodes]);

  useEffect(() => {
    localNodesRef.current = localNodes;
  }, [localNodes]);

  // Cleanup для таймеров ресайза text и shape nodes при размонтировании
  useEffect(() => {
    return () => {
      textNodeResizeTimerRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      textNodeResizeTimerRef.current.clear();
      shapeNodeResizeTimerRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      shapeNodeResizeTimerRef.current.clear();
    };
  }, []);

  // Helper to notify parent AFTER current render tick to avoid render-phase setState warning
  const lastEmittedRef = useRef<string>('');
  const sanitizeExternalNodes = useCallback((arr: BoardCanvasProps['nodes']) => {
    return arr.map((n) => {
      const id =
        (typeof n.id === 'string' && n.id) ||
        (typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `node_${Date.now()}`);
      const position = {
        x: Number.isFinite(Number((n as any).position?.x)) ? Number((n as any).position?.x) : 0,
        y: Number.isFinite(Number((n as any).position?.y)) ? Number((n as any).position?.y) : 0,
      };
      const type = (
        n.type === 'sticky' ? ('note' as const) : (n.type as any)
      ) as BoardCanvasProps['nodes'][number]['type'];
      const basePayload = (n.payload && typeof n.payload === 'object' ? n.payload : {}) as Record<
        string,
        unknown
      >;
      const payload =
        type === 'note'
          ? {
              ...(basePayload ?? {}),
              text:
                typeof (basePayload as any).text === 'string'
                  ? (basePayload as any).text
                  : ((basePayload as any).noteContent ?? ''),
              // дублируем ключ для обратной совместимости с бэком, если он ожидает другое имя
              noteContent:
                typeof (basePayload as any).noteContent === 'string'
                  ? (basePayload as any).noteContent
                  : typeof (basePayload as any).text === 'string'
                    ? (basePayload as any).text
                    : '',
            }
          : basePayload;
      return { id, type, position, payload };
    });
  }, []);
  const sanitizeExternalEdges = useCallback((arr: BoardCanvasProps['edges']) => {
    const nodeIds = new Set((localNodesRef.current ?? []).map((n) => n.id));
    return arr
      .filter((e) => !!e.id && !!e.sourceId && !!e.targetId)
      .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
      .map((e) => ({
        id: String(e.id),
        sourceId: String(e.sourceId),
        targetId: String(e.targetId),
        metadata: e.metadata ?? {},
      }));
  }, []);

  const emitNodesChange = useCallback(
    (next: BoardCanvasProps['nodes'], shouldSaveToHistory = false) => {
      if (!onNodesChange) return;
      
      // Inject audioData from ref before sanitizing - ensures audio is always saved
      const nodesWithAudio = next.map((node) => {
        if (node.type === 'voice') {
          const cachedAudio = globalVoiceAudioCache.get(node.id);
          if (cachedAudio && !(node.payload as any)?.audioData) {
            return {
              ...node,
              payload: {
                ...(node.payload ?? {}),
                audioData: cachedAudio.audioData,
                duration: cachedAudio.duration,
                mimeType: cachedAudio.mimeType,
              },
            };
          }
        }
        return node;
      });
      
      const sanitized = sanitizeExternalNodes(nodesWithAudio);
      const signature = JSON.stringify(sanitized);
      
      if (signature === lastEmittedRef.current) return;
      lastEmittedRef.current = signature;

      queueMicrotask(() => {
        onNodesChange(sanitized);
      });
    },
    [onNodesChange, sanitizeExternalNodes],
  );

  // Helper function to sync node payload changes through Yjs for real-time collaboration
  // This ensures that changes to node content (text, formatting, etc.) are synchronized
  // between all clients immediately, not just on auto-save
  const syncNodePayloadChange = useCallback(
    (nodeId: string, payloadUpdate: (prevPayload: Record<string, unknown>) => Record<string, unknown>) => {
      // Update local state and sync through Yjs
      setLocalNodes((prev) => {
        const currentNode = prev.find((n) => n.id === nodeId);
        if (!currentNode) return prev;

        const updatedPayload = payloadUpdate(currentNode.payload ?? {});
        const next = prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                payload: updatedPayload,
              }
            : n,
        );

        const updatedNode = next.find((n) => n.id === nodeId);
        if (!updatedNode) return next;

        // Sync through Yjs for real-time collaboration
        // Convert to ReactFlow format and sync immediately
        if (yjsOnNodesChange) {
          const reactFlowNode = canvasNodeToReactFlowNode(updatedNode);
          // Use 'add' type to update existing node (Yjs will merge changes automatically)
          yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
        }

        // Also emit through onNodesChange for compatibility and auto-save
        // Use queueMicrotask to avoid potential issues with state updates
        queueMicrotask(() => {
          emitNodesChange(next);
        });

        return next;
      });
    },
    [yjsOnNodesChange, emitNodesChange],
  );

  // Ref для edges чтобы иметь актуальное значение в callback
  const localEdgesRef = useRef(localEdges);
  useEffect(() => {
    localEdgesRef.current = localEdges;
  }, [localEdges]);
  const lastEdgesEmittedRef = useRef<string>('');
  const emitEdgesChange = useCallback(
    (next: BoardCanvasProps['edges']) => {
      if (!onEdgesChange) return;
      const sanitized = sanitizeExternalEdges(next);
      const sig = JSON.stringify(sanitized);
      if (sig === lastEdgesEmittedRef.current) return;
      lastEdgesEmittedRef.current = sig;
      queueMicrotask(() => onEdgesChange(sanitized));
    },
    [onEdgesChange, sanitizeExternalEdges],
  );

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges]);

  const [selectedShape, setSelectedShape] = useState<ShapeType | null>('rectangle');
  const isHandMode = tool === 'hand';
  const isSelectMode = tool === 'select';
  const isStickyMode = tool === 'note';
  const isPenMode = tool === 'pen';
  const isEraserMode = tool === 'eraser';
  const isTextMode = tool === 'text';
  const isShapeMode = tool === 'shape';
  const isVoiceMode = tool === 'voice';

  // Автоматически выбираем rectangle при переключении на режим shape
  useEffect(() => {
    if (tool === 'shape' && !selectedShape) {
      setSelectedShape('rectangle');
    }
  }, [tool, selectedShape]);

  // CRITICAL FIX for Bug 2: Force hide system cursor on all ReactFlow elements
  // This prevents the hand icon from appearing simultaneously with collaborative cursors
  // Works in ALL modes, not just pen mode, because the bug can occur in any mode
  // CRITICAL: Do NOT hide cursor on body - only hide it inside ReactFlow container
  // This allows standard browser cursor to show outside the canvas area (header, buttons, etc.)
  useEffect(() => {
    const forceHideCursor = () => {
      const reactFlowContainer = document.querySelector('.react-flow');
      const reactFlowPane = document.querySelector('.react-flow__pane');
      const reactFlowNodes = document.querySelectorAll('.react-flow__node');
      const reactFlowViewport = document.querySelector('.react-flow__viewport');
      const reactFlowRenderer = document.querySelector('.react-flow__renderer');
      
      // Force hide cursor ONLY on ReactFlow elements, NOT on body
      // This allows standard cursor to show outside the canvas area
      if (reactFlowContainer) {
        (reactFlowContainer as HTMLElement).style.setProperty('cursor', 'none', 'important');
      }
      if (reactFlowPane) {
        (reactFlowPane as HTMLElement).style.setProperty('cursor', 'none', 'important');
      }
      if (reactFlowViewport) {
        (reactFlowViewport as HTMLElement).style.setProperty('cursor', 'none', 'important');
      }
      if (reactFlowRenderer) {
        (reactFlowRenderer as HTMLElement).style.setProperty('cursor', 'none', 'important');
      }
      reactFlowNodes.forEach((node) => {
        (node as HTMLElement).style.setProperty('cursor', 'none', 'important');
        // Also hide cursor on all children of nodes
        const children = node.querySelectorAll('*');
        children.forEach((child) => {
          (child as HTMLElement).style.setProperty('cursor', 'none', 'important');
        });
      });
      
      // Restore standard cursor for Controls and MiniMap (like toolbar)
      const controls = document.querySelector('.react-flow__controls');
      const minimap = document.querySelector('.react-flow__minimap');
      const penToolbar = document.querySelector('[data-pen-toolbar]');
      const commandBar = document.querySelector('[data-board-command-bar]');
      
      if (controls) {
        (controls as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        const controlButtons = controls.querySelectorAll('button');
        controlButtons.forEach((button) => {
          button.style.setProperty('cursor', 'pointer', 'important');
        });
      }
      if (minimap) {
        (minimap as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        const minimapElements = minimap.querySelectorAll('*');
        minimapElements.forEach((el) => {
          (el as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        });
      }
      
      // Restore standard cursor for PenToolbar (pen settings palette)
      if (penToolbar) {
        (penToolbar as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        const penToolbarElements = penToolbar.querySelectorAll('*');
        penToolbarElements.forEach((el) => {
          (el as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        });
      }
      
      // Restore standard cursor for BoardCommandBar
      if (commandBar) {
        (commandBar as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        const commandBarElements = commandBar.querySelectorAll('*');
        commandBarElements.forEach((el) => {
          (el as HTMLElement).style.setProperty('cursor', 'pointer', 'important');
        });
      }
    };

    // Initial hide
    forceHideCursor();

    // Use MutationObserver to watch for ReactFlow class changes on body
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // ReactFlow adds rf-hand-cursor or rf-select-cursor classes to body
          // Force hide cursor whenever these classes change
          forceHideCursor();
        }
      });
    });

    // Observe body for class changes
    const body = document.body;
    if (body) {
      observer.observe(body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    // Also periodically force hide cursor to catch any dynamic changes
    // Reduced interval to 50ms for more aggressive hiding
    const interval = setInterval(() => {
      forceHideCursor();
    }, 50);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      // No need to restore cursor on body since we don't set it anymore
    };
  }, []); // Remove isPenMode dependency - work in all modes

  // CRITICAL FIX: Hide own cursor when hovering over toolbars (Controls, MiniMap, BoardCommandBar, PenToolbar)
  // This matches Miro behavior - cursor disappears for the user but stays visible for others
  // The cursor position continues to update in Yjs, so other users see it at the last canvas position
  useEffect(() => {
    const handleToolbarMouseEnter = () => {
      setIsHoveringToolbar(true);
    };

    const handleToolbarMouseLeave = () => {
      setIsHoveringToolbar(false);
    };

    const attachListeners = () => {
      // Find toolbar elements
      const controls = document.querySelector('.react-flow__controls');
      const minimap = document.querySelector('.react-flow__minimap');
      const commandBar = document.querySelector('[data-board-command-bar]');
      const penToolbar = document.querySelector('[data-pen-toolbar]');

      // Add event listeners to Controls
      if (controls && !controls.hasAttribute('data-cursor-listener')) {
        controls.setAttribute('data-cursor-listener', 'true');
        controls.addEventListener('mouseenter', handleToolbarMouseEnter);
        controls.addEventListener('mouseleave', handleToolbarMouseLeave);
      }

      // Add event listeners to MiniMap
      if (minimap && !minimap.hasAttribute('data-cursor-listener')) {
        minimap.setAttribute('data-cursor-listener', 'true');
        minimap.addEventListener('mouseenter', handleToolbarMouseEnter);
        minimap.addEventListener('mouseleave', handleToolbarMouseLeave);
      }

      // Add event listeners to BoardCommandBar
      if (commandBar && !commandBar.hasAttribute('data-cursor-listener')) {
        commandBar.setAttribute('data-cursor-listener', 'true');
        commandBar.addEventListener('mouseenter', handleToolbarMouseEnter);
        commandBar.addEventListener('mouseleave', handleToolbarMouseLeave);
      }

      // Add event listeners to PenToolbar
      if (penToolbar && !penToolbar.hasAttribute('data-cursor-listener')) {
        penToolbar.setAttribute('data-cursor-listener', 'true');
        penToolbar.addEventListener('mouseenter', handleToolbarMouseEnter);
        penToolbar.addEventListener('mouseleave', handleToolbarMouseLeave);
      }
    };

    // Initial attachment
    attachListeners();

    // Use MutationObserver to catch dynamically rendered toolbars (especially BoardCommandBar via portal)
    const observer = new MutationObserver(() => {
      attachListeners();
    });

    // Observe document body for dynamically added toolbars
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also periodically check (fallback for edge cases)
    const intervalId = setInterval(attachListeners, 500);

    return () => {
      observer.disconnect();
      clearInterval(intervalId);
      
      // Remove all listeners
      document.querySelectorAll('[data-cursor-listener]').forEach((el) => {
        el.removeEventListener('mouseenter', handleToolbarMouseEnter);
        el.removeEventListener('mouseleave', handleToolbarMouseLeave);
      });
    };
  }, []);


  const selectedDataNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = localNodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;
    if (node.type === 'sql' || node.type === 'python' || node.type === 'plot') {
      return node;
    }
    return null;
  }, [selectedNodeId, localNodes]);

  const selectedDataNodeId = selectedDataNode?.id ?? null;
  const selectedDataNodeType = selectedDataNode
    ? (selectedDataNode.type as 'sql' | 'python' | 'plot')
    : null;
  const selectedDataNodeStatus: NodeStatus | undefined = selectedDataNodeId
    ? (executionEntries[selectedDataNodeId]?.status ?? 'idle')
    : undefined;
  const canRunSelectedNode = Boolean(selectedDataNodeId);
  const canRunDownstream = canRunSelectedNode;

  const handleRunSelectedNode = useCallback(() => {
    if (!selectedDataNodeId) return;
    onRunNode(selectedDataNodeId);
  }, [selectedDataNodeId, onRunNode]);

  const handleRunDownstreamSelectedNode = useCallback(() => {
    if (!selectedDataNodeId) return;
    onRunDownstream(selectedDataNodeId);
  }, [selectedDataNodeId, onRunDownstream]);

  // Undo/Redo removed - now handled at page level via Yjs UndoManager (per-user undo)

  // Eraser handler - удаляем узлы и синхронизируем через Yjs
  const handleDeleteNodes = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds || nodeIds.length === 0) return;

      console.log('🧹 Erasing nodes:', nodeIds);

      nodeIds.forEach((id) => recentlyDeletedIdsRef.current.add(id));
      // Sync deletion through Yjs to ensure real-time collaboration
      if (yjsOnNodesChange && nodeIds.length > 0) {
        const removeNodeChanges = nodeIds.map((id) => ({
          type: 'remove' as const,
          id,
        }));
        yjsOnNodesChange(removeNodeChanges);
      }

      setLocalNodes((prev) => {
        const next = prev.filter((n) => !nodeIds.includes(n.id));

        // Уведомляем родителя (history is tracked automatically via Yjs UndoManager)
        queueMicrotask(() => {
          emitNodesChange(next);
        });

        return next;
      });
    },
    [emitNodesChange, localEdges, yjsOnNodesChange],
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (
        target.matches("input, textarea, select, [contenteditable='true']") ||
        target.closest("input, textarea, select, [contenteditable='true'], .monaco-editor")
      ) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Проверяем, не в поле ввода
      if (isEditableTarget(event.target)) {
        // Для undo/redo всегда разрешаем (Ctrl+Z, Cmd+Z)
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'z') {
          // Разрешаем стандартное поведение для полей ввода
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z') {
          // Разрешаем стандартное поведение для полей ввода
          return;
        }
        return;
      }

      if (event.defaultPrevented) return;

      // Undo/Redo keyboard shortcuts now handled at page level via useYjsUndoManager

      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!event.shiftKey) {
          if (key === 'v') {
            setTool('select');
            return;
          }
          if (key === 'n') {
            setTool((prev) => (prev === 'note' ? 'select' : 'note'));
            return;
          }
          if (key === 'p') {
            setTool((prev) => (prev === 'pen' ? 'select' : 'pen'));
            return;
          }
          if (key === 'e') {
            setTool((prev) => (prev === 'eraser' ? 'select' : 'eraser'));
            return;
          }
          if (key === 't') {
            setTool((prev) => (prev === 'text' ? 'select' : 'text'));
            return;
          }
          if (key === 'm') {
            setTool((prev) => (prev === 'voice' ? 'select' : 'voice'));
            return;
          }
        }

        if (event.key === 'Enter' && event.shiftKey && !event.metaKey && !event.ctrlKey) {
          if (canRunSelectedNode) {
            event.preventDefault();
            handleRunSelectedNode();
          }
          return;
        }

        if (
          event.key === 'Enter' &&
          event.shiftKey &&
          (event.metaKey || event.ctrlKey) &&
          canRunDownstream
        ) {
          event.preventDefault();
          handleRunDownstreamSelectedNode();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canRunDownstream,
    canRunSelectedNode,
    handleRunDownstreamSelectedNode,
    handleRunSelectedNode,
    setTool,
  ]);

  const mapNodes = useCallback(() => {
    return (
      localNodes
        .filter((node) => node.type !== 'draw') // draw nodes не отображаются в React Flow (legacy)
        .map((node) => {
          const isSql = node.type === 'sql';
          const isPython = node.type === 'python';
          const isDatabase = node.type === 'database';
          const isPlot = node.type === 'plot';
          const isCsv = node.type === 'csv';
          const isPen = node.type === 'pen';
          const isText = node.type === 'text';
          const isShape = node.type === 'shape';
          const isNote = node.type === 'note'; // Заметки теперь тоже shape nodes
          const isVoice = node.type === 'voice';
          const isImage = node.type === 'image';
          const isVideo = node.type === 'video';
          const isDocument = node.type === 'document';
          const type = isSql
            ? 'sqlNode'
            : isPython
              ? 'pythonNode'
              : isDatabase
                ? 'databaseNode'
                : isPlot
                  ? 'plotNode'
                  : isCsv
                    ? 'csvNode'
                    : isPen
                      ? 'pen'
                      : isText
                        ? 'textNode'
                        : isVoice
                          ? 'voiceNode'
                          : isImage
                            ? 'imageNode'
                            : isVideo
                              ? 'videoNode'
                              : isDocument
                                ? 'documentNode'
                                : isShape || isNote
                                  ? 'shapeNode'
                                  : 'default';

          // Определяем тип слоя для сортировки: data nodes (0) идут раньше, canvas nodes (1) - позже
          const isDataNode = isSql || isPython || isDatabase || isPlot || isCsv;
          const isCanvasNode =
            isPen || isText || isShape || isNote || isVoice || isImage || isVideo || isDocument;

          // NOTE: executionEntries removed - SqlNode/PythonNode fetch their own state via useExecutionStore
          const storedWidth = nodeSizes[node.id]?.width ?? getDefaultNodeWidth();
          const isCodeCollapsed = codeCollapsedMap[node.id] ?? false;

          // Базовые стили для каждого типа
          const baseStyle =
            type === 'default'
              ? { width: 280, borderRadius: 16 }
              : isPen
                ? {
                    width: (node.payload as any)?.initialSize?.width ?? 100,
                    height: (node.payload as any)?.initialSize?.height ?? 100,
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                  }
                : isText
                  ? {
                      width: (node.payload as any)?.ui?.width ?? 240,
                      height: (node.payload as any)?.ui?.height ?? 80,
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                    }
                  : isVoice
                    ? {
                        width: (node.payload as any)?.ui?.width ?? 280,
                        height: (node.payload as any)?.ui?.height ?? 60,
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                      }
                    : isImage
                      ? {
                          width: (node.payload as any)?.width ?? 300,
                          height: (node.payload as any)?.height ?? 300,
                          background: 'transparent',
                          border: 'none',
                          boxShadow: 'none',
                        }
                      : isVideo
                        ? {
                            width: (node.payload as any)?.width ?? 400,
                            height: (node.payload as any)?.height ?? 300,
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                          }
                        : isDocument
                          ? {
                              width: (node.payload as any)?.width ?? 400,
                              height: (node.payload as any)?.height ?? 500,
                              background: 'transparent',
                              border: 'none',
                              boxShadow: 'none',
                            }
                          : isShape || isNote
                            ? {
                                width: isNote
                                  ? ((node.payload as any)?.ui?.width ?? 280)
                                  : ((node.payload as any)?.width ?? 160),
                                height: isNote
                                  ? ((node.payload as any)?.ui?.height ?? 280)
                                  : ((node.payload as any)?.height ?? 96),
                                background: 'transparent',
                                border: 'none',
                                boxShadow: 'none',
                              }
                            : {
                                width: storedWidth,
                                minWidth: MIN_NODE_WIDTH,
                                maxWidth: MAX_NODE_WIDTH,
                              };

          return {
            id: node.id,
            position: node.position,
            type,
            data: isPen
              ? {
                  points: ((node.payload as any)?.points ?? []) as any,
                  initialSize: ((node.payload as any)?.initialSize ?? {
                    width: 100,
                    height: 100,
                  }) as { width: number; height: number },
                  // Передаем все настройки из payload
                  color: (node.payload as any)?.color,
                  strokeWidth: (node.payload as any)?.strokeWidth,
                  opacity: (node.payload as any)?.opacity,
                  smoothing: (node.payload as any)?.smoothing,
                  thinning: (node.payload as any)?.thinning,
                }
              : isText
                ? (() => {
                    const payload = (node.payload ?? {}) as any;
                    const text = payload.text ?? payload.textContent ?? '';
                    const fontSize = payload.fontSize ?? 18;
                    const fontFamily = payload.fontFamily ?? 'Inter, sans-serif';
                    const color = payload.color ?? '#0f172a';
                    const backgroundColor = payload.backgroundColor ?? 'transparent';
                    const textAlign = payload.textAlign ?? 'left';
                    const richContent = payload.richContent ?? payload.richTextHtml ?? null;

                    return {
                      nodeId: node.id,
                      nodeType: 'text' as const,
                      text,
                      fontSize,
                      fontFamily,
                      color,
                      backgroundColor,
                      textAlign,
                      richContentHtml: richContent,
                      onChangeText: (id: string, newText: string) => {
                        syncNodePayloadChange(id, (prevPayload) => ({
                          ...prevPayload,
                          text: newText,
                          textContent: newText,
                        }));
                      },
                      onChangeFormat: (
                        id: string,
                        patch: Partial<{
                          text: string;
                          fontSize: number;
                          fontFamily: string;
                          color: string;
                          backgroundColor?: string;
                          textAlign: 'left' | 'center' | 'right';
                          richContent: string;
                          ui?: { width: number; height: number };
                        }>,
                      ) => {
                        setLocalNodes((prev) => {
                          const next = prev.map((n) =>
                            n.id === id && n.type === 'text'
                              ? {
                                  ...n,
                                  payload: {
                                    ...(n.payload ?? {}),
                                    ...(patch.ui
                                      ? {
                                          ...(n.payload ?? {}),
                                          ui: {
                                            ...((n.payload as any)?.ui ?? {}),
                                            ...patch.ui,
                                          },
                                        }
                                      : {}),
                                    ...Object.fromEntries(
                                      Object.entries(patch).filter(([key]) => key !== 'ui'),
                                    ),
                                  },
                                }
                              : n,
                          );
                          emitNodesChange(next);
                          return next;
                        });
                      },
                      onDeleteNode: (nodeId: string) => {
                        // Удаляем узел из localNodes
                        setLocalNodes((prev) => {
                          const next = prev.filter((n) => n.id !== nodeId);
                          emitNodesChange(next);
                          return next;
                        });
                        // Удаляем из flowNodes
                        setFlowNodes((prev) => prev.filter((n) => n.id !== nodeId));
                        // Снимаем выделение если удаляемый узел был selected
                        if (selectedNodeId === nodeId) {
                          onSelectNode?.(null);
                        }
                      },
                    };
                  })()
                : isImage
                  ? (() => {
                      const payload = (node.payload ?? {}) as any;
                      return {
                        url: payload.url ?? '',
                        originalName: payload.originalName ?? '',
                        fileId: payload.fileId ?? '',
                        caption: payload.caption ?? '',
                        width: payload.width ?? 300,
                        height: payload.height ?? 300,
                        onDelete: (nid: string) => {
                          setLocalNodes((prev) => {
                            const next = prev.filter((n) => n.id !== nid);
                            emitNodesChange(next);
                            return next;
                          });
                          setFlowNodes((prev) => prev.filter((n) => n.id !== nid));
                          if (selectedNodeId === nid) {
                            onSelectNode?.(null);
                          }
                        },
                      };
                    })()
                  : isVideo
                    ? (() => {
                        const payload = (node.payload ?? {}) as any;
                        return {
                          url: payload.url ?? '',
                          originalName: payload.originalName ?? '',
                          fileId: payload.fileId ?? '',
                          width: payload.width ?? 400,
                          height: payload.height ?? 300,
                          onDelete: (nid: string) => {
                            setLocalNodes((prev) => {
                              const next = prev.filter((n) => n.id !== nid);
                              emitNodesChange(next);
                              return next;
                            });
                            setFlowNodes((prev) => prev.filter((n) => n.id !== nid));
                            if (selectedNodeId === nid) {
                              onSelectNode?.(null);
                            }
                          },
                        };
                      })()
                    : isDocument
                      ? (() => {
                          const payload = (node.payload ?? {}) as any;
                          return {
                            url: payload.url ?? '',
                            originalName: payload.originalName ?? '',
                            fileId: payload.fileId ?? '',
                            mimeType: payload.mimeType ?? '',
                            width: payload.width ?? 400,
                            height: payload.height ?? 500,
                            onDelete: (nid: string) => {
                              setLocalNodes((prev) => {
                                const next = prev.filter((n) => n.id !== nid);
                                emitNodesChange(next);
                                return next;
                              });
                              setFlowNodes((prev) => prev.filter((n) => n.id !== nid));
                              if (selectedNodeId === nid) {
                                onSelectNode?.(null);
                              }
                            },
                          };
                        })()
                      : isShape || isNote
                        ? (() => {
                            if (isNote) {
                              // Заметки - это shape nodes с типом rectangle и текстом
                              const text =
                                (node.payload as any)?.text ??
                                (node.payload as any)?.noteContent ??
                                '';
                              const color = (node.payload as any)?.color ?? '#FFFFBA';
                              const fontSize = (node.payload as any)?.fontSize ?? 48;
                              const fontFamily =
                                (node.payload as any)?.fontFamily ?? 'Inter, sans-serif';
                              const isBold = (node.payload as any)?.isBold ?? false;
                              const isItalic = (node.payload as any)?.isItalic ?? false;

                              return {
                                shapeType: 'rectangle' as const,
                                shapeColor: color,
                                text,
                                fontSize,
                                fontFamily,
                                isBold,
                                isItalic,
                                width: (node.payload as any)?.ui?.width ?? 280,
                                height: (node.payload as any)?.ui?.height ?? 280,
                                onChangeText: (nid: string, newText: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'note'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              text: newText,
                                              noteContent: newText,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeColor: (nid: string, newColor: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'note'
                                        ? {
                                            ...n,
                                            payload: { ...(n.payload ?? {}), color: newColor },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeFontSize: (nid: string, newFontSize: number) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'note'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              fontSize: newFontSize,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeFontFamily: (nid: string, newFontFamily: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'note'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              fontFamily: newFontFamily,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeBold: (nid: string, newIsBold: boolean) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'note'
                                        ? {
                                            ...n,
                                            payload: { ...(n.payload ?? {}), isBold: newIsBold },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeItalic: (nid: string, newIsItalic: boolean) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'note'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              isItalic: newIsItalic,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                              };
                            } else {
                              // Обычные shape nodes (не заметки)
                              const payload = node.payload as any;
                              return {
                                shapeType: (payload?.shapeType ?? 'rectangle') as any,
                                shapeColor: payload?.shapeColor ?? '#BFDBFE', // Legacy
                                shapeLabel: payload?.shapeLabel ?? 'Фигура',
                                width: payload?.width ?? 160,
                                height: payload?.height ?? 96,
                                // New style properties
                                fill: payload?.fill ?? 'transparent',
                                stroke: payload?.stroke ?? '#1f1f1f',
                                strokeWidth: payload?.strokeWidth ?? 2,
                                opacity: payload?.opacity ?? 1.0,
                                cornerRadius: payload?.cornerRadius ?? 0,
                                arrowHead: payload?.arrowHead,
                                // For line/arrow types
                                endX: payload?.endX,
                                endY: payload?.endY,
                                // Text properties for shapes
                                text: payload?.text,
                                richContentHtml: payload?.richContentHtml,
                                fontSize: payload?.fontSize,
                                fontFamily: payload?.fontFamily,
                                color: payload?.color,
                                textAlign: payload?.textAlign ?? 'center',
                                // Callback for text changes (as in TextNode)
                                onChangeText: (nid: string, newText: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: { ...(n.payload ?? {}), text: newText },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeFormat: (
                                  nid: string,
                                  patch: Partial<{
                                    text: string;
                                    richContent: string;
                                    fontSize: number;
                                    fontFamily: string;
                                    color: string;
                                    textAlign: 'left' | 'center' | 'right';
                                  }>,
                                ) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              ...(patch.text !== undefined && { text: patch.text }),
                                              ...(patch.richContent !== undefined && {
                                                richContentHtml: patch.richContent,
                                              }),
                                              ...(patch.fontSize !== undefined && {
                                                fontSize: patch.fontSize,
                                              }),
                                              ...(patch.fontFamily !== undefined && {
                                                fontFamily: patch.fontFamily,
                                              }),
                                              ...(patch.color !== undefined && {
                                                color: patch.color,
                                              }),
                                              ...(patch.textAlign !== undefined && {
                                                textAlign: patch.textAlign,
                                              }),
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                // Callbacks для обновления стилей
                                onChangeFill: (nid: string, newFill: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: { ...(n.payload ?? {}), fill: newFill },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeStroke: (nid: string, newStroke: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: { ...(n.payload ?? {}), stroke: newStroke },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeStrokeWidth: (nid: string, newStrokeWidth: number) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              strokeWidth: newStrokeWidth,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeOpacity: (nid: string, newOpacity: number) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: { ...(n.payload ?? {}), opacity: newOpacity },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeCornerRadius: (nid: string, newCornerRadius: number) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              cornerRadius: newCornerRadius,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                onChangeArrowHead: (nid: string, newArrowHead: boolean) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              arrowHead: newArrowHead,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                              };
                            }
                          })()
                        : isVoice
                          ? (() => {
                              const payload = (node.payload ?? {}) as any;
                              return {
                                audioData: payload.audioData ?? null,
                                duration: payload.duration ?? 0,
                                mimeType: payload.mimeType ?? 'audio/webm',
                                recordedBy: payload.recordedBy,
                                recordedAt: payload.recordedAt,
                                currentUser: board.userInfo ? {
                                  id: board.userInfo.userId ?? '',
                                  name: board.userInfo.userName ?? '',
                                } : undefined,
                                onChangeAudio: (
                                  nid: string,
                                  audioPayload: {
                                    audioData: string;
                                    duration: number;
                                    mimeType: string;
                                    recordedBy?: { id: string; name: string };
                                    recordedAt?: number;
                                  },
                                ) => {
                                  // Cache audioData in ref to prevent loss during batching
                                  globalVoiceAudioCache.set(nid, {
                                    audioData: audioPayload.audioData,
                                    duration: audioPayload.duration,
                                    mimeType: audioPayload.mimeType,
                                  });
                                  
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'voice'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              audioData: audioPayload.audioData,
                                              duration: audioPayload.duration,
                                              mimeType: audioPayload.mimeType,
                                              recordedBy: audioPayload.recordedBy,
                                              recordedAt: audioPayload.recordedAt,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                              };
                            })()
                          : isDatabase
                            ? {
                                nodeId: node.id,
                                workspaceId: board.workspaceId,
                                onUpdatePayload: (
                                  nodeId: string,
                                  payload: Record<string, unknown>,
                                ) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nodeId
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              ...payload,
                                            },
                                          }
                                        : n,
                                    );
                                    emitNodesChange(next);
                                    return next;
                                  });
                                },
                                payload: node.payload,
                              }
                            : isPlot
                              ? (() => {
                                  const incomingEdge = localEdges.find(
                                    (e) => e.targetId === node.id,
                                  );
                                  const upstreamNode = incomingEdge
                                    ? localNodes.find(
                                        (n) => n.id === incomingEdge.sourceId,
                                      )
                                    : null;
                                  const isCsvSource =
                                    upstreamNode?.type === 'csv' ||
                                    upstreamNode?.type === 'csvNode';
                                  const isSqlSource = upstreamNode?.type === 'sql';
                                  const upstreamPayload = upstreamNode?.payload as
                                    | { tableName?: string }
                                    | undefined;
                                  const upstreamCsvTableName =
                                    isCsvSource && upstreamPayload?.tableName
                                      ? upstreamPayload.tableName
                                      : undefined;
                                  const upstreamSqlNodeId =
                                    isSqlSource && incomingEdge
                                      ? incomingEdge.sourceId
                                      : undefined;
                                  return {
                                    nodeId: node.id,
                                    payload: node.payload,
                                    edges: localEdges,
                                    width: storedWidth,
                                    upstreamCsvTableName,
                                    upstreamSqlNodeId,
                                  };
                                })()
                              : isCsv
                                ? {
                                    nodeId: node.id,
                                    payload: node.payload,
                                    width: storedWidth,
                                    onResize: (nodeId: string, width: number, height: number) => {
                                      setNodeWidth(nodeId, width);
                                    },
                                  }
                                : {
                                    nodeId: node.id,
                                    nodeType: isSql ? 'sql' : isPython ? 'python' : 'sql',
                                    onCodeChange: (code: string) => onCodeChange(node.id, code),
                                    onRun: () => onRunNode(node.id),
                                    onRunDownstream: () => onRunDownstream(node.id),
                                    onToggleCodeCollapsed: () => toggleCodeCollapsed(node.id),
                                    width: storedWidth,
                                    isCodeCollapsed,
                                    nodeKind: node.type,
                                  },
            // Для shape nodes (включая заметки) передаем width и height как пропсы, чтобы NodeResizer мог обновлять их в реальном времени
            ...(isShape || isNote
              ? {
                  width: isNote
                    ? ((node.payload as any)?.ui?.width ?? 280)
                    : ((node.payload as any)?.width ?? 160),
                  height: isNote
                    ? ((node.payload as any)?.ui?.height ?? 280)
                    : ((node.payload as any)?.height ?? 96),
                }
              : {}),
            style: {
              ...baseStyle,
              // Явный zIndex: дата-клетки = 1, элементы канвы pen = 10, shape = 12, text = 15, voice = 18, заметки = 20
              zIndex: isDataNode
                ? 1
                : isPen
                  ? 10
                  : isShape
                    ? 12
                    : isText
                      ? 15
                      : isVoice
                        ? 18
                        : isNote
                          ? 20
                          : 1,
            },
            // Pen nodes draggable только когда не в режиме pen
            // Text nodes draggable только когда не в режиме text (в режиме select можно перетаскивать)
            // Shape nodes и заметки draggable всегда (как обычные элементы канвы), кроме режимов создания других элементов
            // Остальные ноды draggable всегда (если не в режиме создания sticky/pen/text)
            draggable: isPen
              ? !isPenMode
              : isText
                ? !isTextMode
                : isVoice
                  ? !isVoiceMode
                  : isShape || isNote
                    ? !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode
                    : !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode,
            selectable: isPen
              ? !isPenMode
              : isText
                ? !isTextMode
                : isVoice
                  ? !isVoiceMode
                  : isShape || isNote
                    ? !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode
                    : !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode,
            // Служебное поле для сортировки: data nodes (0) идут раньше, canvas nodes (1) - позже
            _sortOrder: isDataNode ? 0 : isCanvasNode ? 1 : 0,
          } as Node & { _sortOrder: number };
        })
        // Сортируем: сначала дата-клетки (_sortOrder 0), потом элементы канвы (_sortOrder 1)
        .sort((a, b) => a._sortOrder - b._sortOrder)
    );
  }, [
    // NOTE: executionEntries removed - causes constant re-renders, SqlNode/PythonNode fetch their own state
    localNodes,
    nodeSizes,
    codeCollapsedMap,
    onCodeChange,
    onRunNode,
    onRunNodeFull,
    onRunDownstream,
    toggleCodeCollapsed,
    isPenMode,
    isTextMode,
    isVoiceMode,
    emitNodesChange,
    setLocalNodes,
    board.workspaceId,
  ]);

  const [flowNodes, setFlowNodes] = useState<Node[]>(() =>
    mapNodes().map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    })),
  );

  // Отдельный useEffect для обновления selected при изменении selectedNodeId
  // Это предотвращает бесконечные циклы, отделяя обновление selected от обновления структуры узлов
  useEffect(() => {
    setFlowNodes((prev) => {
      // Проверяем, нужно ли обновлять selected
      const needsUpdate = prev.some((node) => {
        const shouldBeSelected = node.id === selectedNodeId;
        return node.selected !== shouldBeSelected;
      });

      // Если selected уже правильный, не обновляем
      if (!needsUpdate) {
        return prev;
      }

      // Обновляем только selected для всех узлов
      return prev.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      }));
    });
  }, [selectedNodeId]);

  // Use useMemo to prevent infinite loops - only recalculate when dependencies change
  // CRITICAL FIX: Include localNodes in dependencies because mapNodes uses localNodes internally
  // When localNodes updates (e.g., from Yjs deletion), mappedNodes must recalculate
  const mappedNodes = useMemo(() => {
    return mapNodes();
  }, [
    mapNodes, // Include the callback itself
    localNodes, // CRITICAL: mapNodes uses localNodes, so we must recalculate when localNodes changes
  ]);

  useEffect(() => {
    const mapped = mappedNodes;

    setFlowNodes((prev) => {
      // Объединяем mapped nodes с существующими, чтобы сохранить позиции и состояние
      const mappedById = new Map(mapped.map((n) => [n.id, n]));
      const existingById = new Map(prev.map((n) => [n.id, n]));

      // Создаем новый массив: сначала mapped nodes, потом существующие, которых нет в mapped
      const result = mapped.map((node) => {
        const existing = existingById.get(node.id);
        const isDataNode = node.type === 'sqlNode' || node.type === 'pythonNode';

        // Для data nodes сохраняем width в data из существующего node или из node.width
        const existingWidth = existing?.width ?? existing?.data?.width;
        const updatedData =
          isDataNode && existingWidth
            ? {
                ...(node.data as any),
                width: existingWidth,
              }
            : node.data;

        // Важно: не перезаписываем position/width/height из existing, если они были обновлены React Flow
        // React Flow автоматически обновляет их через applyNodeChanges при ресайзе
        // Сохраняем selected из existing, чтобы не перезаписывать обновления из другого useEffect
        return {
          ...node,
          data: updatedData,
          // Используем position из mapped node (он будет обновлен через applyNodeChanges)
          position: node.position,
          // Сохраняем selected из existing (обновляется отдельным useEffect)
          selected: existing?.selected ?? node.id === selectedNodeId,
          // Используем width/height из mapped node (React Flow обновляет их через applyNodeChanges)
          width: node.width ?? existing?.width,
          height: node.height ?? existing?.height,
          // Убеждаемся, что zIndex сохраняется из mapNodes (где уже установлен правильный слой)
          style: {
            ...node.style,
            // Используем width/height из mapped node style (React Flow обновляет их)
            width: node.style?.width ?? existing?.style?.width,
            height: node.style?.height ?? existing?.style?.height,
            zIndex: node.style?.zIndex ?? (node.type === 'pen' ? 10 : 1),
          },
        };
      });

      // CRITICAL FIX: Don't preserve nodes that are not in mappedNodes
      // If a node is deleted through Yjs, it should be removed from flowNodes immediately
      // The previous logic preserved pen nodes even when deleted, which caused deletion sync issues
      // Now we only use nodes from mappedNodes, which is the source of truth from Yjs

      // Убеждаемся, что результат отсортирован по слоям: сначала data nodes, потом canvas nodes
      const sortedResult = result.sort((a, b) => {
        const aOrder = (a as any)._sortOrder ?? (a.type === 'pen' ? 1 : 0);
        const bOrder = (b as any)._sortOrder ?? (b.type === 'pen' ? 1 : 0);
        return aOrder - bOrder;
      });

      return sortedResult;
    });
  }, [mappedNodes, selectedNodeId]);

  const didInitialFitRef = useRef(false);
  useEffect(() => {
    if (!flowInstance || flowNodes.length === 0 || didInitialFitRef.current) return;
    flowInstance.fitView({ padding: 0.3, includeHiddenNodes: true, duration: 0 });
    didInitialFitRef.current = true;
  }, [flowInstance, flowNodes.length]);

  const flowEdges = useMemo<Edge[]>(
    () =>
      localEdges.map((edge) => {
        const meta = (edge.metadata ?? {}) as { sourceHandleId?: string; targetHandleId?: string };
        return {
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          sourceHandle: meta.sourceHandleId ?? undefined,
          targetHandle: meta.targetHandleId ?? undefined,
          type: 'step',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 4, strokeDasharray: 'none' },
        };
      }),
    [localEdges],
  );

  const commitFlowNodesToLocal = useCallback(
    (nextFlowNodes: Node[], shouldNotify: boolean) => {
      const prev = localNodesRef.current;
      const prevById = new Map(prev.map((node) => [node.id, node]));
      let mutated = false;
      const nextLocalCore = nextFlowNodes.map((flowNode) => {
        const previous = prevById.get(flowNode.id);
        const position = flowNode.position ?? {
          x: previous?.position.x ?? 0,
          y: previous?.position.y ?? 0,
        };
        // Для pen nodes используем тип из data или previous
        const isPenNode = (flowNode.data as any)?.points !== undefined;
        const isShapeNode = flowNode.type === 'shapeNode';
        const isNoteNode =
          isShapeNode &&
          ((flowNode.data as any)?.text !== undefined || (flowNode.data as any)?.onChangeText);
        const nodeKind = isPenNode
          ? 'pen'
          : isShapeNode && isNoteNode
            ? 'note'
            : isShapeNode
              ? 'shape'
              : (((flowNode.data as NodeData | undefined)?.nodeKind ??
                  previous?.type ??
                  'sql') as BoardCanvasProps['nodes'][number]['type']);
        // Для pen nodes сохраняем points, initialSize И ВСЕ НАСТРОЙКИ из data
        // Для shape nodes сохраняем размеры из flowNode (width/height) и остальной payload
        // Для заметок сохраняем размеры в ui, а текст и форматирование в payload
        const payload = isPenNode
          ? (() => {
              // Сохраняем все из data, включая настройки
              // Приоритет: flowNode.data > previous.payload > defaults
              const penPayload = {
                points: (flowNode.data as any).points ?? (previous?.payload as any)?.points ?? [],
                initialSize: (flowNode.data as any).initialSize ??
                  (previous?.payload as any)?.initialSize ?? { width: 100, height: 100 },
                // ВАЖНО: Сохраняем все настройки из data или из previous payload
                color:
                  (flowNode.data as any).color ?? (previous?.payload as any)?.color ?? '#ef4444',
                strokeWidth:
                  (flowNode.data as any).strokeWidth ??
                  (previous?.payload as any)?.strokeWidth ??
                  7,
                opacity: (flowNode.data as any).opacity ?? (previous?.payload as any)?.opacity ?? 1,
                smoothing:
                  (flowNode.data as any).smoothing ?? (previous?.payload as any)?.smoothing ?? 0.5,
                thinning:
                  (flowNode.data as any).thinning ?? (previous?.payload as any)?.thinning ?? 0.5,
              };

              // Логируем если настройки потерялись
              if (previous?.payload && (previous.payload as any).color && !penPayload.color) {
                console.warn('Pen node lost color during commit:', {
                  nodeId: flowNode.id,
                  previousColor: (previous.payload as any).color,
                  flowNodeDataColor: (flowNode.data as any).color,
                });
              }

              return penPayload;
            })()
          : isShapeNode && isNoteNode
            ? {
                ...(previous?.payload ?? {}),
                text: (flowNode.data as any)?.text ?? (previous?.payload as any)?.text,
                noteContent:
                  (flowNode.data as any)?.text ?? (previous?.payload as any)?.noteContent,
                color: (flowNode.data as any)?.shapeColor ?? (previous?.payload as any)?.color,
                fontSize: (flowNode.data as any)?.fontSize ?? (previous?.payload as any)?.fontSize,
                fontFamily:
                  (flowNode.data as any)?.fontFamily ?? (previous?.payload as any)?.fontFamily,
                isBold: (flowNode.data as any)?.isBold ?? (previous?.payload as any)?.isBold,
                isItalic: (flowNode.data as any)?.isItalic ?? (previous?.payload as any)?.isItalic,
                ui: {
                  ...((previous?.payload as any)?.ui ?? {}),
                  width:
                    typeof flowNode.width === 'number'
                      ? flowNode.width
                      : (((previous?.payload as any)?.ui as any)?.width ?? 280),
                  height:
                    typeof flowNode.height === 'number'
                      ? flowNode.height
                      : (((previous?.payload as any)?.ui as any)?.height ?? 280),
                },
              }
            : isShapeNode
              ? {
                  ...(previous?.payload ?? {}),
                  ...((flowNode.data as any) ?? {}),
                  // Сохраняем размеры из flowNode, если они есть
                  width:
                    typeof flowNode.width === 'number'
                      ? flowNode.width
                      : (previous?.payload as any)?.width,
                  height:
                    typeof flowNode.height === 'number'
                      ? flowNode.height
                      : (previous?.payload as any)?.height,
                }
              : (previous?.payload ?? {});
        // Проверяем изменения: position, type, или для shape nodes - размеры
        const positionChanged =
          !previous || previous.position.x !== position.x || previous.position.y !== position.y;
        const typeChanged = previous?.type !== nodeKind;
        const shapeSizeChanged =
          isShapeNode &&
          previous &&
          (isNoteNode
            ? ((previous.payload as any)?.ui as any)?.width !== (payload as any)?.ui?.width ||
              ((previous.payload as any)?.ui as any)?.height !== (payload as any)?.ui?.height
            : (previous.payload as any)?.width !== payload.width ||
              (previous.payload as any)?.height !== payload.height);
        if (positionChanged || typeChanged || shapeSizeChanged) {
          mutated = true;
        }
        return {
          id: flowNode.id,
          type: nodeKind,
          position,
          payload,
        };
      });
      // CRITICAL FIX: Only preserve nodes that are still in the nodes prop (from Yjs)
      // If a node was deleted through Yjs, it won't be in the nodes prop, so we shouldn't preserve it
      // This fixes the issue where deleted pen nodes reappear after deletion
      const nextIds = new Set(nextFlowNodes.map((n) => n.id));
      const nodesPropIds = new Set(nodes.map((n) => n.id));
      
      // Only preserve notes that are still in nodes prop (not deleted through Yjs)
      const preservedNotes = prev.filter(
        (n) => n.type === 'note' && !nextIds.has(n.id) && nodesPropIds.has(n.id),
      );
      
      // CRITICAL FIX: Don't preserve pen nodes that were deleted through Yjs
      // If a pen node is not in nodes prop, it was deleted through Yjs and should not be preserved
      const preservedPen = prev.filter(
        (n) => n.type === 'pen' && !nextIds.has(n.id) && nodesPropIds.has(n.id),
      );
      
      const nextLocal = [...nextLocalCore, ...preservedNotes, ...preservedPen];

      if (mutated) {
        setLocalNodes(nextLocal);
        if (shouldNotify) {
          emitNodesChange(nextLocal);
        }
      }
    },
    [emitNodesChange, nodes], // CRITICAL: Include nodes to check if pen nodes were deleted through Yjs
  );

  // Заметки теперь обрабатываются как shape nodes, отдельная логика не нужна

  const hasSelection = useMemo(() => {
    const nodes = flowNodes ?? [];
    const edges = flowEdges ?? [];
    return nodes.some((n: any) => n?.selected) || edges.some((e: any) => e?.selected);
  }, [flowNodes, flowEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // If Yjs handlers are provided, use them directly for real-time sync
      if (yjsOnNodesChange) {
        yjsOnNodesChange(changes);
        // Still update local state for compatibility with existing code
        // but Yjs will be the source of truth
      }

      // Все изменения обрабатываются как flowChanges (заметки теперь shape nodes)
      const flowChanges: NodeChange[] = changes;
      if (flowChanges.length) {
        // Определяем, завершен ли жест (drag или resize)
        const shouldCommit = flowChanges.some(
          (change) => change.type === 'position' && change.dragging !== true,
        );
        setFlowNodes((current) => {
          const next = applyNodeChanges(flowChanges, current);
          // Создаем Map для быстрого доступа к предыдущим узлам
          const currentById = new Map(current.map((n) => [n.id, n]));

          // Убеждаемся, что zIndex сохраняется после изменений и сортировка по слоям
          // Также обновляем selected для синхронизации с selectedNodeId
          const nextWithZIndex = next
            .map((node) => {
              const isPen = node.type === 'pen';
              const isText = node.type === 'textNode';
              const isShape = node.type === 'shapeNode';
              const isDataNode = node.type === 'sqlNode' || node.type === 'pythonNode';

              // Получаем предыдущий узел для восстановления данных
              const previousNode = currentById.get(node.id);

              // Для data nodes обновляем data.width из node.width (который React Flow обновляет через dimensions)
              // Для pen nodes ВАЖНО сохранить все настройки из data или из предыдущего узла
              // Важно: используем node.width напрямую из applyNodeChanges, который уже содержит обновленные размеры и position
              const updatedData =
                isDataNode && node.width
                  ? {
                      ...(node.data as any),
                      width: node.width,
                    }
                  : isPen
                    ? {
                        // Для pen узлов сохраняем ВСЕ данные из node.data или из previousNode.data
                        // applyNodeChanges может не сохранить все поля, поэтому восстанавливаем из предыдущего состояния
                        points:
                          (node.data as any)?.points ?? (previousNode?.data as any)?.points ?? [],
                        initialSize: (node.data as any)?.initialSize ??
                          (previousNode?.data as any)?.initialSize ?? { width: 100, height: 100 },
                        // ВАЖНО: Сохраняем настройки из node.data или из previousNode.data
                        color: (node.data as any)?.color ?? (previousNode?.data as any)?.color,
                        strokeWidth:
                          (node.data as any)?.strokeWidth ??
                          (previousNode?.data as any)?.strokeWidth,
                        opacity:
                          (node.data as any)?.opacity ?? (previousNode?.data as any)?.opacity,
                        smoothing:
                          (node.data as any)?.smoothing ?? (previousNode?.data as any)?.smoothing,
                        thinning:
                          (node.data as any)?.thinning ?? (previousNode?.data as any)?.thinning,
                      }
                    : node.data;

              return {
                ...node,
                data: updatedData,
                // Сохраняем position из applyNodeChanges (React Flow автоматически обновляет его при ресайзе)
                position: node.position,
                // Сохраняем selected из applyNodeChanges (React Flow управляет этим через onNodeClick)
                // Не обновляем selected здесь, чтобы избежать бесконечных циклов
                selected: node.selected,
                // Сохраняем width/height из applyNodeChanges (важно для shape nodes - NodeResizer обновляет их напрямую)
                width: node.width,
                height: node.height,
                style: {
                  ...node.style,
                  // Для shape nodes обновляем width/height в style из пропсов, чтобы они синхронизировались
                  ...(isShape
                    ? {
                        width: typeof node.width === 'number' ? node.width : node.style?.width,
                        height: typeof node.height === 'number' ? node.height : node.style?.height,
                      }
                    : {
                        width: node.style?.width,
                        height: node.style?.height,
                      }),
                  zIndex:
                    node.style?.zIndex ??
                    (isPen ? 10 : isShape ? 12 : isText ? 15 : isDataNode ? 1 : 1),
                },
                // Сохраняем _sortOrder для корректной сортировки
                _sortOrder: isDataNode ? 0 : isPen || isText || isShape ? 1 : 0,
              };
            })
            .sort((a, b) => (a._sortOrder ?? 0) - (b._sortOrder ?? 0));
          if (shouldCommit) {
            commitFlowNodesToLocal(nextWithZIndex, true);
            // История сохранится автоматически через emitNodesChange
          }
          return nextWithZIndex;
        });
        flowChanges.forEach((change) => {
          if (change.type === 'dimensions' && change.id && change.dimensions) {
            const width = change.dimensions.width;
            const height = change.dimensions.height;

            // Проверяем, есть ли активный dragging или resizing для этого node
            const hasActiveDragging = flowChanges.some(
              (ch) =>
                ch.type === 'position' &&
                (ch as any).id === change.id &&
                (ch as any).dragging === true,
            );
            // Проверяем, есть ли другие dimensions изменения для этого node (активный ресайз)
            const hasActiveResizing = flowChanges.some(
              (ch) => ch.type === 'dimensions' && (ch as any).id === change.id && ch !== change,
            );

            const node = localNodes.find((n) => n.id === change.id);

            // Для text nodes используем debounce, чтобы избежать дергания при ресайзе
            // Miro-like поведение: сохраняем только width (userWidth), height вычисляется автоматически
            if (node?.type === 'text' && width) {
              // Очищаем предыдущий таймер для этого узла
              const existingTimer = textNodeResizeTimerRef.current.get(change.id);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }

              // Устанавливаем новый таймер для debounce (150ms после последнего изменения)
              // Синхронизирован с debounce в RichTextEditor для плавных обновлений
              const timer = setTimeout(() => {
                // Sync size changes through Yjs for real-time collaboration
                const nodeId = change.id;
                const finalWidth =
                  typeof width === 'number' ? width : parseFloat(String(width)) || 240;
                const finalHeight =
                  typeof height === 'number' ? height : parseFloat(String(height)) || 80;

                syncNodePayloadChange(nodeId, (prevPayload) => ({
                  ...prevPayload,
                  ui: {
                    ...((prevPayload as any)?.ui ?? {}),
                    width: finalWidth,
                    height: finalHeight,
                  },
                }));

                setLocalNodes((prev) => {
                  const next = prev.map((n) =>
                    n.id === change.id && n.type === 'text'
                      ? {
                          ...n,
                          payload: {
                            ...(n.payload ?? {}),
                            ui: {
                              ...((n.payload as any)?.ui ?? {}),
                              // Сохраняем только width (userWidth) - задается пользователем через resize
                              width:
                                typeof width === 'number'
                                  ? width
                                  : parseFloat(String(width)) || 240,
                              // height не сохраняем здесь - он вычисляется автоматически в TextNode (autoHeight)
                              // Если height есть в существующих данных, сохраняем его временно (будет пересчитан)
                              height: ((n.payload as any)?.ui?.height as number) || 80,
                            },
                          },
                        }
                      : n,
                  );
                  emitNodesChange(next);
                  return next;
                });
                textNodeResizeTimerRef.current.delete(change.id);
              }, 150); // Уменьшено с 200ms до 150ms для синхронизации с RichTextEditor

              textNodeResizeTimerRef.current.set(change.id, timer);
            } else if (
              (node?.type === 'shape' || node?.type === 'note') &&
              width &&
              height &&
              !hasActiveDragging &&
              !hasActiveResizing
            ) {
              // Для shape nodes используем debounce для сохранения размеров в payload
              // Сохраняем только после завершения ресайза, чтобы не конфликтовать с React Flow
              const existingTimer = shapeNodeResizeTimerRef.current.get(change.id);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }

              const timer = setTimeout(() => {
                // Получаем актуальные размеры из flowNodes через setFlowNodes callback
                setFlowNodes((currentFlowNodes) => {
                  const currentFlowNode = currentFlowNodes.find((n) => n.id === change.id);
                  const isNote = node?.type === 'note';
                  const defaultWidth = isNote ? 280 : 160;
                  const defaultHeight = isNote ? 280 : 96;

                  const finalWidth =
                    typeof currentFlowNode?.width === 'number' && currentFlowNode.width > 0
                      ? currentFlowNode.width
                      : typeof width === 'number'
                        ? width
                        : parseFloat(String(width)) || defaultWidth;
                  const finalHeight =
                    typeof currentFlowNode?.height === 'number' && currentFlowNode.height > 0
                      ? currentFlowNode.height
                      : typeof height === 'number'
                        ? height
                        : parseFloat(String(height)) || defaultHeight;

                  // Sync size changes through Yjs for real-time collaboration
                  const nodeId = change.id;
                  if (node?.type === 'shape') {
                    syncNodePayloadChange(nodeId, (prevPayload) => ({
                      ...prevPayload,
                      width: finalWidth,
                      height: finalHeight,
                    }));
                  } else if (node?.type === 'note') {
                    syncNodePayloadChange(nodeId, (prevPayload) => ({
                      ...prevPayload,
                      ui: {
                        ...((prevPayload as any)?.ui ?? {}),
                        width: finalWidth,
                        height: finalHeight,
                      },
                    }));
                  }

                  return currentFlowNodes;
                });
                shapeNodeResizeTimerRef.current.delete(change.id);
              }, 300); // Увеличиваем debounce до 300ms для более плавного ресайза

              shapeNodeResizeTimerRef.current.set(change.id, timer);
            } else if (
              node?.type !== 'text' &&
              node?.type !== 'shape' &&
              node?.type !== 'note' &&
              width &&
              !hasActiveDragging
            ) {
              // Для data nodes сохраняем только width
              requestAnimationFrame(() => {
                setNodeWidth(change.id!, width);
              });
            }
            // Для pen nodes также сохраняем height
            if (height && node?.type === 'pen') {
              requestAnimationFrame(() => {
                useCanvasLayoutStore.getState().setNodeSize(change.id!, { width, height });
              });
            }
          }
        });
      }
    },
    [
      commitFlowNodesToLocal,
      setNodeWidth,
      localNodes,
      emitNodesChange,
      setLocalNodes,
      setFlowNodes,
    ],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode?.(node.id);
    },
    [onSelectNode],
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode?.(null);
  }, [onSelectNode]);

  const handleSelectionChange = useCallback(
    (selected: { nodes?: Node[] }) => {
      if (selected.nodes && selected.nodes.length > 0) {
        onSelectNode?.(selected.nodes[0].id);
      }
    },
    [onSelectNode],
  );

  const handleAddSqlNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    // Создаем узел с пустым кодом
    const template = addNodeHelpers.createSqlNode(position) as BoardCanvasProps['nodes'][number];
    // Перезаписываем payload, чтобы узел был пустым
    template.payload = { sql: '' };

    registerNode({
      id: template.id,
      type: 'sql',
      position: template.position,
      payload: template.payload,
    });

    // CRITICAL FIX: Use direct Yjs sync for immediate real-time synchronization
    // Following the same pattern as text/shape/pen nodes
    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }

    // Also update localNodes and trigger auto-save through onNodesChange
    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, registerNode]);

  const handleAddPythonNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    // Создаем узел с пустым кодом
    const template = addNodeHelpers.createPythonNode(position) as BoardCanvasProps['nodes'][number];
    // Перезаписываем payload, чтобы узел был пустым
    template.payload = { python: '' };

    registerNode({
      id: template.id,
      type: 'python',
      position: template.position,
      payload: template.payload,
    });

    // CRITICAL FIX: Use direct Yjs sync for immediate real-time synchronization
    // Following the same pattern as text/shape/pen nodes
    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }

    // Also update localNodes and trigger auto-save through onNodesChange
    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, registerNode]);

  const handleAddDatabaseNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    const template = addNodeHelpers.createDatabaseNode(
      position,
    ) as BoardCanvasProps['nodes'][number];

    registerNode({
      id: template.id,
      type: 'database',
      position: template.position,
      payload: template.payload,
    });

    // CRITICAL FIX: Use direct Yjs sync for immediate real-time synchronization
    // Following the same pattern as text/shape/pen nodes
    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }

    // Also update localNodes and trigger auto-save through onNodesChange
    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, registerNode]);

  const handleAddPlotNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    const template = addNodeHelpers.createPlotNode(position) as BoardCanvasProps['nodes'][number];

    registerNode({
      id: template.id,
      type: 'plot',
      position: template.position,
      payload: template.payload,
    });

    // CRITICAL FIX: Use direct Yjs sync for immediate real-time synchronization
    // Following the same pattern as text/shape/pen nodes
    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }

    // Also update localNodes and trigger auto-save through onNodesChange
    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, registerNode]);

  const handleUploadSpreadsheet = useCallback(
    async (file: File) => {
      const result = await parseSpreadsheetFile(file);

      if (!result.success) {
        alert(`Error: ${result.error}`);
        return;
      }

      // Register the dataset in DuckDB so SQL nodes can query it
      let tableName = '';
      let normalizedColumns: string[] = [];
      const totalRowCount = result.data.rows.length;
      try {
        const duckDbResult = await registerDatasetFromCsvNode(
          result.filename,
          result.data,
          board.id,
        );
        tableName = duckDbResult.tableName;
        normalizedColumns = duckDbResult.normalizedColumns;
        console.log(
          `Registered table "${tableName}" with ${duckDbResult.rows} rows in DuckDB`,
        );
        // Sync to Yjs datasetsMap so observer keeps localStorage in sync and table survives restoreDatasetsForBoard
        onCsvDatasetAdded?.({
          tableName,
          columns: normalizedColumns,
          rows: result.data.rows,
        });
      } catch (err) {
        console.error('Failed to register dataset in DuckDB:', err);
        // Fallback table name
        tableName = result.filename
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/[^a-zA-Z0-9_]/g, '_');
      }

      // Получаем центр viewport пользователя и преобразуем в координаты flow
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

      const nodeId = crypto.randomUUID();
      
      // Table preview: default 100 rows (no user selector). Full data lives in DuckDB;
      // Plot nodes connected to this CSV use full dataset via useFullCsvDataForPlot.
      const PREVIEW_ROW_LIMIT = 100;
      const previewRows = result.data.rows.slice(0, PREVIEW_ROW_LIMIT);
      const columns = normalizedColumns.length > 0 ? normalizedColumns : result.data.columns;
      
      const previewData = {
        columns,
        rows: previewRows,
      };

      const csvNode: BoardCanvasProps['nodes'][number] = {
        id: nodeId,
        type: 'csv',
        position,
        payload: {
          filename: result.filename,
          tableName, // Store the DuckDB table name for lazy loading
          data: previewData, // Only preview rows for initial render
          totalRowCount, // Total rows in DuckDB for "Load more" functionality
          originalColumns: result.data.columns, // Keep original for reference
          uploadedAt: new Date().toISOString(),
          fileType: result.fileType,
        },
      };

      // Register in executionStore with data ready
      registerNode({
        id: nodeId,
        type: 'csv' as 'sql' | 'python' | 'table' | 'plot',
        position,
        payload: csvNode.payload,
      });

      setLocalNodes((prev) => {
        const next = [...prev, csvNode];
        emitNodesChange(next);
        return next;
      });
      onSelectNode?.(nodeId);
    },
    [rf, emitNodesChange, onSelectNode, registerNode, board.id, onCsvDatasetAdded],
  );

  const handleAddVoiceNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    const template = addNodeHelpers.createVoiceNode(position) as BoardCanvasProps['nodes'][number];

    registerNode({
      id: template.id,
      type: 'voice',
      position: template.position,
      payload: template.payload,
    });
    setLocalNodes((prev) => {
      const next = [...prev, template];
      emitNodesChange(next);
      return next;
    });
    onSelectNode?.(template.id);
    setTool('select'); // Переключаемся на select после создания voice узла
  }, [addNodeHelpers, rf, emitNodesChange, onSelectNode, registerNode, setTool]);

  const handleConnectStart = useCallback(
    (_event: React.MouseEvent | React.TouchEvent, params: OnConnectStartParams) => {
      connectOriginRef.current = {
        nodeId: params?.nodeId ?? null,
        handleType: params?.handleType ?? null,
        handleId: params?.handleId ?? null,
      };
      connectionCreatedRef.current = false;

      // Start tracking mouse position
      const handleMouseMove = (e: MouseEvent) => {
        if (connectOriginRef.current) {
          const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
          lastMousePositionRef.current = flowPos;
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      // Store cleanup function
      mouseMoveCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove);
      };
    },
    [rf],
  );

  const handleConnectEnd = useCallback(
    (event?: MouseEvent | TouchEvent) => {
      // Cleanup mouse tracking
      if (mouseMoveCleanupRef.current) {
        mouseMoveCleanupRef.current();
        mouseMoveCleanupRef.current = null;
      }

      // If connection was not created through onConnect, try to create it manually
      if (
        !connectionCreatedRef.current &&
        connectOriginRef.current?.nodeId &&
        lastMousePositionRef.current
      ) {
        const sourceNodeId = connectOriginRef.current.nodeId;
        const sourceNode = rf.getNode(sourceNodeId);

        if (sourceNode && lastMousePositionRef.current) {
          // Find node under mouse cursor or nearest node
          const mousePos = lastMousePositionRef.current;
          const allNodes = rf.getNodes();

          // First, try to find node that contains the mouse position
          let targetNode: Node | null = null;
          let minDistance = Infinity;

          for (const node of allNodes) {
            if (node.id === sourceNodeId) continue; // Skip source node

            const nodePos = node.positionAbsolute ?? node.position;
            const nodeWidth = node.width ?? 280;
            const nodeHeight = node.height ?? 320;
            const nodeCenterX = nodePos.x + nodeWidth / 2;
            const nodeCenterY = nodePos.y + nodeHeight / 2;

            // Check if mouse is inside node bounds
            if (
              mousePos.x >= nodePos.x &&
              mousePos.x <= nodePos.x + nodeWidth &&
              mousePos.y >= nodePos.y &&
              mousePos.y <= nodePos.y + nodeHeight
            ) {
              targetNode = node;
              break; // Found node containing cursor, use it
            }

            // Otherwise, track distance to node center for fallback
            const distance = Math.sqrt(
              Math.pow(mousePos.x - nodeCenterX, 2) + Math.pow(mousePos.y - nodeCenterY, 2),
            );
            if (distance < minDistance) {
              minDistance = distance;
              // Only use as fallback if reasonably close (within 200px)
              if (distance < 200) {
                targetNode = node;
              }
            }
          }

          if (targetNode) {
            // Create connection manually
            const originHandleType = connectOriginRef.current.handleType;
            const originHandleId = connectOriginRef.current.handleId;
            const isConnectingFromSource = originHandleType === 'source';

            // Determine source handle - use the actual handle ID from connectStart if available
            let sourceHandle: string | null = null;
            if (
              originHandleId &&
              (originHandleId === 'left' ||
                originHandleId === 'top' ||
                originHandleId === 'right' ||
                originHandleId === 'bottom')
            ) {
              // Use the handle ID from where we started
              sourceHandle = originHandleId;
            } else {
              // Fallback: find nearest handle if ID is not available
              if (originHandleType === 'source') {
                const sourceNodePos = sourceNode.positionAbsolute ?? sourceNode.position;
                const sourceNodeWidth = sourceNode.width ?? 280;
                const sourceNodeHeight = sourceNode.height ?? 320;
                const sourceCenter = {
                  x: sourceNodePos.x + sourceNodeWidth / 2,
                  y: sourceNodePos.y + sourceNodeHeight / 2,
                };
                sourceHandle = findNearestHandleId(sourceNode, sourceCenter, 'source') ?? null;
              } else if (originHandleType === 'target') {
                const sourceNodePos = sourceNode.positionAbsolute ?? sourceNode.position;
                const sourceNodeWidth = sourceNode.width ?? 280;
                const sourceNodeHeight = sourceNode.height ?? 320;
                const sourceCenter = {
                  x: sourceNodePos.x + sourceNodeWidth / 2,
                  y: sourceNodePos.y + sourceNodeHeight / 2,
                };
                sourceHandle = findNearestHandleId(sourceNode, sourceCenter, 'target') ?? null;
              }
            }

            // Determine target handle - use mouse position to find nearest handle
            const neededTargetHandleType = isConnectingFromSource ? 'target' : 'source';
            // Use actual mouse position instead of node center for better accuracy
            const targetHandle =
              findNearestHandleId(targetNode, mousePos, neededTargetHandleType) ?? null;

            if (sourceHandle && targetHandle) {
              // Create the connection
              const sourceId = isConnectingFromSource ? sourceNodeId : targetNode.id;
              const targetId = isConnectingFromSource ? targetNode.id : sourceNodeId;
              const finalSourceHandle = isConnectingFromSource ? sourceHandle : targetHandle;
              const finalTargetHandle = isConnectingFromSource ? targetHandle : sourceHandle;

              setLocalEdges((prev) => {
                if (prev.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId)) {
                  return prev;
                }
                const next = [
                  ...prev,
                  {
                    id: createEdgeId(),
                    sourceId,
                    targetId,
                    metadata: {
                      sourceHandleId: finalSourceHandle,
                      targetHandleId: finalTargetHandle,
                    },
                  },
                ];
                emitEdgesChange(next);
                return next;
              });
            }
          }
        }
      }

      connectOriginRef.current = null;
      connectionCreatedRef.current = false;
      lastMousePositionRef.current = null;
    },
    [rf, emitEdgesChange],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      let { sourceId, targetId, sourceHandle, targetHandle } = resolveConnectionEndpoints(
        connection,
        connectOriginRef.current,
      );

      // Determine the handle type we started from (from connectOriginRef)
      const originHandleType = connectOriginRef.current?.handleType;
      const isConnectingFromSource =
        originHandleType === 'source' ||
        sourceHandle === 'right' ||
        sourceHandle === 'bottom' ||
        (connection.sourceHandle &&
          (connection.sourceHandle === 'right' || connection.sourceHandle === 'bottom'));

      // Auto-complete targetHandle if missing
      if (targetId && !targetHandle && connection.target) {
        const targetNode = rf.getNode(targetId);
        if (targetNode) {
          // Use the actual connection end position if available, otherwise use node center
          const targetNodePos = targetNode.positionAbsolute ?? targetNode.position;
          const targetNodeWidth = targetNode.width ?? 280;
          const targetNodeHeight = targetNode.height ?? 320;

          // Try to get mouse position from connection, fallback to node center
          const mousePosition = {
            x: targetNodePos.x + targetNodeWidth / 2,
            y: targetNodePos.y + targetNodeHeight / 2,
          };

          // If connecting from source, we need target handle (and vice versa)
          const neededHandleType = isConnectingFromSource ? 'target' : 'source';

          const nearestHandleId = findNearestHandleId(targetNode, mousePosition, neededHandleType);

          if (nearestHandleId) {
            targetHandle = nearestHandleId;
          }
        }
      }

      // Auto-complete sourceHandle if missing (less common, but possible)
      if (sourceId && !sourceHandle && connection.source) {
        const sourceNode = rf.getNode(sourceId);
        if (sourceNode) {
          const sourceNodePos = sourceNode.positionAbsolute ?? sourceNode.position;
          const sourceNodeWidth = sourceNode.width ?? 280;
          const sourceNodeHeight = sourceNode.height ?? 320;
          const mousePosition = {
            x: sourceNodePos.x + sourceNodeWidth / 2,
            y: sourceNodePos.y + sourceNodeHeight / 2,
          };

          // If target is target handle, we need source handle (and vice versa)
          const neededHandleType =
            targetHandle && (targetHandle === 'left' || targetHandle === 'top')
              ? 'source'
              : originHandleType === 'target'
                ? 'source'
                : 'target';

          const nearestHandleId = findNearestHandleId(sourceNode, mousePosition, neededHandleType);

          if (nearestHandleId) {
            sourceHandle = nearestHandleId;
          }
        }
      }

      connectOriginRef.current = null;
      connectionCreatedRef.current = true;
      if (!sourceId || !targetId) return;
      setLocalEdges((prev) => {
        if (prev.some((edge) => edge.sourceId === sourceId && edge.targetId === targetId)) {
          return prev;
        }
        const next = [
          ...prev,
          {
            id: createEdgeId(),
            sourceId,
            targetId,
            metadata: {
              ...(connection.metadata ?? {}),
              sourceHandleId: sourceHandle ?? connection.sourceHandle ?? undefined,
              targetHandleId: targetHandle ?? connection.targetHandle ?? undefined,
            },
          },
        ];
        emitEdgesChange(next);
        return next;
      });
    },
    [emitEdgesChange, rf],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // If Yjs handlers are provided, use them directly for real-time sync
      if (yjsOnEdgesChange) {
        yjsOnEdgesChange(changes);
        // Still update local state for compatibility with existing code
        // but Yjs will be the source of truth
      }

      const removedIds = changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id);
      if (removedIds.length === 0) {
        return;
      }
      setLocalEdges((prev) => {
        const next = prev.filter((edge) => !removedIds.includes(edge.id));
        if (next.length !== prev.length) {
          emitEdgesChange(next);
        }
        return next;
      });
    },
    [emitEdgesChange, yjsOnEdgesChange],
  );

  // Deletion handler for selected nodes/edges
  const handleDeleteSelection = useCallback(() => {
    // collect selection from RF
    const selectedNodeIds = new Set(
      (rf.getNodes?.() ?? []).filter((n: any) => n?.selected).map((n: any) => n.id),
    );
    const selectedEdgeIds = new Set(
      (rf.getEdges?.() ?? []).filter((e: any) => e?.selected).map((e: any) => e.id),
    );
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    console.log(
      'handleDeleteSelection: Deleting nodes:',
      Array.from(selectedNodeIds),
      'edges:',
      Array.from(selectedEdgeIds),
    );

    // CRITICAL FIX: Sync deletion through Yjs first to ensure real-time collaboration
    // This ensures deleted elements are removed from Yjs map and don't reappear
    if (yjsOnNodesChange && selectedNodeIds.size > 0) {
      selectedNodeIds.forEach((id) => recentlyDeletedIdsRef.current.add(id));
      const removeNodeChanges = Array.from(selectedNodeIds).map((id) => ({
        type: 'remove' as const,
        id,
      }));
      yjsOnNodesChange(removeNodeChanges);
      console.log('handleDeleteSelection: Synced node deletions through Yjs:', removeNodeChanges.length);
    }

    // Also remove edges incident to removed nodes (they should be deleted automatically by Yjs,
    // but we'll also sync them explicitly for safety)
    const edgesToRemove = new Set(selectedEdgeIds);
    // Find edges connected to deleted nodes
    const currentEdges = rf.getEdges?.() ?? [];
    for (const edge of currentEdges) {
      if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) {
        edgesToRemove.add(edge.id);
      }
    }

    if (yjsOnEdgesChange && edgesToRemove.size > 0) {
      const removeEdgeChanges = Array.from(edgesToRemove).map((id) => ({
        type: 'remove' as const,
        id,
      }));
      yjsOnEdgesChange(removeEdgeChanges);
      console.log('handleDeleteSelection: Synced edge deletions through Yjs:', removeEdgeChanges.length);
    }

    // remove from localNodes (regular + mirrored notes + pen nodes)
    setLocalNodes((prev) => {
      const next = prev.filter((n) => !selectedNodeIds.has(n.id));
      console.log(
        'handleDeleteSelection: localNodes after filter:',
        next.length,
        'removed:',
        prev.length - next.length,
      );
      emitNodesChange(next);
      return next;
    });

    // remove selected edges and edges incident to removed nodes
    setLocalEdges((prev) => {
      const next = prev.filter(
        (e) =>
          !selectedEdgeIds.has(e.id) &&
          !selectedNodeIds.has(e.sourceId) &&
          !selectedNodeIds.has(e.targetId),
      );
      emitEdgesChange(next);
      return next;
    });

    // remove from flowNodes directly
    setFlowNodes((prev) => {
      const next = prev.filter((n) => !selectedNodeIds.has(n.id));
      console.log(
        'handleDeleteSelection: flowNodes after filter:',
        next.length,
        'removed:',
        prev.length - next.length,
      );
      return next;
    });

    onSelectNode?.(null);
  }, [rf, emitNodesChange, emitEdgesChange, onSelectNode, yjsOnNodesChange, yjsOnEdgesChange]);

  // Keyboard bindings for Delete / Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = (document.activeElement as HTMLElement | null) ?? null;
      if (active) {
        const tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (active.getAttribute('contenteditable') === 'true') return;
        if (active.closest('.monaco-editor')) return;
      }
      e.preventDefault();
      handleDeleteSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDeleteSelection]);

  // Ensure Space and Tab are not intercepted by global listeners when editing
  useEffect(() => {
    const onKeyCapture = (e: KeyboardEvent) => {
      const active = (document.activeElement as HTMLElement | null) ?? null;
      const isMonaco = !!active?.closest('.monaco-editor');
      const isTextArea = !!active?.closest('textarea');
      const isInput = !!active?.closest(
        "input[type='text'], input[type='search'], input[type='password']",
      );
      const key = e.key || '';
      const isSpace = key === ' ' || key === 'Spacebar' || (e as any).code === 'Space';
      const isTab = key === 'Tab';
      if ((isMonaco || isTextArea || isInput) && (isSpace || isTab)) {
        // Allow editors to handle Space / Tab; do not block default, but stop bubbling
        e.stopPropagation();
      }
    };
    // capture phase to stop other global handlers (e.g., tldraw) from seeing it
    window.addEventListener('keydown', onKeyCapture, true);
    return () => window.removeEventListener('keydown', onKeyCapture, true);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!flowInstance) return;
    const currentZoom = typeof flowInstance.getZoom === 'function' ? flowInstance.getZoom() : 1;
    flowInstance.zoomTo(Math.min(currentZoom * 1.2, 4));
  }, [flowInstance]);

  const handleZoomOut = useCallback(() => {
    if (!flowInstance) return;
    const currentZoom = typeof flowInstance.getZoom === 'function' ? flowInstance.getZoom() : 1;
    flowInstance.zoomTo(Math.max(currentZoom / 1.2, 0.1));
  }, [flowInstance]);

  const handleZoomReset = useCallback(() => {
    if (!flowInstance) return;
    flowInstance.fitView({ padding: 0.3, includeHiddenNodes: true, duration: 200 });
  }, [flowInstance]);

  const pendingStickyRef = useRef<{ x: number; y: number } | null>(null);
  const uuidv4 = useCallback(() => {
    try {
      // Most environments
       
      if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
         
        return (crypto as any).randomUUID() as string;
      }
    } catch {}
    // Fallback RFC4122 v4
    const rnd = (n = 16) =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${((8 + Math.random() * 4) | 0).toString(16)}${rnd(3)}-${rnd(12)}`;
  }, []);
  const getClientXY = (e: any): { x: number; y: number } | null => {
    const x =
      e?.clientX ?? e?.event?.clientX ?? e?.sourceEvent?.clientX ?? e?.nativeEvent?.clientX ?? null;
    const y =
      e?.clientY ?? e?.event?.clientY ?? e?.sourceEvent?.clientY ?? e?.nativeEvent?.clientY ?? null;
    if (typeof x === 'number' && typeof y === 'number') return { x, y };
    return null;
  };
  const addExternalSticky = useCallback(
    (id: string, pos: { x: number; y: number }, text = '') => {
      const defaultColor = '#FFFFBA'; // пастельный желтый по умолчанию
      const defaultFontSize = 48;
      const defaultFontFamily = 'Inter, sans-serif';
      const externalSticky = {
        id,
        type: 'note' as const,
        position: pos,
        payload: {
          text,
          noteContent: text,
          noteColor: '#FFFFBA',
          color: defaultColor,
          fontSize: defaultFontSize, // явно устанавливаем 48
          fontFamily: defaultFontFamily,
          isBold: false,
          isItalic: false,
          ui: { width: 280, height: 280 }, // квадратная форма, примерно половина дефолтной дата-клетки
        },
      };
      setLocalNodes((prev) => {
        const next = [...prev, externalSticky];
        emitNodesChange(next);
        return next;
      });
    },
    [emitNodesChange],
  );
  const combineForPersist = useCallback((stickies: Node[]) => {
    const stickyExternal =
      stickies.map((n) => ({
        id: n.id,
        type: 'note' as const,
        position: n.position ?? { x: 0, y: 0 },
        payload: { text: (n.data as any)?.text ?? '' },
      })) ?? [];
    return [...(localNodesRef.current ?? []), ...stickyExternal];
  }, []);

  // File drop handling
  const getDropPosition = useCallback(
    (clientX: number, clientY: number) => {
      return rf.screenToFlowPosition({ x: clientX, y: clientY });
    },
    [rf],
  );

  const handleFilesUploaded = useCallback(
    (
      uploadedFiles: Array<{
        file: UploadedFile;
        nodeType: 'image' | 'video' | 'document';
        dropPosition?: { x: number; y: number };
      }>,
    ) => {
      const newNodes: BoardCanvasProps['nodes'] = [];

      for (const { file, nodeType, dropPosition } of uploadedFiles) {
        const position =
          dropPosition ??
          rf.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });

        let newNode: BoardCanvasProps['nodes'][number] | null = null;

        if (nodeType === 'image') {
          const created = addNodeHelpers.createImageNode(position, {
            url: file.url,
            originalName: file.originalName,
            fileId: file.id,
          });
          newNode = created as BoardCanvasProps['nodes'][number];
        } else if (nodeType === 'video') {
          const created = addNodeHelpers.createVideoNode(position, {
            url: file.url,
            originalName: file.originalName,
            fileId: file.id,
          });
          newNode = created as BoardCanvasProps['nodes'][number];
        } else if (nodeType === 'document') {
          const created = addNodeHelpers.createDocumentNode(position, {
            url: file.url,
            originalName: file.originalName,
            fileId: file.id,
            mimeType: file.mimeType,
          });
          newNode = created as BoardCanvasProps['nodes'][number];
        }

        if (newNode) {
          newNodes.push(newNode);
        }
      }

      if (newNodes.length > 0) {
        setLocalNodes((prev) => {
          const next = [...prev, ...newNodes];
          emitNodesChange(next);
          return next;
        });
        // Select the first uploaded node
        onSelectNode?.(newNodes[0].id);
      }
    },
    [rf, addNodeHelpers, emitNodesChange, onSelectNode],
  );

  return (
    <FileDropOverlay
      boardId={board.id}
      onFilesUploaded={handleFilesUploaded}
      getDropPosition={getDropPosition}
      disabled={isPenMode || isShapeMode}
    >
      <div
        ref={canvasRootRef}
        className="board-canvas-root relative flex h-full min-h-0 w-full flex-1 overflow-hidden"
        style={{ position: 'relative' }}
      >
        <div 
          className="relative h-full w-full overflow-hidden" 
          onPointerMoveCapture={onMouseMove}
        >
          <div className="relative h-full w-full">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              fitView
              fitViewOptions={{ padding: 0.2, duration: 0 }}
              panOnDrag={!isSelectMode && !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode}
              panOnScroll={false}
              zoomOnScroll
              selectionOnDrag={isSelectMode}
              nodesDraggable={!isPenMode && !isTextMode && !isShapeMode && !isVoiceMode}
              nodesConnectable={
                !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode
              }
              elementsSelectable={
                !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode
              }
              proOptions={{ hideAttribution: true }}
              className="h-full bg-white"
              style={{ width: '100%', height: '100%' }}
              onInit={(instance) => setFlowInstance(instance)}
              selectNodesOnDrag={false}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onConnectStart={handleConnectStart}
              onConnectEnd={handleConnectEnd}
              connectionLineComponent={CustomConnectionLine}
              connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 4 }}
              onNodeClick={handleNodeClick}
              onNodeDataChange={(id, data) => {
                // Синхронизируем изменения данных узла (цвет, форматирование, стили) с localNodes
                // Заметки теперь shape nodes, изменения обрабатываются через callbacks в data
                // Shape nodes также обновляют стили (fill, stroke, strokeWidth, opacity, cornerRadius, arrowHead)
                if (data && typeof data === 'object') {
                  const node = flowNodes.find((n) => n.id === id);
                  if (node && node.type === 'shapeNode') {
                    const nodeData = node.data as any;
                    // Если это заметка (есть text или onChangeText), обновляем localNodes
                    if (nodeData?.text !== undefined || nodeData?.onChangeText) {
                      const newColor = (data as any)?.shapeColor;
                      const newText = (data as any)?.text;
                      const newFontSize = (data as any)?.fontSize;
                      const newFontFamily = (data as any)?.fontFamily;
                      const newIsBold = (data as any)?.isBold;
                      const newIsItalic = (data as any)?.isItalic;

                      // Обновляем только если есть изменения
                      if (
                        newColor ||
                        newText !== undefined ||
                        newFontSize !== undefined ||
                        newFontFamily ||
                        newIsBold !== undefined ||
                        newIsItalic !== undefined
                      ) {
                        setLocalNodes((prev) => {
                          const next = prev.map((ext) =>
                            ext.id === id && ext.type === 'note'
                              ? {
                                  ...ext,
                                  payload: {
                                    ...(ext.payload ?? {}),
                                    ...(newColor && { color: newColor }),
                                    ...(newText !== undefined && {
                                      text: newText,
                                      noteContent: newText,
                                    }),
                                    ...(newFontSize !== undefined && { fontSize: newFontSize }),
                                    ...(newFontFamily && { fontFamily: newFontFamily }),
                                    ...(newIsBold !== undefined && { isBold: newIsBold }),
                                    ...(newIsItalic !== undefined && { isItalic: newIsItalic }),
                                  },
                                }
                              : ext,
                          );
                          queueMicrotask(() => {
                            emitNodesChange(next);
                          });
                          return next;
                        });
                      }
                    } else {
                      // Это обычная фигура (не заметка) - обновляем стили
                      const newFill = (data as any)?.fill;
                      const newStroke = (data as any)?.stroke;
                      const newStrokeWidth = (data as any)?.strokeWidth;
                      const newOpacity = (data as any)?.opacity;
                      const newCornerRadius = (data as any)?.cornerRadius;
                      const newArrowHead = (data as any)?.arrowHead;
                      const newEndX = (data as any)?.endX;
                      const newEndY = (data as any)?.endY;

                      // Обновляем только если есть изменения стилей
                      if (
                        newFill !== undefined ||
                        newStroke !== undefined ||
                        newStrokeWidth !== undefined ||
                        newOpacity !== undefined ||
                        newCornerRadius !== undefined ||
                        newArrowHead !== undefined ||
                        newEndX !== undefined ||
                        newEndY !== undefined
                      ) {
                        setLocalNodes((prev) => {
                          const next = prev.map((ext) =>
                            ext.id === id && ext.type === 'shape'
                              ? {
                                  ...ext,
                                  payload: {
                                    ...(ext.payload ?? {}),
                                    ...(newFill !== undefined && { fill: newFill }),
                                    ...(newStroke !== undefined && { stroke: newStroke }),
                                    ...(newStrokeWidth !== undefined && {
                                      strokeWidth: newStrokeWidth,
                                    }),
                                    ...(newOpacity !== undefined && { opacity: newOpacity }),
                                    ...(newCornerRadius !== undefined && {
                                      cornerRadius: newCornerRadius,
                                    }),
                                    ...(newArrowHead !== undefined && { arrowHead: newArrowHead }),
                                    ...(newEndX !== undefined && { endX: newEndX }),
                                    ...(newEndY !== undefined && { endY: newEndY }),
                                  },
                                }
                              : ext,
                          );
                          queueMicrotask(() => {
                            emitNodesChange(next);
                          });
                          return next;
                        });
                      }
                    }
                  }
                }
              }}
              onPaneClick={(e) => {
                // Всегда снимаем выделение при клике на свободную область
                handlePaneClick();

                const xy = getClientXY(e);
                if (!xy) return;
                const p = rf.screenToFlowPosition({ x: xy.x, y: xy.y });

                // Создаем новый текст-ноду в режиме text
                if (isTextMode) {
                  const textNode = addNodeHelpers.createTextNode(p);
                  setLocalNodes((prev) => {
                    const next = [...prev, textNode];
                    emitNodesChange(next);
                    return next;
                  });
                  // Автоматически выделяем созданный узел и сбрасываем tool в select (как в Miro)
                  onSelectNode?.(textNode.id);
                  setTool('select');
                  return;
                }

                // Создаем новый voice-ноду в режиме voice
                if (isVoiceMode) {
                  const voiceNode = addNodeHelpers.createVoiceNode(p);
                  setLocalNodes((prev) => {
                    const next = [...prev, voiceNode];
                    emitNodesChange(next);
                    return next;
                  });
                  // Автоматически выделяем созданный узел и сбрасываем tool в select
                  onSelectNode?.(voiceNode.id);
                  setTool('select');
                  return;
                }

                // Создание фигур теперь через drag-to-create (ShapeDragOverlay)
                // Убираем создание по клику, оставляем только drag
                // if (isShapeMode && selectedShape) { ... }

                // Создаем новую заметку в режиме стикеров (как shape node с типом rectangle и текстом)
                if (!isStickyMode) return;
                const noteNode = addNodeHelpers.createNoteNode(
                  p,
                ) as BoardCanvasProps['nodes'][number];
                setLocalNodes((prev) => {
                  const next = [...prev, noteNode];
                  emitNodesChange(next);
                  return next;
                });
                // Автоматически выделяем созданный узел и сбрасываем tool в select (как в Miro)
                onSelectNode?.(noteNode.id);
                setTool('select');
              }}
              onSelectionChange={handleSelectionChange}
              minZoom={0.2}
              nodeTypes={nodeTypes}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.8} color="#cbd5e1" />
              <MiniMap
                nodeColor={(node) => {
                  const nodeType = node.type;
                  const nodeData = node.data as any;

                  // Проверяем, является ли узел pen-узлом по всем возможным признакам
                  const isPenNode =
                    nodeType === 'pen' ||
                    (nodeData?.initialSize &&
                      typeof nodeData.initialSize === 'object' &&
                      !nodeData?.nodeId) ||
                    (nodeData?.points && Array.isArray(nodeData.points) && !nodeData?.nodeId);

                  // Исключаем pen узлы - возвращаем null, чтобы они не отображались
                  if (isPenNode) {
                    return null;
                  }

                  // Для остальных узлов возвращаем цвет через стандартную функцию
                  return getNodeColor((nodeData as any)?.nodeKind ?? 'sql');
                }}
                nodeFilter={(node) => {
                  const nodeType = node.type;
                  const nodeData = node.data as any;

                  // Проверяем, является ли узел pen-узлом по всем возможным признакам
                  const isPenNode =
                    nodeType === 'pen' ||
                    (nodeData?.initialSize &&
                      typeof nodeData.initialSize === 'object' &&
                      !nodeData?.nodeId) ||
                    (nodeData?.points && Array.isArray(nodeData.points) && !nodeData?.nodeId);

                  // Исключаем pen узлы
                  if (isPenNode) {
                    return false;
                  }

                  // Показываем только заметки (shape nodes с текстом) и дата-клетки
                  // Явно разрешаем только эти типы узлов
                  const isNote =
                    nodeType === 'shapeNode' &&
                    ((nodeData as any)?.text !== undefined || (nodeData as any)?.onChangeText);
                  return isNote || nodeType === 'sqlNode' || nodeType === 'pythonNode';
                }}
                zoomable
                pannable
                style={{ right: 0, bottom: 0 }}
              />
              <Controls
                position="bottom-left"
                showInteractive={false}
                style={{ left: 0, bottom: 0 }}
              />
              <ConnectionArrowsOverlay edges={flowEdges} />
              {isShapeMode && selectedShape && (
                <ShapeDragOverlay
                  selectedShape={selectedShape}
                  onAddShapeNode={(node) => {
                    console.log('onAddShapeNode called with:', node);
                    // Создаем shape node через useAddNode с новыми параметрами
                    const shapeNode = addNodeHelpers.createShapeNode(
                      node.position,
                      node.width,
                      node.height,
                      node.payload,
                    ) as BoardCanvasProps['nodes'][number];
                    setLocalNodes((prev) => {
                      const next = [...prev, shapeNode];
                      queueMicrotask(() => {
                        emitNodesChange(next);
                      });
                      return next;
                    });
                    // Автоматически выделяем созданный узел и сбрасываем tool в select (как в Miro)
                    onSelectNode?.(shapeNode.id);
                    setTool('select');
                  }}
                />
              )}
              {isPenMode && (
                <FreehandOverlay
                  onAddPenNode={(node) => {
                    console.log('onAddPenNode called with:', node);
                    // Добавляем pen node в localNodes
                    const externalNode = {
                      id: node.id,
                      type: 'pen' as const,
                      position: node.position,
                      payload: {
                        points: node.data.points,
                        initialSize: node.data.initialSize,
                      },
                    };
                    console.log('Adding to localNodes:', externalNode);
                    setLocalNodes((prev) => {
                      const next = [...prev, externalNode];
                      console.log(
                        'localNodes updated, new length:',
                        next.length,
                        'pen nodes:',
                        next.filter((n) => n.type === 'pen').length,
                      );
                      // Вызываем emitNodesChange для сохранения изменений
                      queueMicrotask(() => {
                        emitNodesChange(next);
                      });
                      return next;
                    });
                    // Немедленно добавляем в flowNodes для отображения
                    // useEffect который зависит от mapNodes обновит его позже с правильными данными из localNodes
                    setFlowNodes((prev) => {
                      if (prev.some((n) => n.id === node.id)) {
                        console.log('Node already exists in flowNodes:', node.id);
                        return prev;
                      }
                      // Добавляем node с правильной структурой для React Flow
                      const flowNode: Node = {
                        ...node,
                        selected: node.id === selectedNodeId,
                        // Убеждаемся, что pen node получает правильный zIndex
                        style: {
                          ...node.style,
                          zIndex: node.style?.zIndex ?? 10, // Pen nodes должны быть выше дата-клеток
                        },
                      };
                      console.log('Adding to flowNodes:', flowNode);
                      return [...prev, flowNode];
                    });
                  }}
                />
              )}
              {/* Collaborative cursors overlay */}
              <CollaborativeCursors cursors={cursors} />
            </ReactFlow>
          </div>
        </div>
        <BoardCommandBar
          currentTool={tool}
          onChangeTool={setTool}
          portalRoot={canvasRootRef.current}
          selectedNodeType={selectedDataNodeType}
          selectedNodeStatus={selectedDataNodeStatus}
          onRunSelectedNode={canRunSelectedNode ? handleRunSelectedNode : undefined}
          onRunDownstreamSelectedNode={
            canRunDownstream ? handleRunDownstreamSelectedNode : undefined
          }
          canRunSelectedNode={canRunSelectedNode}
          canRunDownstream={canRunDownstream}
          onAddSqlNode={handleAddSqlNode}
          onAddPythonNode={handleAddPythonNode}
          onAddDatabaseNode={handleAddDatabaseNode}
          onAddPlotNode={handleAddPlotNode}
          onAddVoiceNode={handleAddVoiceNode}
          onUploadSpreadsheet={handleUploadSpreadsheet}
          selectedShape={selectedShape}
          onSelectShape={setSelectedShape}
          onDeleteSelection={handleDeleteSelection}
          hasSelection={hasSelection}
        />
      </div>
    </FileDropOverlay>
  );
}
