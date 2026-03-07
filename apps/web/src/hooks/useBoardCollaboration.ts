import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NodeChange, EdgeChange, Node, Edge } from 'reactflow';
import { Doc } from 'yjs';
import {
  canvasNodeToReactFlowNode,
  reactFlowNodeToCanvasNode,
  canvasEdgeToReactFlowEdge,
  reactFlowEdgeToCanvasEdge,
  type CanvasNode,
  type CanvasEdge,
} from '../lib/yjs/adapters';
import {
  getBoardYdoc,
  getBoardProvider,
  retainBoardYdoc,
  cleanupBoardYdoc,
} from '../lib/yjs/boardYdoc';
import { useEdgesStateSynced } from './useEdgesStateSynced';
import { useNodesStateSynced } from './useNodesStateSynced';

/**
 * Hook for managing board collaboration through Yjs
 * Handles initialization, synchronization, and cleanup
 */
export function useBoardCollaboration(
  boardId: string,
  initialNodes?: CanvasNode[],
  initialEdges?: CanvasEdge[],
) {
  const initializedRef = useRef(false);

  // Get Yjs document and provider
  const ydoc = useMemo(() => getBoardYdoc(boardId), [boardId]);
  const provider = useMemo(() => getBoardProvider(boardId), [boardId]);

  // Get Yjs maps for nodes, edges, cursors, datasets, and editing presence
  // CRITICAL: All clients must use the same map names to share data
  // These maps are automatically synced through Yjs when all clients
  // connect to the same Y.Doc (which is ensured by using the same boardId as docName)
  const nodesMap = useMemo(() => ydoc.getMap('nodes'), [ydoc]);
  const edgesMap = useMemo(() => ydoc.getMap('edges'), [ydoc]);
  const cursorsMap = useMemo(() => ydoc.getMap('cursors'), [ydoc]);
  const datasetsMap = useMemo(() => ydoc.getMap('datasets'), [ydoc]);
  // Map for tracking which users are editing which nodes (key: clientId:nodeId)
  const editingMap = useMemo(() => ydoc.getMap('editing'), [ydoc]);
  // Map for presentation broadcasts: key = presentationNodeId, value = { isActive, presenterUserId, presenterName, slideIndex, updatedAt }
  const presentationBroadcastsMap = useMemo(() => ydoc.getMap('presentationBroadcasts'), [ydoc]);
  // Map for audio call signaling and participant state (WebRTC offers/answers/ICE/presence)
  const audioCallMap = useMemo(() => ydoc.getMap('audioCall'), [ydoc]);

  // Debug logging for cursorsMap synchronization
  // CRITICAL: This observer helps verify that cursorsMap changes from other clients are received
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Yjs] Board ${boardId} cursorsMap initialized:`, {
        mapSize: cursorsMap.size,
        docClientID: ydoc.clientID.toString(),
        mapName: 'cursors',
        providerConnected: provider.wsconnected,
        providerUrl: provider.url,
        providerRoomName: (provider as any).roomName || 'unknown',
      });

      // Observe map changes to verify synchronization from other clients
      // This observer fires when ANY change happens in cursorsMap (local or remote)
      const observer = (event: any) => {
        const allCursors = Array.from(cursorsMap.values());
        const ownCursors = allCursors.filter((c: any) => c.id === ydoc.clientID.toString());
        const otherCursors = allCursors.filter((c: any) => c.id !== ydoc.clientID.toString());

        console.log(`[Yjs] Board ${boardId} cursorsMap changed:`, {
          mapSize: cursorsMap.size,
          totalCursors: allCursors.length,
          ownCursors: ownCursors.length,
          otherCursors: otherCursors.length,
          cursors: allCursors.map((c: any) => ({
            id: c.id,
            clientId: ydoc.clientID.toString(),
            isSelf: c.id === ydoc.clientID.toString(),
            hasUserName: !!c.userName,
            timestamp: c.timestamp,
          })),
          eventType: event.changes ? 'map-changes' : 'unknown',
          changes: event.changes
            ? Array.from(event.changes.keys || []).map((k: any) => ({
                key: k,
                action: event.changes.keys.get(k)?.action,
              }))
            : [],
        });
      };

      // Observe all changes in cursorsMap
      cursorsMap.observe(observer);

      // Also observe the Y.Doc for any updates (to see if updates from server are received)
      const docObserver = () => {
        console.log(`[Yjs] Board ${boardId} Y.Doc changed (cursorsMap may have updated):`, {
          cursorsMapSize: cursorsMap.size,
        });
      };

      ydoc.on('afterTransaction', docObserver);

      return () => {
        cursorsMap.unobserve(observer);
        ydoc.off('afterTransaction', docObserver);
      };
    }
  }, [cursorsMap, boardId, ydoc, provider]);

  // Get client ID for cursor tracking (exposed for use in BoardCanvas)
  const clientId = useMemo(() => ydoc.clientID.toString(), [ydoc]);

  // Initialize Yjs maps with initial data (only once)
  useEffect(() => {
    if (initializedRef.current || !initialNodes || !initialEdges) {
      return;
    }

    // CRITICAL FIX: Initialize from DB data if Yjs is empty (first load)
    // This ensures positions from DB are applied on first load
    // If Yjs already contains data (from another client), don't overwrite it
    if (nodesMap.size === 0 && edgesMap.size === 0) {
      // Convert CanvasNodes to ReactFlow Nodes and store in Yjs
      // This preserves positions from DB on first load
      for (const canvasNode of initialNodes) {
        const reactFlowNode = canvasNodeToReactFlowNode(canvasNode);
        // Ensure position is preserved from DB data
        nodesMap.set(canvasNode.id, {
          ...reactFlowNode,
          position: canvasNode.position, // Use position from DB
        });
      }

      // Convert CanvasEdges to ReactFlow Edges and store in Yjs
      for (const canvasEdge of initialEdges) {
        const reactFlowEdge = canvasEdgeToReactFlowEdge(canvasEdge);
        edgesMap.set(canvasEdge.id, reactFlowEdge);
      }

      initializedRef.current = true;
    }
  }, [initialNodes, initialEdges, nodesMap, edgesMap]);

  // Use synced hooks with ydoc and clientId for UndoManager tracking
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesStateSynced(
    nodesMap,
    edgesMap,
    ydoc,
    clientId,
  );
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesStateSynced(
    edgesMap,
    ydoc,
    clientId,
  );

  // Convert ReactFlow nodes/edges back to Canvas format for compatibility
  const canvasNodes = useMemo(
    () => reactFlowNodes.map(reactFlowNodeToCanvasNode),
    [reactFlowNodes],
  );
  const canvasEdges = useMemo(
    () => reactFlowEdges.map(reactFlowEdgeToCanvasEdge),
    [reactFlowEdges],
  );

  // Note: onNodesChange and onEdgesChange from hooks work with ReactFlow format
  // and automatically sync through Yjs. We expose them directly.
  // For Canvas format compatibility, we provide conversion helpers

  // Lifecycle: retain on mount, release on unmount.
  // retainBoardYdoc increments the usage count and cancels any pending delayed cleanup.
  // cleanupBoardYdoc decrements the count and schedules delayed destruction.
  // This survives React Strict Mode (mount→unmount→remount) because the delayed
  // cleanup timer is cancelled when retainBoardYdoc fires on remount.
  useEffect(() => {
    retainBoardYdoc(boardId);

    // Ensure provider is connected (safety net — if it was somehow disconnected)
    if (provider && !provider.wsconnected) {
      try {
        provider.connect();
      } catch {
        // provider.connect() may throw if provider was destroyed — ignore
      }
    }

    return () => {
      cleanupBoardYdoc(boardId);
    };
  }, [boardId, provider]);

  // SIMPLIFIED: Direct sync through Yjs - following collaborative-11-pro-example pattern
  // Yjs map is the single source of truth, changes go directly to Yjs
  // This handler is mainly for backward compatibility with Canvas format
  // For real-time sync, use onNodesChange (ReactFlow format) directly
  const handleCanvasNodesChange = useCallback(
    (nodes: CanvasNode[]) => {
      // Convert Canvas nodes to ReactFlow format
      const reactFlowNodes = nodes.map(canvasNodeToReactFlowNode);

      // Get current nodes from Yjs map (cast to Node[] since map stores unknown)
      const currentNodes = Array.from(nodesMap.values()) as Node[];
      const currentById = new Map(currentNodes.map((n) => [n.id, n]));
      const newById = new Map(reactFlowNodes.map((n) => [n.id, n]));
      const incomingIds = new Set(reactFlowNodes.map((n) => n.id));
      const removedFromMap = currentNodes.filter((n) => !incomingIds.has(n.id)).map((n) => n.id);

      // Compute changes: add new nodes, update existing ones
      const changes: NodeChange[] = [];

      for (const newNode of reactFlowNodes) {
        if (!currentById.has(newNode.id)) {
          // New node - add it
          changes.push({ type: 'add', item: newNode });
        } else {
          // Existing node - update it (Yjs will merge changes automatically)
          // Use 'add' to replace the node with updated data
          changes.push({ type: 'add', item: newNode });
        }
      }

      // Apply changes through onNodesChange (which syncs to Yjs)
      if (changes.length > 0) {
        onNodesChange(changes);
      }
    },
    [nodesMap, onNodesChange],
  );

  // CRITICAL FIX: Use incremental changes instead of full replacement to avoid
  // deleting edges added by other clients that haven't synced to localEdges yet
  const handleCanvasEdgesChange = useCallback(
    (edges: CanvasEdge[]) => {
      // Get current edges from Yjs map (source of truth for all clients)
      // Cast to Edge[] since map stores unknown
      const currentReactFlowEdges = Array.from(edgesMap.values()) as Edge[];
      const newReactFlowEdges = edges.map(canvasEdgeToReactFlowEdge);

      // Compute incremental changes instead of replacing all edges
      const changes: EdgeChange[] = [];

      // Create maps for efficient lookup
      const currentById = new Map(currentReactFlowEdges.map((e) => [e.id, e]));
      const newById = new Map(newReactFlowEdges.map((e) => [e.id, e]));

      // Find added edges
      for (const newEdge of newReactFlowEdges) {
        if (!currentById.has(newEdge.id)) {
          changes.push({ type: 'add', item: newEdge });
        }
      }

      // Find removed edges
      for (const currentEdge of currentReactFlowEdges) {
        if (!newById.has(currentEdge.id)) {
          changes.push({ type: 'remove', id: currentEdge.id });
        }
      }

      // Find updated edges (source, target, data, etc.)
      for (const newEdge of newReactFlowEdges) {
        const currentEdge = currentById.get(newEdge.id);
        if (currentEdge) {
          // Check if edge was actually changed
          const sourceChanged = currentEdge.source !== newEdge.source;
          const targetChanged = currentEdge.target !== newEdge.target;
          const dataChanged = JSON.stringify(currentEdge.data) !== JSON.stringify(newEdge.data);
          const selectedChanged = currentEdge.selected !== newEdge.selected;

          if (sourceChanged || targetChanged || dataChanged || selectedChanged) {
            if (selectedChanged) {
              changes.push({
                type: 'select',
                id: newEdge.id,
                selected: newEdge.selected ?? false,
              });
            }
            // For other changes (source, target, data), we need to update the edge
            // Since ReactFlow doesn't have a direct 'update' change type, we'll use 'add' to replace
            if (sourceChanged || targetChanged || dataChanged) {
              changes.push({ type: 'add', item: newEdge });
            }
          }
        }
      }

      // Apply incremental changes through onEdgesChange (which uses Yjs properly)
      if (changes.length > 0) {
        onEdgesChange(changes);
      }
    },
    [edgesMap, onEdgesChange],
  );

  return {
    canvasNodes,
    canvasEdges,
    // ReactFlow handlers (for direct ReactFlow integration)
    onNodesChange,
    onEdgesChange,
    // Canvas format handlers (for compatibility with current code)
    handleCanvasNodesChange,
    handleCanvasEdgesChange,
    // Yjs maps and client ID for cursor tracking and UndoManager
    cursorsMap,
    datasetsMap,
    editingMap, // For tracking who is editing which node
    presentationBroadcastsMap, // For presentation broadcast (single presenter per node)
    audioCallMap, // For audio call signaling and participant state
    nodesMap, // Exported for UndoManager
    edgesMap, // Exported for UndoManager
    clientId,
    provider,
    ydoc,
  };
}
