import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WorkspaceSummary = {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
};

export type SidebarView = 'home' | 'recent' | 'starred';

type TeamState = {
  currentTeamId: string | null;
  sidebarView: SidebarView;
  setCurrentTeamId: (id: string) => void;
  setSidebarView: (view: SidebarView) => void;
  initCurrentTeam: (workspaces: WorkspaceSummary[]) => void;
  clear: () => void;
};

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      currentTeamId: null,
      sidebarView: 'home',

      setCurrentTeamId: (id) => set({ currentTeamId: id }),

      setSidebarView: (view) => set({ sidebarView: view }),

      initCurrentTeam: (workspaces) => {
        if (!workspaces.length) return;
        const saved = get().currentTeamId;
        const stillValid = saved && workspaces.some((ws) => ws.id === saved);
        if (!stillValid) {
          set({ currentTeamId: workspaces[0].id });
        }
      },

      clear: () => set({ currentTeamId: null, sidebarView: 'home' }),
    }),
    { name: 'workyy-current-team' },
  ),
);
