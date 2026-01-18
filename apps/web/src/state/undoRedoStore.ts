import { create } from 'zustand';

type CanvasState = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    payload?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }>;
};

type UndoRedoStore = {
  history: CanvasState[];
  currentIndex: number;
  maxHistorySize: number;
  canUndo: boolean;
  canRedo: boolean;
  pushState: (state: CanvasState) => void;
  undo: () => CanvasState | null;
  redo: () => CanvasState | null;
  clear: () => void;
};

export const useUndoRedoStore = create<UndoRedoStore>((set, get) => ({
  history: [],
  currentIndex: -1,
  maxHistorySize: 50,
  canUndo: false,
  canRedo: false,

  pushState: (state: CanvasState) => {
    const { history, currentIndex, maxHistorySize } = get();

    // Удаляем все состояния после текущего индекса (если делали undo)
    const newHistory = history.slice(0, currentIndex + 1);

    // Добавляем новое состояние
    newHistory.push(JSON.parse(JSON.stringify(state))); // Deep clone

    // Ограничиваем размер истории
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    }

    const newIndex = newHistory.length - 1;

    set({
      history: newHistory,
      currentIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: false,
    });
  },

  undo: () => {
    const { history, currentIndex } = get();
    if (currentIndex <= 0) return null;

    const newIndex = currentIndex - 1;
    const state = history[newIndex];

    set({
      currentIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
    });

    return JSON.parse(JSON.stringify(state)); // Deep clone
  },

  redo: () => {
    const { history, currentIndex } = get();
    if (currentIndex >= history.length - 1) return null;

    const newIndex = currentIndex + 1;
    const state = history[newIndex];

    set({
      currentIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < history.length - 1,
    });

    return JSON.parse(JSON.stringify(state)); // Deep clone
  },

  clear: () => {
    set({
      history: [],
      currentIndex: -1,
      canUndo: false,
      canRedo: false,
    });
  },
}));
