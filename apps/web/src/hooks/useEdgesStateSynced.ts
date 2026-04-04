import { useCallback, useEffect, useState } from 'react';
import { type Edge, type OnEdgesChange, applyEdgeChanges } from 'reactflow';
import type { Map as YMapType, Doc } from 'yjs';
import { undoState } from '../lib/yjs/undoState';

/**
 * Hook for syncing edges state through Yjs YMap
 * Based on collaborative-11-pro-example pattern
 *
 * Updated to use transactions with clientId as origin for UndoManager tracking
 */
export function useEdgesStateSynced(
  edgesMap: YMapType<unknown>,
  ydoc?: Doc | null,
  clientId?: string | null,
): [Edge[], React.Dispatch<React.SetStateAction<Edge[]>>, OnEdgesChange] {
  const [edges, setEdges] = useState<Edge[]>([]);

  const setEdgesSynced = useCallback(
    (edgesOrUpdater: React.SetStateAction<Edge[]>) => {
      const doUpdate = () => {
        const currentEdges = Array.from(edgesMap.values()) as Edge[];
        const next =
          typeof edgesOrUpdater === 'function' ? edgesOrUpdater(currentEdges) : edgesOrUpdater;

        const seen = new Set<string>();

        for (const edge of next) {
          seen.add(edge.id);
          edgesMap.set(edge.id, edge);
        }

        for (const edge of currentEdges) {
          if (!seen.has(edge.id)) {
            edgesMap.delete(edge.id);
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
    [edgesMap, ydoc, clientId],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const doUpdate = () => {
        const edges = Array.from(edgesMap.values()) as Edge[];
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
    [edgesMap, ydoc, clientId],
  );

  // Batch rapid observer fires to prevent "Maximum update depth exceeded"
  useEffect(() => {
    let rafId: number | null = null;
    const observer = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setEdges(Array.from(edgesMap.values()) as Edge[]);
      });
    };

    setEdges(Array.from(edgesMap.values()) as Edge[]);
    edgesMap.observe(observer);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      edgesMap.unobserve(observer);
    };
  }, [edgesMap]);

  return [edges, setEdgesSynced, onEdgesChange];
}
