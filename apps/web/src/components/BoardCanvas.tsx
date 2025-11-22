"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Connection,
  ConnectionStartParams,
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
} from "reactflow";
import "reactflow/dist/style.css";

import type { ExecutionEntry, NodeStatus, ExecutionStoreState } from "../state/executionStore";
import { useExecutionStore } from "../state/executionStore";
import { InteractiveResultTable } from "./InteractiveResultTable";
import { PlotPreview } from "./PlotPreview";
import {
  getDefaultNodeWidth,
  useCanvasLayoutStore,
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
  type CanvasLayoutState,
} from "../state/canvasLayoutStore";
import { useAddNode } from "../state/useAddNode";
import { ConnectionArrow } from "./ConnectionArrow";
import { resolveConnectionEndpoints, type ConnectionOrigin } from "./connectionUtils";
import { BoardInspector } from "./BoardInspector";
import { BoardCommandBar, type CanvasTool } from "./BoardCommandBar";
import { StickyNode } from "./StickyNode";
import { FreehandOverlay } from "./pen/FreehandOverlay";
import { PenNode } from "./pen/PenNode";
import { TextNode } from "./TextNode";
import { DatabaseNode } from "./flowNodes/DatabaseNode";
import { PlotNode } from "./flowNodes/PlotNode";

const MonacoEditor = dynamic(async () => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-32 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-xs text-slate-400">
      Loading editor…
    </div>
  ),
});

type CanvasNodeType =
  | "sql"
  | "python"
  | "table"
  | "plot"
  | "note"
  | "text"
  | "shape"
  | "image"
  | "pen"
  | "database";

type BoardCanvasProps = {
  board: {
    id: string;
    workspaceId: string;
    title: string;
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
  onRunDownstream: (nodeId: string) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onNodesChange?: (nodes: BoardCanvasProps["nodes"]) => void;
  onEdgesChange?: (edges: BoardCanvasProps["edges"]) => void;
};

type NodeData = {
  nodeId: string;
  nodeType: "sql" | "python";
  nodeKind: "sql" | "python" | "table" | "plot";
  execution?: ExecutionEntry;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onRunDownstream: () => void;
  width: number;
  isCodeCollapsed: boolean;
  onToggleCodeCollapsed: () => void;
};

const statusColors: Record<NodeStatus, string> = {
  idle: "border-slate-200",
  running: "border-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.18)]",
  success: "border-emerald-300 shadow-[0_0_14px_rgba(34,197,94,0.18)]",
  error: "border-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.2)]",
};

export const DATA_NODE_HANDLE_CLASS = "!h-3 !w-3 !bg-slate-400";
const dataNodeHandles = [
  { id: "left", type: "target" as const, position: Position.Left },
  { id: "top", type: "target" as const, position: Position.Top },
  { id: "right", type: "source" as const, position: Position.Right },
  { id: "bottom", type: "source" as const, position: Position.Bottom },
];

export function DataNodeHandles() {
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
        />
      ))}
    </>
  );
}

function getNodeColor(type: string) {
  switch (type) {
    case "sql":
      return "#3b82f6";
    case "python":
      return "#22c55e";
    case "plot":
      return "#a855f7";
    default:
      return "#f97316";
  }
}

function createEdgeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function StatusBadge({ status }: { status: NodeStatus }) {
  const text =
    status === "idle"
      ? "IDLE"
      : status === "running"
      ? "RUNNING"
      : status === "success"
      ? "SUCCESS"
      : "ERROR";
  const tone =
    status === "running"
      ? "bg-amber-100 text-amber-600 border border-amber-200"
      : status === "success"
      ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
      : status === "error"
      ? "bg-rose-100 text-rose-600 border border-rose-200"
      : "bg-slate-200 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{text}</span>;
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
  tone: "stdout" | "stderr" | "warning";
  onDismiss?: () => void;
}) {
  const styles =
    tone === "stderr"
      ? "border border-rose-200 bg-rose-50 text-rose-600"
      : tone === "warning"
      ? "border border-amber-200 bg-amber-50 text-amber-700"
      : "border border-slate-200 bg-slate-100 text-slate-600";
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
  const execution = data.execution;
  const status: NodeStatus = execution?.status ?? "idle";
  const result = execution?.output?.kind === "sql" ? execution.output.result : undefined;
  const code = execution?.code ?? "";
  const codeLines = code.split("\n").length;
  const expandedHeight = Math.max(240, codeLines * 18 + 60);
  const editorHeight = data.isCodeCollapsed ? Math.min(220, expandedHeight) : expandedHeight;
  return (
    <div
      className={`group rounded-md border bg-white shadow-lg px-5 pb-5 pt-4 transition-all ${
        statusColors[status]
      } ${selected ? "ring-2 ring-indigo-400" : ""}`}
      style={{ width: data.width, minHeight: 320 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_WIDTH}
        maxWidth={MAX_NODE_WIDTH}
        minHeight={240}
        lineClassName="!border-indigo-200"
        handleStyle={{ width: 12, height: 12, borderRadius: 6, border: "2px solid #6366f1", background: "#EEF2FF" }}
      />
      <DataNodeHandles />
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
            disabled={status === "running"}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
          >
            {status === "running" ? "Running…" : "Run"}
          </button>
          <button
            onClick={data.onRunDownstream}
            disabled={status === "running"}
            className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run downstream
          </button>
          <button
            onClick={data.onToggleCodeCollapsed}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-100"
          >
            {data.isCodeCollapsed ? "Expand code" : "Collapse code"}
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
          path={`${data.nodeId}-sql-${data.isCodeCollapsed ? "compact" : "full"}`}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            padding: { top: 8 },
          }}
          onChange={(next) => data.onCodeChange(next ?? "")}
        />
      </div>

      {execution?.error && <ErrorMessage message={execution.error} />}
      {result && (
        <div className="mt-3">
          <InteractiveResultTable result={result} compact />
        </div>
      )}
    </div>
  );
};

const PythonNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  const execution = data.execution;
  const status: NodeStatus = execution?.status ?? "idle";
  const output = execution?.output?.kind === "python" ? execution.output.result : undefined;
  const code = execution?.code ?? "";
  const codeLines = code.split("\n").length;
  const expandedHeight = Math.max(240, codeLines * 18 + 60);
  const editorHeight = data.isCodeCollapsed ? Math.min(220, expandedHeight) : expandedHeight;
  const stdoutContent = output?.stdout && output.stdout.trim().length > 0 ? output.stdout : "";
  const stderrContent = output?.stderr && output.stderr.trim().length > 0 ? output.stderr.trim() : "";
  const stderrTone = execution?.error ? "stderr" : "warning";
  const stderrTitle = execution?.error ? "Stderr" : "Warnings";
  const dismissError = useExecutionStore((state: ExecutionStoreState) => state.dismissError);
  const dismissWarnings = useExecutionStore((state: ExecutionStoreState) => state.dismissWarnings);
  const hiddenOutputs = execution?.hiddenOutputs ?? { error: false, warnings: false };
  const shouldShowError = Boolean(execution?.error) && !hiddenOutputs.error;
  const shouldShowWarnings = Boolean(stderrContent) && !hiddenOutputs.warnings;
  return (
    <div
      className={`group rounded-md border bg-white shadow-lg px-5 pb-5 pt-4 transition-all ${
        statusColors[status]
      } ${selected ? "ring-2 ring-indigo-400" : ""}`}
      style={{ width: data.width, minHeight: 320 }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_NODE_WIDTH}
        maxWidth={MAX_NODE_WIDTH}
        minHeight={260}
        lineClassName="!border-indigo-200"
        handleStyle={{ width: 12, height: 12, borderRadius: 6, border: "2px solid #6366f1", background: "#EEF2FF" }}
      />
      <DataNodeHandles />
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
            disabled={status === "running"}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
          >
            {status === "running" ? "Running…" : "Run"}
          </button>
          <button
            onClick={data.onRunDownstream}
            disabled={status === "running"}
            className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run downstream
          </button>
          <button
            onClick={data.onToggleCodeCollapsed}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-100"
          >
            {data.isCodeCollapsed ? "Expand code" : "Collapse code"}
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
          path={`${data.nodeId}-python-${data.isCodeCollapsed ? "compact" : "full"}`}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            padding: { top: 8 },
          }}
          onChange={(next) => data.onCodeChange(next ?? "")}
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
      {status === "success" && !output?.stdout && !output?.stderr && !output?.table && !output?.plotJson && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
          Execution finished without captured output. Use <code>print()</code>, assign to <code>result</code>, or set {" "}
          <code>plot</code>.
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  sqlNode: SqlNodeComponent,
  pythonNode: PythonNodeComponent,
  sticky: StickyNode,
  pen: PenNode,
  textNode: TextNode,
  databaseNode: DatabaseNode,
  plotNode: PlotNode,
};

