'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  fetchBoard,
  isValidUuid,
  saveBoardStructure,
  type BoardResponse,
  type SaveBoardStructureInput,
} from '../../../lib/api';
import { RequireAuth } from '../../../components/RequireAuth';
import { useAuthStore } from '../../../state/authStore';
import { useRouter } from 'next/navigation';
import { useExecutionStore, type ExecutionStoreState } from '../../../state/executionStore';
import { useCanvasLayoutStore, type CanvasLayoutState } from '../../../state/canvasLayoutStore';
import { useBoardCollaboration } from '../../../hooks/useBoardCollaboration';
import { useBoardPresence } from '../../../hooks/useBoardPresence';
import { useYjsUndoManager } from '../../../hooks/useYjsUndoManager';
import { UserPresenceIndicator } from '../../../components/UserPresenceIndicator';
import { UndoRedoControls } from '../../../components/UndoRedoControls';
import {
  executeSql,
  executeSqlWithPreview,
  listTables,
  loadFileIntoDuckDb,
  restoreDatasetsForBoard,
  registerDatasetFromCsvNode,
} from '../../../lib/duckdbClient';
import { runPython } from '../../../lib/pythonExecutor';
import type { SqlResult, PlotResult } from '../../../state/executionStore';
import type { PlotConfig, PlotNodePayload } from '../../../lib/visualization/chartTypes';

type ExecutionNode = Extract<
  BoardResponse['nodes'][number],
  { type: 'sql' | 'python' | 'table' | 'plot' | 'csv' }
>;

const isExecutionNode = (node: BoardResponse['nodes'][number]): node is ExecutionNode => {
  return (
    node.type === 'sql' ||
    node.type === 'python' ||
    node.type === 'table' ||
    node.type === 'plot' ||
    node.type === 'csv'
  );
};

type CanvasNode = {
  id: string;
  boardId?: string;
  type: BoardResponse['nodes'][number]['type'];
  position: BoardResponse['nodes'][number]['position'];
  payload?: Record<string, unknown>;
};

type CanvasEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  metadata: Record<string, unknown>;
};

function mapNodesToCanvas(nodes: BoardResponse['nodes']): CanvasNode[] {
  return nodes.map((node) => ({
    id: node.id,
    boardId: node.boardId,
    type: node.type,
    position: node.position,
    payload: node.payload,
  }));
}

function mapEdgesToCanvas(edges: BoardResponse['edges']): CanvasEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    metadata: edge.metadata ?? {},
  }));
}

const BoardCanvasDynamic = dynamic(
  () => import('../../../components/BoardCanvas').then((module) => module.BoardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-slate-400">Loading canvas…</div>
    ),
  },
);

type BoardPageProps = {
  params: {
    boardId: string;
  };
};

