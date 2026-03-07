import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GridSize = 'small' | 'medium' | 'large';

export type StartViewState = {
  x: number;
  y: number;
  zoom: number;
} | null;

export type SavedTemplate = {
  id: string;
  name: string;
  snapshot: { nodes: unknown[]; edges: unknown[] };
  createdAt: number;
};

export type BoardsListView = 'grid' | 'list';

export type BoardSettingsState = {
  boardsListView: BoardsListView;
  gridVisible: boolean;
  showCollaboratorCursors: boolean;
  showComments: boolean;
  showScrollbars: boolean;
  showObjectDimensions: boolean;
  showUndoRedoControls: boolean;
  alignObjects: boolean;
  followAllThreads: boolean;
  lockDefaultView: boolean;
  starredBoardIds: string[];
  lastVisitedAtByBoardId: Record<string, number>;
  backgroundColor: string;
  startView: StartViewState;
  gridSize: GridSize;
  snapToGrid: boolean;
  templates: SavedTemplate[];
  setGridVisible: (v: boolean) => void;
  setShowCollaboratorCursors: (v: boolean) => void;
  setShowComments: (v: boolean) => void;
  setShowScrollbars: (v: boolean) => void;
  setShowObjectDimensions: (v: boolean) => void;
  setShowUndoRedoControls: (v: boolean) => void;
  setAlignObjects: (v: boolean) => void;
  setFollowAllThreads: (v: boolean) => void;
  setLockDefaultView: (v: boolean) => void;
  toggleStarred: (boardId: string) => void;
  isStarred: (boardId: string) => boolean;
  recordBoardVisit: (boardId: string) => void;
  setBackgroundColor: (v: string) => void;
  setStartView: (v: StartViewState) => void;
  setGridSize: (v: GridSize) => void;
  setSnapToGrid: (v: boolean) => void;
  setBoardsListView: (v: BoardsListView) => void;
};

export const useBoardSettingsStore = create<BoardSettingsState>()(
  persist(
    (set, get) => ({
      boardsListView: 'grid',
      gridVisible: true,
      showCollaboratorCursors: true,
      showComments: true,
      showScrollbars: true,
      showObjectDimensions: false,
      showUndoRedoControls: true,
      alignObjects: true,
      followAllThreads: false,
      lockDefaultView: false,
      starredBoardIds: [],
      lastVisitedAtByBoardId: {},
      backgroundColor: '#ffffff',
      startView: null,
      gridSize: 'medium',
      snapToGrid: true,
      templates: [],
      setGridVisible: (v) => set({ gridVisible: v }),
      setShowCollaboratorCursors: (v) => set({ showCollaboratorCursors: v }),
      setShowComments: (v) => set({ showComments: v }),
      setShowScrollbars: (v) => set({ showScrollbars: v }),
      setShowObjectDimensions: (v) => set({ showObjectDimensions: v }),
      setShowUndoRedoControls: (v) => set({ showUndoRedoControls: v }),
      setAlignObjects: (v) => set({ alignObjects: v }),
      setFollowAllThreads: (v) => set({ followAllThreads: v }),
      setLockDefaultView: (v) => set({ lockDefaultView: v }),
      toggleStarred: (boardId) =>
        set((s) => ({
          starredBoardIds: s.starredBoardIds.includes(boardId)
            ? s.starredBoardIds.filter((id) => id !== boardId)
            : [...s.starredBoardIds, boardId],
        })),
      isStarred: (boardId) => get().starredBoardIds.includes(boardId),
      recordBoardVisit: (boardId) =>
        set((s) => ({
          lastVisitedAtByBoardId: {
            ...s.lastVisitedAtByBoardId,
            [boardId]: Date.now(),
          },
        })),
      setBackgroundColor: (v) => set({ backgroundColor: v }),
      setStartView: (v) => set({ startView: v }),
      setGridSize: (v) => set({ gridSize: v }),
      setSnapToGrid: (v) => set({ snapToGrid: v }),
      setBoardsListView: (v) => set({ boardsListView: v }),
    }),
    { name: 'workyy-board-settings' },
  ),
);
