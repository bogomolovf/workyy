import { create } from 'zustand';
import { fetchCurrentUser, loginUser, registerUser, logoutUser } from '../lib/api';

type WorkspaceSummary = {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
};

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  workspaces?: WorkspaceSummary[];
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  init: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    set({ loading: true, error: null });
    try {
      const user = await fetchCurrentUser();
      set({ user, initialized: true, loading: false });
    } catch (err: any) {
      set({ user: null, initialized: true, loading: false, error: null });
    }
  },

  login: async (payload) => {
    set({ loading: true, error: null });
    try {
      const user = await loginUser(payload);
      set({ user, loading: false });
    } catch (err: any) {
      set({ error: err.message ?? 'Login failed', loading: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const user = await registerUser(payload);
      set({ user, loading: false });
    } catch (err: any) {
      set({ error: err.message ?? 'Registration failed', loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await logoutUser();
    } finally {
      set({ user: null });
    }
  },
}));

