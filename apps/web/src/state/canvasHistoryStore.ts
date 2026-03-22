'use client';

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal node representation for history storage
 */
export type HistoryNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type HistoryEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Canvas snapshot - immutable state at a point in time
 */
export type CanvasSnapshot = {
  nodes: HistoryNode[];
  edges: HistoryEdge[];
  timestamp: number;
};

/**
 * Delta represents the difference between two snapshots
 * More efficient than storing full snapshots
 */
export type HistoryDelta = {
  // Added nodes/edges
  added: {
    nodes: HistoryNode[];
    edges: HistoryEdge[];
  };
  // Removed nodes/edges (by id)
  removed: {
    nodeIds: string[];
    edgeIds: string[];
  };
  // Modified nodes/edges (id -> changes)
  modified: {
    nodes: Map<string, Partial<HistoryNode>>;
    edges: Map<string, Partial<HistoryEdge>>;
  };
  timestamp: number;
};

type CanvasHistoryStore = {
  // State
  past: CanvasSnapshot[];
  present: CanvasSnapshot | null;
  future: CanvasSnapshot[];

  // Computed (derived state)
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  saveSnapshot: (nodes: HistoryNode[], edges: HistoryEdge[]) => void;
  undo: () => CanvasSnapshot | null;
  redo: () => CanvasSnapshot | null;
  clear: () => void;

  // Helpers
  getCurrentSnapshot: () => CanvasSnapshot | null;
  getHistoryLength: () => { past: number; future: number };
};

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY_SIZE = 100; // Excalidraw-style larger history
const MIN_SNAPSHOT_INTERVAL = 50; // ms - debounce rapid changes

// ============================================================================
// Helpers
// ============================================================================

/**
 * Deep clone with structural sharing for unchanged objects
 * More efficient than JSON.parse/JSON.stringify
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return cloned as T;
}

/**
 * Check if two snapshots are structurally equal
 * Used to avoid saving duplicate history entries
 */
function snapshotsEqual(a: CanvasSnapshot | null, b: CanvasSnapshot | null): boolean {
  if (!a || !b) return a === b;

  if (a.nodes.length !== b.nodes.length) return false;
  if (a.edges.length !== b.edges.length) return false;

  // Quick check: compare node/edge ids
  const aNodeIds = new Set(a.nodes.map((n) => n.id));
  const bNodeIds = new Set(b.nodes.map((n) => n.id));

  if (aNodeIds.size !== bNodeIds.size) return false;
  for (const id of aNodeIds) {
    if (!bNodeIds.has(id)) return false;
  }

  // Check for position changes in nodes
  const aNodesMap = new Map(a.nodes.map((n) => [n.id, n]));
  for (const bNode of b.nodes) {
    const aNode = aNodesMap.get(bNode.id);
    if (!aNode) return false;
    if (aNode.position.x !== bNode.position.x || aNode.position.y !== bNode.position.y) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Store
// ============================================================================

export const useCanvasHistoryStore = create<CanvasHistoryStore>((set, get) => ({
  past: [],
  present: null,
  future: [],
  canUndo: false,
  canRedo: false,

  saveSnapshot: (nodes, edges) => {
    const { present, past } = get();

    const newSnapshot: CanvasSnapshot = {
      nodes: deepClone(nodes),
      edges: deepClone(edges),
      timestamp: Date.now(),
    };

    // Check if snapshot is meaningfully different from present
    if (present && snapshotsEqual(present, newSnapshot)) {
      return;
    }

    // Debounce rapid changes
    if (present && newSnapshot.timestamp - present.timestamp < MIN_SNAPSHOT_INTERVAL) {
      // Update present without adding to history
      set({
        present: newSnapshot,
      });
      return;
    }

    // Add present to past if it exists
    const newPast = present ? [...past, present] : [...past];

    // Limit history size
    while (newPast.length > MAX_HISTORY_SIZE) {
      newPast.shift();
    }

    set({
      past: newPast,
      present: newSnapshot,
      future: [], // Clear future on new action
      canUndo: newPast.length > 0 || present !== null,
      canRedo: false,
    });
  },

  undo: () => {
    const { past, present, future } = get();

    if (past.length === 0) {
      return null;
    }

    // Get previous snapshot
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    // Current present goes to future
    const newFuture = present ? [present, ...future] : future;

    set({
      past: newPast,
      present: previous,
      future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: true,
    });

    // Return a deep clone to prevent mutation
    return deepClone(previous);
  },

  redo: () => {
    const { past, present, future } = get();

    if (future.length === 0) {
      return null;
    }

    // Get next snapshot
    const next = future[0];
    const newFuture = future.slice(1);

    // Current present goes to past
    const newPast = present ? [...past, present] : past;

    set({
      past: newPast,
      present: next,
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });

    return deepClone(next);
  },

  clear: () => {
    set({
      past: [],
      present: null,
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },

  getCurrentSnapshot: () => {
    const { present } = get();
    return present ? deepClone(present) : null;
  },

  getHistoryLength: () => {
    const { past, future } = get();
    return { past: past.length, future: future.length };
  },
}));

// ============================================================================
// Selector hooks for optimized re-renders
// ============================================================================

export const useCanUndo = () => useCanvasHistoryStore((state) => state.canUndo);
export const useCanRedo = () => useCanvasHistoryStore((state) => state.canRedo);
