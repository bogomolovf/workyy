import { useCallback, useEffect, useState } from 'react';
import { type Node, type Edge, type OnNodesChange, applyNodeChanges, getConnectedEdges } from 'reactflow';
import type { Map as YMapType, Doc } from 'yjs';
import { undoState } from '../lib/yjs/undoState';

// Type for canvas node (simplified version of BoardCanvas node)
export type CanvasNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  payload?: Record<string, unknown>;
};

/**
 * Hook for syncing nodes state through Yjs YMap
 * Based on collaborative-11-pro-example pattern
 * 
 * Updated to use transactions with clientId as origin for UndoManager tracking
 */
export function useNodesStateSynced(
  nodesMap: YMapType<unknown>,
  edgesMap: YMapType<unknown>,
  ydoc?: Doc | null,
  clientId?: string | null
): [Node[], React.Dispatch<React.SetStateAction<Node[]>>, OnNodesChange] {
  const [nodes, setNodes] = useState<Node[]>([]);

  const setNodesSynced = useCallback(
    (nodesOrUpdater: React.SetStateAction<Node[]>) => {
      const doUpdate = () => {
        const seen = new Set<string>();
        const currentNodes = Array.from(nodesMap.values()) as Node[];
        const next =
          typeof nodesOrUpdater === 'function'
            ? nodesOrUpdater(currentNodes)
            : nodesOrUpdater;

        for (const node of next) {
          seen.add(node.id);
          nodesMap.set(node.id, node);
        }

        for (const node of currentNodes) {
          if (!seen.has(node.id)) {
            nodesMap.delete(node.id);
          }
        }
      };

      // Wrap in transaction with clientId as origin for UndoManager tracking
      if (ydoc && clientId) {
        ydoc.transact(doUpdate, clientId);
      } else {
        doUpdate();
      }
    },
    [nodesMap, ydoc, clientId]
  );

  // The onNodesChange callback updates nodesMap.
  // When the changes are applied to the map, the observer will be triggered and updates the nodes state.
  const onNodesChanges: OnNodesChange = useCallback(
    (changes) => {
      const doUpdate = () => {
        const nodes = Array.from(nodesMap.values()) as Node[];
        const edges = Array.from(edgesMap.values()) as Edge[];
        const nextNodes = applyNodeChanges(changes, nodes);

        for (const change of changes) {
          if (change.type === 'add' || change.type === 'reset') {
            nodesMap.set(change.item.id, change.item);
          } else if (change.type === 'remove' && nodesMap.has(change.id)) {
            const deletedNode = nodesMap.get(change.id) as Node;
            const connectedEdges = getConnectedEdges([deletedNode], edges);

            nodesMap.delete(change.id);

            for (const edge of connectedEdges) {
              edgesMap.delete(edge.id);
            }
          } else if (change.type === 'remove' && !nodesMap.has(change.id)) {
            // Node already absent from map; nothing to do
          } else {
            const updatedNode = nextNodes.find((n) => n.id === change.id);
            if (updatedNode) {
              nodesMap.set(change.id, updatedNode);
            }
          }
        }
      };

      // Skip transaction wrapping if undo/redo is in progress to prevent double-tracking
      const isUndoing = undoState.isUndoing;
      
      // Wrap in transaction with clientId as origin for UndoManager tracking
      // But NOT during undo/redo operations!
      if (ydoc && clientId && !isUndoing) {
        ydoc.transact(doUpdate, clientId);
      } else {
        doUpdate();
      }
    },
    [nodesMap, edgesMap, ydoc, clientId]
  );

  // Observe the nodesMap and update the nodes state whenever the map changes.
  useEffect(() => {
    const observer = () => {
      setNodes(Array.from(nodesMap.values()) as Node[]);
    };

    setNodes(Array.from(nodesMap.values()) as Node[]);
    nodesMap.observe(observer);

    return () => nodesMap.unobserve(observer);
  }, [nodesMap, setNodes]);

  return [nodes, setNodesSynced, onNodesChanges];
}

