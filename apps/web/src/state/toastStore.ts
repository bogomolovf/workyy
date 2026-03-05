import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
};

type ToastState = {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${idCounter}-${Date.now()}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = nextId();
    set((s) => ({
      toasts: [...s.toasts, { id, message, type, createdAt: Date.now() }],
    }));
    setTimeout(() => {
      get().dismiss(id);
    }, 4000);
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
