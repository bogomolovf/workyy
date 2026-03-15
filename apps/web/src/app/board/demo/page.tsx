'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchBoard, isValidUuid } from '../../../lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useExecutionStore } from '../../../state/executionStore';
import { executeSql } from '../../../lib/duckdbClient';
import { runPython } from '../../../lib/pythonExecutor';
import { useCanvasLayoutStore } from '../../../state/canvasLayoutStore';

const ENV_DEMO_BOARD_ID = process.env.NEXT_PUBLIC_DEMO_BOARD_ID ?? '';

const BoardCanvasDynamic = dynamic(
  () => import('../../../components/BoardCanvas').then((module) => module.BoardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-slate-400">Loading canvas…</div>
    ),
  },
);

export default function DemoBoardPage() {
  const searchParams = useSearchParams();
  const boardIdParam = searchParams.get('boardId');
  const boardId = useMemo(() => {
    if (boardIdParam && isValidUuid(boardIdParam)) {
      return boardIdParam;
    }
    if (ENV_DEMO_BOARD_ID && isValidUuid(ENV_DEMO_BOARD_ID)) {
      return ENV_DEMO_BOARD_ID;
    }
    return null;
  }, [boardIdParam]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => fetchBoard(boardId as string),
    enabled: isValidUuid(boardId),
  });

  const entries = useExecutionStore((state) => state.entries);
  const initFromNodes = useExecutionStore((state) => state.initFromNodes);
  const setCode = useExecutionStore((state) => state.setCode);
  const setStatus = useExecutionStore((state) => state.setStatus);
  const setSuccess = useExecutionStore((state) => state.setSuccess);
  const setError = useExecutionStore((state) => state.setError);
  const resetLayout = useCanvasLayoutStore((state) => state.reset);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const executionNodes = useMemo(() => {
    if (!data?.nodes) return [];
    return data.nodes.filter(
      (n): n is typeof n & { type: 'sql' | 'python' | 'table' | 'plot' } =>
        n.type === 'sql' || n.type === 'python' || n.type === 'table' || n.type === 'plot',
    );
  }, [data?.nodes]);

  useEffect(() => {
    if (data?.nodes) {
      initFromNodes(executionNodes);
      if (!selectedNodeId && data.nodes.length > 0) {
        setSelectedNodeId(data.nodes[0].id);
      }
    }
  }, [data?.nodes, executionNodes, initFromNodes, selectedNodeId]);

  useEffect(() => {
    if (data?.board.id) {
      resetLayout();
    }
  }, [data?.board.id, resetLayout]);

  const adjacency = useMemo(() => {
    const map = new Map<string, string[]>();
    data?.edges.forEach((edge) => {
      if (!map.has(edge.sourceId)) {
        map.set(edge.sourceId, []);
      }
      map.get(edge.sourceId)!.push(edge.targetId);
    });
    return map;
  }, [data?.edges]);

  const handleRunNode = useCallback(
    async (nodeId: string) => {
      if (!data) return;
      const node = data.nodes.find((item) => item.id === nodeId);
      if (!node) {
        setError(nodeId, 'Node not found');
        return;
      }
      const currentEntries = useExecutionStore.getState().entries;
      const entry = currentEntries[nodeId];
      const code = entry?.code ?? '';

      setStatus(nodeId, 'running');
      try {
        if (node.type === 'sql') {
          const result = await executeSql(code);
          setSuccess(nodeId, { kind: 'sql', result, code });
          return;
        }

        if (node.type === 'python') {
          const upstreamEdge = data.edges.find((edge) => edge.targetId === nodeId);
          const latestEntries = useExecutionStore.getState().entries;
          const upstreamOutput = upstreamEdge
            ? latestEntries[upstreamEdge.sourceId]?.output
            : undefined;
          const sqlResult = upstreamOutput?.kind === 'sql' ? upstreamOutput.result : undefined;

          const pythonOutput = await runPython(code, { sqlResult });
          if (!pythonOutput.success) {
            setError(nodeId, pythonOutput.error ?? 'Execution failed');
            return;
          }

          setSuccess(nodeId, {
            kind: 'python',
            result: {
              stdout: pythonOutput.stdout,
              stderr: pythonOutput.stderr,
              table: pythonOutput.table,
              plotJson: pythonOutput.plotJson,
            },
            code,
          });
          return;
        }

        setError(nodeId, `Execution for node type "${node.type}" is not supported.`);
      } catch (err) {
        setError(nodeId, err instanceof Error ? err.message : String(err));
      }
    },
    [data, setError, setStatus, setSuccess],
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

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#f7f9fd] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {data?.board.title ?? 'Demo Board'}
            </h1>
            <p className="text-sm text-slate-500">
              Рабочая копия борда. Изменения пока не сохраняются — используйте для предпросмотра.
            </p>
          </div>
          <Link
            className="self-start rounded-md border border-indigo-400 px-3 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            href="/"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <section className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {!boardId && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <p>Пожалуйста, укажите Board ID в .env или введите UUID вручную.</p>
            <p className="text-sm text-slate-500">
              Пример:{' '}
              <code>
                docker exec -it workyy-postgres-1 psql -U postgres -d workyy -c 'select id, title
                from "Board";'
              </code>
            </p>
          </div>
        )}
        {isLoading && boardId && (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading board…
          </div>
        )}
        {error && boardId && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-rose-500">
            <span>
              Failed to load board <code>{boardId}</code>.
            </span>
            <span className="text-sm text-slate-400">
              Проверьте UUID и убедитесь, что realtime-сервер доступен по{' '}
              <code>http://localhost:4000/api/boards/{boardId}</code>.
            </span>
          </div>
        )}
        {data && (
          <div className="flex h-full flex-1 min-h-0">
            <BoardCanvasDynamic
              board={data.board}
              nodes={data.nodes}
              edges={data.edges}
              executionEntries={entries}
              onCodeChange={(nodeId, code) => setCode(nodeId, code)}
              onRunNode={handleRunNode}
              onRunDownstream={handleRunDownstream}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}
      </section>
    </main>
  );
}
