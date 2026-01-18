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
import { LANDING_URL } from '../../../lib/appConfig';
import { RequireAuth } from '../../../components/RequireAuth';
import { useAuthStore } from '../../../state/authStore';
import { useRouter } from 'next/navigation';
import { useExecutionStore, type ExecutionStoreState } from '../../../state/executionStore';
import { useCanvasLayoutStore, type CanvasLayoutState } from '../../../state/canvasLayoutStore';
import {
  executeSql,
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

  // Register CSV nodes from payload into DuckDB on initial load
  // This ensures CSV data is available for SQL queries after page reload
  useEffect(() => {
    if (csvNodesRegisteredRef.current) return;

    const csvNodes = nodesState.filter((n) => n.type === 'csv');
    if (csvNodes.length === 0) return;

    csvNodesRegisteredRef.current = true;

    void (async () => {
      for (const node of csvNodes) {
        const payload = node.payload as {
          filename?: string;
          tableName?: string;
          data?: SqlResult;
        } | undefined;
        if (payload?.data && payload?.filename) {
          try {
            await registerDatasetFromCsvNode(payload.filename, payload.data, boardId);
            console.log(`Registered CSV "${payload.filename}" as table in DuckDB`);
          } catch (err) {
            console.error(`Failed to register CSV node ${node.id} in DuckDB:`, err);
          }
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
            // Execute via DuckDB (default)
            result = await executeSql(code);
          }

          const output = { kind: 'sql' as const, result, code };
          setSuccess(nodeId, output);
          const latestEntry = useExecutionStore.getState().entries[nodeId];

          // Сохраняем результаты выполнения в payload узла
          setNodesState((prev) =>
            prev.map((n) =>
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
            ),
          );
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

            // Сохраняем статус ошибки в payload узла
            setNodesState((prev) =>
              prev.map((n) =>
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
              ),
            );
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

          // Сохраняем результаты выполнения в payload узла
          setNodesState((prev) =>
            prev.map((n) =>
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
            ),
          );
          markDirty();
          return;
        }

        if (node.type === 'plot') {
          // Plot nodes don't execute code - they visualize data from upstream nodes
          // Find upstream node and get its data
          const upstreamEdges = edgesState.filter((edge) => edge.targetId === nodeId);
          let inputData: SqlResult | undefined;

          // Try to find upstream SQL or Python node with data
          for (const edge of upstreamEdges) {
            const upstreamEntry = useExecutionStore.getState().entries[edge.sourceId];
            if (upstreamEntry?.output) {
              if (upstreamEntry.output.kind === 'sql') {
                inputData = upstreamEntry.output.result;
                break;
              } else if (
                upstreamEntry.output.kind === 'python' &&
                upstreamEntry.output.result?.table
              ) {
                inputData = upstreamEntry.output.result.table;
                break;
              } else if (
                upstreamEntry.output.kind === 'plot' &&
                upstreamEntry.output.result?.inputData
              ) {
                inputData = upstreamEntry.output.result.inputData;
                break;
              }
            }
          }

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

            // Сохраняем результаты выполнения в payload узла
            setNodesState((prev) =>
              prev.map((n) =>
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
              ),
            );
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

        // Сохраняем статус ошибки в payload узла
        setNodesState((prev) =>
          prev.map((n) =>
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
          ),
        );
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
    ],
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
      setNodesState((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            payload: {
              ...(node.payload ?? {}),
              ...(node.type === 'sql' ? { sql: code } : {}),
              ...(node.type === 'python' ? { python: code } : {}),
            },
          };
        }),
      );
      markDirty();
    },
    [setCodeStore, markDirty],
  );

  const handleNodesChange = useCallback(
    (updated: CanvasNode[]) => {
      // Проверяем, изменилось ли состояние по сравнению с серверными данными
      // Если нет - не помечаем доску как измененную
      const serverData = serverDataRef.current;
      const hasChanged = !serverData || !nodesEqual(updated, serverData.nodes);
      const previousIds = new Set(nodesStateRef.current.map((node) => node.id));
      const nextIds = new Set(updated.map((node) => node.id));
      previousIds.forEach((id) => {
        if (!nextIds.has(id)) {
          removeExecutionEntry(id);
        }
      });

      setNodesState(updated);

      // Помечаем доску как измененную только если данные действительно изменились
      // и загрузка завершена (markDirty также проверит isLoadingRef)
      if (hasChanged) {
        markDirty();
      }
    },
    [markDirty, removeExecutionEntry],
  );

  const handleEdgesChange = useCallback(
    (updated: CanvasEdge[]) => {
      // Проверяем, изменилось ли состояние по сравнению с серверными данными
      // Если нет - не помечаем доску как измененную
      const serverData = serverDataRef.current;
      const hasChanged = !serverData || !edgesEqual(updated, serverData.edges);

      setEdgesState(updated);

      // Помечаем доску как измененную только если данные действительно изменились
      // и загрузка завершена (markDirty также проверит isLoadingRef)
      if (hasChanged) {
        markDirty();
      }
    },
    [markDirty],
  );

  const handleDatasetUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsUploadingDataset(true);
      setUploadMessage(null);
      try {
        const { tableName, rows } = await loadFileIntoDuckDb(file, {
          format: 'auto',
          boardId,
          persist: true,
        });
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
    [refreshTables],
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
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {data?.board.title ?? 'Board'}
            </h1>
            <p className="text-sm text-slate-500">
              Внесите изменения и нажмите «Сохранить борд», чтобы зафиксировать их.
            </p>
            {tableNames.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Таблицы DuckDB</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                  {tableNames.map((name) => (
                    <span key={name} className="rounded-full border border-slate-200 px-3 py-0.5">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-3 md:ml-auto md:flex-row md:items-center md:justify-end">
            {user && (
              <div className="flex items-center gap-3 mr-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user.name || user.email}</p>
                  {user.name && <p className="text-xs text-slate-500">{user.email}</p>}
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Log out
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleDatasetButtonClick}
              disabled={isUploadingDataset}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingDataset ? 'Загружаем…' : 'Загрузить CSV/Parquet'}
            </button>
            <button
              type="button"
              onClick={handleSaveBoard}
              disabled={(!isDirty && !saveError) || isSaving}
              className={`rounded-md px-3 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 ${
                (!isDirty && !saveError) || isSaving
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 focus:ring-slate-200'
                  : 'border border-emerald-400 text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-200'
              }`}
            >
              {isSaving ? 'Сохраняем…' : 'Сохранить борд'}
            </button>
            <Link
              className="rounded-md border border-indigo-400 px-3 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              href="/"
            >
              ← Back to home
            </Link>
            <a
              href={LANDING_URL}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              Back to website
            </a>
          </div>
        </div>
        {saveError && <p className="mt-3 text-sm text-rose-500">{saveError}</p>}
        {uploadMessage && <p className="mt-2 text-xs text-slate-500">{uploadMessage}</p>}
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
              board={data.board}
              nodes={nodesState}
              edges={edgesState}
              executionEntries={entries}
              onCodeChange={handleCodeChange}
              onRunNode={handleRunNode}
              onRunDownstream={handleRunDownstream}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
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