function BoardPageContent({ params }: BoardPageProps) {
  const { boardId } = params;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [nodesState, setNodesState] = useState<CanvasNode[]>([]);
  const [edgesState, setEdgesState] = useState<CanvasEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [isUploadingDataset, setIsUploadingDataset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const entries = useExecutionStore((state: ExecutionStoreState) => state.entries);
  const initFromNodes = useExecutionStore((state: ExecutionStoreState) => state.initFromNodes);
  const setCodeStore = useExecutionStore((state: ExecutionStoreState) => state.setCode);
  const setStatus = useExecutionStore((state: ExecutionStoreState) => state.setStatus);
  const setSuccess = useExecutionStore((state: ExecutionStoreState) => state.setSuccess);
  const setError = useExecutionStore((state: ExecutionStoreState) => state.setError);
  const resetExecutionOutput = useExecutionStore((state: ExecutionStoreState) => state.resetOutput);
  const removeExecutionEntry = useExecutionStore((state: ExecutionStoreState) => state.removeNode);

  const resetLayout = useCanvasLayoutStore((state: CanvasLayoutState) => state.reset);
  const nodeSizes = useCanvasLayoutStore((state: CanvasLayoutState) => state.nodeSizes);
  const setNodeWidth = useCanvasLayoutStore((state: CanvasLayoutState) => state.setNodeWidth);

  const { data, isLoading, error } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => fetchBoard(boardId),
    enabled: isValidUuid(boardId),
  });

  // Initialize Yjs collaboration when board data is loaded
  const collaboration = useBoardCollaboration(
    boardId,
    data ? mapNodesToCanvas(data.nodes) : undefined,
    data ? mapEdgesToCanvas(data.edges) : undefined
  );

  // Get list of users on the board for presence indicator
  const presenceUsers = useBoardPresence(collaboration.cursorsMap, collaboration.clientId);

  // Per-user undo/redo using Yjs UndoManager
  // Only tracks changes made by the current user
  const {
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
  } = useYjsUndoManager(
    collaboration.ydoc,
    collaboration.nodesMap,
    collaboration.edgesMap,
    collaboration.clientId
  );

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          handleUndo();
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo) {
          handleRedo();
        }
      }
      // Ctrl+Y or Cmd+Y for redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) {
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, canUndo, canRedo]);

  // Use Yjs as the single source of truth for nodes and edges
  const yjsNodes = collaboration.canvasNodes.length > 0 ? collaboration.canvasNodes : nodesState;
  const yjsEdges = collaboration.canvasEdges.length > 0 ? collaboration.canvasEdges : edgesState;

  // Sync Yjs changes back to local state (but prevent sync loops)
  // Only sync if nodes actually changed (by comparing IDs, positions, and content)
  useEffect(() => {
    if (collaboration.canvasNodes.length === 0) return;
    
    // Compare by IDs to avoid unnecessary updates
    const currentIds = new Set(nodesStateRef.current.map((n) => n.id));
    const yjsIds = new Set(collaboration.canvasNodes.map((n) => n.id));
    const idsChanged = 
      currentIds.size !== yjsIds.size ||
      Array.from(currentIds).some((id) => !yjsIds.has(id)) ||
      Array.from(yjsIds).some((id) => !currentIds.has(id));
    
    // CRITICAL FIX: Also check if positions changed
    // This ensures that position updates from Yjs are synced to local state
    const positionsChanged = nodesStateRef.current.some((node) => {
      const yjsNode = collaboration.canvasNodes.find((n) => n.id === node.id);
      if (!yjsNode) return false;
      // Check if position changed (with small threshold to avoid floating point issues)
      const threshold = 0.01;
      return (
        Math.abs(yjsNode.position.x - node.position.x) > threshold ||
        Math.abs(yjsNode.position.y - node.position.y) > threshold
      );
    });
    
    // CRITICAL FIX: Check if code changed in SQL/Python nodes
    // This ensures code changes from Yjs are synced to codeStore
    const codeChanged = nodesStateRef.current.some((node) => {
      if (node.type !== 'sql' && node.type !== 'python') return false;
      const yjsNode = collaboration.canvasNodes.find((n) => n.id === node.id);
      if (!yjsNode) return false;
      const currentCode = node.type === 'sql' 
        ? ((node.payload as any)?.sql ?? '')
        : ((node.payload as any)?.python ?? '');
      const yjsCode = node.type === 'sql'
        ? ((yjsNode.payload as any)?.sql ?? '')
        : ((yjsNode.payload as any)?.python ?? '');
      return currentCode !== yjsCode;
    });
    
    // CRITICAL FIX: Check if execution status/results changed
    // This ensures execution results from Yjs are synced to executionStore
    const executionChanged = nodesStateRef.current.some((node) => {
      if (node.type !== 'sql' && node.type !== 'python') return false;
      const yjsNode = collaboration.canvasNodes.find((n) => n.id === node.id);
      if (!yjsNode) return false;
      const currentExecution = (node.payload as any)?.execution;
      const yjsExecution = (yjsNode.payload as any)?.execution;
      if (!currentExecution && !yjsExecution) return false;
      if (!currentExecution || !yjsExecution) return true;
      // Compare execution status
      if (currentExecution.status !== yjsExecution.status) return true;
      // Compare execution results if status is success
      if (yjsExecution.status === 'success' && currentExecution.status === 'success') {
        return JSON.stringify(currentExecution.output) !== JSON.stringify(yjsExecution.output);
      }
      // Compare error messages if status is error
      if (yjsExecution.status === 'error' && currentExecution.status === 'error') {
        return currentExecution.error !== yjsExecution.error;
      }
      return false;
    });
    
    if (idsChanged || positionsChanged || codeChanged || executionChanged) {
      // Mark as Yjs update to prevent sync loop
      isYjsUpdateRef.current = true;
      // Update local state from Yjs
      const previousIds = new Set(nodesStateRef.current.map((node) => node.id));
      const nextIds = new Set(collaboration.canvasNodes.map((node) => node.id));
      previousIds.forEach((id) => {
        if (!nextIds.has(id)) {
          removeExecutionEntry(id);
        }
      });
      
      // Update codeStore for SQL/Python nodes when code changes through Yjs
      if (codeChanged) {
        collaboration.canvasNodes.forEach((yjsNode) => {
          if (yjsNode.type === 'sql' || yjsNode.type === 'python') {
            const code = yjsNode.type === 'sql'
              ? ((yjsNode.payload as any)?.sql ?? '')
              : ((yjsNode.payload as any)?.python ?? '');
            if (code) {
              setCodeStore(yjsNode.id, code);
            }
          }
        });
      }
      
      // Update executionStore when execution status/results change through Yjs
      // CRITICAL FIX: Don't overwrite final states (success/error) with "running" from Yjs
      // This prevents errors from being overwritten by stale "running" status
      // CRITICAL FIX: Both errors and success should overwrite each other - whichever comes from Yjs is the latest state
      if (executionChanged) {
        collaboration.canvasNodes.forEach((yjsNode) => {
          if (yjsNode.type === 'sql' || yjsNode.type === 'python') {
            const execution = (yjsNode.payload as any)?.execution;
            if (execution) {
              const currentEntry = useExecutionStore.getState().entries[yjsNode.id];
              const currentStatus = currentEntry?.status;
              
              // Always update "running" status when it comes from Yjs
              // This ensures other users see when someone starts executing a node
              // CRITICAL FIX: Don't overwrite success/error with "running" if we just set success/error locally
              // Check if the current status in nodesStateRef is already success/error - if so, don't overwrite with running
              const currentNodeInRef = nodesStateRef.current.find((n) => n.id === yjsNode.id);
              const currentNodeExecution = currentNodeInRef ? (currentNodeInRef.payload as any)?.execution : null;
              
              if (execution.status === 'running') {
                // Only set "running" if current status in ref is not already a final state
                // This prevents overwriting success/error that was just set locally
                if (currentNodeExecution?.status !== 'success' && currentNodeExecution?.status !== 'error') {
                  // Always set "running" - it indicates a new execution has started
                  // This allows other users to see the execution progress in real-time
                  setStatus(yjsNode.id, 'running');
                }
              } else if (execution.status === 'error' && execution.error) {
                // Always update error - new errors replace old results (including success)
                setError(yjsNode.id, execution.error);
              } else if (execution.status === 'success' && execution.output) {
                // Always update success - new success replaces old errors (after fixing the query)
                // This ensures that when a user fixes an error and runs successfully, all users see the success
                setSuccess(yjsNode.id, execution.output);
              }
            }
          }
        });
      }
      
      // Type assertion: collaboration.canvasNodes uses CanvasNode from yjs/adapters (type: string)
      // but we need the local CanvasNode type (with specific union type)
      // This is safe because all valid node types are included in the union
      setNodesState(collaboration.canvasNodes as CanvasNode[]);
      
      // CRITICAL FIX: Trigger auto-save when nodes are added/updated through Yjs
      // This ensures that new nodes added via yjsOnNodesChange are saved to DB
      // Use setTimeout to ensure nodesStateRef is updated before auto-save
      // Use ref to avoid dependency issues
      setTimeout(() => {
        triggerAutoSaveRef.current?.();
      }, 0);
    }
  }, [collaboration.canvasNodes, removeExecutionEntry, setCodeStore, setStatus, setSuccess, setError]);

  useEffect(() => {
    if (collaboration.canvasEdges.length === 0) return;
    
    // Compare by IDs to avoid unnecessary updates
    const currentIds = new Set(edgesStateRef.current.map((e) => e.id));
    const yjsIds = new Set(collaboration.canvasEdges.map((e) => e.id));
    const idsChanged = 
      currentIds.size !== yjsIds.size ||
      Array.from(currentIds).some((id) => !yjsIds.has(id)) ||
      Array.from(yjsIds).some((id) => !currentIds.has(id));
    
    if (idsChanged) {
      setEdgesState(collaboration.canvasEdges);
    }
  }, [collaboration.canvasEdges]);

  const dataLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const serverDataRef = useRef<{
    nodes: BoardResponse['nodes'];
    edges: BoardResponse['edges'];
  } | null>(null);

  const previousBoardIdRef = useRef<string | null>(null);
  const nodesStateRef = useRef(nodesState);
  const edgesStateRef = useRef(edgesState);

  useEffect(() => {
    nodesStateRef.current = nodesState;
  }, [nodesState]);

  useEffect(() => {
    edgesStateRef.current = edgesState;
  }, [edgesState]);

  function nodesEqual(a: typeof nodesStateRef.current, b: BoardResponse['nodes']): boolean {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      const left = a[index];
      const right = b[index];
      if (
        !right ||
        left.id !== right.id ||
        left.type !== right.type ||
        left.position.x !== right.position.x ||
        left.position.y !== right.position.y ||
        JSON.stringify(left.payload ?? {}) !== JSON.stringify(right.payload ?? {})
      ) {
        return false;
      }
    }
    return true;
  }

  function edgesEqual(a: typeof edgesStateRef.current, b: BoardResponse['edges']): boolean {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      const left = a[index];
      const right = b[index];
      if (
        !right ||
        left.id !== right.id ||
        left.sourceId !== right.sourceId ||
        left.targetId !== right.targetId ||
        JSON.stringify(left.metadata ?? {}) !== JSON.stringify(right.metadata ?? {})
      ) {
        return false;
      }
    }
    return true;
  }

  const refreshTables = useCallback(async () => {
    try {
      const names = await listTables();
      setTableNames(names);
    } catch (error) {
      console.error('Failed to fetch DuckDB tables', error);
    }
  }, []);

  // Sync datasets from Yjs and restore them in local DuckDB
  useEffect(() => {
    const datasetsMap = collaboration.datasetsMap;
    if (!datasetsMap) return;

    const observer = async () => {
      try {
        const { restoreDatasetsForBoard, getDatasetsKey } = await import('../../../lib/duckdbClient');
        const datasets: Array<{ tableName: string; columns: string[]; rows: Array<Array<string | number | null>> }> = [];
        
        // Collect all datasets from Yjs map
        datasetsMap.forEach((dataset: any) => {
          datasets.push(dataset);
        });

        // Save datasets to localStorage (for compatibility with restoreDatasetsForBoard)
        // Always update localStorage, even if empty (to handle deletions)
        const key = getDatasetsKey(boardId);
        window.localStorage.setItem(key, JSON.stringify(datasets));
        
        // Restore datasets in local DuckDB (this will clear tables if datasets is empty)
        await restoreDatasetsForBoard(boardId);
        
        // Refresh table list
        await refreshTables();
      } catch (error) {
        console.error('Failed to sync datasets from Yjs', error);
      }
    };

    // Observe changes in datasetsMap
    datasetsMap.observe(observer);
    
    // Initial sync (even if map is empty, we need to restore from localStorage on first load)
    observer();

    return () => {
      datasetsMap.unobserve(observer);
    };
  }, [collaboration.datasetsMap, boardId, refreshTables]);

  useEffect(() => {
    if (!data) return;

    const boardChanged = previousBoardIdRef.current !== data.board.id;
    const isInitialLoad = nodesStateRef.current.length === 0 && edgesStateRef.current.length === 0;
    previousBoardIdRef.current = data.board.id;

    // Сохраняем серверные данные для сравнения
    serverDataRef.current = { nodes: data.nodes, edges: data.edges };

    // Устанавливаем флаги загрузки, чтобы markDirty не срабатывал во время загрузки
    dataLoadedRef.current = false;
    isLoadingRef.current = true;
    // Сразу сбрасываем isDirty при начале загрузки данных
    setIsDirty(false);
    setSaveError(null);

    const executionNodes: ExecutionNode[] = data.nodes.filter(isExecutionNode);

    if (boardChanged) {
      useExecutionStore.setState({ entries: {} });
      initFromNodes(executionNodes);
      resetLayout();
      if (data.nodes.length > 0) {
        setSelectedNodeId((current) => current ?? data.nodes[0].id);
      }
    } else {
      // При обновлении той же доски восстанавливаем результаты выполнения из payload
      // только если entries еще не заполнены (первая загрузка после обновления страницы)
      const currentEntries = useExecutionStore.getState().entries;
      if (Object.keys(currentEntries).length === 0) {
        initFromNodes(executionNodes);
      }
    }

    // Обновляем состояние только если оно действительно изменилось
    // При первой загрузке это всегда произойдет, но markDirty не сработает из-за isLoadingRef.current = true
    // и handleNodesChange/handleEdgesChange теперь проверяют серверные данные
    if (!nodesEqual(nodesStateRef.current, data.nodes)) {
      setNodesState(mapNodesToCanvas(data.nodes));
    }
    if (!edgesEqual(edgesStateRef.current, data.edges)) {
      setEdgesState(mapEdgesToCanvas(data.edges));
    }

    data.nodes.forEach((node) => {
      const ui = (node.payload as Record<string, unknown> | undefined)?.ui as
        | { width?: number }
        | undefined;
      // ширину в стор кладём только для не-sticky узлов
      if (node.type !== 'note' && ui?.width) {
        setNodeWidth(node.id, ui.width);
      }
    });

    // После всех обновлений снимаем флаги загрузки
    // Важно: делаем это через requestAnimationFrame, чтобы все синхронные обновления завершились
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isLoadingRef.current = false;
        dataLoadedRef.current = true;
        // Принудительно сбрасываем isDirty после загрузки, чтобы гарантировать
        // что кнопка сохранения неактивна после загрузки неизмененной доски
        setIsDirty(false);
        setSaveError(null);
      });
    });
  }, [data, initFromNodes, resetLayout, setNodeWidth]);

  // Дополнительный эффект для гарантированного сброса isDirty после загрузки данных
  useEffect(() => {
    if (!data || !dataLoadedRef.current) return;

    // Используем requestAnimationFrame для более надежной проверки после всех обновлений
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (dataLoadedRef.current && data) {
          setIsDirty((prev) => {
            // Проверяем, что доска действительно не изменилась
            // сравнивая текущее состояние с данными из сервера
            if (prev) {
              const currentNodes = nodesStateRef.current;
              const currentEdges = edgesStateRef.current;
              const nodesMatch = nodesEqual(currentNodes, data.nodes);
              const edgesMatch = edgesEqual(currentEdges, data.edges);
              // Если состояние совпадает с серверными данными, сбрасываем isDirty
              if (nodesMatch && edgesMatch) {
                return false;
              }
            }
            return prev;
          });
        }
      });
    });
  }, [data]);

  const csvNodesRegisteredRef = useRef(false);

  useEffect(() => {
    void (async () => {
      await restoreDatasetsForBoard(boardId);
      await refreshTables();
    })();
  }, [boardId, refreshTables]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Register CSV nodes from payload into DuckDB on initial load (fallback when localStorage empty)
  // NOTE: restoreDatasetsForBoard runs first and loads FULL data from localStorage.
  // Payload.data is preview-only (100 rows) - we must NOT overwrite full data with it.
  // Only register from payload when localStorage has no datasets (e.g. new device).
  useEffect(() => {
    if (csvNodesRegisteredRef.current) return;

    const csvNodes = nodesState.filter((n) => n.type === 'csv');
    if (csvNodes.length === 0) return;

    csvNodesRegisteredRef.current = true;

    void (async () => {
      const { getDatasetsKey } = await import('../../../lib/duckdbClient');
      const key = getDatasetsKey(boardId);
      const hasStoredDatasets =
        typeof window !== 'undefined' &&
        (window.localStorage.getItem(key) ?? '[]') !== '[]';

      for (const node of csvNodes) {
        const payload = node.payload as {
          filename?: string;
          tableName?: string;
          data?: SqlResult;
          totalRowCount?: number;
        } | undefined;
        if (!payload?.data || !payload?.filename) continue;
        const rowCount = payload.data.rows?.length ?? 0;
        const totalCount = payload.totalRowCount ?? rowCount;
        // Skip when payload is partial AND we have full data in localStorage
        if (totalCount > rowCount && hasStoredDatasets) continue;
        try {
          await registerDatasetFromCsvNode(payload.filename, payload.data, boardId);
          console.log(`Registered CSV "${payload.filename}" as table in DuckDB`);
        } catch (err) {
          console.error(`Failed to register CSV node ${node.id} in DuckDB:`, err);
        }
      }
      await refreshTables();
    })();
  }, [nodesState, boardId, refreshTables]);

  const adjacency = useMemo(() => {
    const map = new Map<string, string[]>();
    edgesState.forEach((edge) => {
      if (!map.has(edge.sourceId)) {
        map.set(edge.sourceId, []);
      }
      map.get(edge.sourceId)!.push(edge.targetId);
    });
    return map;
  }, [edgesState]);

  const reverseAdjacency = useMemo(() => {
    const map = new Map<string, string[]>();
    edgesState.forEach((edge) => {
      if (!map.has(edge.targetId)) {
        map.set(edge.targetId, []);
      }
      map.get(edge.targetId)!.push(edge.sourceId);
    });
    return map;
  }, [edgesState]);

  const getAncestors = useCallback(
    (nodeId: string) => {
      const result: string[] = [];
      const visited = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        const parents = reverseAdjacency.get(current) ?? [];
        for (const parent of parents) {
          if (!visited.has(parent)) {
            visited.add(parent);
            result.push(parent);
            stack.push(parent);
          }
        }
      }
      return result;
    },
    [reverseAdjacency],
  );

  const markDirty = useCallback(() => {
    // Не помечаем доску как измененную, если данные еще загружаются
    if (!dataLoadedRef.current || isLoadingRef.current) return;
    setIsDirty(true);
    setSaveError(null);
  }, []);

  const handleRunNode = useCallback(
    async (nodeId: string) => {
      const node = nodesState.find((item) => item.id === nodeId);
      if (!node) {
        setError(nodeId, 'Node not found');
        return;
      }
      resetExecutionOutput(nodeId);
      const currentEntries = useExecutionStore.getState().entries;
      const entry = currentEntries[nodeId];
      const code = entry?.code ?? '';

      setStatus(nodeId, 'running');
      
      // Sync "running" status through Yjs for real-time collaboration
      // This allows other clients to see that the node is executing
      setNodesState((prev) => {
        const next = prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                payload: {
                  ...(n.payload ?? {}),
                  execution: {
                    status: 'running' as const,
                    startedAt: Date.now(),
                  },
                },
              }
            : n,
        );
        collaboration.handleCanvasNodesChange(next);
        return next;
      });
      try {
        if (node.type === 'sql') {
          // Check if there's a database connection node connected to this SQL node
          const incomingEdges = edgesState.filter((edge) => edge.targetId === nodeId);
          let dbNode = null;
          for (const edge of incomingEdges) {
            const sourceNode = nodesState.find((n) => n.id === edge.sourceId);
            if (sourceNode?.type === 'database') {
              dbNode = sourceNode;
              break; // Use the first database connection found
            }
          }

          let result;
          if (dbNode) {
            // Execute via PostgreSQL
            const payload = dbNode.payload as { connectionId?: string } | undefined;
            const connectionId = payload?.connectionId;

            if (!connectionId) {
              setError(nodeId, 'Database connection not configured');
              return;
            }

            try {
              const { executePostgresSql } = await import('../../../lib/postgresClient');
              result = await executePostgresSql(connectionId, code);
              // Update database node status to connected on success
              setNodesState((prev) =>
                prev.map((n) =>
                  n.id === dbNode!.id
                    ? {
                        ...n,
                        payload: {
                          ...(n.payload ?? {}),
                          status: 'connected' as const,
                        },
                      }
                    : n,
                ),
              );
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              // Update database node status to error
              setNodesState((prev) =>
                prev.map((n) =>
                  n.id === dbNode!.id
                    ? {
                        ...n,
                        payload: {
                          ...(n.payload ?? {}),
                          status: 'error' as const,
                        },
                      }
                    : n,
                ),
              );
              throw err;
            }
          } else {
            // Execute via DuckDB (default) with preview mode for large results
            result = await executeSqlWithPreview(code);
          }

          const output = { kind: 'sql' as const, result, code };
          setSuccess(nodeId, output);
          const latestEntry = useExecutionStore.getState().entries[nodeId];

          // Сохраняем результаты выполнения в payload узла и синхронизируем через Yjs
          setNodesState((prev) => {
            const next = prev.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    payload: {
                      ...(n.payload ?? {}),
                      execution: {
                        status: 'success' as const,
                        output,
                        hiddenOutputs: latestEntry?.hiddenOutputs,
                      },
                    },
                  }
                : n,
            );
            // Sync execution results through Yjs for real-time collaboration
            // CRITICAL: Update nodesStateRef before syncing to Yjs to prevent stale data issues
            nodesStateRef.current = next;
            collaboration.handleCanvasNodesChange(next);
            return next;
          });
          markDirty();
          return;
        }

        if (node.type === 'python') {
          const ancestors = getAncestors(nodeId);
          let upstreamResult: SqlResult | undefined;
          // ensure immediate parents are executed if needed
          const immediateParents = reverseAdjacency.get(nodeId) ?? [];
          for (const parentId of immediateParents) {
            const parentEntry = useExecutionStore.getState().entries[parentId];
            const parentNode = nodesState.find((n) => n.id === parentId);
            if (parentNode?.type === 'sql' && parentEntry?.output?.kind !== 'sql') {
              // run parent SQL to produce output for downstream
              await handleRunNode(parentId);
            }
          }
          for (const ancestorId of ancestors) {
            const output = useExecutionStore.getState().entries[ancestorId]?.output;
            if (output?.kind === 'sql') {
              upstreamResult = output.result;
              break;
            }
          }
          // Fallback: if ancestor traversal didn't find SQL, scan edges for direct parents
          if (!upstreamResult) {
            const directParents = edgesState
              .filter((e) => e.targetId === nodeId)
              .map((e) => e.sourceId);
            for (const parentId of directParents) {
              const parentNode = nodesState.find((n) => n.id === parentId);
              if (parentNode?.type !== 'sql') continue;
              const parentEntry = useExecutionStore.getState().entries[parentId];
              if (parentEntry?.output?.kind !== 'sql') {
                await handleRunNode(parentId);
              }
              const out = useExecutionStore.getState().entries[parentId]?.output;
              if (out?.kind === 'sql') {
                upstreamResult = out.result;
                break;
              }
            }
          }

          const pythonOutput = await runPython(code, { sqlResult: upstreamResult });
          if (!pythonOutput.success) {
            const errorMessage = pythonOutput.error ?? 'Execution failed';
            setError(nodeId, errorMessage);
            const latestEntry = useExecutionStore.getState().entries[nodeId];

            // Сохраняем статус ошибки в payload узла и синхронизируем через Yjs
            setNodesState((prev) => {
              const next = prev.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      payload: {
                        ...(n.payload ?? {}),
                        execution: {
                          status: 'error' as const,
                          error: errorMessage,
                          hiddenOutputs: latestEntry?.hiddenOutputs,
                        },
                      },
                    }
                  : n,
              );
              // Sync execution error through Yjs for real-time collaboration
              collaboration.handleCanvasNodesChange(next);
              return next;
            });
            markDirty();
            return;
          }

          const output = {
            kind: 'python' as const,
            result: {
              stdout: pythonOutput.stdout,
              stderr: pythonOutput.stderr ?? '',
              table: pythonOutput.table ?? null,
              plotJson: pythonOutput.plotJson ?? null,
            },
            code,
          };
          setSuccess(nodeId, output);
          const latestEntry = useExecutionStore.getState().entries[nodeId];

          // Сохраняем результаты выполнения в payload узла и синхронизируем через Yjs
          setNodesState((prev) => {
            const next = prev.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    payload: {
                      ...(n.payload ?? {}),
                      execution: {
                        status: 'success' as const,
                        output,
                        hiddenOutputs: latestEntry?.hiddenOutputs,
                      },
                    },
                  }
                : n,
            );
            // Sync execution results through Yjs for real-time collaboration
            collaboration.handleCanvasNodesChange(next);
            return next;
          });
          markDirty();
          return;
        }

        if (node.type === 'plot') {
          // Plot nodes don't execute code - they visualize data from upstream nodes.
          // Visualization must be built from the FULL dataset (not preview).
          const upstreamEdges = edgesState.filter((edge) => edge.targetId === nodeId);
          let inputData: SqlResult | undefined;

          for (const edge of upstreamEdges) {
            const upstreamEntry = useExecutionStore.getState().entries[edge.sourceId];

            if (upstreamEntry?.output?.kind === 'sql') {
              // SQL upstream: fetch full result for visualization (not preview limit)
              const sqlCode = upstreamEntry.code ?? '';
              if (sqlCode.trim()) {
                try {
                  const fullResult = await executeSqlWithPreview(sqlCode, {
                    fullLoad: true,
                  });
                  inputData = fullResult;
                } catch (err) {
                  console.warn('Plot: full SQL load failed, using preview', err);
                  inputData = upstreamEntry.output.result;
                }
              } else {
                inputData = upstreamEntry.output.result;
              }
              break;
            }
            if (
              upstreamEntry?.output?.kind === 'python' &&
              upstreamEntry.output.result?.table
            ) {
              inputData = upstreamEntry.output.result.table;
              break;
            }
            if (
              upstreamEntry?.output?.kind === 'plot' &&
              upstreamEntry.output.result?.inputData
            ) {
              inputData = upstreamEntry.output.result.inputData;
              break;
            }
          }
          // CSV upstream: PlotNode uses useFullCsvDataForPlot(upstreamCsvTableName) for
          // rendering, so full dataset is loaded in the component; no need to fetch here.

          // Get plot configuration from payload
          const plotPayload = (node.payload ?? {}) as PlotNodePayload;
          const plotConfig: PlotConfig = {
            chartType: plotPayload.chartType ?? 'bar',
            mapping: plotPayload.mapping ?? {},
            aggregation: plotPayload.aggregation,
            filters: plotPayload.filters,
            sort: plotPayload.sort,
            styling: plotPayload.styling ?? {
              title: 'New Chart',
              theme: 'light',
              showLegend: true,
              legendPosition: 'top',
              showGrid: true,
              enableZoomPan: false,
              enableTooltips: true,
            },
          };

          // Create PlotResult
          if (inputData) {
            const plotResult: PlotResult = {
              chartType: plotConfig.chartType,
              config: plotConfig,
              inputData,
            };

            const output = { kind: 'plot' as const, result: plotResult };
            setSuccess(nodeId, output);
            const latestEntry = useExecutionStore.getState().entries[nodeId];

            // Сохраняем результаты выполнения в payload узла и синхронизируем через Yjs
            setNodesState((prev) => {
              const next = prev.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      payload: {
                        ...(n.payload ?? {}),
                        execution: {
                          status: 'success' as const,
                          output,
                          hiddenOutputs: latestEntry?.hiddenOutputs,
                        },
                      },
                    }
                  : n,
              );
              // Sync execution results through Yjs for real-time collaboration
              collaboration.handleCanvasNodesChange(next);
              return next;
            });
            markDirty();
            return;
          } else {
            // No upstream data available - set status to idle, not error
            setStatus(nodeId, 'idle');
            const latestEntry = useExecutionStore.getState().entries[nodeId];

            // Сохраняем статус idle в payload узла
            setNodesState((prev) =>
              prev.map((n) =>
                n.id === nodeId
                  ? {
                      ...n,
                      payload: {
                        ...(n.payload ?? {}),
                        execution: {
                          status: 'idle' as const,
                          hiddenOutputs: latestEntry?.hiddenOutputs,
                        },
                      },
                    }
                  : n,
              ),
            );
            markDirty();
            return;
          }
        }

        setError(nodeId, `Execution for node type "${node.type}" is not supported.`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(nodeId, errorMessage);
        const latestEntry = useExecutionStore.getState().entries[nodeId];

        // Сохраняем статус ошибки в payload узла и синхронизируем через Yjs
        setNodesState((prev) => {
          const next = prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  payload: {
                    ...(n.payload ?? {}),
                    execution: {
                      status: 'error' as const,
                      error: errorMessage,
                      hiddenOutputs: latestEntry?.hiddenOutputs,
                    },
                  },
                }
              : n,
          );
          // Sync execution error through Yjs for real-time collaboration
          collaboration.handleCanvasNodesChange(next);
          return next;
        });
        markDirty();
      }
    },
    [
      edgesState,
      nodesState,
      setError,
      setStatus,
      setSuccess,
      getAncestors,
      reverseAdjacency,
      markDirty,
      resetExecutionOutput,
      collaboration,
    ],
  );

  // Handler for loading full SQL results without preview limit
  const handleRunNodeFull = useCallback(
    async (nodeId: string) => {
      const node = nodesState.find((item) => item.id === nodeId);
      if (!node || node.type !== 'sql') {
        return; // Only support full load for SQL nodes
      }
      
      resetExecutionOutput(nodeId);
      const currentEntries = useExecutionStore.getState().entries;
      const entry = currentEntries[nodeId];
      const code = entry?.code ?? '';

      setStatus(nodeId, 'running');
      
      try {
        // Execute with fullLoad=true to bypass preview limit
        const result = await executeSqlWithPreview(code, { fullLoad: true });
        const output = { kind: 'sql' as const, result, code };
        setSuccess(nodeId, output);
        
        // Sync through Yjs
        setNodesState((prev) => {
          const next = prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  payload: {
                    ...(n.payload ?? {}),
                    execution: {
                      status: 'success' as const,
                      output,
                    },
                  },
                }
              : n,
          );
          collaboration.handleCanvasNodesChange(next);
          return next;
        });
        markDirty();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(nodeId, errorMessage);
      }
    },
    [nodesState, setStatus, setSuccess, setError, resetExecutionOutput, markDirty, collaboration],
  );

  const runDownstreamRecursive = useCallback(
    async (nodeId: string, visited: Set<string>) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      await handleRunNode(nodeId);
      const children = adjacency.get(nodeId) ?? [];
      for (const child of children) {
        await runDownstreamRecursive(child, visited);
      }
    },
    [handleRunNode, adjacency],
  );

  const handleRunDownstream = useCallback(
    async (nodeId: string) => {
      const visited = new Set<string>();
      await runDownstreamRecursive(nodeId, visited);
    },
    [runDownstreamRecursive],
  );

  const { mutateAsync: persistBoard } = useMutation({
    mutationFn: (payload: SaveBoardStructureInput) => saveBoardStructure(boardId, payload),
  });

  // Auto-save debounce timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSavingRef = useRef(false);
  
  // Ref to store triggerAutoSave function to avoid dependency issues
  const triggerAutoSaveRef = useRef<(() => void) | null>(null);

  // Auto-save function that uses Yjs data
  // CRITICAL FIX: Moved before first useEffect to fix initialization order
  const autoSaveBoard = useCallback(async () => {
    if (isAutoSavingRef.current || !dataLoadedRef.current || isLoadingRef.current) {
      console.log('[AutoSave] Skipping - isAutoSaving:', isAutoSavingRef.current, 'dataLoaded:', dataLoadedRef.current, 'isLoading:', isLoadingRef.current);
      return;
    }

    // CRITICAL FIX: Use nodesState as source of truth for auto-save
    // Yjs is for real-time sync, but auto-save should use local state
    // This ensures that even if Yjs sync fails, auto-save still works
    const currentNodes = nodesStateRef.current.length > 0 ? nodesStateRef.current : nodesState;
    const currentEdges = edgesState.length > 0 ? edgesState : [];
    
    console.log('[AutoSave] Saving nodes:', currentNodes.length, 'edges:', currentEdges.length);

    // Build payload from Yjs data
    const nodes = currentNodes.map((node) => {
      const payload: Record<string, unknown> = { ...(node.payload ?? {}) };
      if (node.type === 'sql') {
        payload.sql = (payload.sql as string | undefined) ?? '';
        const entry = useExecutionStore.getState().entries[node.id];
        if (entry?.status === 'success' && entry.output) {
          payload.execution = {
            status: entry.status,
            output: entry.output,
            hiddenOutputs: entry.hiddenOutputs,
          };
        } else if (entry?.status === 'error') {
          payload.execution = {
            status: entry.status,
            error: entry.error,
            hiddenOutputs: entry.hiddenOutputs,
          };
        }
      } else if (node.type === 'python') {
        payload.python = (payload.python as string | undefined) ?? '';
        const entry = useExecutionStore.getState().entries[node.id];
        if (entry?.status === 'success' && entry.output) {
          payload.execution = {
            status: entry.status,
            output: entry.output,
            hiddenOutputs: entry.hiddenOutputs,
          };
        } else if (entry?.status === 'error') {
          payload.execution = {
            status: entry.status,
            error: entry.error,
            hiddenOutputs: entry.hiddenOutputs,
          };
        }
      } else if (node.type === 'note') {
        const text =
          typeof (payload as any).text === 'string'
            ? (payload as any).text
            : ((payload as any).noteContent ?? '');
        payload.text = text ?? '';
        if ((payload as any).noteContent === undefined) {
          (payload as any).noteContent = text ?? '';
        }
      } else if (node.type === 'pen') {
        payload.points = (payload as any).points ?? [];
        payload.initialSize = (payload as any).initialSize ?? { width: 100, height: 100 };
      } else if (node.type === 'text') {
        const text =
          typeof (payload as any).text === 'string'
            ? (payload as any).text
            : ((payload as any).textContent ?? '');
        payload.text = text ?? '';
        payload.textContent = text ?? '';
        payload.fontSize = (payload as any).fontSize ?? 18;
        payload.fontFamily = (payload as any).fontFamily ?? 'Inter, sans-serif';
        payload.color = (payload as any).color ?? '#0f172a';
        payload.textAlign = (payload as any).textAlign ?? 'left';
        if ((payload as any).richContent) {
          payload.richContent = (payload as any).richContent;
        }
      } else if (node.type === 'plot') {
        payload.chartType = (payload as any).chartType ?? 'bar';
        payload.mapping = (payload as any).mapping ?? {};
        payload.styling = (payload as any).styling ?? {
          title: 'New Chart',
          theme: 'light',
          showLegend: true,
          legendPosition: 'top',
          showGrid: true,
        };
        payload.version = (payload as any).version ?? '1';
      }
      const existingUi = (payload.ui as Record<string, unknown> | undefined) ?? {};
      const ui: Record<string, unknown> = { ...existingUi };
      const width = nodeSizes[node.id]?.width;
      const height = nodeSizes[node.id]?.height;
      if (
        node.type !== 'note' &&
        node.type !== 'pen' &&
        node.type !== 'text' &&
        width !== undefined
      ) {
        ui.width = width;
      }
      if (node.type === 'note') {
        const existingH = (payload.ui as any)?.height as number | undefined;
        if (existingH !== undefined) {
          ui.height = existingH;
        } else if (ui.height === undefined) {
          ui.height = 96;
        }
        if (ui.width === undefined) {
          ui.width = 160;
        }
      }
      if (node.type === 'text') {
        const existingH = (payload.ui as any)?.height as number | undefined;
        if (existingH !== undefined) {
          ui.height = existingH;
        } else if (ui.height === undefined) {
          ui.height = 80;
        }
        const existingW = (payload.ui as any)?.width as number | undefined;
        if (existingW !== undefined) {
          ui.width = existingW;
        } else if (ui.width === undefined) {
          ui.width = 240;
        }
      }
      if (node.type === 'pen') {
        if (width !== undefined) {
          ui.width = width;
        } else if (ui.width === undefined && (payload as any).initialSize?.width) {
          ui.width = (payload as any).initialSize.width;
        }
        if (height !== undefined) {
          ui.height = height;
        } else if (ui.height === undefined && (payload as any).initialSize?.height) {
          ui.height = (payload as any).initialSize.height;
        }
      }
      if (Object.keys(ui).length > 0) {
        payload.ui = ui;
      } else if (payload.ui) {
        delete payload.ui;
      }
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        payload,
      };
    });

    const nodeIds = new Set(nodes.map((n) => n.id).filter((id) => isValidUuid(id)));
    const edges = currentEdges
      .filter((e) => isValidUuid(e.id) && isValidUuid(e.sourceId) && isValidUuid(e.targetId))
      .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
      .map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        metadata: edge.metadata ?? {},
      }));

    const payload: SaveBoardStructureInput = { nodes, edges };

    try {
      isAutoSavingRef.current = true;
      await persistBoard(payload);
      setIsDirty(false);
      setSaveError(null);

      // Update serverDataRef with saved data
      queryClient.setQueryData<BoardResponse | undefined>(['board', boardId], (previous) => {
        if (!previous) return previous;

        const savedNodes: BoardResponse['nodes'] = payload.nodes.map((node) => ({
          id: node.id,
          boardId,
          type: node.type,
          position: node.position,
          payload: node.payload,
        }));
        const savedEdges: BoardResponse['edges'] = payload.edges.map((edge) => ({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          metadata: edge.metadata ?? {},
        }));

        serverDataRef.current = { nodes: savedNodes, edges: savedEdges };

        return {
          board: previous.board,
          nodes: savedNodes,
          edges: savedEdges,
        };
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to auto-save board');
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [boardId, persistBoard, queryClient, nodeSizes, collaboration.canvasNodes, collaboration.canvasEdges, nodesState, edgesState]);

  // Debounced auto-save trigger
  // CRITICAL FIX: Moved before first useEffect to fix initialization order
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    // Reduced debounce from 2000ms to 500ms for faster saves
    // This prevents data loss on page refresh while still batching rapid changes
    autoSaveTimerRef.current = setTimeout(() => {
      void autoSaveBoard();
    }, 500); // 500ms debounce for faster saves
  }, [autoSaveBoard]);
  
  // CRITICAL FIX: Store triggerAutoSave in ref for use in useEffect
  useEffect(() => {
    triggerAutoSaveRef.current = triggerAutoSave;
  }, [triggerAutoSave]);

  const buildPersistPayload = useCallback((): SaveBoardStructureInput => {
    const nodes = nodesState.map((node) => {
      const payload: Record<string, unknown> = { ...(node.payload ?? {}) };
      if (node.type === 'sql') {
        payload.sql = (payload.sql as string | undefined) ?? '';
        // Сохраняем результаты выполнения для SQL узлов
        const entry = useExecutionStore.getState().entries[node.id];
        if (entry?.status === 'success' && entry.output) {
          payload.execution = {
            status: entry.status,
            output: entry.output,
            hiddenOutputs: entry.hiddenOutputs,
          };
        } else if (entry?.status === 'error') {
          payload.execution = {
            status: entry.status,
            error: entry.error,
            hiddenOutputs: entry.hiddenOutputs,
          };
        }
      } else if (node.type === 'python') {
        payload.python = (payload.python as string | undefined) ?? '';
        // Сохраняем результаты выполнения для Python узлов
        const entry = useExecutionStore.getState().entries[node.id];
        if (entry?.status === 'success' && entry.output) {
          payload.execution = {
            status: entry.status,
            output: entry.output,
            hiddenOutputs: entry.hiddenOutputs,
          };
        } else if (entry?.status === 'error') {
          payload.execution = {
            status: entry.status,
            error: entry.error,
            hiddenOutputs: entry.hiddenOutputs,
          };
        }
      } else if (node.type === 'note') {
        const text =
          typeof (payload as any).text === 'string'
            ? (payload as any).text
            : ((payload as any).noteContent ?? '');
        payload.text = text ?? '';
        // на всякий случай дублируем под старым ключом, если бэк ожидает noteContent
        if ((payload as any).noteContent === undefined) {
          (payload as any).noteContent = text ?? '';
        }
      } else if (node.type === 'pen') {
        // Сохраняем points и initialSize для pen nodes
        payload.points = (payload as any).points ?? [];
        payload.initialSize = (payload as any).initialSize ?? { width: 100, height: 100 };
      } else if (node.type === 'text') {
        // Сохраняем форматирование для text nodes
        const text =
          typeof (payload as any).text === 'string'
            ? (payload as any).text
            : ((payload as any).textContent ?? '');
        payload.text = text ?? '';
        payload.textContent = text ?? ''; // дублируем для совместимости
        payload.fontSize = (payload as any).fontSize ?? 18;
        payload.fontFamily = (payload as any).fontFamily ?? 'Inter, sans-serif';
        payload.color = (payload as any).color ?? '#0f172a';
        payload.textAlign = (payload as any).textAlign ?? 'left';
        // Сохраняем rich content (HTML от TipTap)
        if ((payload as any).richContent) {
          payload.richContent = (payload as any).richContent;
        }
        // ui.width и ui.height сохраняются ниже
      } else if (node.type === 'plot') {
        // Сохраняем конфигурацию для plot nodes
        payload.chartType = (payload as any).chartType ?? 'bar';
        payload.mapping = (payload as any).mapping ?? {};
        payload.styling = (payload as any).styling ?? {
          title: 'New Chart',
          theme: 'light',
          showLegend: true,
          legendPosition: 'top',
          showGrid: true,
        };
        payload.version = (payload as any).version ?? '1';
      }
      const existingUi = (payload.ui as Record<string, unknown> | undefined) ?? {};
      const ui: Record<string, unknown> = { ...existingUi };
      const width = nodeSizes[node.id]?.width;
      const height = nodeSizes[node.id]?.height;
      if (
        node.type !== 'note' &&
        node.type !== 'pen' &&
        node.type !== 'text' &&
        width !== undefined
      ) {
        ui.width = width;
      }
      // фиксируем размеры только для заметок
      if (node.type === 'note') {
        const existingH = (payload.ui as any)?.height as number | undefined;
        if (existingH !== undefined) {
          ui.height = existingH;
        } else if (ui.height === undefined) {
          ui.height = 96; // дефолт для sticky
        }
        if (ui.width === undefined) {
          ui.width = 160;
        }
      }
      // фиксируем размеры для text nodes
      if (node.type === 'text') {
        const existingH = (payload.ui as any)?.height as number | undefined;
        if (existingH !== undefined) {
          ui.height = existingH;
        } else if (ui.height === undefined) {
          ui.height = 80; // дефолт для text
        }
        const existingW = (payload.ui as any)?.width as number | undefined;
        if (existingW !== undefined) {
          ui.width = existingW;
        } else if (ui.width === undefined) {
          ui.width = 240; // дефолт для text
        }
      }
      // фиксируем размеры для pen nodes
      if (node.type === 'pen') {
        if (width !== undefined) {
          ui.width = width;
        } else if (ui.width === undefined && (payload as any).initialSize?.width) {
          ui.width = (payload as any).initialSize.width;
        }
        if (height !== undefined) {
          ui.height = height;
        } else if (ui.height === undefined && (payload as any).initialSize?.height) {
          ui.height = (payload as any).initialSize.height;
        }
      }
      if (Object.keys(ui).length > 0) {
        payload.ui = ui;
      } else if (payload.ui) {
        delete payload.ui;
      }
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        payload,
      };
    });
    // filter edges to valid uuids and existing nodes (pre-validate client-side to avoid 500)
    const nodeIds = new Set(nodes.map((n) => n.id).filter((id) => isValidUuid(id)));
    const edges = edgesState
      .filter((e) => isValidUuid(e.id) && isValidUuid(e.sourceId) && isValidUuid(e.targetId))
      .filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
      .map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        metadata: edge.metadata ?? {},
      }));
    return { nodes, edges };
  }, [nodesState, edgesState, nodeSizes]);

  const handleCodeChange = useCallback(
    (nodeId: string, code: string) => {
      setCodeStore(nodeId, code);
      
      // Update local state
      setNodesState((prev) => {
        const next = prev.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            payload: {
              ...(node.payload ?? {}),
              ...(node.type === 'sql' ? { sql: code } : {}),
              ...(node.type === 'python' ? { python: code } : {}),
            },
          };
        });

        // Sync through Yjs for real-time collaboration
        // This ensures code changes are synchronized between all clients immediately
        collaboration.handleCanvasNodesChange(next);

        return next;
      });
      
      markDirty();
    },
    [setCodeStore, markDirty, collaboration],
  );

  // Track if changes are coming from Yjs to prevent sync loops
  const isYjsUpdateRef = useRef(false);

  const handleNodesChange = useCallback(
    (updated: CanvasNode[]) => {
      // Check if any voice node has NEW audioData that needs to be synced
      // This must be checked BEFORE the isYjsUpdate check to ensure audio is always synced
      const yjsNodesMapEarly = new Map(collaboration.canvasNodes.map((n) => [n.id, n]));
      const hasNewVoiceAudio = updated.some((n) => {
        if (n.type !== 'voice') return false;
        const payload = n.payload as Record<string, unknown> | undefined;
        if (!payload?.audioData) return false;
        const yjsNode = yjsNodesMapEarly.get(n.id);
        const yjsPayload = yjsNode?.payload as Record<string, unknown> | undefined;
        return !yjsPayload?.audioData || yjsPayload.audioData !== payload.audioData;
      });
      
      // If we have new voice audio, force sync it regardless of isYjsUpdate
      if (hasNewVoiceAudio) {
        collaboration.handleCanvasNodesChange(updated);
      }
      
      // Skip sync if this update came from Yjs (to prevent loops)
      if (isYjsUpdateRef.current) {
        isYjsUpdateRef.current = false;
        // Still update local state for compatibility
        const previousIds = new Set(nodesStateRef.current.map((node) => node.id));
        const nextIds = new Set(updated.map((node) => node.id));
        previousIds.forEach((id) => {
          if (!nextIds.has(id)) {
            removeExecutionEntry(id);
          }
        });
        setNodesState(updated);
        // CRITICAL FIX: Trigger auto-save even for Yjs updates to ensure new nodes are saved
        triggerAutoSave();
        return;
      }

      // CRITICAL FIX: Don't call handleCanvasNodesChange if changes already went through Yjs
      // When nodes are added via yjsOnNodesChange, they're already in Yjs, so we don't need to sync again
      // Only sync if this is a local change that hasn't been synced through Yjs yet
      // Check if this update contains nodes that are already in Yjs (synced via yjsOnNodesChange)
      const yjsNodeIds = new Set(collaboration.canvasNodes.map((n) => n.id));
      const yjsNodesMap = new Map(collaboration.canvasNodes.map((n) => [n.id, n]));
      const hasNewNodes = updated.some((n) => !yjsNodeIds.has(n.id));
      
      // Check if any voice node has new audioData that needs to be synced
      const hasVoiceAudioChanges = updated.some((n) => {
        if (n.type !== 'voice') return false;
        const payload = n.payload as Record<string, unknown> | undefined;
        if (!payload?.audioData) return false;
        // Check if Yjs version has this audioData
        const yjsNode = yjsNodesMap.get(n.id);
        const yjsPayload = yjsNode?.payload as Record<string, unknown> | undefined;
        return !yjsPayload?.audioData || yjsPayload.audioData !== payload.audioData;
      });

      // Check if any node has payload changes (e.g. plot config, chart type, SQL/Python code)
      const hasPayloadChanges = updated.some((n) => {
        const yjsNode = yjsNodesMap.get(n.id);
        if (!yjsNode) return false;
        return (
          JSON.stringify(n.payload ?? {}) !== JSON.stringify(yjsNode.payload ?? {})
        );
      });

      // Sync through handleCanvasNodesChange if there are new nodes, voice audio changes, or payload changes
      if (hasNewNodes || hasVoiceAudioChanges || hasPayloadChanges) {
        collaboration.handleCanvasNodesChange(updated);
      }

      // Update local state for compatibility (will be replaced by Yjs data)
      const previousIds = new Set(nodesStateRef.current.map((node) => node.id));
      const nextIds = new Set(updated.map((node) => node.id));
      previousIds.forEach((id) => {
        if (!nextIds.has(id)) {
          removeExecutionEntry(id);
        }
      });

      setNodesState(updated);

      // CRITICAL FIX: Always trigger auto-save, even if sync went through Yjs
      // Auto-save must work independently of Yjs sync to prevent data loss
      triggerAutoSave();
    },
    [removeExecutionEntry, collaboration, triggerAutoSave],
  );

  const handleEdgesChange = useCallback(
    (updated: CanvasEdge[]) => {
      // Sync through Yjs for real-time collaboration
      collaboration.handleCanvasEdgesChange(updated);

      // Update local state for compatibility (will be replaced by Yjs data)
      setEdgesState(updated);

      // Trigger auto-save after changes (debounced)
      triggerAutoSave();
    },
    [collaboration, triggerAutoSave],
  );

  const handleDatasetUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsUploadingDataset(true);
      setUploadMessage(null);
      try {
        const { loadFileIntoDuckDb, getDatasetsKey } = await import('../../../lib/duckdbClient');
        const { tableName, rows } = await loadFileIntoDuckDb(file, {
          format: 'auto',
          boardId,
          persist: true,
        });
        
        // Get dataset metadata from localStorage (saved by loadFileIntoDuckDb)
        const key = getDatasetsKey(boardId);
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const datasets: Array<{ tableName: string; columns: string[]; rows: Array<Array<string | number | null>> }> = JSON.parse(raw);
          const dataset = datasets.find((d) => d.tableName === tableName);
          if (dataset) {
            // Sync dataset metadata through Yjs for real-time collaboration
            collaboration.datasetsMap.set(tableName, dataset);
          }
        }
        
        setUploadMessage(`Загружено ${file.name} → таблица ${tableName} (${rows} строк).`);
        await refreshTables();
      } catch (uploadError) {
        console.error('Failed to import file', uploadError);
        setUploadMessage(
          uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить файл',
        );
      } finally {
        setIsUploadingDataset(false);
        event.target.value = '';
      }
    },
    [refreshTables, collaboration, boardId],
  );

  const handleDatasetDelete = useCallback(
    async (tableName: string) => {
      if (!confirm(`Удалить таблицу "${tableName}"? Это действие нельзя отменить.`)) {
        return;
      }
      
      try {
        const { deleteTable } = await import('../../../lib/duckdbClient');
        
        // Delete table from DuckDB and localStorage
        await deleteTable(tableName, boardId);
        
        // Remove from Yjs map to sync deletion with other users
        collaboration.datasetsMap.delete(tableName);
        
        // Refresh table list
        await refreshTables();
        
        setUploadMessage(`Таблица "${tableName}" удалена.`);
      } catch (deleteError) {
        console.error('Failed to delete table', deleteError);
        setUploadMessage(
          deleteError instanceof Error ? deleteError.message : 'Не удалось удалить таблицу',
        );
      }
    },
    [refreshTables, collaboration, boardId],
  );

  const handleDatasetButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [logout, router]);

  const handleSaveBoard = useCallback(async () => {
    if (!boardId || isSaving || (!isDirty && !saveError)) return;
    const payload = buildPersistPayload();
    setIsSaving(true);
    setSaveError(null);
    try {
      await persistBoard(payload);
      setIsDirty(false);

      // Преобразуем payload в формат BoardResponse для сохранения в serverDataRef
      queryClient.setQueryData<BoardResponse | undefined>(['board', boardId], (previous) => {
        if (!previous) return previous;

        const savedNodes: BoardResponse['nodes'] = payload.nodes.map((node) => ({
          id: node.id,
          boardId,
          type: node.type,
          position: node.position,
          payload: node.payload,
        }));
        const savedEdges: BoardResponse['edges'] = payload.edges.map((edge) => ({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          metadata: edge.metadata ?? {},
        }));

        // Обновляем serverDataRef с сохраненными данными
        serverDataRef.current = { nodes: savedNodes, edges: savedEdges };

        return {
          board: previous.board,
          nodes: savedNodes,
          edges: savedEdges,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    } catch (error) {
      console.error('Failed to save board', error);
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить доску');
    } finally {
      setIsSaving(false);
    }
  }, [boardId, buildPersistPayload, isDirty, isSaving, persistBoard, queryClient, saveError]);

  if (!isValidUuid(boardId)) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#f7f9fd] text-slate-900">
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-6 py-4 text-sm text-amber-700">
          Некорректный идентификатор борда. Вернитесь на <Link href="/">главную</Link> и выберите
          борд из списка.
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#f7f9fd] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Board title + Undo/Redo controls */}
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {data?.board.title ?? 'Board'}
            </h1>
            
            {/* Undo/Redo controls - per-user */}
            <div className="flex items-center border-l border-slate-200 pl-4">
              <UndoRedoControls
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </div>
          </div>

          {/* Right: Presence indicator + Back to home */}
          <div className="flex items-center gap-3">
            <UserPresenceIndicator 
              users={presenceUsers} 
              currentUserId={user?.id}
            />
            <Link
              className="rounded-md border border-indigo-400 px-3 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors"
              href="/"
            >
              ← Back to home
            </Link>
          </div>
        </div>
        {/* Hidden file input for dataset upload (triggered from canvas toolbar) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.parquet"
          className="hidden"
          onChange={handleDatasetUpload}
        />
      </header>

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading board…
          </div>
        )}
        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-rose-500">
            <span>
              Failed to load board <code>{boardId}</code>.
            </span>
            <span className="text-sm text-slate-400">
              Проверьте, что realtime-сервер доступен по{' '}
              <code>http://localhost:4000/api/boards/{boardId}</code>.
            </span>
          </div>
        )}
        {data && !isLoading && !error && (
          <div className="flex h-full flex-1 min-h-0">
            <BoardCanvasDynamic
              board={{
                ...data.board,
                userInfo: user
                  ? {
                      userId: user.id,
                      userName: user.name || user.email,
                    }
                  : undefined,
              }}
              nodes={yjsNodes as Array<{
                id: string;
                boardId?: string;
                type: 'sql' | 'python' | 'table' | 'plot' | 'note' | 'text' | 'shape' | 'image' | 'pen' | 'database';
                position: { x: number; y: number };
                payload?: Record<string, unknown>;
              }>}
              edges={yjsEdges}
              executionEntries={entries}
              onCodeChange={handleCodeChange}
              onRunNode={handleRunNode}
              onRunNodeFull={handleRunNodeFull}
              onRunDownstream={handleRunDownstream}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              yjsOnNodesChange={collaboration.onNodesChange}
              yjsOnEdgesChange={collaboration.onEdgesChange}
              cursorsMap={collaboration.cursorsMap}
              editingMap={collaboration.editingMap}
              clientId={collaboration.clientId}
            />
          </div>
        )}
      </section>
    </main>
  );
}

export default function BoardPage({ params }: BoardPageProps) {
  return (
    <RequireAuth>
      <BoardPageContent params={params} />
    </RequireAuth>
  );
}
