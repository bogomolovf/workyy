import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Predefined cursor colors palette - vibrant and distinguishable
export const DEFAULT_CURSOR = 'default' as const;

export const CURSOR_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
] as const;

export type CursorColor = (typeof CURSOR_COLORS)[number] | typeof DEFAULT_CURSOR;

type CursorSettingsState = {
  cursorColor: CursorColor;
  setCursorColor: (color: CursorColor) => void;
};

export const useCursorSettingsStore = create<CursorSettingsState>()(
  persist(
    (set) => ({
      cursorColor: CURSOR_COLORS[5], // Default to blue
      setCursorColor: (color: CursorColor) => set({ cursorColor: color }),
    }),
    {
      name: 'workyy-cursor-settings',
    },
  ),
);
