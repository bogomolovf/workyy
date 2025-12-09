import { useCallback, useEffect, useState } from 'react';
import { type Node, type OnNodesChange, applyNodeChanges, getConnectedEdges } from 'reactflow';
import type { Map as YMapType } from 'yjs';

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
 */
export function useNodesStateSynced(
  nodesMap: YMapType<Node>,
  edgesMap: YMapType<any>
): [Node[], React.Dispatch<React.SetStateAction<Node[]>>, OnNodesChange] {
  const [nodes, setNodes] = useState<Node[]>([]);

  const setNodesSynced = useCallback(
    (nodesOrUpdater: React.SetStateAction<Node[]>) => {
      const seen = new Set<string>();
      const next =
        typeof nodesOrUpdater === 'function'
          ? nodesOrUpdater([...nodesMap.values()])
          : nodesOrUpdater;

      for (const node of next) {
        seen.add(node.id);
        nodesMap.set(node.id, node);
      }

      for (const node of nodesMap.values()) {
        if (!seen.has(node.id)) {
          nodesMap.delete(node.id);
        }
      }
    },
    [nodesMap]
  );

  // The onNodesChange callback updates nodesMap.
  // When the changes are applied to the map, the observer will be triggered and updates the nodes state.
  const onNodesChanges: OnNodesChange = useCallback(
    (changes) => {
      const nodes = Array.from(nodesMap.values());
      const nextNodes = applyNodeChanges(changes, nodes);

      for (const change of changes) {
        if (change.type === 'add' || change.type === 'reset') {
          nodesMap.set(change.item.id, change.item);
        } else if (change.type === 'remove' && nodesMap.has(change.id)) {
          const deletedNode = nodesMap.get(change.id)!;
          const connectedEdges = getConnectedEdges([deletedNode], [...edgesMap.values()]);

          nodesMap.delete(change.id);

          for (const edge of connectedEdges) {
            edgesMap.delete(edge.id);
          }
        } else {
          const updatedNode = nextNodes.find((n) => n.id === change.id);
          if (updatedNode) {
            nodesMap.set(change.id, updatedNode);
          }
        }
      }
    },
    [nodesMap, edgesMap]
  );

  // Observe the nodesMap and update the nodes state whenever the map changes.
  useEffect(() => {
    const observer = () => {
      setNodes(Array.from(nodesMap.values()));
    };

    setNodes(Array.from(nodesMap.values()));
    nodesMap.observe(observer);

    return () => nodesMap.unobserve(observer);
  }, [nodesMap, setNodes]);

  return [nodes, setNodesSynced, onNodesChanges];
}

