'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Connection,
  OnConnectStartParams,
  Edge,
  EdgeChange,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  ReactFlowInstance,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useCursorStateSynced } from '../../hooks/useCursorStateSynced';
import { type UploadedFile } from '../../lib/api';
import { registerDatasetFromCsvNode } from '../../lib/duckdbClient';
import { createEmptyCell } from '../../lib/notebookParser';
import type { ParsedNotebook } from '../../lib/notebookParser';
import { parseSpreadsheetFile } from '../../lib/spreadsheetParser';
import { globalVoiceAudioCache } from '../../lib/voiceAudioCache';
import { canvasNodeToReactFlowNode } from '../../lib/yjs/adapters';
import { useBoardCanvasApiStore } from '../../state/boardCanvasApiStore';
import {
  getDefaultNodeWidth,
  useCanvasLayoutStore,
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
  type CanvasLayoutState,
} from '../../state/canvasLayoutStore';
import { useChainStore } from '../../state/chainStore';
import { useCommentStore } from '../../state/commentStore';
import { DEFAULT_CURSOR, useCursorSettingsStore } from '../../state/cursorSettingsStore';
import type { ExecutionEntry, NodeStatus, ExecutionStoreState } from '../../state/executionStore';
import { useExecutionStore } from '../../state/executionStore';
import { useAddNode } from '../../state/useAddNode';
import { BoardCommandBar, type CanvasTool } from '../BoardCommandBar';
import CollaborativeCursors from '../CollaborativeCursors';
import { CommentLayer } from '../comments/CommentLayer';
import {
  resolveConnectionEndpoints,
  type ConnectionOrigin,
  findNearestHandleId,
} from '../connectionUtils';
import { FileDropOverlay } from '../FileDropOverlay';
import CustomConnectionLine from '../flowEdges/CustomConnectionLine';
import { CsvNode } from '../flowNodes/CsvNode';
import { DatabaseNode } from '../flowNodes/DatabaseNode';
import { DocumentNode } from '../flowNodes/DocumentNode';
import { ImageNode } from '../flowNodes/ImageNode';
import { MarkdownCellNode } from '../flowNodes/MarkdownCellNode';
import { NotebookFrameNode } from '../flowNodes/NotebookFrame';
import { NotebookNode } from '../flowNodes/NotebookNode';
import { PlotNode } from '../flowNodes/PlotNode';
import { PythonCellNode } from '../flowNodes/PythonCellNode';
import ShapeNode, { type ShapeType } from '../flowNodes/ShapeNode';
import { SqlCellNode } from '../flowNodes/SqlCellNode';
import { VideoNode } from '../flowNodes/VideoNode';
import { VoiceNode } from '../flowNodes/VoiceNode';
import { EraserOverlay } from '../pen/EraserOverlay';
import { FreehandOverlay } from '../pen/FreehandOverlay';
import { PenNode } from '../pen/PenNode';
import { PenToolbar } from '../pen/PenToolbar';
import { ShapeDragOverlay } from '../shape/ShapeDragOverlay';
import { SHAPE_DEFAULTS, isLineType as isLineShapeType } from '../shape/shapeEngine';
import { TextNode } from '../TextNode';

import type { BoardCanvasProps, NodeData } from './boardCanvas.types';
import { ConnectionArrowsOverlay } from './ConnectionArrowsOverlay';
import { DataNodeHandles, DATA_NODE_HANDLE_CLASS } from './DataNodeHandles';
import {
  statusColors,
  getNodeColor,
  createEdgeId,
  StatusBadge,
  ErrorMessage,
  StdoutBlock,
} from './nodeUtils';
import { PythonNodeComponent } from './PythonNodeComponent';
import { SqlNodeComponent } from './SqlNodeComponent';

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
  shapeNode: ShapeNode,
  voiceNode: VoiceNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  documentNode: DocumentNode,
  notebookNode: NotebookNode,
  pythonCellNode: PythonCellNode,
  markdownCellNode: MarkdownCellNode,
  sqlCellNode: SqlCellNode,
  notebookFrameNode: NotebookFrameNode,
};

type InnerProps = BoardCanvasProps;

