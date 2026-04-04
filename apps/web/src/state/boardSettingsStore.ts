import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useNotificationsStore } from './notificationsStore';
import { useToastStore } from './toastStore';

/** Stable empty array — avoid new [] in selectors to prevent "getSnapshot" infinite loop */
const EMPTY_STRING_ARRAY: string[] = [];

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

export type ScrollBehavior = 'scrollAndZoom' | 'scrollToPan';

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
  invertScroll: boolean;
  scrollBehavior: ScrollBehavior;
  templates: SavedTemplate[];
  nodeIdsAtLastVisit: Record<string, string[]>;
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
  setInvertScroll: (v: boolean) => void;
  setScrollBehavior: (v: ScrollBehavior) => void;
  setBoardsListView: (v: BoardsListView) => void;
  recordBoardVisitWithNodes: (boardId: string, nodeIds: string[]) => void;
  getNodeIdsAtLastVisit: (boardId: string) => string[];
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
      invertScroll: false,
      scrollBehavior: 'scrollAndZoom' as ScrollBehavior,
      templates: [],
      nodeIdsAtLastVisit: {},
      setGridVisible: (v) => set({ gridVisible: v }),
      setShowCollaboratorCursors: (v) => set({ showCollaboratorCursors: v }),
      setShowComments: (v) => set({ showComments: v }),
      setShowScrollbars: (v) => set({ showScrollbars: v }),
      setShowObjectDimensions: (v) => set({ showObjectDimensions: v }),
      setShowUndoRedoControls: (v) => set({ showUndoRedoControls: v }),
      setAlignObjects: (v) => set({ alignObjects: v }),
      setFollowAllThreads: (v) => {
        set({ followAllThreads: v });
        useNotificationsStore.getState().set('someoneCommentsInThreadsFollowing', v);
        useToastStore
          .getState()
          .show(v ? 'Subscribed to all threads' : 'Unsubscribed from threads', 'success');
      },
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
      setInvertScroll: (v) => set({ invertScroll: v }),
      setScrollBehavior: (v) => set({ scrollBehavior: v }),
      setBoardsListView: (v) => set({ boardsListView: v }),
      recordBoardVisitWithNodes: (boardId, nodeIds) =>
        set((s) => ({
          lastVisitedAtByBoardId: { ...s.lastVisitedAtByBoardId, [boardId]: Date.now() },
          nodeIdsAtLastVisit: { ...s.nodeIdsAtLastVisit, [boardId]: nodeIds },
        })),
      // Return stable empty array to avoid "getSnapshot should be cached" / infinite loop
      // when used in Zustand selector (e.g. CatchUpPanel)
      getNodeIdsAtLastVisit: (boardId) => get().nodeIdsAtLastVisit[boardId] ?? EMPTY_STRING_ARRAY,
    }),
    { name: 'workyy-board-settings' },
  ),
);
