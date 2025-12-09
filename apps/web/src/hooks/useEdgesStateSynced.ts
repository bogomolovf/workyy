import { useCallback, useEffect, useState } from 'react';
import { type Edge, type OnEdgesChange, applyEdgeChanges } from 'reactflow';
import type { Map as YMapType } from 'yjs';

/**
 * Hook for syncing edges state through Yjs YMap
 * Based on collaborative-11-pro-example pattern
 */
export function useEdgesStateSynced(
  edgesMap: YMapType<Edge>
): [Edge[], React.Dispatch<React.SetStateAction<Edge[]>>, OnEdgesChange] {
  const [edges, setEdges] = useState<Edge[]>([]);

  const setEdgesSynced = useCallback(
    (edgesOrUpdater: React.SetStateAction<Edge[]>) => {
      const next =
        typeof edgesOrUpdater === 'function'
          ? edgesOrUpdater([...edgesMap.values()])
          : edgesOrUpdater;

      const seen = new Set<string>();

      for (const edge of next) {
        seen.add(edge.id);
        edgesMap.set(edge.id, edge);
      }

      for (const edge of edgesMap.values()) {
        if (!seen.has(edge.id)) {
          edgesMap.delete(edge.id);
        }
      }
    },
    [edgesMap]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const edges = Array.from(edgesMap.values());
      const nextEdges = applyEdgeChanges(changes, edges);

      for (const change of changes) {
        if (change.type === 'add' || change.type === 'reset') {
          edgesMap.set(change.item.id, change.item);
        } else if (change.type === 'remove' && edgesMap.has(change.id)) {
          edgesMap.delete(change.id);
        } else {
          const updatedEdge = nextEdges.find((e) => e.id === change.id);
          if (updatedEdge) {
            edgesMap.set(change.id, updatedEdge);
          }
        }
      }
    },
    [edgesMap]
  );

  useEffect(() => {
    const observer = () => {
      setEdges(Array.from(edgesMap.values()));
    };

    setEdges(Array.from(edgesMap.values()));
    edgesMap.observe(observer);

    return () => edgesMap.unobserve(observer);
  }, [edgesMap, setEdges]);

  return [edges, setEdgesSynced, onEdgesChange];
}

