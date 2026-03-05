import { create } from 'zustand';

/** Store for canvas API (fitView) registered by BoardCanvas when React Flow is ready. */
type BoardCanvasApiState = {
  fitView: (() => void) | null;
  setFitView: (fn: (() => void) | null) => void;
};

export const useBoardCanvasApiStore = create<BoardCanvasApiState>((set) => ({
  fitView: null,
  setFitView: (fn) => set({ fitView: fn }),
}));