export function InnerBoardCanvas({
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
  commentDragMap,
  presentationBroadcastsMap,
  ydoc,
  clientId,
  userInfo,
  onCsvDatasetAdded,
  onOpenPresentationViewer,
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

  // Marquee selection → comment intersection tracking
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(new Set());

  // Track if cursor is hovering over toolbars (Controls, MiniMap, BoardCommandBar, PenToolbar)
  // When hovering toolbars, hide own cursor but keep updating position for other users
  const [isHoveringToolbar, setIsHoveringToolbar] = useState(false);

  // Tool state - defined early because it's needed for cursor visibility
  const [tool, setTool] = useState<CanvasTool>('hand');

  // Use cursor syncing hook (must be inside ReactFlowProvider)
  // Hide own cursor when hovering toolbars (like Miro behavior)
  // Also hide own cursor when using eraser (eraser has its own cursor indicator)
  // When 'default' cursor selected, user sees system cursor — never show overlay
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);
  // Always hide own cursor overlay — user sees standard system cursor,
  // other users see colored cursor with label via Yjs sync
  const showOwnCursor = false;
  const [cursors, onMouseMove, onPointerLeave, onCursorViewportChange] =
    cursorsMap && clientId
      ? useCursorStateSynced(cursorsMap, clientId, userInfo, {
          showOwnCursor,
          boardContainerRef: canvasRootRef,
        })
      : ([[], () => {}, () => {}, () => {}] as const);

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
  // Ref for the `nodes` prop so that callbacks (e.g. onPayloadChange) always read the latest value
  const nodesPropRef = useRef(nodes);
  useEffect(() => {
    nodesPropRef.current = nodes;
  }, [nodes]);
  /** Ids we just deleted locally; avoid restoring them when nodes prop is still stale (Yjs observer not yet applied). */
  const recentlyDeletedIdsRef = useRef<Set<string>>(new Set());
  const [localEdges, setLocalEdges] = useState(edges);

  // Presentation broadcast: which document nodes have an active broadcast (for "Join broadcast" buttons)
  const [broadcastingNodeIds, setBroadcastingNodeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!presentationBroadcastsMap) return;
    const update = () => {
      const ids = new Set<string>();
      presentationBroadcastsMap.forEach((value: unknown, key: string) => {
        const state =
          value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
        if (state && state.isActive === true && state.presenterUserId) ids.add(key);
      });
      setBroadcastingNodeIds(ids);
    };
    update();
    presentationBroadcastsMap.observe(update);
    return () => presentationBroadcastsMap.unobserve(update);
  }, [presentationBroadcastsMap]);
  const textNodeResizeTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const shapeNodeResizeTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Undo/Redo now handled at page level via Yjs UndoManager (per-user undo)
  // Changes are automatically tracked through Yjs transactions with clientId origin

  // Voice audio data is stored in globalVoiceAudioCache (module-level)
  // to persist across component remounts

  useLayoutEffect(() => {
    // Merge incoming nodes with local state, using ref for voice audio data
    // useLayoutEffect ensures position updates apply before paint, preventing
    // visual desync between nodes and edges during remote collaborative drags.
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
      // Для default (legacy nodes: voice, csv, video, document) берём тип из data
      const rawType = (n.type as string) === 'sticky' ? 'note' : n.type;
      const type = (
        (rawType as string) === 'default' && typeof (n as any).payload?.type === 'string'
          ? (n as any).payload.type
          : rawType
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
    (
      nodeId: string,
      payloadUpdate: (prevPayload: Record<string, unknown>) => Record<string, unknown>,
    ) => {
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
  const isCommentMode = tool === 'comment';

  // Автоматически выбираем rectangle при переключении на режим shape
  useEffect(() => {
    if (tool === 'shape' && !selectedShape) {
      setSelectedShape('rectangle');
    }
  }, [tool, selectedShape]);

  // Always show system cursor on canvas — own colored overlay is never shown,
  // other users see the colored cursor via Yjs sync
  useEffect(() => {
    const canvasCursor = 'default';

    const applyCursorStyle = (el: HTMLElement, cursor: string) => {
      (el as HTMLElement).style.setProperty('cursor', cursor, 'important');
    };

    const forceHideCursor = () => {
      const reactFlowContainer = document.querySelector('.react-flow');
      const reactFlowPane = document.querySelector('.react-flow__pane');
      const reactFlowNodes = document.querySelectorAll('.react-flow__node');
      const reactFlowViewport = document.querySelector('.react-flow__viewport');
      const reactFlowRenderer = document.querySelector('.react-flow__renderer');

      // Force hide cursor ONLY on ReactFlow elements, NOT on body
      // This allows standard cursor to show outside the canvas area
      if (reactFlowContainer) {
        applyCursorStyle(reactFlowContainer as HTMLElement, canvasCursor);
      }
      if (reactFlowPane) {
        applyCursorStyle(reactFlowPane as HTMLElement, canvasCursor);
      }
      if (reactFlowViewport) {
        applyCursorStyle(reactFlowViewport as HTMLElement, canvasCursor);
      }
      if (reactFlowRenderer) {
        applyCursorStyle(reactFlowRenderer as HTMLElement, canvasCursor);
      }
      reactFlowNodes.forEach((node) => {
        applyCursorStyle(node as HTMLElement, canvasCursor);
        const children = node.querySelectorAll('*');
        children.forEach((child) => {
          if ((child as HTMLElement).classList?.contains('react-flow__resize-control')) return;
          if ((child as HTMLElement).closest?.('.react-flow__resize-control')) return;
          applyCursorStyle(child as HTMLElement, canvasCursor);
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
  }, []);

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
          if (key === 'c') {
            setTool((prev) => (prev === 'comment' ? 'select' : 'comment'));
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

  // Unwrap CSV payload: after Yjs roundtrip it may be nested as { payload: { tableName, ... } }
  const getCsvPayload = (raw: any): any => {
    if (!raw) return raw;
    if (raw.tableName) return raw;
    if (raw.payload && typeof raw.payload === 'object') return getCsvPayload(raw.payload);
    return raw;
  };

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
          const isNote = node.type === 'note';
          const isVoice = node.type === 'voice';
          const isImage = node.type === 'image';
          const isVideo = node.type === 'video';
          const isDocument = node.type === 'document';
          const isNotebook = node.type === 'notebook';
          const isPythonCell = node.type === 'pythonCell';
          const isMarkdownCell = node.type === 'markdownCell';
          const isSqlCell = node.type === 'sqlCell';
          const isNotebookFrame = node.type === 'notebookFrame';

          const CELL_TYPE_MAP: Record<string, string> = {
            sql: 'sqlNode',
            python: 'pythonNode',
            database: 'databaseNode',
            plot: 'plotNode',
            csv: 'csvNode',
            pen: 'pen',
            text: 'textNode',
            voice: 'voiceNode',
            image: 'imageNode',
            video: 'videoNode',
            document: 'documentNode',
            notebook: 'notebookNode',
            pythonCell: 'pythonCellNode',
            markdownCell: 'markdownCellNode',
            sqlCell: 'sqlCellNode',
            notebookFrame: 'notebookFrameNode',
            shape: 'shapeNode',
            note: 'shapeNode',
          };
          const type = CELL_TYPE_MAP[node.type as string] ?? 'default';

          const isDataNode =
            isSql ||
            isPython ||
            isDatabase ||
            isPlot ||
            isCsv ||
            isNotebook ||
            isPythonCell ||
            isSqlCell ||
            isNotebookFrame;
          const isCellNode = isPythonCell || isMarkdownCell || isSqlCell;
          const isCanvasNode =
            isPen || isText || isShape || isNote || isVoice || isImage || isVideo || isDocument;

          // NOTE: executionEntries removed - SqlNode/PythonNode fetch their own state via useExecutionStore
          // For nodes that store width in payload (notebook, image, video, document),
          // fall back to payload.width so resize persists across page refresh.
          const storedWidth =
            nodeSizes[node.id]?.width ??
            (typeof (node.payload as any)?.width === 'number'
              ? (node.payload as any).width
              : null) ??
            getDefaultNodeWidth();
          const isCodeCollapsed = codeCollapsedMap[node.id] ?? false;

          // Chain ID for notebook grouping (cells linked together, no parent-child)
          const cellChainId =
            isPythonCell || isMarkdownCell || isSqlCell
              ? useChainStore.getState().getFrameForCell(node.id)
              : undefined;

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
                            : isNotebook
                              ? {
                                  width: (node.payload as any)?.width ?? 520,
                                  background: 'transparent',
                                  border: 'none',
                                  boxShadow: 'none',
                                }
                              : isPythonCell || isSqlCell || isMarkdownCell
                                ? {
                                    width: 520,
                                    background: 'transparent',
                                    border: 'none',
                                    boxShadow: 'none',
                                  }
                                : isNotebookFrame
                                  ? {
                                      width: (node.payload as any)?.width ?? 560,
                                      height: (node.payload as any)?.height ?? 400,
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
            // Notebook nodes: drag only by header, body allows canvas pan
            ...(isNotebook ? { dragHandle: '.drag-handle' } : {}),
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
                        syncNodePayloadChange(id, (prevPayload) => ({
                          ...prevPayload,
                          ...(patch.ui
                            ? {
                                ui: {
                                  ...((prevPayload as any)?.ui ?? {}),
                                  ...patch.ui,
                                },
                              }
                            : {}),
                          ...Object.fromEntries(
                            Object.entries(patch).filter(([key]) => key !== 'ui'),
                          ),
                        }));
                      },
                      onDeleteNode: (nodeId: string) => {
                        // Sync deletion through Yjs FIRST for real-time collaboration
                        recentlyDeletedIdsRef.current.add(nodeId);
                        if (yjsOnNodesChange) {
                          yjsOnNodesChange([{ type: 'remove' as const, id: nodeId }]);
                        }
                        // Also remove connected edges from Yjs
                        if (yjsOnEdgesChange) {
                          const edgesToRemove = localEdgesRef.current.filter(
                            (e) => e.sourceId === nodeId || e.targetId === nodeId,
                          );
                          if (edgesToRemove.length > 0) {
                            yjsOnEdgesChange(
                              edgesToRemove.map((e) => ({ type: 'remove' as const, id: e.id })),
                            );
                          }
                        }
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
                            onOpenViewer: onOpenPresentationViewer
                              ? () => onOpenPresentationViewer(node.id)
                              : undefined,
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
                                isNoteNode: true,
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
                              // Обычные shape nodes — используем StickyToolbar как у заметок
                              const payload = node.payload as any;
                              return {
                                isNoteNode: false,
                                shapeType: (payload?.shapeType ?? 'rectangle') as any,
                                shapeColor:
                                  payload?.shapeColor ?? payload?.fill ?? SHAPE_DEFAULTS.fill,
                                width: payload?.width ?? SHAPE_DEFAULTS.defaultWidth,
                                height: payload?.height ?? SHAPE_DEFAULTS.defaultHeight,
                                fill: payload?.fill ?? SHAPE_DEFAULTS.fill,
                                stroke: payload?.stroke ?? SHAPE_DEFAULTS.stroke,
                                strokeWidth: payload?.strokeWidth ?? SHAPE_DEFAULTS.strokeWidth,
                                opacity: payload?.opacity ?? SHAPE_DEFAULTS.opacity,
                                cornerRadius: payload?.cornerRadius ?? SHAPE_DEFAULTS.cornerRadius,
                                arrowHead: payload?.arrowHead,
                                startX: payload?.startX,
                                startY: payload?.startY,
                                endX: payload?.endX,
                                endY: payload?.endY,
                                // Text (plain, like notes)
                                text: payload?.text ?? '',
                                fontSize: payload?.fontSize ?? 16,
                                fontFamily: payload?.fontFamily ?? 'Inter, sans-serif',
                                isBold: payload?.isBold ?? false,
                                isItalic: payload?.isItalic ?? false,
                                // StickyToolbar callbacks (same pattern as notes)
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
                                onChangeColor: (nid: string, newColor: string) => {
                                  setLocalNodes((prev) => {
                                    const next = prev.map((n) =>
                                      n.id === nid && n.type === 'shape'
                                        ? {
                                            ...n,
                                            payload: {
                                              ...(n.payload ?? {}),
                                              fill: newColor,
                                              shapeColor: newColor,
                                            },
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
                                      n.id === nid && n.type === 'shape'
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
                                      n.id === nid && n.type === 'shape'
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
                                      n.id === nid && n.type === 'shape'
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
                                      n.id === nid && n.type === 'shape'
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
                                currentUser: board.userInfo
                                  ? {
                                      id: board.userInfo.userId ?? '',
                                      name: board.userInfo.userName ?? '',
                                    }
                                  : undefined,
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

                                    const updatedNode = next.find((n) => n.id === nodeId);
                                    if (updatedNode && yjsOnNodesChange) {
                                      const reactFlowNode = canvasNodeToReactFlowNode(updatedNode);
                                      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
                                    }

                                    queueMicrotask(() => {
                                      emitNodesChange(next);
                                    });
                                    return next;
                                  });
                                },
                                payload: node.payload,
                              }
                            : isPlot
                              ? (() => {
                                  const edgeTargetId = (e: {
                                    targetId?: string;
                                    target?: string;
                                  }) => e.targetId ?? (e as { target?: string }).target;
                                  const edgeSourceId = (e: {
                                    sourceId?: string;
                                    source?: string;
                                  }) => e.sourceId ?? (e as { source?: string }).source;
                                  const edgeSourceHandle = (e: any) =>
                                    e.sourceHandleId ?? e.metadata?.sourceHandleId ?? undefined;
                                  const incomingEdge = localEdges.find(
                                    (e) => edgeTargetId(e) === node.id,
                                  );
                                  const sourceId = incomingEdge
                                    ? edgeSourceId(incomingEdge)
                                    : undefined;
                                  const srcHandle = incomingEdge
                                    ? edgeSourceHandle(incomingEdge)
                                    : undefined;
                                  const upstreamNode = sourceId
                                    ? localNodes.find((n) => n.id === sourceId)
                                    : null;
                                  const isCsvSource =
                                    upstreamNode?.type === 'csv' ||
                                    (upstreamNode?.type as string) === 'csvNode';
                                  const isSqlSource = upstreamNode?.type === 'sql';
                                  const isNotebookSource = upstreamNode?.type === 'notebook';
                                  const upstreamPayload = isCsvSource
                                    ? (getCsvPayload(upstreamNode?.payload) as
                                        | { tableName?: string }
                                        | undefined)
                                    : (upstreamNode?.payload as { tableName?: string } | undefined);
                                  const upstreamCsvTableName =
                                    isCsvSource && upstreamPayload?.tableName
                                      ? upstreamPayload.tableName
                                      : undefined;
                                  const upstreamSqlNodeId =
                                    isSqlSource && sourceId ? sourceId : undefined;
                                  // Notebook cell output: compute executionStore entry ID
                                  let notebookCellEntryId: string | undefined;
                                  if (isNotebookSource && srcHandle?.startsWith('cell-out-')) {
                                    const cellId = srcHandle.slice(9); // remove "cell-out-"
                                    notebookCellEntryId = `${sourceId}__${cellId}`;
                                  }
                                  // Fallback: if connected to notebook but no cell handle, find any cell with data
                                  if (isNotebookSource && !notebookCellEntryId && sourceId) {
                                    const nbPayload = (upstreamNode?.payload ?? {}) as any;
                                    const nbCells = nbPayload?.notebook?.cells;
                                    if (Array.isArray(nbCells)) {
                                      const execStore = useExecutionStore.getState();
                                      for (let ci = nbCells.length - 1; ci >= 0; ci--) {
                                        const cid = nbCells[ci].id;
                                        const entryId = `${sourceId}__${cid}`;
                                        const entry = execStore.entries[entryId];
                                        if (
                                          entry?.output?.kind === 'python' &&
                                          entry.output.result?.table
                                        ) {
                                          notebookCellEntryId = entryId;
                                          break;
                                        }
                                      }
                                    }
                                  }
                                  // Resolve CSV data through notebook: find CSV connected to notebook and pass data inline
                                  let notebookUpstreamCsvTableName: string | undefined;
                                  let inlineData:
                                    | {
                                        columns: string[];
                                        rows: Array<Array<string | number | null>>;
                                      }
                                    | undefined;
                                  if (isNotebookSource && sourceId) {
                                    const nbIncomingEdges = localEdges.filter(
                                      (e) => edgeTargetId(e) === sourceId,
                                    );
                                    for (const nbEdge of nbIncomingEdges) {
                                      const nbSrcId = edgeSourceId(nbEdge);
                                      if (nbSrcId) {
                                        const nbSrcNode = localNodes.find((n) => n.id === nbSrcId);
                                        if (
                                          nbSrcNode?.type === 'csv' ||
                                          (nbSrcNode?.type as string) === 'csvNode'
                                        ) {
                                          const nbSrcPayload = getCsvPayload(
                                            nbSrcNode.payload ?? {},
                                          );
                                          if (nbSrcPayload.tableName) {
                                            notebookUpstreamCsvTableName = nbSrcPayload.tableName;
                                          }
                                          // Pass CSV data directly as inline data (no DuckDB round-trip needed)
                                          if (
                                            nbSrcPayload.data?.columns &&
                                            nbSrcPayload.data?.rows
                                          ) {
                                            inlineData = nbSrcPayload.data;
                                          } else {
                                            // Fallback: read from executionStore (CsvNode syncs loaded data there)
                                            const csvEntry =
                                              useExecutionStore.getState().entries[nbSrcId];
                                            if (
                                              csvEntry?.output?.kind === 'sql' &&
                                              csvEntry.output.result
                                            ) {
                                              inlineData = csvEntry.output.result;
                                            }
                                          }
                                          break;
                                        }
                                      }
                                    }
                                  }
                                  return {
                                    nodeId: node.id,
                                    payload: node.payload,
                                    edges: localEdges,
                                    width: storedWidth,
                                    upstreamCsvTableName:
                                      upstreamCsvTableName || notebookUpstreamCsvTableName,
                                    upstreamSqlNodeId,
                                    notebookCellEntryId,
                                    inlineData,
                                    onPayloadChange: (
                                      nid: string,
                                      patch: Record<string, unknown>,
                                    ) => {
                                      // For plot nodes, snapshot saves (_dataSnapshot) go through Yjs
                                      // via a two-step read-then-write to avoid overwriting chart config
                                      // (chartType, mapping, styling) with stale localNodes data.
                                      // Use nodesPropRef to always read the LATEST nodes prop,
                                      // not a stale closure capture from when mapNodes was created.
                                      const freshNode = nodesPropRef.current.find(
                                        (n) => n.id === nid,
                                      );
                                      if (freshNode) {
                                        const merged = { ...freshNode.payload, ...patch };
                                        const canvasNode = { ...freshNode, payload: merged };
                                        if (yjsOnNodesChange) {
                                          const rfNode = canvasNodeToReactFlowNode(canvasNode);
                                          yjsOnNodesChange([{ type: 'add', item: rfNode }]);
                                        }
                                      }
                                    },
                                  };
                                })()
                              : isCsv
                                ? {
                                    nodeId: node.id,
                                    payload: getCsvPayload(node.payload),
                                    width: storedWidth,
                                    onResize: (nodeId: string, width: number, height: number) => {
                                      setNodeWidth(nodeId, width);
                                    },
                                  }
                                : isNotebook
                                  ? (() => {
                                      const payload = (node.payload ?? {}) as any;
                                      const edgeTargetId = (e: {
                                        targetId?: string;
                                        target?: string;
                                      }) => e.targetId ?? (e as { target?: string }).target;
                                      const edgeSourceId = (e: {
                                        sourceId?: string;
                                        source?: string;
                                      }) => e.sourceId ?? (e as { source?: string }).source;
                                      const edgeTargetHandle = (e: any) =>
                                        e.targetHandleId ?? e.metadata?.targetHandleId ?? undefined;
                                      // Find all incoming edges to this notebook
                                      const incomingEdges = localEdges.filter(
                                        (e) => edgeTargetId(e) === node.id,
                                      );
                                      // Global upstream (connected to node-level "left" handle)
                                      const globalEdge = incomingEdges.find(
                                        (e) =>
                                          !edgeTargetHandle(e) || edgeTargetHandle(e) === 'left',
                                      );
                                      const sourceId = globalEdge
                                        ? edgeSourceId(globalEdge)
                                        : undefined;
                                      let csvUpstreamData:
                                        | {
                                            columns: string[];
                                            rows: Array<Array<string | number | null>>;
                                          }
                                        | undefined;
                                      let csvUpstreamFilename: string | undefined;
                                      if (sourceId) {
                                        const sourceNode = localNodes.find(
                                          (n) => n.id === sourceId,
                                        );
                                        if (sourceNode?.type === 'csv') {
                                          const srcPayload = getCsvPayload(
                                            sourceNode.payload ?? {},
                                          );
                                          // First try payload.data (available on initial upload before Yjs strips it)
                                          if (srcPayload.data?.columns && srcPayload.data?.rows) {
                                            csvUpstreamData = srcPayload.data;
                                          } else {
                                            // Fallback: read from executionStore (CsvNode syncs loaded DuckDB data there)
                                            const csvEntry =
                                              useExecutionStore.getState().entries[sourceId];
                                            if (
                                              csvEntry?.output?.kind === 'sql' &&
                                              csvEntry.output.result
                                            ) {
                                              csvUpstreamData = csvEntry.output.result;
                                            }
                                          }
                                          csvUpstreamFilename =
                                            srcPayload.filename || srcPayload.tableName;
                                        }
                                      }
                                      // Per-cell upstream: edges targeting "cell-{cellId}" handles
                                      const cellDataMap: Record<
                                        string,
                                        {
                                          columns: string[];
                                          rows: Array<Array<string | number | null>>;
                                          filename?: string;
                                          tableName?: string;
                                        }
                                      > = {};
                                      for (const edge of incomingEdges) {
                                        const th = edgeTargetHandle(edge);
                                        if (th && th.startsWith('cell-')) {
                                          const cellId = th.slice(5); // remove "cell-" prefix
                                          const srcId = edgeSourceId(edge);
                                          if (srcId) {
                                            const srcNode = localNodes.find((n) => n.id === srcId);
                                            if (srcNode?.type === 'csv') {
                                              const srcPayload = getCsvPayload(
                                                srcNode.payload ?? {},
                                              );
                                              if (
                                                srcPayload.data?.columns &&
                                                srcPayload.data?.rows
                                              ) {
                                                cellDataMap[cellId] = {
                                                  ...srcPayload.data,
                                                  filename: srcPayload.filename,
                                                  tableName: srcPayload.tableName,
                                                };
                                              } else {
                                                // Fallback: read from executionStore
                                                const csvEntry =
                                                  useExecutionStore.getState().entries[srcId];
                                                if (
                                                  csvEntry?.output?.kind === 'sql' &&
                                                  csvEntry.output.result
                                                ) {
                                                  cellDataMap[cellId] = {
                                                    ...csvEntry.output.result,
                                                    filename:
                                                      srcPayload.filename || srcPayload.tableName,
                                                    tableName: srcPayload.tableName,
                                                  };
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                      return {
                                        nodeId: node.id,
                                        notebook: payload.notebook ?? {
                                          name: payload.fileName ?? 'Untitled',
                                          cells: [],
                                          metadata: {},
                                          nbformat: 4,
                                          nbformatMinor: 0,
                                        },
                                        upstreamNodeId: sourceId,
                                        csvUpstreamData,
                                        csvUpstreamFilename,
                                        cellDataMap:
                                          Object.keys(cellDataMap).length > 0
                                            ? cellDataMap
                                            : undefined,
                                        onNotebookChange: (nb: any) => {
                                          syncNodePayloadChange(node.id, (prev) => ({
                                            ...prev,
                                            notebook: nb,
                                          }));
                                        },
                                      };
                                    })()
                                  : isPythonCell
                                    ? (() => {
                                        const cid = cellChainId;
                                        const chain = cid
                                          ? useChainStore.getState().chains[cid]
                                          : undefined;
                                        const idx = chain ? chain.cellIds.indexOf(node.id) : -1;
                                        const total = chain ? chain.cellIds.length : 0;
                                        const pos:
                                          | 'only'
                                          | 'first'
                                          | 'last'
                                          | 'middle'
                                          | 'standalone' =
                                          cid && idx >= 0
                                            ? total <= 1
                                              ? 'only'
                                              : idx === 0
                                                ? 'first'
                                                : idx === total - 1
                                                  ? 'last'
                                                  : 'middle'
                                            : 'standalone';
                                        return {
                                          nodeId: node.id,
                                          onCodeChange: (code: string) => {
                                            syncNodePayloadChange(node.id, (prev) => ({
                                              ...prev,
                                              cellSource: code,
                                            }));
                                            onCodeChange(node.id, code);
                                          },
                                          onRun: () => onRunNode(node.id),
                                          onDelete: () => {
                                            const deleteHeight =
                                              rf.getNode(node.id)?.height ?? DEFAULT_CELL_HEIGHT;
                                            const chainBefore = cid
                                              ? useChainStore.getState().chains[cid]
                                              : undefined;
                                            const delIdx = chainBefore
                                              ? chainBefore.cellIds.indexOf(node.id)
                                              : -1;
                                            const cellsToShift =
                                              chainBefore && delIdx >= 0
                                                ? new Set(chainBefore.cellIds.slice(delIdx + 1))
                                                : new Set<string>();
                                            if (cid)
                                              useChainStore
                                                .getState()
                                                .removeCellFromFrame(cid, node.id);
                                            setLocalNodes((prev) => {
                                              const next = prev
                                                .filter((n) => n.id !== node.id)
                                                .map((n) =>
                                                  cellsToShift.has(n.id)
                                                    ? {
                                                        ...n,
                                                        position: {
                                                          x: n.position.x,
                                                          y: n.position.y - deleteHeight,
                                                        },
                                                      }
                                                    : n,
                                                );
                                              emitNodesChange(next);
                                              return next;
                                            });
                                          },
                                          cellPosition: pos,
                                          cellIndex: idx >= 0 ? idx + 1 : undefined,
                                          onAddCellBelow: (type: 'pythonCell' | 'markdownCell') => {
                                            handleAddCellBelow(node.id, type);
                                          },
                                          chainName: chain?.name,
                                          chainCellCount: total || undefined,
                                          onRunAll: cid ? () => onRunNode(cid) : undefined,
                                        };
                                      })()
                                    : isMarkdownCell
                                      ? (() => {
                                          const cid = cellChainId;
                                          const chain = cid
                                            ? useChainStore.getState().chains[cid]
                                            : undefined;
                                          const idx = chain ? chain.cellIds.indexOf(node.id) : -1;
                                          const total = chain ? chain.cellIds.length : 0;
                                          const pos:
                                            | 'only'
                                            | 'first'
                                            | 'last'
                                            | 'middle'
                                            | 'standalone' =
                                            cid && idx >= 0
                                              ? total <= 1
                                                ? 'only'
                                                : idx === 0
                                                  ? 'first'
                                                  : idx === total - 1
                                                    ? 'last'
                                                    : 'middle'
                                              : 'standalone';
                                          return {
                                            nodeId: node.id,
                                            source: (node.payload as any)?.cellSource ?? '',
                                            onSourceChange: (source: string) => {
                                              syncNodePayloadChange(node.id, (prev) => ({
                                                ...prev,
                                                cellSource: source,
                                              }));
                                              onCodeChange(node.id, source);
                                            },
                                            onDelete: () => {
                                              const deleteHeight =
                                                rf.getNode(node.id)?.height ??
                                                DEFAULT_MD_CELL_HEIGHT;
                                              const chainBefore = cid
                                                ? useChainStore.getState().chains[cid]
                                                : undefined;
                                              const delIdx = chainBefore
                                                ? chainBefore.cellIds.indexOf(node.id)
                                                : -1;
                                              const cellsToShift =
                                                chainBefore && delIdx >= 0
                                                  ? new Set(chainBefore.cellIds.slice(delIdx + 1))
                                                  : new Set<string>();
                                              if (cid)
                                                useChainStore
                                                  .getState()
                                                  .removeCellFromFrame(cid, node.id);
                                              setLocalNodes((prev) => {
                                                const next = prev
                                                  .filter((n) => n.id !== node.id)
                                                  .map((n) =>
                                                    cellsToShift.has(n.id)
                                                      ? {
                                                          ...n,
                                                          position: {
                                                            x: n.position.x,
                                                            y: n.position.y - deleteHeight,
                                                          },
                                                        }
                                                      : n,
                                                  );
                                                emitNodesChange(next);
                                                return next;
                                              });
                                            },
                                            onAddCellBelow: (
                                              type: 'pythonCell' | 'markdownCell',
                                            ) => {
                                              handleAddCellBelow(node.id, type);
                                            },
                                            cellPosition: pos,
                                            chainName: chain?.name,
                                            chainCellCount: total || undefined,
                                            onRunAll: cid ? () => onRunNode(cid) : undefined,
                                          };
                                        })()
                                      : isSqlCell
                                        ? (() => {
                                            const cid = cellChainId;
                                            const chain = cid
                                              ? useChainStore.getState().chains[cid]
                                              : undefined;
                                            const idx = chain ? chain.cellIds.indexOf(node.id) : -1;
                                            const total = chain ? chain.cellIds.length : 0;
                                            const pos:
                                              | 'only'
                                              | 'first'
                                              | 'last'
                                              | 'middle'
                                              | 'standalone' =
                                              cid && idx >= 0
                                                ? total <= 1
                                                  ? 'only'
                                                  : idx === 0
                                                    ? 'first'
                                                    : idx === total - 1
                                                      ? 'last'
                                                      : 'middle'
                                                : 'standalone';
                                            return {
                                              nodeId: node.id,
                                              onCodeChange: (code: string) => {
                                                syncNodePayloadChange(node.id, (prev) => ({
                                                  ...prev,
                                                  cellSource: code,
                                                }));
                                                onCodeChange(node.id, code);
                                              },
                                              onRun: () => onRunNode(node.id),
                                              onRunFull: () => onRunNodeFull?.(node.id),
                                              onDelete: () => {
                                                const deleteHeight =
                                                  rf.getNode(node.id)?.height ??
                                                  DEFAULT_CELL_HEIGHT;
                                                const chainBefore = cid
                                                  ? useChainStore.getState().chains[cid]
                                                  : undefined;
                                                const delIdx = chainBefore
                                                  ? chainBefore.cellIds.indexOf(node.id)
                                                  : -1;
                                                const cellsToShift =
                                                  chainBefore && delIdx >= 0
                                                    ? new Set(chainBefore.cellIds.slice(delIdx + 1))
                                                    : new Set<string>();
                                                if (cid)
                                                  useChainStore
                                                    .getState()
                                                    .removeCellFromFrame(cid, node.id);
                                                setLocalNodes((prev) => {
                                                  const next = prev
                                                    .filter((n) => n.id !== node.id)
                                                    .map((n) =>
                                                      cellsToShift.has(n.id)
                                                        ? {
                                                            ...n,
                                                            position: {
                                                              x: n.position.x,
                                                              y: n.position.y - deleteHeight,
                                                            },
                                                          }
                                                        : n,
                                                    );
                                                  emitNodesChange(next);
                                                  return next;
                                                });
                                              },
                                              cellPosition: pos,
                                              cellIndex: idx >= 0 ? idx + 1 : undefined,
                                              onAddCellBelow: (
                                                type: 'pythonCell' | 'markdownCell',
                                              ) => {
                                                handleAddCellBelow(node.id, type);
                                              },
                                              chainName: chain?.name,
                                              chainCellCount: total || undefined,
                                              onRunAll: cid ? () => onRunNode(cid) : undefined,
                                            };
                                          })()
                                        : isNotebookFrame
                                          ? {
                                              nodeId: node.id,
                                              frameName:
                                                (node.payload as any)?.frameName ?? 'Notebook',
                                              onRunAll: () => onRunNode(node.id),
                                              onAddCell: (afterIndex: number, cellType: string) => {
                                                // Will be handled by the board page
                                              },
                                            }
                                          : {
                                              nodeId: node.id,
                                              nodeType: isSql ? 'sql' : isPython ? 'python' : 'sql',
                                              onCodeChange: (code: string) =>
                                                onCodeChange(node.id, code),
                                              onRun: () => onRunNode(node.id),
                                              onRunDownstream: () => onRunDownstream(node.id),
                                              onToggleCodeCollapsed: () =>
                                                toggleCodeCollapsed(node.id),
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
            draggable: isEraserMode
              ? false
              : isPen
                ? !isPenMode
                : isText
                  ? !isTextMode
                  : isVoice
                    ? !isVoiceMode
                    : isShape || isNote
                      ? !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode
                      : !isStickyMode && !isPenMode && !isTextMode && !isShapeMode && !isVoiceMode,
            selectable: isEraserMode
              ? false
              : isPen
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
    localEdges,
    nodeSizes,
    codeCollapsedMap,
    onCodeChange,
    onRunNode,
    onRunNodeFull,
    onRunDownstream,
    toggleCodeCollapsed,
    isPenMode,
    isEraserMode,
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
      // Don't override multi-select from marquee drag — when multiple nodes
      // are selected via ReactFlow's selection rectangle, we must not reset
      // them to a single selectedNodeId.
      const currentlySelected = prev.filter((n) => n.selected);
      if (currentlySelected.length > 1) {
        return prev;
      }

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
    localEdges, // mapNodes uses localEdges for edge-based data resolution (e.g. PlotNode upstream CSV)
  ]);

  useLayoutEffect(() => {
    // useLayoutEffect: commit mapped nodes to flowNodes before paint so that
    // ReactFlow renders nodes and edges with consistent positions in the same
    // frame. Prevents edge "detachment" artifacts during remote collaborative drags.
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
          position: node.position,
          selected: existing?.selected ?? node.id === selectedNodeId,
          width: existing?.width ?? node.width,
          height: existing?.height ?? node.height,
          style: {
            ...node.style,
            width: existing?.style?.width ?? node.style?.width,
            height: existing?.style?.height ?? node.style?.height,
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
        // Use the explicit isNoteNode flag set in mapNodes data assembly.
        // Fallback: check the previous node type for backward compat.
        const isNoteNode =
          isShapeNode &&
          ((flowNode.data as any)?.isNoteNode === true ||
            ((flowNode.data as any)?.isNoteNode === undefined && previous?.type === 'note'));
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
              ? (() => {
                  const fd = (flowNode.data ?? {}) as Record<string, unknown>;
                  const pp = (previous?.payload ?? {}) as Record<string, unknown>;
                  // Only persist data fields, NOT callbacks or UI-only flags
                  const dataKeys = [
                    'shapeType',
                    'fill',
                    'stroke',
                    'strokeWidth',
                    'opacity',
                    'cornerRadius',
                    'arrowHead',
                    'startX',
                    'startY',
                    'endX',
                    'endY',
                    'text',
                    'fontSize',
                    'fontFamily',
                    'isBold',
                    'isItalic',
                    'shapeColor',
                  ];
                  const merged: Record<string, unknown> = { ...pp };
                  for (const key of dataKeys) {
                    if (fd[key] !== undefined) {
                      merged[key] = fd[key];
                    }
                  }
                  if (merged.shapeType == null) {
                    merged.shapeType = pp.shapeType ?? 'rectangle';
                  }
                  const prevW = pp['width'] as number | undefined;
                  const prevH = pp['height'] as number | undefined;
                  return {
                    ...merged,
                    width: typeof flowNode.width === 'number' ? flowNode.width : prevW,
                    height: typeof flowNode.height === 'number' ? flowNode.height : prevH,
                  };
                })()
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
            : (previous.payload as any)?.width !== (payload as any)?.width ||
              (previous.payload as any)?.height !== (payload as any)?.height);
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

  const activeCommentThreadId = useCommentStore((s) => s.activeThreadId);

  const hasSelection = useMemo(() => {
    const nodes = flowNodes ?? [];
    const edges = flowEdges ?? [];
    return (
      nodes.some((n: any) => n?.selected) ||
      edges.some((e: any) => e?.selected) ||
      !!activeCommentThreadId
    );
  }, [flowNodes, flowEdges, activeCommentThreadId]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Fast path: selection-only changes (marquee drag) — skip heavy processing
      // and Yjs sync to avoid re-render storms that interrupt the drag gesture
      const isSelectOnly = changes.every((c) => c.type === 'select');
      if (isSelectOnly) {
        setFlowNodes((current) => applyNodeChanges(changes, current));
        return;
      }

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
                  ...(isShape || isDataNode
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
              setNodeWidth(change.id!, width);
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
      if (node.type === 'documentNode' && onOpenPresentationViewer) {
        onOpenPresentationViewer(node.id);
        return;
      }
      onSelectNode?.(node.id);
    },
    [onSelectNode, onOpenPresentationViewer],
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode?.(null);
    setSelectedCommentIds(new Set());
  }, [onSelectNode]);

  // Track marquee selection rectangle to detect comment intersection
  const handleSelectionPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isSelectMode || e.button !== 0) return;
      const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      selectionStartRef.current = flowPos;
    },
    [isSelectMode, rf],
  );

  const handleSelectionPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isSelectMode || !selectionStartRef.current) return;
      const start = selectionStartRef.current;
      selectionStartRef.current = null;
      const end = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // Normalized rectangle in flow coordinates
      const rect = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x),
        h: Math.abs(end.y - start.y),
      };

      // Minimum drag distance to count as selection (not a click)
      if (rect.w < 5 && rect.h < 5) return;

      // Check which comment anchors fall within the selection rectangle
      const threads = useCommentStore.getState().threads;
      const selected = new Set<string>();
      for (const thread of Object.values(threads)) {
        if (
          thread.anchorX >= rect.x &&
          thread.anchorX <= rect.x + rect.w &&
          thread.anchorY >= rect.y &&
          thread.anchorY <= rect.y + rect.h
        ) {
          selected.add(thread.id);
        }
      }
      setSelectedCommentIds(selected);
    },
    [isSelectMode, rf],
  );

  const handleSelectionChange = useCallback(
    (selected: { nodes?: Node[] }) => {
      if (selected.nodes && selected.nodes.length === 1) {
        // Single node selected — update sidebar/details panel
        onSelectNode?.(selected.nodes[0].id);
      }
      // Multi-select (marquee): don't call onSelectNode to avoid
      // triggering the useEffect that resets selection to a single node
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

  const handleAddPythonCell = useCallback(() => {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    // Create a NotebookNode with one empty code cell — a single draggable object
    const emptyNotebook: ParsedNotebook = {
      name: 'Notebook',
      cells: [createEmptyCell('code')],
      metadata: {},
      nbformat: 4,
      nbformatMinor: 5,
    };
    const template = addNodeHelpers.createNotebookNode(position, {
      notebook: emptyNotebook,
      fileName: 'Notebook',
    }) as BoardCanvasProps['nodes'][number];

    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }
    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
  }, [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, sanitizeExternalNodes]);

  const handleAddSqlCell = useCallback(() => {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    const template = addNodeHelpers.createSqlCell(position) as BoardCanvasProps['nodes'][number];
    registerNode({ id: template.id, type: 'sqlCell', payload: template.payload });

    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }
    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
  }, [
    addNodeHelpers,
    rf,
    yjsOnNodesChange,
    onNodesChange,
    onSelectNode,
    registerNode,
    sanitizeExternalNodes,
  ]);

  // Height of the in-flow "+" button area on the last cell (py-1 = 4+4 padding + ~14 button + 2 border ≈ 24px)
  const ADD_BUTTON_FLOW_HEIGHT = 24;

  const handleAddCellBelow = useCallback(
    (aboveNodeId: string, cellType: 'pythonCell' | 'markdownCell') => {
      const aboveNode = localNodes.find((n) => n.id === aboveNodeId);
      if (!aboveNode) return;

      const cellHeight = cellType === 'pythonCell' ? DEFAULT_CELL_HEIGHT : DEFAULT_MD_CELL_HEIGHT;
      const measuredAbove = rf.getNode(aboveNodeId);
      let aboveHeight =
        measuredAbove?.height ??
        (aboveNode.type === 'markdownCell' ? DEFAULT_MD_CELL_HEIGHT : DEFAULT_CELL_HEIGHT);

      // If the above node was the last cell in chain (or standalone), its measured height
      // includes the in-flow "+" button. Subtract it so cells are placed flush.
      const aboveChainId = useChainStore.getState().getFrameForCell(aboveNodeId);
      if (aboveChainId) {
        const aboveChain = useChainStore.getState().chains[aboveChainId];
        const aboveIdx = aboveChain ? aboveChain.cellIds.indexOf(aboveNodeId) : -1;
        const isLast = !aboveChain || aboveIdx === aboveChain.cellIds.length - 1;
        if (isLast && measuredAbove?.height) {
          aboveHeight -= ADD_BUTTON_FLOW_HEIGHT;
        }
      } else {
        // Standalone cell — also has the in-flow "+" button
        if (measuredAbove?.height) {
          aboveHeight -= ADD_BUTTON_FLOW_HEIGHT;
        }
      }

      const newPosition = {
        x: aboveNode.position.x,
        y: aboveNode.position.y + aboveHeight,
      };

      const creator =
        cellType === 'pythonCell'
          ? addNodeHelpers.createPythonCell
          : addNodeHelpers.createMarkdownCell;
      const template = creator(newPosition, {
        source: '',
        exact: true,
      }) as BoardCanvasProps['nodes'][number];

      if (cellType === 'pythonCell') {
        registerNode({ id: template.id, type: 'pythonCell', payload: template.payload });
      }

      // Add to the same chain if the above cell is in one, otherwise create a new chain
      const existingChainId = useChainStore.getState().getFrameForCell(aboveNodeId);
      if (existingChainId) {
        const chain = useChainStore.getState().chains[existingChainId];
        const idx = chain?.cellIds.indexOf(aboveNodeId) ?? -1;
        useChainStore.getState().addCellToFrame(existingChainId, template.id, idx);
      } else {
        // Create a new chain from these two cells
        const chainId = aboveNodeId;
        useChainStore.getState().registerFrame(chainId, 'Notebook', [aboveNodeId, template.id]);
      }

      // Determine cells that need to shift down
      const chainId = useChainStore.getState().getFrameForCell(template.id);
      let cellsBelowSet = new Set<string>();
      if (chainId) {
        const chain = useChainStore.getState().chains[chainId];
        if (chain) {
          const insertedIdx = chain.cellIds.indexOf(template.id);
          cellsBelowSet = new Set(chain.cellIds.slice(insertedIdx + 1));
        }
      }

      const reactFlowNode = canvasNodeToReactFlowNode(template);
      if (yjsOnNodesChange) {
        yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
      }

      setLocalNodes((prev) => {
        const shifted = prev.map((n) => {
          if (cellsBelowSet.has(n.id)) {
            return {
              ...n,
              position: {
                x: n.position.x,
                y: n.position.y + cellHeight + CELL_STACK_GAP,
              },
            };
          }
          return n;
        });
        const next = [...shifted, template];
        if (onNodesChange) {
          const sanitized = sanitizeExternalNodes(next);
          onNodesChange(sanitized);
        }
        return next;
      });
      onSelectNode?.(template.id);
    },
    [
      addNodeHelpers,
      localNodes,
      yjsOnNodesChange,
      onNodesChange,
      onSelectNode,
      registerNode,
      sanitizeExternalNodes,
    ],
  );

  // ─── Chain drag: move all connected cells together ───
  const chainDragRef = useRef<{
    startPositions: Map<string, { x: number; y: number }>;
    dragNodeId: string;
  } | null>(null);

  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const chainId = useChainStore.getState().getFrameForCell(node.id);
      if (!chainId) {
        chainDragRef.current = null;
        return;
      }

      const chain = useChainStore.getState().chains[chainId];
      if (!chain || chain.cellIds.length <= 1) {
        chainDragRef.current = null;
        return;
      }

      const allRfNodes = rf.getNodes();
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const cellId of chain.cellIds) {
        const n = allRfNodes.find((rfn) => rfn.id === cellId);
        if (n) startPositions.set(cellId, { x: n.position.x, y: n.position.y });
      }

      chainDragRef.current = { startPositions, dragNodeId: node.id };
    },
    [rf],
  );

  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const ref = chainDragRef.current;
      if (!ref || ref.dragNodeId !== node.id) return;

      const startPos = ref.startPositions.get(node.id);
      if (!startPos) return;

      const dx = node.position.x - startPos.x;
      const dy = node.position.y - startPos.y;

      setFlowNodes((prev) =>
        prev.map((n) => {
          if (n.id === node.id) return n;
          const orig = ref.startPositions.get(n.id);
          if (!orig) return n;
          return {
            ...n,
            position: { x: orig.x + dx, y: orig.y + dy },
          };
        }),
      );
    },
    [setFlowNodes],
  );

  // ─── Snap-to-attach / Detach logic for cell nodes ───
  const SNAP_THRESHOLD_Y = 40;
  const SNAP_THRESHOLD_X = 60;
  const DETACH_THRESHOLD = 60;

  const getCellNodeType = useCallback((rfType?: string): string | undefined => {
    if (rfType === 'pythonCellNode') return 'pythonCell';
    if (rfType === 'markdownCellNode') return 'markdownCell';
    if (rfType === 'sqlCellNode') return 'sqlCell';
    return undefined;
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      // Sync chain member positions to localNodes after group drag
      const chainDrag = chainDragRef.current;
      if (chainDrag && chainDrag.dragNodeId === draggedNode.id) {
        const startPos = chainDrag.startPositions.get(draggedNode.id);
        if (startPos) {
          const dx = draggedNode.position.x - startPos.x;
          const dy = draggedNode.position.y - startPos.y;
          if (dx !== 0 || dy !== 0) {
            const siblingIds = new Set<string>();
            for (const [cid] of chainDrag.startPositions) {
              if (cid !== draggedNode.id) siblingIds.add(cid);
            }
            if (siblingIds.size > 0) {
              setLocalNodes((prev) => {
                const next = prev.map((n) => {
                  if (!siblingIds.has(n.id)) return n;
                  const orig = chainDrag.startPositions.get(n.id);
                  if (!orig) return n;
                  return { ...n, position: { x: orig.x + dx, y: orig.y + dy } };
                });
                emitNodesChange(next);
                return next;
              });
            }
          }
        }
        chainDragRef.current = null;
      }

      const draggedCellType = getCellNodeType(draggedNode.type);
      if (!draggedCellType) return;

      const allNodes = rf.getNodes();
      const draggedTop = draggedNode.position.y;
      const draggedHeight = draggedNode.height ?? DEFAULT_CELL_HEIGHT;
      const draggedBottom = draggedTop + draggedHeight;
      const draggedX = draggedNode.position.x;

      let snapBelow: Node | null = null;
      let snapAbove: Node | null = null;

      for (const other of allNodes) {
        if (other.id === draggedNode.id) continue;
        const otherCellType = getCellNodeType(other.type);
        if (!otherCellType) continue;

        const otherHeight = other.height ?? DEFAULT_CELL_HEIGHT;
        const otherBottom = other.position.y + otherHeight;
        const otherTop = other.position.y;

        // Dragged cell's top near other cell's bottom → snap below other
        if (
          Math.abs(draggedTop - otherBottom) < SNAP_THRESHOLD_Y &&
          Math.abs(draggedX - other.position.x) < SNAP_THRESHOLD_X
        ) {
          snapBelow = other;
          break;
        }

        // Dragged cell's bottom near other cell's top → snap above other
        if (
          Math.abs(draggedBottom - otherTop) < SNAP_THRESHOLD_Y &&
          Math.abs(draggedX - other.position.x) < SNAP_THRESHOLD_X
        ) {
          snapAbove = other;
          break;
        }
      }

      const draggedChainId = useChainStore.getState().getFrameForCell(draggedNode.id);

      if (snapBelow) {
        // Snap below this node — subtract "+" button area if target was the last cell
        let targetHeight = snapBelow.height ?? DEFAULT_CELL_HEIGHT;
        const snapBelowChainId = useChainStore.getState().getFrameForCell(snapBelow.id);
        if (snapBelowChainId) {
          const snapChain = useChainStore.getState().chains[snapBelowChainId];
          const snapIdx = snapChain ? snapChain.cellIds.indexOf(snapBelow.id) : -1;
          if (!snapChain || snapIdx === snapChain.cellIds.length - 1) {
            targetHeight -= ADD_BUTTON_FLOW_HEIGHT;
          }
        }
        const newPos = {
          x: snapBelow.position.x,
          y: snapBelow.position.y + targetHeight,
        };

        // Remove from old chain first
        if (draggedChainId) {
          useChainStore.getState().removeCellFromFrame(draggedChainId, draggedNode.id);
        }

        const targetChainId = useChainStore.getState().getFrameForCell(snapBelow.id);
        if (targetChainId) {
          const chain = useChainStore.getState().chains[targetChainId];
          const idx = chain?.cellIds.indexOf(snapBelow.id) ?? -1;
          useChainStore.getState().addCellToFrame(targetChainId, draggedNode.id, idx);

          // Shift cells that were after the insertion point
          const updatedChain = useChainStore.getState().chains[targetChainId];
          if (updatedChain) {
            const insertedIdx = updatedChain.cellIds.indexOf(draggedNode.id);
            const cellsAfter = updatedChain.cellIds.slice(insertedIdx + 1);
            const cellsAfterSet = new Set(cellsAfter);

            setLocalNodes((prev) => {
              const next = prev.map((n) => {
                if (n.id === draggedNode.id) return { ...n, position: newPos };
                if (cellsAfterSet.has(n.id))
                  return { ...n, position: { x: newPos.x, y: n.position.y + draggedHeight } };
                return n;
              });
              emitNodesChange(next);
              return next;
            });
          } else {
            setLocalNodes((prev) => {
              const next = prev.map((n) =>
                n.id === draggedNode.id ? { ...n, position: newPos } : n,
              );
              emitNodesChange(next);
              return next;
            });
          }
        } else {
          // Create new chain: target + dragged
          useChainStore
            .getState()
            .registerFrame(snapBelow.id, 'Notebook', [snapBelow.id, draggedNode.id]);
          setLocalNodes((prev) => {
            const next = prev.map((n) =>
              n.id === draggedNode.id ? { ...n, position: newPos } : n,
            );
            emitNodesChange(next);
            return next;
          });
        }
        return;
      }

      if (snapAbove) {
        // Snap above this node: dragged goes right above snapAbove
        const newPos = {
          x: snapAbove.position.x,
          y: snapAbove.position.y - draggedHeight,
        };

        if (draggedChainId) {
          useChainStore.getState().removeCellFromFrame(draggedChainId, draggedNode.id);
        }

        const targetChainId = useChainStore.getState().getFrameForCell(snapAbove.id);
        if (targetChainId) {
          const chain = useChainStore.getState().chains[targetChainId];
          const snapAboveIdx = chain?.cellIds.indexOf(snapAbove.id) ?? 0;
          const insertIdx = Math.max(0, snapAboveIdx - 1);
          useChainStore.getState().addCellToFrame(targetChainId, draggedNode.id, insertIdx);
        } else {
          useChainStore
            .getState()
            .registerFrame(draggedNode.id, 'Notebook', [draggedNode.id, snapAbove.id]);
        }

        setLocalNodes((prev) => {
          const next = prev.map((n) => (n.id === draggedNode.id ? { ...n, position: newPos } : n));
          emitNodesChange(next);
          return next;
        });
        return;
      }

      // No snap target found — check if should detach from current chain
      if (draggedChainId) {
        const chain = useChainStore.getState().chains[draggedChainId];
        if (chain) {
          const idx = chain.cellIds.indexOf(draggedNode.id);
          if (idx >= 0) {
            // Check distance to neighbors
            const prevCellId = idx > 0 ? chain.cellIds[idx - 1] : null;
            const nextCellId = idx < chain.cellIds.length - 1 ? chain.cellIds[idx + 1] : null;
            const prevNode = prevCellId ? allNodes.find((n) => n.id === prevCellId) : null;
            const nextNode = nextCellId ? allNodes.find((n) => n.id === nextCellId) : null;

            let shouldDetach = true;
            if (prevNode) {
              const prevBottom = prevNode.position.y + (prevNode.height ?? DEFAULT_CELL_HEIGHT);
              if (
                Math.abs(draggedTop - prevBottom) < DETACH_THRESHOLD &&
                Math.abs(draggedX - prevNode.position.x) < SNAP_THRESHOLD_X
              ) {
                shouldDetach = false;
              }
            }
            if (nextNode && shouldDetach) {
              if (
                Math.abs(draggedBottom - nextNode.position.y) < DETACH_THRESHOLD &&
                Math.abs(draggedX - nextNode.position.x) < SNAP_THRESHOLD_X
              ) {
                shouldDetach = false;
              }
            }

            if (shouldDetach) {
              useChainStore.getState().removeCellFromFrame(draggedChainId, draggedNode.id);

              // Close the gap: shift cells that were below the detached cell up
              const remainingChain = useChainStore.getState().chains[draggedChainId];
              if (remainingChain && remainingChain.cellIds.length > 0) {
                const cellsAfterDetach = chain.cellIds.slice(idx + 1);
                const cellsAfterSet = new Set(cellsAfterDetach);
                if (cellsAfterSet.size > 0) {
                  setLocalNodes((prev) => {
                    const next = prev.map((n) => {
                      if (cellsAfterSet.has(n.id)) {
                        return {
                          ...n,
                          position: { x: n.position.x, y: n.position.y - draggedHeight },
                        };
                      }
                      return n;
                    });
                    emitNodesChange(next);
                    return next;
                  });
                }
              }
            }
          }
        }
      }
    },
    [rf, getCellNodeType, localNodes, emitNodesChange, setLocalNodes],
  );

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
      type: 'sql' as const, // database nodes share SQL execution type
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
      } catch (err) {
        console.error('Failed to register dataset in DuckDB:', err);
        // Fallback: generate tableName and normalize columns manually
        tableName = result.filename
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/[^a-zA-Z0-9_]/g, '_');
        const { normalizeColumnName: normCol } = await import('../../lib/duckdbClient');
        normalizedColumns = result.data.columns.map(normCol);
      }

      // ALWAYS persist dataset to server (source of truth for restore after refresh).
      // This runs regardless of DuckDB success to ensure data survives page refresh.
      try {
        const { saveDatasetToServer } = await import('../../lib/api');
        await saveDatasetToServer(board.id, {
          tableName,
          fileName: result.filename,
          columns: normalizedColumns.length > 0 ? normalizedColumns : result.data.columns,
          rows: result.data.rows,
        });
      } catch (serverErr) {
        console.error('Failed to save dataset to server:', serverErr);
      }

      // Sync metadata to Yjs datasetsMap for other connected clients
      onCsvDatasetAdded?.({
        tableName,
        columns: normalizedColumns.length > 0 ? normalizedColumns : result.data.columns,
        rows: result.data.rows,
      });

      // Получаем центр viewport пользователя и преобразуем в координаты flow
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

      const nodeId = crypto.randomUUID();

      // Load all rows directly (up to 10k). No pagination needed for datasets this size.
      const MAX_INLINE_ROWS = 10000;
      const allRows = result.data.rows.slice(0, MAX_INLINE_ROWS);
      const columns = normalizedColumns.length > 0 ? normalizedColumns : result.data.columns;

      const previewData = {
        columns,
        rows: allRows,
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
        type: 'csv',
        payload: csvNode.payload,
      });

      // CRITICAL FIX: Use direct Yjs sync for immediate real-time synchronization
      // Previously CSV node relied on indirect emitNodesChange path which could be
      // skipped by isYjsUpdateRef check, causing node metadata to be lost after reload
      const reactFlowNode = canvasNodeToReactFlowNode(csvNode);
      if (yjsOnNodesChange) {
        yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
      }

      setLocalNodes((prev) => {
        const next = [...prev, csvNode];
        if (onNodesChange) {
          const sanitized = sanitizeExternalNodes(next);
          onNodesChange(sanitized);
        }
        return next;
      });
      onSelectNode?.(nodeId);
    },
    [
      rf,
      onNodesChange,
      sanitizeExternalNodes,
      yjsOnNodesChange,
      onSelectNode,
      registerNode,
      board.id,
      onCsvDatasetAdded,
    ],
  );

  const handleAddVoiceNode = useCallback(() => {
    // Получаем центр viewport пользователя и преобразуем в координаты flow
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

    const template = addNodeHelpers.createVoiceNode(position) as BoardCanvasProps['nodes'][number];

    // Sync through Yjs for real-time collaboration
    const reactFlowNode = canvasNodeToReactFlowNode(template);
    if (yjsOnNodesChange) {
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
    }

    setLocalNodes((prev) => {
      const next = [...prev, template];
      if (onNodesChange) {
        const sanitized = sanitizeExternalNodes(next);
        onNodesChange(sanitized);
      }
      return next;
    });
    onSelectNode?.(template.id);
    setTool('select');
  }, [
    addNodeHelpers,
    rf,
    yjsOnNodesChange,
    onNodesChange,
    onSelectNode,
    sanitizeExternalNodes,
    setTool,
  ]);

  const CELL_STACK_GAP = 0;
  const DEFAULT_CELL_HEIGHT = 180;
  const DEFAULT_MD_CELL_HEIGHT = 100;
  const NOTEBOOK_HEADER_HEIGHT = 28; // Height of the notebook header rendered above the first cell

  const handleUploadNotebook = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const { parseNotebook } = await import('../../lib/notebookParser');
        const notebook = parseNotebook(text, file.name);

        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        const position = rf.screenToFlowPosition({ x: viewportCenterX, y: viewportCenterY });

        // Create a single NotebookNode containing all cells
        const template = addNodeHelpers.createNotebookNode(position, {
          notebook,
          fileName: file.name,
        }) as BoardCanvasProps['nodes'][number];

        const reactFlowNode = canvasNodeToReactFlowNode(template);
        if (yjsOnNodesChange) {
          yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
        }

        setLocalNodes((prev) => {
          const next = [...prev, template];
          if (onNodesChange) {
            const sanitized = sanitizeExternalNodes(next);
            onNodesChange(sanitized);
          }
          return next;
        });
        onSelectNode?.(template.id);
      } catch (err) {
        console.error('Failed to parse notebook:', err);
      }
    },
    [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, sanitizeExternalNodes],
  );

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
                originHandleId === 'bottom' ||
                originHandleId.startsWith('cell-')) // notebook cell handles
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

      // If sourceHandle wasn't resolved from connection, use the origin handle ID
      if (!sourceHandle && connectOriginRef.current?.handleId) {
        sourceHandle = connectOriginRef.current.handleId;
      }

      // Determine the handle type we started from (from connectOriginRef)
      const originHandleType = connectOriginRef.current?.handleType;
      const isConnectingFromSource =
        originHandleType === 'source' ||
        sourceHandle === 'right' ||
        sourceHandle === 'bottom' ||
        (sourceHandle && sourceHandle.startsWith('cell-out-')) ||
        (connection.sourceHandle &&
          (connection.sourceHandle === 'right' ||
            connection.sourceHandle === 'bottom' ||
            connection.sourceHandle.startsWith('cell-out-')));

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

  // Deletion handler for selected nodes/edges (and active comment thread)
  const handleDeleteSelection = useCallback(() => {
    // If a comment thread is open, delete it instead of canvas elements
    const commentState = useCommentStore.getState();
    if (commentState.activeThreadId && board.id) {
      commentState.deleteThread(board.id, commentState.activeThreadId);
      commentState.closeThread();
      return;
    }

    // Delete any comments selected via marquee
    if (selectedCommentIds.size > 0 && board.id) {
      for (const commentId of selectedCommentIds) {
        commentState.deleteThread(board.id, commentId);
      }
      setSelectedCommentIds(new Set());
    }

    // collect selection from RF
    const selectedNodeIds = new Set(
      (rf.getNodes?.() ?? []).filter((n: any) => n?.selected).map((n: any) => n.id),
    );
    const selectedEdgeIds = new Set(
      (rf.getEdges?.() ?? []).filter((e: any) => e?.selected).map((e: any) => e.id),
    );
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0 && selectedCommentIds.size === 0)
      return;

    // CRITICAL FIX: Sync deletion through Yjs first to ensure real-time collaboration
    // This ensures deleted elements are removed from Yjs map and don't reappear
    if (yjsOnNodesChange && selectedNodeIds.size > 0) {
      selectedNodeIds.forEach((id) => recentlyDeletedIdsRef.current.add(id));
      const removeNodeChanges = Array.from(selectedNodeIds).map((id) => ({
        type: 'remove' as const,
        id,
      }));
      yjsOnNodesChange(removeNodeChanges);
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
    }

    // remove from localNodes (regular + mirrored notes + pen nodes)
    setLocalNodes((prev) => {
      const next = prev.filter((n) => !selectedNodeIds.has(n.id));
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
      return next;
    });

    onSelectNode?.(null);
  }, [
    rf,
    emitNodesChange,
    emitEdgesChange,
    onSelectNode,
    yjsOnNodesChange,
    yjsOnEdgesChange,
    board.id,
    selectedCommentIds,
  ]);

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

  // Register fitView for board menu "Catch up" and other consumers
  useEffect(() => {
    if (!flowInstance) {
      useBoardCanvasApiStore.getState().setFitView(null);
      return;
    }
    const fn = () => {
      flowInstance.fitView({ padding: 0.3, includeHiddenNodes: true, duration: 200 });
    };
    useBoardCanvasApiStore.getState().setFitView(fn);
    return () => useBoardCanvasApiStore.getState().setFitView(null);
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

  const handleNotebookDropped = useCallback(
    async (file: File, dropPosition?: { x: number; y: number }) => {
      try {
        const text = await file.text();
        const { parseNotebook } = await import('../../lib/notebookParser');
        const notebook = parseNotebook(text, file.name);

        const position =
          dropPosition ??
          rf.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });

        // Create a single NotebookNode containing all cells
        const template = addNodeHelpers.createNotebookNode(position, {
          notebook,
          fileName: file.name,
        }) as BoardCanvasProps['nodes'][number];

        const reactFlowNode = canvasNodeToReactFlowNode(template);
        if (yjsOnNodesChange) {
          yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
        }

        setLocalNodes((prev) => {
          const next = [...prev, template];
          if (onNodesChange) {
            const sanitized = sanitizeExternalNodes(next);
            onNodesChange(sanitized);
          }
          return next;
        });
        onSelectNode?.(template.id);
      } catch (err) {
        console.error('Failed to parse dropped notebook:', err);
      }
    },
    [addNodeHelpers, rf, yjsOnNodesChange, onNodesChange, onSelectNode, sanitizeExternalNodes],
  );

  return (
    <FileDropOverlay
      boardId={board.id}
      onFilesUploaded={handleFilesUploaded}
      onNotebookDropped={handleNotebookDropped}
      getDropPosition={getDropPosition}
      disabled={isPenMode || isShapeMode}
    >
      <div
        ref={canvasRootRef}
        className="board-canvas-root relative flex h-full min-h-0 w-full flex-1 overflow-hidden"
        style={{ position: 'relative', overscrollBehavior: 'none', touchAction: 'none' }}
      >
        <div
          className="relative h-full w-full overflow-hidden"
          onPointerMoveCapture={onMouseMove}
          onPointerLeaveCapture={onPointerLeave}
          onPointerDownCapture={handleSelectionPointerDown}
          onPointerUpCapture={handleSelectionPointerUp}
        >
          <div className="relative h-full w-full">
            {isPenMode && <PenToolbar />}
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              fitView
              fitViewOptions={{ padding: 0.2, duration: 0 }}
              panOnDrag={
                !isSelectMode &&
                !isStickyMode &&
                !isPenMode &&
                !isEraserMode &&
                !isTextMode &&
                !isShapeMode &&
                !isVoiceMode &&
                !isCommentMode
              }
              panOnScroll
              panOnScrollSpeed={1}
              zoomOnScroll={false}
              zoomOnPinch
              selectionOnDrag={isSelectMode}
              selectionMode={SelectionMode.Partial}
              nodesDraggable={
                !isPenMode && !isEraserMode && !isTextMode && !isShapeMode && !isVoiceMode
              }
              nodesConnectable={
                !isStickyMode &&
                !isPenMode &&
                !isEraserMode &&
                !isTextMode &&
                !isShapeMode &&
                !isVoiceMode &&
                !isCommentMode
              }
              elementsSelectable={
                !isStickyMode &&
                !isPenMode &&
                !isEraserMode &&
                !isTextMode &&
                !isShapeMode &&
                !isVoiceMode &&
                !isCommentMode
              }
              proOptions={{ hideAttribution: true }}
              className="h-full bg-white"
              style={{ width: '100%', height: '100%' }}
              onMove={onCursorViewportChange}
              onInit={(instance) => setFlowInstance(instance)}
              selectNodesOnDrag={false}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onConnectStart={handleConnectStart}
              onConnectEnd={handleConnectEnd}
              connectionLineComponent={CustomConnectionLine}
              connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 4 }}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
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

                // Клик по доске (вне карточки комментария) закрывает открытый тред и композер
                const commentStore = useCommentStore.getState();
                if (commentStore.activeThreadId || commentStore.composerAnchor) {
                  commentStore.closeThread();
                  commentStore.cancelComposer();
                }

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
                  const voiceNode = addNodeHelpers.createVoiceNode(
                    p,
                  ) as BoardCanvasProps['nodes'][number];

                  // Sync through Yjs for real-time collaboration
                  const reactFlowNode = canvasNodeToReactFlowNode(voiceNode);
                  if (yjsOnNodesChange) {
                    yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
                  }

                  setLocalNodes((prev) => {
                    const next = [...prev, voiceNode];
                    if (onNodesChange) {
                      const sanitized = sanitizeExternalNodes(next);
                      onNodesChange(sanitized);
                    }
                    return next;
                  });
                  // Автоматически выделяем созданный узел и сбрасываем tool в select
                  onSelectNode?.(voiceNode.id);
                  setTool('select');
                  return;
                }

                // Создаем фигуру по клику (как в Miro — click-to-place, центр фигуры в точке клика)
                if (isShapeMode && selectedShape) {
                  const isLine = isLineShapeType(selectedShape);
                  const defaultW = isLine
                    ? SHAPE_DEFAULTS.lineDefaultWidth
                    : SHAPE_DEFAULTS.defaultWidth;
                  const defaultH = isLine
                    ? SHAPE_DEFAULTS.lineDefaultHeight
                    : SHAPE_DEFAULTS.defaultHeight;
                  const position = { x: p.x - defaultW / 2, y: p.y - defaultH / 2 };
                  const shapePayload: Record<string, unknown> = {
                    shapeType: selectedShape,
                    fill: SHAPE_DEFAULTS.fill,
                    stroke: SHAPE_DEFAULTS.stroke,
                    strokeWidth: SHAPE_DEFAULTS.strokeWidth,
                    opacity: SHAPE_DEFAULTS.opacity,
                    cornerRadius:
                      selectedShape === 'round-rectangle'
                        ? SHAPE_DEFAULTS.roundRectCornerRadius
                        : SHAPE_DEFAULTS.cornerRadius,
                    arrowHead: selectedShape === 'arrow' ? true : undefined,
                  };
                  if (isLine) {
                    shapePayload.startX = 0;
                    shapePayload.startY = 0;
                    shapePayload.endX = defaultW;
                    shapePayload.endY = 0;
                  }
                  const shapeNode = addNodeHelpers.createShapeNode(
                    position,
                    defaultW,
                    defaultH,
                    shapePayload,
                  ) as BoardCanvasProps['nodes'][number];
                  const reactFlowNode = canvasNodeToReactFlowNode(shapeNode);
                  if (yjsOnNodesChange) yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
                  setLocalNodes((prev) => {
                    const next = [...prev, shapeNode];
                    queueMicrotask(() => emitNodesChange(next));
                    return next;
                  });
                  onSelectNode?.(shapeNode.id);
                  setTool('select');
                  return;
                }

                // Comment mode: place a comment anchor at the click point
                if (isCommentMode) {
                  useCommentStore.getState().startComposer({ x: p.x, y: p.y });
                  setTool('select');
                  return;
                }

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
              {onOpenPresentationViewer &&
                presentationBroadcastsMap &&
                flowNodes
                  .filter((n) => n.type === 'documentNode' && broadcastingNodeIds.has(n.id))
                  .map((n) => {
                    const w = (n.style?.width as number) ?? 400;
                    const h = (n.style?.height as number) ?? 500;
                    return (
                      <div
                        key={n.id}
                        className="nodrag nopan absolute z-10"
                        style={{
                          left: n.position.x + w / 2 - 90,
                          top: n.position.y + h + 8,
                          width: 180,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenPresentationViewer(n.id, true)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-md hover:bg-emerald-500"
                        >
                          <span>Подключиться к трансляции</span>
                        </button>
                      </div>
                    );
                  })}
              {isShapeMode && selectedShape && (
                <ShapeDragOverlay
                  selectedShape={selectedShape}
                  onAddShapeNode={(node) => {
                    // Создаем shape node через useAddNode (с shapeType из payload для ellipse, diamond и т.д.)
                    const shapeNode = addNodeHelpers.createShapeNode(
                      node.position,
                      node.width,
                      node.height,
                      node.payload,
                    ) as BoardCanvasProps['nodes'][number];
                    const reactFlowNode = canvasNodeToReactFlowNode(shapeNode);
                    if (yjsOnNodesChange) yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
                    setLocalNodes((prev) => {
                      const next = [...prev, shapeNode];
                      queueMicrotask(() => emitNodesChange(next));
                      return next;
                    });
                    onSelectNode?.(shapeNode.id);
                    setTool('select');
                  }}
                />
              )}
              {isEraserMode && (
                <EraserOverlay
                  eraserSize={20}
                  onDeleteNodes={handleDeleteNodes}
                  onCursorMove={onMouseMove}
                />
              )}
              {isPenMode && (
                <FreehandOverlay
                  yjsOnNodesChange={yjsOnNodesChange}
                  onCursorMove={onMouseMove}
                  onAddPenNode={(node) => {
                    // Добавляем pen node в localNodes
                    const externalNode = {
                      id: node.id,
                      type: 'pen' as const,
                      position: node.position,
                      payload: {
                        points: node.data.points,
                        initialSize: node.data.initialSize,
                        color: node.data.color,
                        strokeWidth: node.data.strokeWidth,
                        opacity: node.data.opacity,
                        smoothing: node.data.smoothing,
                        thinning: node.data.thinning,
                      },
                    };
                    setLocalNodes((prev) => {
                      const next = [...prev, externalNode];
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
                      return [...prev, flowNode];
                    });
                  }}
                />
              )}
            </ReactFlow>
          </div>
        </div>
        {/* Comment overlay: positioned relative to board-canvas-root, outside overflow-hidden */}
        <CommentLayer
          boardId={board.id}
          selectedCommentIds={selectedCommentIds}
          commentDragMap={commentDragMap}
          cursorsMap={cursorsMap}
          clientId={clientId}
        />
        {/* Collaborative cursors overlay — rendered after comments so cursors appear above them */}
        <CollaborativeCursors cursors={cursors} ownClientId={clientId} />
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
          onAddPythonCell={handleAddPythonCell}
          onAddSqlCell={handleAddSqlCell}
          onAddDatabaseNode={handleAddDatabaseNode}
          onAddPlotNode={handleAddPlotNode}
          onAddVoiceNode={handleAddVoiceNode}
          onUploadSpreadsheet={handleUploadSpreadsheet}
          onUploadNotebook={handleUploadNotebook}
          selectedShape={selectedShape}
          onSelectShape={setSelectedShape}
          onDeleteSelection={handleDeleteSelection}
          hasSelection={hasSelection}
        />
      </div>
    </FileDropOverlay>
  );
}
