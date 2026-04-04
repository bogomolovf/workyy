import type { Node, Viewport } from 'reactflow';
import { create } from 'zustand';

/** Store for canvas API registered by BoardCanvas when React Flow is ready. */
type BoardCanvasApiState = {
  fitView: (() => void) | null;
  getNodes: (() => Node[]) | null;
  getEdges: (() => { id: string; source: string; target: string }[]) | null;
  setCenter: ((x: number, y: number, opts?: { zoom?: number; duration?: number }) => void) | null;
  getViewport: (() => Viewport) | null;
  setNodes: ((updater: Node[] | ((prev: Node[]) => Node[])) => void) | null;
  setFitView: (fn: (() => void) | null) => void;
  setGetNodes: (fn: (() => Node[]) | null) => void;
  setGetEdges: (fn: (() => { id: string; source: string; target: string }[]) | null) => void;
  setSetCenter: (
    fn: ((x: number, y: number, opts?: { zoom?: number; duration?: number }) => void) | null,
  ) => void;
  setGetViewport: (fn: (() => Viewport) | null) => void;
  setSetNodes: (fn: ((updater: Node[] | ((prev: Node[]) => Node[])) => void) | null) => void;
};

export const useBoardCanvasApiStore = create<BoardCanvasApiState>((set) => ({
  fitView: null,
  getNodes: null,
  getEdges: null,
  setCenter: null,
  getViewport: null,
  setNodes: null,
  setFitView: (fn) => set({ fitView: fn }),
  setGetNodes: (fn) => set({ getNodes: fn }),
  setGetEdges: (fn) => set({ getEdges: fn }),
  setSetCenter: (fn) => set({ setCenter: fn }),
  setGetViewport: (fn) => set({ getViewport: fn }),
  setSetNodes: (fn) => set({ setNodes: fn }),
}));