type ConnectionArrowsOverlayProps = {
  edges: Edge[];
};

function ConnectionArrowsOverlay({ edges }: ConnectionArrowsOverlayProps) {
  const { getNode } = useReactFlow();
  const viewport = useViewport();

  const segments = useMemo(() => {
    const pairs: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }> = [];

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
      style={{ transform, transformOrigin: "0 0" }}
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
  onRunDownstream,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
  onEdgesChange,
}: BoardCanvasProps) {
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : null;
  const inspectorEntry = selectedNode ? executionEntries[selectedNode.id] : undefined;
  const inspectorKind =
    selectedNode && (selectedNode.type === "sql" || selectedNode.type === "python" || selectedNode.type === "plot")
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
      <div className="flex h-full w-full flex-1 min-h-0">
        <InnerBoardCanvas
          board={board}
          nodes={nodes}
          edges={edges}
          executionEntries={executionEntries}
          onCodeChange={onCodeChange}
          onRunNode={onRunNode}
          onRunDownstream={onRunDownstream}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />
        {/* Всегда резервируем фиксированную ширину для инспектора, чтобы тулбары не перескакивали */}
        <div className="flex-none transition-all duration-200" style={{ width: `${inspectorWidth}px`, minWidth: `${inspectorWidth}px`, maxWidth: `${inspectorWidth}px` }}>
          {inspectorKind && selectedNode ? (
            <BoardInspector
              nodeLabel={
                (selectedNode.payload?.label as string | undefined) ??
                `${inspectorKind === "sql" ? "SQL" : inspectorKind === "python" ? "Python" : "Plot"} ${selectedNode.id.slice(0, 6)}`
              }
              kind={inspectorKind}
              status={inspectorEntry?.status ?? "idle"}
              error={inspectorEntry?.error}
              lastStartedAt={inspectorEntry?.startedAt}
              lastFinishedAt={inspectorEntry?.finishedAt}
              code={inspectorEntry?.code ?? ""}
              onChange={(value) => onCodeChange(selectedNode.id, value ?? "")}
              onCollapseChange={setInspectorCollapsed}
              result={
                inspectorKind === "sql"
                  ? inspectorEntry?.output?.kind === "sql"
                    ? inspectorEntry.output.result
                    : undefined
                  : inspectorKind === "python"
                  ? inspectorEntry?.output?.kind === "python"
                    ? inspectorEntry.output.result
                    : undefined
                  : undefined
              }
              nodeId={selectedNode.id}
              nodes={nodes}
              edges={edges}
              executionEntries={executionEntries}
              onPlotConfigChange={
                inspectorKind === "plot"
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
                          : n
                      );
                      onNodesChange?.(updatedNodes);
                    }
                  : undefined
              }
            />
          ) : null}
        </div>
      </div>
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
  onRunDownstream,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
  onEdgesChange,
}: InnerProps) {
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const nodeSizes = useCanvasLayoutStore((state: CanvasLayoutState) => state.nodeSizes);
  const setNodeWidth = useCanvasLayoutStore((state: CanvasLayoutState) => state.setNodeWidth);
  const codeCollapsedMap = useCanvasLayoutStore((state: CanvasLayoutState) => state.codeCollapsed);
  const toggleCodeCollapsed = useCanvasLayoutStore((state: CanvasLayoutState) => state.toggleCodeCollapsed);
  const registerNode = useExecutionStore((state: ExecutionStoreState) => state.registerNode);
  const addNodeHelpers = useAddNode();
  const rf = useReactFlow();
  const connectOriginRef = useRef<ConnectionOrigin | null>(null);

  const [localNodes, setLocalNodes] = useState(nodes);
  const localNodesRef = useRef(localNodes);
  const [localEdges, setLocalEdges] = useState(edges);
  const textNodeResizeTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes]);

  useEffect(() => {
    localNodesRef.current = localNodes;
  }, [localNodes]);

  // Cleanup для таймеров ресайза text nodes при размонтировании
  useEffect(() => {
    return () => {
      textNodeResizeTimerRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      textNodeResizeTimerRef.current.clear();
    };
  }, []);

  // Helper to notify parent AFTER current render tick to avoid render-phase setState warning
  const lastEmittedRef = useRef<string>("");
  const sanitizeExternalNodes = useCallback((arr: BoardCanvasProps["nodes"]) => {
    return arr.map((n) => {
      const id =
        (typeof n.id === "string" && n.id) ||
        (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `node_${Date.now()}`);
      const position = {
        x: Number.isFinite(Number((n as any).position?.x)) ? Number((n as any).position?.x) : 0,
        y: Number.isFinite(Number((n as any).position?.y)) ? Number((n as any).position?.y) : 0,
      };
      const type = (n.type === "sticky" ? ("note" as const) : (n.type as any)) as BoardCanvasProps["nodes"][number]["type"];
      const basePayload = (n.payload && typeof n.payload === "object" ? n.payload : {}) as Record<string, unknown>;
      const payload =
        type === "note"
          ? {
              ...(basePayload ?? {}),
              text: typeof (basePayload as any).text === "string" ? (basePayload as any).text : ((basePayload as any).noteContent ?? ""),
              // дублируем ключ для обратной совместимости с бэком, если он ожидает другое имя
              noteContent:
                typeof (basePayload as any).noteContent === "string"
                  ? (basePayload as any).noteContent
                  : typeof (basePayload as any).text === "string"
                  ? (basePayload as any).text
                  : "",
            }
          : basePayload;
      return { id, type, position, payload };
    });
  }, []);
  const sanitizeExternalEdges = useCallback(
    (arr: BoardCanvasProps["edges"]) => {
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
    },
    [],
  );
  const emitNodesChange = useCallback(
    (next: BoardCanvasProps["nodes"]) => {
      if (!onNodesChange) return;
      const sanitized = sanitizeExternalNodes(next);
      const signature = JSON.stringify(sanitized);
      if (signature === lastEmittedRef.current) return;
      lastEmittedRef.current = signature;
      queueMicrotask(() => {
        onNodesChange(sanitized);
      });
    },
    [onNodesChange, sanitizeExternalNodes],
  );
  const lastEdgesEmittedRef = useRef<string>("");
  const emitEdgesChange = useCallback(
    (next: BoardCanvasProps["edges"]) => {
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

  const [tool, setTool] = useState<CanvasTool>("select");
  const isStickyMode = tool === "note";
  const isPenMode = tool === "pen";
  const isTextMode = tool === "text";

  const selectedDataNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = localNodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;
    if (node.type === "sql" || node.type === "python" || node.type === "plot") {
      return node;
    }
    return null;
  }, [selectedNodeId, localNodes]);

  const selectedDataNodeId = selectedDataNode?.id ?? null;
  const selectedDataNodeType = selectedDataNode ? (selectedDataNode.type as "sql" | "python" | "plot") : null;
  const selectedDataNodeStatus: NodeStatus | undefined = selectedDataNodeId
    ? executionEntries[selectedDataNodeId]?.status ?? "idle"
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
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!event.shiftKey) {
          if (key === "v") {
            setTool("select");
            return;
          }
          if (key === "n") {
            setTool((prev) => (prev === "note" ? "select" : "note"));
            return;
          }
          if (key === "p") {
            setTool((prev) => (prev === "pen" ? "select" : "pen"));
            return;
          }
          if (key === "t") {
            setTool((prev) => (prev === "text" ? "select" : "text"));
            return;
          }
        }

        if (event.key === "Enter" && event.shiftKey && !event.metaKey && !event.ctrlKey) {
          if (canRunSelectedNode) {
            event.preventDefault();
            handleRunSelectedNode();
          }
          return;
        }

        if (
          event.key === "Enter" &&
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRunDownstream, canRunSelectedNode, handleRunDownstreamSelectedNode, handleRunSelectedNode, setTool]);

  const mapNodes = useCallback(() => {
    const penNodes = localNodes.filter((n) => n.type === "pen");
    if (penNodes.length > 0) {
      console.log("mapNodes: Found pen nodes in localNodes:", penNodes.length, penNodes.map((n) => ({
        id: n.id,
        hasPayload: !!n.payload,
        hasPoints: !!(n.payload as any)?.points,
        hasInitialSize: !!(n.payload as any)?.initialSize,
      })));
    }
    return localNodes
      .filter((node) => node.type !== "draw") // draw nodes не отображаются в React Flow (legacy)
      .filter((node) => node.type !== "note") // sticky НЕ идут в flowNodes, они рендерятся через stickyNodes
      .map((node) => {
        const isSql = node.type === "sql";
        const isPython = node.type === "python";
        const isDatabase = node.type === "database";
        const isPlot = node.type === "plot";
        const isPen = node.type === "pen";
        const isText = node.type === "text";
        const type = isSql ? "sqlNode" : isPython ? "pythonNode" : isDatabase ? "databaseNode" : isPlot ? "plotNode" : isPen ? "pen" : isText ? "textNode" : "default";
        
        // Определяем тип слоя для сортировки: data nodes (0) идут раньше, canvas nodes (1) - позже
        const isDataNode = isSql || isPython || isDatabase || isPlot;
        const isCanvasNode = isPen || isText;
        
        if (isPen) {
          console.log("mapNodes: Mapping pen node", {
            id: node.id,
            payload: node.payload,
            points: (node.payload as any)?.points?.length,
            initialSize: (node.payload as any)?.initialSize,
          });
        }
      const entry = executionEntries[node.id];
      const storedWidth = nodeSizes[node.id]?.width ?? getDefaultNodeWidth();
      const isCodeCollapsed = codeCollapsedMap[node.id] ?? false;
      
      // Базовые стили для каждого типа
      const baseStyle =
        type === "default"
          ? { width: 280, borderRadius: 16 }
          : isPen
          ? {
              width: ((node.payload as any)?.initialSize?.width ?? 100),
              height: ((node.payload as any)?.initialSize?.height ?? 100),
              background: "transparent",
              border: "none",
              boxShadow: "none",
            }
          : isText
          ? {
              width: ((node.payload as any)?.ui?.width ?? 240),
              height: ((node.payload as any)?.ui?.height ?? 80),
              background: "transparent",
              border: "none",
              boxShadow: "none",
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
              initialSize: ((node.payload as any)?.initialSize ?? { width: 100, height: 100 }) as { width: number; height: number },
            }
          : isText
          ? (() => {
              const payload = (node.payload ?? {}) as any;
              const text = payload.text ?? payload.textContent ?? "";
              const fontSize = payload.fontSize ?? 18;
              const fontFamily = payload.fontFamily ?? "Inter, sans-serif";
              const color = payload.color ?? "#0f172a";
              const textAlign = payload.textAlign ?? "left";
              const richContent = payload.richContent ?? payload.richTextHtml ?? null;

              return {
                nodeId: node.id,
                nodeType: "text" as const,
                text,
                fontSize,
                fontFamily,
                color,
                textAlign,
                richContentHtml: richContent,
                onChangeText: (id: string, newText: string) => {
                  setLocalNodes((prev) => {
                    const next = prev.map((n) =>
                      n.id === id && n.type === "text"
                        ? {
                            ...n,
                            payload: {
                              ...(n.payload ?? {}),
                              text: newText,
                              textContent: newText,
                            },
                          }
                        : n
                    );
                    emitNodesChange(next);
                    return next;
                  });
                },
                onChangeFormat: (
                  id: string,
                  patch: Partial<{
                    text: string;
                    fontSize: number;
                    fontFamily: string;
                    color: string;
                    textAlign: "left" | "center" | "right";
                    richContent: string;
                  }>
                ) => {
                  setLocalNodes((prev) => {
                    const next = prev.map((n) =>
                      n.id === id && n.type === "text"
                        ? {
                            ...n,
                            payload: {
                              ...(n.payload ?? {}),
                              ...patch,
                            },
                          }
                        : n
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
              onUpdatePayload: (nodeId: string, payload: Record<string, unknown>) => {
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
                      : n
                  );
                  emitNodesChange(next);
                  return next;
                });
              },
              payload: node.payload,
            }
          : isPlot
          ? {
              nodeId: node.id,
              payload: node.payload,
              edges: localEdges,
              width: storedWidth,
            }
          : {
              nodeId: node.id,
              nodeType: isSql ? "sql" : isPython ? "python" : "sql",
              execution: entry,
              onCodeChange: (code: string) => onCodeChange(node.id, code),
              onRun: () => onRunNode(node.id),
              onRunDownstream: () => onRunDownstream(node.id),
              onToggleCodeCollapsed: () => toggleCodeCollapsed(node.id),
              width: storedWidth,
              isCodeCollapsed,
              nodeKind: node.type,
            },
        style: {
          ...baseStyle,
          // Явный zIndex: дата-клетки = 1, элементы канвы pen = 10, text = 15 (между pen и sticky)
          zIndex: isDataNode ? 1 : isPen ? 10 : isText ? 15 : 1,
        },
        // Pen nodes draggable только когда не в режиме pen
        // Text nodes draggable только когда не в режиме text (в режиме select можно перетаскивать)
        // Остальные ноды draggable всегда (если не в режиме создания sticky/pen/text)
        draggable: isPen ? !isPenMode : isText ? !isTextMode : !isStickyMode && !isPenMode && !isTextMode,
        selectable: isPen ? !isPenMode : isText ? !isTextMode : !isStickyMode && !isPenMode && !isTextMode,
        // Служебное поле для сортировки: data nodes (0) идут раньше, canvas nodes (1) - позже
        _sortOrder: isDataNode ? 0 : isCanvasNode ? 1 : 0,
      } as Node & { _sortOrder: number };
    })
    // Сортируем: сначала дата-клетки (_sortOrder 0), потом элементы канвы (_sortOrder 1)
    .sort((a, b) => a._sortOrder - b._sortOrder);
  }, [executionEntries, localNodes, nodeSizes, codeCollapsedMap, onCodeChange, onRunNode, onRunDownstream, toggleCodeCollapsed, isPenMode, isTextMode, emitNodesChange, setLocalNodes, board.workspaceId]);

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

  useEffect(() => {
    const mapped = mapNodes();
    const penNodesInMapped = mapped.filter((n) => n.type === "pen");
    console.log("useEffect mapNodes: mapped nodes:", mapped.length, "pen nodes:", penNodesInMapped.length);
    
    setFlowNodes((prev) => {
      // Объединяем mapped nodes с существующими, чтобы сохранить позиции и состояние
      const mappedById = new Map(mapped.map((n) => [n.id, n]));
      const existingById = new Map(prev.map((n) => [n.id, n]));
      
      const existingPenNodes = Array.from(existingById.values()).filter((n) => n.type === "pen");
      console.log("useEffect mapNodes: existing pen nodes:", existingPenNodes.length);
      
      // Создаем новый массив: сначала mapped nodes, потом существующие, которых нет в mapped
      const result = mapped.map((node) => {
        const existing = existingById.get(node.id);
        const isDataNode = node.type === "sqlNode" || node.type === "pythonNode";
        
        // Для data nodes сохраняем width в data из существующего node или из node.width
        const existingWidth = existing?.width ?? existing?.data?.width;
        const updatedData = isDataNode && existingWidth
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
          selected: existing?.selected ?? (node.id === selectedNodeId),
          // Используем width/height из mapped node (React Flow обновляет их через applyNodeChanges)
          width: node.width ?? existing?.width,
          height: node.height ?? existing?.height,
          // Убеждаемся, что zIndex сохраняется из mapNodes (где уже установлен правильный слой)
          style: {
            ...node.style,
            // Используем width/height из mapped node style (React Flow обновляет их)
            width: node.style?.width ?? existing?.style?.width,
            height: node.style?.height ?? existing?.style?.height,
            zIndex: node.style?.zIndex ?? (node.type === "pen" ? 10 : 1),
          },
        };
      });
      
      // Добавляем существующие nodes, которых нет в mapped
      // Это важно для pen nodes, которые могут быть добавлены напрямую в flowNodes
      // до того, как они попадут в localNodes и будут обработаны mapNodes
      for (const [id, existing] of existingById) {
        if (!mappedById.has(id)) {
          // Сохраняем pen nodes даже если их еще нет в mapped
          // Они появятся в следующем обновлении когда localNodes обновится
          const isPenNode = existing.type === "pen";
          if (isPenNode && existing.data && (existing.data as any).points) {
            console.log("useEffect mapNodes: Preserving pen node from existing:", id);
            result.push({
              ...existing,
              // Обновляем selected для синхронизации с selectedNodeId
              selected: id === selectedNodeId,
              // Убеждаемся, что pen node сохраняет правильный zIndex
              style: {
                ...existing.style,
                zIndex: existing.style?.zIndex ?? 10, // Pen nodes должны быть выше дата-клеток
              },
            });
          }
        }
      }
      
      // Убеждаемся, что результат отсортирован по слоям: сначала data nodes, потом canvas nodes
      const sortedResult = result.sort((a, b) => {
        const aOrder = (a as any)._sortOrder ?? (a.type === "pen" ? 1 : 0);
        const bOrder = (b as any)._sortOrder ?? (b.type === "pen" ? 1 : 0);
        return aOrder - bOrder;
      });
      
      const finalPenNodes = sortedResult.filter((n) => n.type === "pen");
      console.log("useEffect mapNodes: Final result pen nodes:", finalPenNodes.length);
      if (finalPenNodes.length > 0) {
        console.log("useEffect mapNodes: Final pen nodes details:", finalPenNodes.map((n) => ({
          id: n.id,
          width: n.width,
          height: n.height,
          position: n.position,
          hasData: !!n.data,
          hasPoints: !!(n.data as any)?.points,
        })));
      }
      
      return sortedResult;
    });
  }, [mapNodes]);

  const didInitialFitRef = useRef(false);
  useEffect(() => {
    if (!flowInstance || flowNodes.length === 0 || didInitialFitRef.current) return;
    flowInstance.fitView({ padding: 0.3, includeHiddenNodes: true, duration: 0 });
    didInitialFitRef.current = true;
  }, [flowInstance, flowNodes.length]);

  const flowEdges = useMemo<Edge[]>(
    () =>
      localEdges.map((edge) => ({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        type: "step",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
        animated: true,
        style: { stroke: "#94a3b8", strokeWidth: 2.2 },
      })),
    [localEdges],
  );

  const commitFlowNodesToLocal = useCallback(
    (nextFlowNodes: Node[], shouldNotify: boolean) => {
      const prev = localNodesRef.current;
      const prevById = new Map(prev.map((node) => [node.id, node]));
      let mutated = false;
      const nextLocalCore = nextFlowNodes.map((flowNode) => {
        const previous = prevById.get(flowNode.id);
        const position = flowNode.position ?? { x: previous?.position.x ?? 0, y: previous?.position.y ?? 0 };
        // Для pen nodes используем тип из data или previous
        const isPenNode = (flowNode.data as any)?.points !== undefined;
        const nodeKind = isPenNode
          ? "pen"
          : ((flowNode.data as NodeData | undefined)?.nodeKind ?? previous?.type ?? "sql") as BoardCanvasProps["nodes"][number]["type"];
        // Для pen nodes сохраняем points и initialSize из data
        const payload = isPenNode
          ? {
              points: (flowNode.data as any).points,
              initialSize: (flowNode.data as any).initialSize,
            }
          : previous?.payload ?? {};
        if (!previous || previous.position.x !== position.x || previous.position.y !== position.y || previous.type !== nodeKind) {
          mutated = true;
        }
        return {
          id: flowNode.id,
          type: nodeKind,
          position,
          payload,
        };
      });
      // preserve sticky notes and pen nodes that are not part of nextFlowNodes
      const nextIds = new Set(nextFlowNodes.map((n) => n.id));
      const preservedNotes = prev.filter((n) => n.type === "note" && !nextIds.has(n.id));
      const preservedPen = prev.filter((n) => n.type === "pen" && !nextIds.has(n.id));
      const nextLocal = [...nextLocalCore, ...preservedNotes, ...preservedPen];

      if (mutated) {
        setLocalNodes(nextLocal);
        if (shouldNotify) {
          emitNodesChange(nextLocal);
        }
      }
    },
    [emitNodesChange],
  );

  // Sticky nodes live alongside flow nodes; we render a merged list
  const [stickyNodes, setStickyNodes] = useState<Node[]>([]);
  
  // Инициализируем stickyNodes из localNodes при загрузке/изменении localNodes
  useEffect(() => {
    const noteNodes = localNodes.filter((n) => n.type === "note");
    if (noteNodes.length > 0) {
      const existingStickyIds = new Set(stickyNodes.map((n) => n.id));
      const newStickyNodes = noteNodes
        .filter((n) => !existingStickyIds.has(n.id))
        .map((n) => {
          const text = (n.payload as any)?.text ?? (n.payload as any)?.noteContent ?? "";
          const nodeWidth = Number(((n.payload as any)?.ui as any)?.width ?? 160);
          const nodeHeight = Number(((n.payload as any)?.ui as any)?.height ?? 96);
          const color = (n.payload as any)?.color ?? "#EBC347"; // yellow по умолчанию
          const fontSize = (n.payload as any)?.fontSize ?? 14;
          const fontFamily = (n.payload as any)?.fontFamily ?? "Inter, sans-serif";
          const isBold = (n.payload as any)?.isBold ?? false;
          const isItalic = (n.payload as any)?.isItalic ?? false;
          
          return {
            id: n.id,
            type: "sticky" as const,
            position: n.position,
            // Важно: передаем width и height напрямую в props, а не только в style
            // React Flow NodeResizer использует эти props для управления размерами
            width: nodeWidth,
            height: nodeHeight,
            data: {
              text,
              color,
              fontSize,
              fontFamily,
              isBold,
              isItalic,
              onChangeText: (nid: string, text: string) =>
                setStickyNodes((cur) => {
                  const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), text } } : st));
                  setLocalNodes((prev) => {
                    const next = prev.map((ext) =>
                      ext.id === nid && ext.type === "note"
                        ? { ...ext, payload: { ...(ext.payload ?? {}), text, noteContent: text } }
                        : ext,
                    );
                    emitNodesChange(next);
                    return next;
                  });
                  return updated;
                }),
              onChangeColor: (nid: string, newColor: string) => {
                setStickyNodes((cur) => {
                  const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), color: newColor } } : st));
                  setLocalNodes((prev) => {
                    const next = prev.map((ext) =>
                      ext.id === nid && ext.type === "note"
                        ? { ...ext, payload: { ...(ext.payload ?? {}), color: newColor } }
                        : ext,
                    );
                    emitNodesChange(next);
                    return next;
                  });
                  return updated;
                });
              },
              onChangeFontSize: (nid: string, newFontSize: number) => {
                setStickyNodes((cur) => {
                  const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), fontSize: newFontSize } } : st));
                  setLocalNodes((prev) => {
                    const next = prev.map((ext) =>
                      ext.id === nid && ext.type === "note"
                        ? { ...ext, payload: { ...(ext.payload ?? {}), fontSize: newFontSize } }
                        : ext,
                    );
                    emitNodesChange(next);
                    return next;
                  });
                  return updated;
                });
              },
              onChangeFontFamily: (nid: string, newFontFamily: string) => {
                setStickyNodes((cur) => {
                  const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), fontFamily: newFontFamily } } : st));
                  setLocalNodes((prev) => {
                    const next = prev.map((ext) =>
                      ext.id === nid && ext.type === "note"
                        ? { ...ext, payload: { ...(ext.payload ?? {}), fontFamily: newFontFamily } }
                        : ext,
                    );
                    emitNodesChange(next);
                    return next;
                  });
                  return updated;
                });
              },
              onChangeBold: (nid: string, newIsBold: boolean) => {
                setStickyNodes((cur) => {
                  const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), isBold: newIsBold } } : st));
                  setLocalNodes((prev) => {
                    const next = prev.map((ext) =>
                      ext.id === nid && ext.type === "note"
                        ? { ...ext, payload: { ...(ext.payload ?? {}), isBold: newIsBold } }
                        : ext,
                    );
                    emitNodesChange(next);
                    return next;
                  });
                  return updated;
                });
              },
              onChangeItalic: (nid: string, newIsItalic: boolean) => {
                setStickyNodes((cur) => {
                  const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), isItalic: newIsItalic } } : st));
                  setLocalNodes((prev) => {
                    const next = prev.map((ext) =>
                      ext.id === nid && ext.type === "note"
                        ? { ...ext, payload: { ...(ext.payload ?? {}), isItalic: newIsItalic } }
                        : ext,
                    );
                    emitNodesChange(next);
                    return next;
                  });
                  return updated;
                });
              },
            },
            style: {
              width: nodeWidth,
              height: nodeHeight,
              // Явный zIndex для sticky: выше всех других nodes (20)
              zIndex: 20,
            },
          } as Node;
        });
      
      if (newStickyNodes.length > 0) {
        setStickyNodes((prev) => {
          const prevIds = new Set(prev.map((n) => n.id));
          const unique = newStickyNodes.filter((n) => !prevIds.has(n.id));
          return [...prev, ...unique];
        });
      }
    }
    // Удаляем stickyNodes, которых больше нет в localNodes
    setStickyNodes((prev) => {
      const localNoteIds = new Set(noteNodes.map((n) => n.id));
      return prev.filter((n) => localNoteIds.has(n.id));
    });
  }, [localNodes, emitNodesChange]);

  const hasSelection = useMemo(() => {
    const nodes = flowNodes ?? [];
    const edges = flowEdges ?? [];
    const sticky = stickyNodes ?? [];
    return (
      nodes.some((n: any) => n?.selected) ||
      edges.some((e: any) => e?.selected) ||
      sticky.some((n: any) => n?.selected || n.id === selectedNodeId)
    );
  }, [flowNodes, flowEdges, stickyNodes, selectedNodeId]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const stickyIds = new Set(stickyNodes.map((n) => n.id));
      const stickyChanges: NodeChange[] = [];
      const flowChanges: NodeChange[] = [];
      for (const ch of changes) {
        const id = (ch as any).id as string | undefined;
        if (id && stickyIds.has(id)) stickyChanges.push(ch);
        else flowChanges.push(ch);
      }
      if (stickyChanges.length) {
        // Проверяем, есть ли активный dragging для sticky nodes
        const hasActiveDragging = stickyChanges.some((ch) => ch.type === "position" && (ch as any).dragging === true);
        
        setStickyNodes((prev) => {
          const updated = applyNodeChanges(stickyChanges, prev);
          // Убеждаемся, что zIndex сохраняется после изменений и selected обновляется
          const updatedWithZIndex = updated.map((node) => {
            // React Flow обновляет width/height через applyNodeChanges при ресайзе
            // Важно: используем node.width и node.height напрямую из applyNodeChanges
            // applyNodeChanges обновляет их автоматически при изменениях dimensions
            // НЕ используем fallback значения здесь, чтобы React Flow мог управлять размерами
            // Fallback только если React Flow еще не установил размеры (undefined)
            const nodeWidth = node.width ?? node.style?.width ?? 160;
            const nodeHeight = node.height ?? node.style?.height ?? 96;
            
            return {
              ...node,
              selected: node.id === selectedNodeId,
              // Сохраняем position из applyNodeChanges (React Flow автоматически обновляет его при ресайзе)
              position: node.position,
              // Сохраняем width/height в props (это важно для NodeResizer)
              // React Flow передает их как числа в props компонента
              width: nodeWidth,
              height: nodeHeight,
              style: {
                ...node.style,
                // Сохраняем width/height и в style для совместимости
                width: nodeWidth,
                height: nodeHeight,
                zIndex: node.style?.zIndex ?? 20, // Сохраняем zIndex = 20 для sticky
              },
            };
          });
          
          // Обновляем localNodes для всех изменений
          setLocalNodes((prevExt) => {
            const next = prevExt.map((ext) => {
              if (ext.type !== "note") return ext;
              const match = updatedWithZIndex.find((n) => n.id === ext.id);
              if (!match) return ext;
              
              const newPos = match.position ?? { x: 0, y: 0 };
              const newText = (match.data as any)?.text ?? (ext.payload as any)?.text ?? "";
              const newColor = (match.data as any)?.color ?? (ext.payload as any)?.color ?? "#EBC347";
              const newFontSize = (match.data as any)?.fontSize ?? (ext.payload as any)?.fontSize ?? 14;
              const newFontFamily = (match.data as any)?.fontFamily ?? (ext.payload as any)?.fontFamily ?? "Inter, sans-serif";
              const newIsBold = (match.data as any)?.isBold ?? (ext.payload as any)?.isBold ?? false;
              const newIsItalic = (match.data as any)?.isItalic ?? (ext.payload as any)?.isItalic ?? false;
              
              // Обновляем размеры из width/height props напрямую (React Flow обновляет их при ресайзе)
              // Важно: используем match.width/match.height, а не style.width/style.height
              const newWidth = match.width ?? match.style?.width ?? ((ext.payload as any)?.ui as any)?.width ?? 160;
              const newHeight = match.height ?? match.style?.height ?? ((ext.payload as any)?.ui as any)?.height ?? 96;
              
              return {
                ...ext,
                position: newPos,
                payload: {
                  ...(ext.payload ?? {}),
                  text: newText,
                  color: newColor,
                  fontSize: newFontSize,
                  fontFamily: newFontFamily,
                  isBold: newIsBold,
                  isItalic: newIsItalic,
                  ui: {
                    ...((ext.payload as any)?.ui ?? {}),
                    width: typeof newWidth === "number" ? newWidth : parseFloat(String(newWidth)) || 160,
                    height: typeof newHeight === "number" ? newHeight : parseFloat(String(newHeight)) || 96,
                  },
                },
              };
            });
            
            // Вызываем emitNodesChange только при окончании dragging (не во время активного ресайза)
            if (!hasActiveDragging) {
              queueMicrotask(() => {
                emitNodesChange(next);
              });
            }
            
            return next;
          });
          
          return updatedWithZIndex;
        });
      }
      if (flowChanges.length) {
        const shouldCommit = flowChanges.some((change) => change.type === "position" && change.dragging !== true);
        setFlowNodes((current) => {
          const next = applyNodeChanges(flowChanges, current);
          // Убеждаемся, что zIndex сохраняется после изменений и сортировка по слоям
          // Также обновляем selected для синхронизации с selectedNodeId
          const nextWithZIndex = next.map((node) => {
            const isPen = node.type === "pen";
            const isText = node.type === "textNode";
            const isDataNode = node.type === "sqlNode" || node.type === "pythonNode";
            
            // Для data nodes обновляем data.width из node.width (который React Flow обновляет через dimensions)
            // Важно: используем node.width напрямую из applyNodeChanges, который уже содержит обновленные размеры и position
            const updatedData = isDataNode && node.width
              ? {
                  ...(node.data as any),
                  width: node.width,
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
              // Сохраняем width/height из applyNodeChanges
              width: node.width,
              height: node.height,
              style: {
                ...node.style,
                // Сохраняем width/height из style, если React Flow их обновил
                width: node.style?.width,
                height: node.style?.height,
                zIndex: node.style?.zIndex ?? (isPen ? 10 : isText ? 15 : isDataNode ? 1 : 1),
              },
              // Сохраняем _sortOrder для корректной сортировки
              _sortOrder: isDataNode ? 0 : (isPen || isText) ? 1 : 0,
            };
          }).sort((a, b) => (a._sortOrder ?? 0) - (b._sortOrder ?? 0));
          if (shouldCommit) {
            commitFlowNodesToLocal(nextWithZIndex, true);
          }
          return nextWithZIndex;
        });
        flowChanges.forEach((change) => {
          if (change.type === "dimensions" && change.id && change.dimensions) {
            const width = change.dimensions.width;
            const height = change.dimensions.height;
            
            // Проверяем, есть ли активный dragging для этого node
            const hasActiveDragging = flowChanges.some(
              (ch) => ch.type === "position" && (ch as any).id === change.id && (ch as any).dragging === true
            );
            
            const node = localNodes.find((n) => n.id === change.id);
            
            // Для text nodes используем debounce, чтобы избежать дергания при ресайзе
            if (node?.type === "text" && width && height) {
              // Очищаем предыдущий таймер для этого узла
              const existingTimer = textNodeResizeTimerRef.current.get(change.id);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }
              
              // Устанавливаем новый таймер для debounce (200ms после последнего изменения)
              const timer = setTimeout(() => {
                setLocalNodes((prev) => {
                  const currentNode = prev.find((n) => n.id === change.id && n.type === "text");
                  if (!currentNode) return prev;
                  
                  const next = prev.map((n) =>
                    n.id === change.id && n.type === "text"
                      ? {
                          ...n,
                          payload: {
                            ...(n.payload ?? {}),
                            ui: {
                              ...((n.payload as any)?.ui ?? {}),
                              width: typeof width === "number" ? width : parseFloat(String(width)) || 240,
                              height: typeof height === "number" ? height : parseFloat(String(height)) || 80,
                            },
                          },
                        }
                      : n
                  );
                  emitNodesChange(next);
                  return next;
                });
                textNodeResizeTimerRef.current.delete(change.id);
              }, 200);
              
              textNodeResizeTimerRef.current.set(change.id, timer);
            } else if (node?.type !== "text" && width && !hasActiveDragging) {
                // Для data nodes сохраняем только width
                requestAnimationFrame(() => {
                  setNodeWidth(change.id!, width);
                });
              }
              // Для pen nodes также сохраняем height
              if (height && node?.type === "pen") {
                requestAnimationFrame(() => {
                  useCanvasLayoutStore.getState().setNodeSize(change.id!, { width, height });
                });
              }
          }
        });
      }
    },
    [commitFlowNodesToLocal, setNodeWidth, stickyNodes, localNodes, emitNodesChange, setLocalNodes],
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
    const template = addNodeHelpers.createSqlNode(position) as BoardCanvasProps["nodes"][number];
    // Перезаписываем payload, чтобы узел был пустым
    template.payload = { sql: "" };
    
    registerNode({ id: template.id, type: "sql", position: template.position, payload: template.payload });
    setLocalNodes((prev) => {
      const next = [...prev, template];
      emitNodesChange(next);
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, emitNodesChange, onSelectNode, registerNode]);

  const handleAddPythonNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });
    
    // Создаем узел с пустым кодом
    const template = addNodeHelpers.createPythonNode(position) as BoardCanvasProps["nodes"][number];
    // Перезаписываем payload, чтобы узел был пустым
    template.payload = { python: "" };
    
    registerNode({ id: template.id, type: "python", position: template.position, payload: template.payload });
    setLocalNodes((prev) => {
      const next = [...prev, template];
      emitNodesChange(next);
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, emitNodesChange, onSelectNode, registerNode]);

  const handleAddDatabaseNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });
    
    const template = addNodeHelpers.createDatabaseNode(position) as BoardCanvasProps["nodes"][number];
    
    registerNode({ id: template.id, type: "database", position: template.position, payload: template.payload });
    setLocalNodes((prev) => {
      const next = [...prev, template];
      emitNodesChange(next);
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, emitNodesChange, onSelectNode, registerNode]);

  const handleAddPlotNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });
    
    const template = addNodeHelpers.createPlotNode(position) as BoardCanvasProps["nodes"][number];
    
    registerNode({ id: template.id, type: "plot", position: template.position, payload: template.payload });
    setLocalNodes((prev) => {
      const next = [...prev, template];
      emitNodesChange(next);
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, emitNodesChange, onSelectNode, registerNode]);

  const handleConnectStart = useCallback(
    (_event: React.MouseEvent | React.TouchEvent, params: ConnectionStartParams) => {
    connectOriginRef.current = {
      nodeId: params?.nodeId ?? null,
      handleType: params?.handleType ?? null,
    };
    },
    [],
  );

  const handleConnectEnd = useCallback(() => {
    connectOriginRef.current = null;
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      const { sourceId, targetId } = resolveConnectionEndpoints(connection, connectOriginRef.current);
      connectOriginRef.current = null;
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
            metadata: {},
          },
        ];
        emitEdgesChange(next);
        return next;
      });
    },
    [emitEdgesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removedIds = changes.filter((change) => change.type === "remove").map((change) => change.id);
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
    [emitEdgesChange],
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

    console.log("handleDeleteSelection: Deleting nodes:", Array.from(selectedNodeIds), "edges:", Array.from(selectedEdgeIds));

    // remove sticky layer nodes
    setStickyNodes((prev) => prev.filter((n) => !selectedNodeIds.has(n.id)));

    // remove from localNodes (regular + mirrored notes + pen nodes)
    setLocalNodes((prev) => {
      const next = prev.filter((n) => !selectedNodeIds.has(n.id));
      console.log("handleDeleteSelection: localNodes after filter:", next.length, "removed:", prev.length - next.length);
      emitNodesChange(next);
      return next;
    });

    // remove selected edges and edges incident to removed nodes
    setLocalEdges((prev) => {
      const next = prev.filter(
        (e) =>
          !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.sourceId) && !selectedNodeIds.has(e.targetId),
      );
      emitEdgesChange(next);
      return next;
    });

    // remove from flowNodes directly
    setFlowNodes((prev) => {
      const next = prev.filter((n) => !selectedNodeIds.has(n.id));
      console.log("handleDeleteSelection: flowNodes after filter:", next.length, "removed:", prev.length - next.length);
      return next;
    });

    onSelectNode?.(null);
  }, [rf, emitNodesChange, emitEdgesChange, onSelectNode]);

  // Keyboard bindings for Delete / Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = (document.activeElement as HTMLElement | null) ?? null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (active.getAttribute("contenteditable") === "true") return;
        if (active.closest(".monaco-editor")) return;
      }
      e.preventDefault();
      handleDeleteSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDeleteSelection]);

  // Ensure Space and Tab are not intercepted by global listeners when editing
  useEffect(() => {
    const onKeyCapture = (e: KeyboardEvent) => {
      const active = (document.activeElement as HTMLElement | null) ?? null;
      const isMonaco = !!active?.closest(".monaco-editor");
      const isTextArea = !!active?.closest("textarea");
      const isInput = !!active?.closest("input[type='text'], input[type='search'], input[type='password']");
      const key = e.key || "";
      const isSpace = key === " " || key === "Spacebar" || (e as any).code === "Space";
      const isTab = key === "Tab";
      if ((isMonaco || isTextArea || isInput) && (isSpace || isTab)) {
        // Allow editors to handle Space / Tab; do not block default, but stop bubbling
        e.stopPropagation();
      }
    };
    // capture phase to stop other global handlers (e.g., tldraw) from seeing it
    window.addEventListener("keydown", onKeyCapture, true);
    return () => window.removeEventListener("keydown", onKeyCapture, true);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!flowInstance) return;
    const currentZoom = typeof flowInstance.getZoom === "function" ? flowInstance.getZoom() : 1;
    flowInstance.zoomTo(Math.min(currentZoom * 1.2, 4));
  }, [flowInstance]);

  const handleZoomOut = useCallback(() => {
    if (!flowInstance) return;
    const currentZoom = typeof flowInstance.getZoom === "function" ? flowInstance.getZoom() : 1;
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
      // eslint-disable-next-line no-undef
      if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
        // eslint-disable-next-line no-undef
        return (crypto as any).randomUUID() as string;
      }
    } catch {}
    // Fallback RFC4122 v4
    const rnd = (n = 16) =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${((8 + Math.random() * 4) | 0).toString(16)}${rnd(3)}-${rnd(12)}`;
  }, []);
  const getClientXY = (e: any): { x: number; y: number } | null => {
    const x = e?.clientX ?? e?.event?.clientX ?? e?.sourceEvent?.clientX ?? e?.nativeEvent?.clientX ?? null;
    const y = e?.clientY ?? e?.event?.clientY ?? e?.sourceEvent?.clientY ?? e?.nativeEvent?.clientY ?? null;
    if (typeof x === "number" && typeof y === "number") return { x, y };
    return null;
  };
  const addExternalSticky = useCallback(
    (id: string, pos: { x: number; y: number }, text = "") => {
      const defaultColor = "#EBC347"; // yellow по умолчанию
      const defaultFontSize = 14;
      const defaultFontFamily = "Inter, sans-serif";
      const externalSticky = {
        id,
        type: "note" as const,
        position: pos,
        payload: {
          text,
          noteContent: text,
          noteColor: "#FDE68A",
          color: defaultColor,
          fontSize: defaultFontSize,
          fontFamily: defaultFontFamily,
          isBold: false,
          isItalic: false,
          ui: { width: 180, height: 180 },
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
  const combineForPersist = useCallback(
    (stickies: Node[]) => {
      const stickyExternal =
        stickies.map((n) => ({
          id: n.id,
          type: "note" as const,
          position: n.position ?? { x: 0, y: 0 },
          payload: { text: (n.data as any)?.text ?? "" },
        })) ?? [];
      return [...(localNodesRef.current ?? []), ...stickyExternal];
    },
    [],
  );

  return (
    <div
      ref={canvasRootRef}
      className="board-canvas-root relative flex h-full min-h-0 w-full flex-1 overflow-hidden"
      style={{ position: "relative" }}
    >
      <div className="relative h-full w-full overflow-hidden">
        <div className="relative h-full w-full">
          <ReactFlow
            nodes={[
              ...flowNodes,
              ...stickyNodes.map((node) => ({
                ...node,
                selected: node.id === selectedNodeId,
              })),
            ]}
            edges={flowEdges}
            fitView
            fitViewOptions={{ padding: 0.2, duration: 0 }}
            panOnDrag={!isStickyMode && !isPenMode && !isTextMode}
            panOnScroll={false}
            zoomOnScroll
            selectionOnDrag={!isStickyMode && !isPenMode && !isTextMode}
            nodesDraggable={!isStickyMode && !isPenMode && !isTextMode}
            nodesConnectable={!isStickyMode && !isPenMode && !isTextMode}
            elementsSelectable={!isStickyMode && !isPenMode && !isTextMode}
            proOptions={{ hideAttribution: true }}
            className="h-full bg-white"
            style={{ width: "100%", height: "100%" }}
            onInit={(instance) => setFlowInstance(instance)}
            selectNodesOnDrag={false}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            onNodeClick={handleNodeClick}
            onNodeDataChange={(id, data) => {
              // Синхронизируем изменения данных узла (цвет, форматирование) с localNodes
              if (data && typeof data === "object") {
                const node = stickyNodes.find((n) => n.id === id);
                if (node && node.type === "sticky") {
                  const newColor = (data as any)?.color;
                  const newFontSize = (data as any)?.fontSize;
                  const newFontFamily = (data as any)?.fontFamily;
                  const newIsBold = (data as any)?.isBold;
                  const newIsItalic = (data as any)?.isItalic;
                  
                  // Обновляем только если есть изменения
                  if (newColor || newFontSize !== undefined || newFontFamily || newIsBold !== undefined || newIsItalic !== undefined) {
                    setLocalNodes((prev) => {
                      const next = prev.map((ext) =>
                        ext.id === id && ext.type === "note"
                          ? {
                              ...ext,
                              payload: {
                                ...(ext.payload ?? {}),
                                ...(newColor && { color: newColor }),
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
                return;
              }
              
              // Создаем новый стикер только в режиме стикеров
              if (!isStickyMode) return;
              const id = uuidv4();
              const defaultColor = "#EBC347"; // yellow по умолчанию
              const defaultFontSize = 14;
              const defaultFontFamily = "Inter, sans-serif";
              const node: Node = {
                id,
                type: "sticky",
                position: p,
                // Важно: передаем width и height напрямую в props для NodeResizer
                width: 160,
                height: 96,
                data: {
                  text: "",
                  color: defaultColor,
                  fontSize: defaultFontSize,
                  fontFamily: defaultFontFamily,
                  isBold: false,
                  isItalic: false,
                  onChangeText: (nid: string, text: string) =>
                    setStickyNodes((cur) => {
                      const updated = cur.map((n) => (n.id === nid ? { ...n, data: { ...(n.data as any), text } } : n));
                      setLocalNodes((prev) => {
                        const next = prev.map((ext) =>
                          ext.id === nid && ext.type === "note"
                            ? { ...ext, payload: { ...(ext.payload ?? {}), text, noteContent: text } }
                            : ext,
                        );
                        emitNodesChange(next);
                        return next;
                      });
                      return updated;
                    }),
                  onChangeColor: (nid: string, newColor: string) => {
                    setStickyNodes((cur) => {
                      const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), color: newColor } } : st));
                      setLocalNodes((prev) => {
                        const next = prev.map((ext) =>
                          ext.id === nid && ext.type === "note"
                            ? { ...ext, payload: { ...(ext.payload ?? {}), color: newColor } }
                            : ext,
                        );
                        emitNodesChange(next);
                        return next;
                      });
                      return updated;
                    });
                  },
                  onChangeFontSize: (nid: string, newFontSize: number) => {
                    setStickyNodes((cur) => {
                      const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), fontSize: newFontSize } } : st));
                      setLocalNodes((prev) => {
                        const next = prev.map((ext) =>
                          ext.id === nid && ext.type === "note"
                            ? { ...ext, payload: { ...(ext.payload ?? {}), fontSize: newFontSize } }
                            : ext,
                        );
                        emitNodesChange(next);
                        return next;
                      });
                      return updated;
                    });
                  },
                  onChangeFontFamily: (nid: string, newFontFamily: string) => {
                    setStickyNodes((cur) => {
                      const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), fontFamily: newFontFamily } } : st));
                      setLocalNodes((prev) => {
                        const next = prev.map((ext) =>
                          ext.id === nid && ext.type === "note"
                            ? { ...ext, payload: { ...(ext.payload ?? {}), fontFamily: newFontFamily } }
                            : ext,
                        );
                        emitNodesChange(next);
                        return next;
                      });
                      return updated;
                    });
                  },
                  onChangeBold: (nid: string, newIsBold: boolean) => {
                    setStickyNodes((cur) => {
                      const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), isBold: newIsBold } } : st));
                      setLocalNodes((prev) => {
                        const next = prev.map((ext) =>
                          ext.id === nid && ext.type === "note"
                            ? { ...ext, payload: { ...(ext.payload ?? {}), isBold: newIsBold } }
                            : ext,
                        );
                        emitNodesChange(next);
                        return next;
                      });
                      return updated;
                    });
                  },
                  onChangeItalic: (nid: string, newIsItalic: boolean) => {
                    setStickyNodes((cur) => {
                      const updated = cur.map((st) => (st.id === nid ? { ...st, data: { ...(st.data as any), isItalic: newIsItalic } } : st));
                      setLocalNodes((prev) => {
                        const next = prev.map((ext) =>
                          ext.id === nid && ext.type === "note"
                            ? { ...ext, payload: { ...(ext.payload ?? {}), isItalic: newIsItalic } }
                            : ext,
                        );
                        emitNodesChange(next);
                        return next;
                      });
                      return updated;
                    });
                  },
                },
                style: {
                  width: 160,
                  height: 96,
                  // Явный zIndex для sticky: выше всех других nodes (20)
                  zIndex: 20,
                },
              } as Node;
              setStickyNodes((prev) => [...prev, node]);
              addExternalSticky(id, p, "");
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
                  nodeType === "pen" ||
                  (nodeData?.initialSize && typeof nodeData.initialSize === "object" && !nodeData?.nodeId) ||
                  (nodeData?.points && Array.isArray(nodeData.points) && !nodeData?.nodeId);
                
                // Исключаем pen узлы - возвращаем null, чтобы они не отображались
                if (isPenNode) {
                  return null;
                }
                
                // Для остальных узлов возвращаем цвет через стандартную функцию
                return getNodeColor((nodeData as any)?.nodeKind ?? "sql");
              }}
              nodeFilter={(node) => {
                const nodeType = node.type;
                const nodeData = node.data as any;
                
                // Проверяем, является ли узел pen-узлом по всем возможным признакам
                const isPenNode = 
                  nodeType === "pen" ||
                  (nodeData?.initialSize && typeof nodeData.initialSize === "object" && !nodeData?.nodeId) ||
                  (nodeData?.points && Array.isArray(nodeData.points) && !nodeData?.nodeId);
                
                // Исключаем pen узлы
                if (isPenNode) {
                  return false;
                }
                
                // Показываем только стикеры и дата-клетки
                // Явно разрешаем только эти типы узлов
                return (
                  nodeType === "sticky" ||
                  nodeType === "sqlNode" ||
                  nodeType === "pythonNode"
                );
              }}
              zoomable
              pannable
              style={{ right: 0, bottom: 0 }}
            />
            <Controls position="bottom-left" showInteractive={false} style={{ left: 0, bottom: 0 }} />
            <ConnectionArrowsOverlay edges={flowEdges} />
            {isPenMode && (
              <FreehandOverlay
                onAddPenNode={(node) => {
                  console.log("onAddPenNode called with:", node);
                  // Добавляем pen node в localNodes
                  const externalNode = {
                    id: node.id,
                    type: "pen" as const,
                    position: node.position,
                    payload: {
                      points: node.data.points,
                      initialSize: node.data.initialSize,
                    },
                  };
                  console.log("Adding to localNodes:", externalNode);
                  setLocalNodes((prev) => {
                    const next = [...prev, externalNode];
                    console.log("localNodes updated, new length:", next.length, "pen nodes:", next.filter((n) => n.type === "pen").length);
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
                      console.log("Node already exists in flowNodes:", node.id);
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
                    console.log("Adding to flowNodes:", flowNode);
                    return [...prev, flowNode];
                  });
                }}
              />
            )}
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
        onRunDownstreamSelectedNode={canRunDownstream ? handleRunDownstreamSelectedNode : undefined}
        canRunSelectedNode={canRunSelectedNode}
        canRunDownstream={canRunDownstream}
        onAddSqlNode={handleAddSqlNode}
        onAddPythonNode={handleAddPythonNode}
        onAddDatabaseNode={handleAddDatabaseNode}
        onAddPlotNode={handleAddPlotNode}
        onDeleteSelection={handleDeleteSelection}
        hasSelection={hasSelection}
      />
    </div>
  );
}

 


