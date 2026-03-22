'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';

import { EditingPresenceProvider } from '../context/EditingPresenceContext';
import { canvasNodeToReactFlowNode } from '../lib/yjs/adapters';
import { PresentationViewer } from './PresentationViewer';
import { BoardInspector } from './BoardInspector';
import type { BoardCanvasProps } from './board/boardCanvas.types';
import { InnerBoardCanvas } from './board/InnerBoardCanvas';

// Re-export extracted pieces for backward compatibility
export { DataNodeHandles, DATA_NODE_HANDLE_CLASS } from './board/DataNodeHandles';
export type { BoardCanvasProps, CanvasNodeType, NodeData } from './board/boardCanvas.types';

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
  commentDragMap,
  presentationBroadcastsMap,
  ydoc,
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
  const [openPresentationNodeId, setOpenPresentationNodeId] = useState<string | null>(null);
  const [openPresentationFollowMode, setOpenPresentationFollowMode] = useState(false);
  const onOpenPresentationViewer = useCallback((nodeId: string, followMode?: boolean) => {
    setOpenPresentationNodeId(nodeId);
    setOpenPresentationFollowMode(followMode ?? false);
  }, []);
  const presentationNode = openPresentationNodeId
    ? nodes.find((n) => n.id === openPresentationNodeId)
    : null;

  useEffect(() => {
    if (!inspectorKind || !selectedNode) {
      setInspectorCollapsed(true);
    }
  }, [inspectorKind, selectedNode]);

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
            commentDragMap={commentDragMap}
            presentationBroadcastsMap={presentationBroadcastsMap}
            ydoc={ydoc}
            clientId={clientId}
            userInfo={board.userInfo}
            onCsvDatasetAdded={onCsvDatasetAdded}
            onOpenPresentationViewer={onOpenPresentationViewer}
          />
          {presentationNode &&
            presentationNode.type === 'document' &&
            (() => {
              const payload = (presentationNode.payload ?? {}) as Record<string, unknown>;
              const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
              const url =
                payload.url != null && String(payload.url).trim() !== ''
                  ? String(payload.url)
                  : payload.fileId
                    ? `${apiBase}/api/files/${payload.fileId}`
                    : '';
              return (
                <PresentationViewer
                  nodeId={presentationNode.id}
                  url={url}
                  originalName={payload.originalName as string | undefined}
                  mimeType={payload.mimeType as string | undefined}
                  onClose={() => setOpenPresentationNodeId(null)}
                  presentationBroadcastsMap={presentationBroadcastsMap ?? null}
                  ydoc={ydoc ?? null}
                  clientId={clientId ?? null}
                  userInfo={board.userInfo ?? null}
                  initialFollowMode={openPresentationFollowMode}
                />
              );
            })()}
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
                        // Sync the changed node directly to Yjs nodesMap for immediate persistence.
                        // This bypasses the handleNodesChange → handleCanvasNodesChange chain
                        // which can have a one-render delay due to localNodes useEffect in InnerBoardCanvas.
                        if (yjsOnNodesChange) {
                          const changedNode = updatedNodes.find((n) => n.id === nodeId);
                          if (changedNode) {
                            const rfNode = canvasNodeToReactFlowNode(changedNode);
                            yjsOnNodesChange([{ type: 'add', item: rfNode }]);
                          }
                        }
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
