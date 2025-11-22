// file: apps/web/src/state/canvasLayoutStore.ts
import { create } from "zustand";

const MIN_NODE_WIDTH = 360;
const MAX_NODE_WIDTH = 920;
const DEFAULT_NODE_WIDTH = 620;

type CanvasLayoutStore = {
  nodeSizes: Record<string, { width: number; height?: number }>;
  codeCollapsed: Record<string, boolean>;
  setNodeWidth: (nodeId: string, width: number) => void;
  setNodeSize: (nodeId: string, size: { width?: number; height?: number }) => void;
  toggleCodeCollapsed: (nodeId: string) => void;
  reset: () => void;
};

export type CanvasLayoutState = CanvasLayoutStore;

export const useCanvasLayoutStore = create<CanvasLayoutStore>((set) => ({
  nodeSizes: {},
  codeCollapsed: {},
  setNodeWidth: (nodeId, width) =>
    set((state) => ({
      nodeSizes: {
        ...state.nodeSizes,
        [nodeId]: {
          width: Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(width))),
          height: state.nodeSizes[nodeId]?.height,
        },
      },
    })),
  setNodeSize: (nodeId, size) =>
    set((state) => ({
      nodeSizes: {
        ...state.nodeSizes,
        [nodeId]: {
          width:
            size.width !== undefined
              ? Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(size.width)))
              : state.nodeSizes[nodeId]?.width ?? DEFAULT_NODE_WIDTH,
          height: size.height !== undefined ? Math.max(160, Math.round(size.height)) : state.nodeSizes[nodeId]?.height,
        },
      },
    })),
  toggleCodeCollapsed: (nodeId) =>
    set((state) => ({
      codeCollapsed: {
        ...state.codeCollapsed,
        [nodeId]: !state.codeCollapsed[nodeId],
      },
    })),
  reset: () => ({ nodeSizes: {}, codeCollapsed: {} }),
}));

export function getDefaultNodeWidth() {
  return DEFAULT_NODE_WIDTH;
}

export { MIN_NODE_WIDTH, MAX_NODE_WIDTH };
