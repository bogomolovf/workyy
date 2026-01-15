import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PenSettings = {
  color: string;
  strokeWidth: number;
  opacity: number;
  smoothing: number;
  thinning: number;
};

// Optimized defaults based on Excalidraw's settings
const DEFAULT_PEN_SETTINGS: PenSettings = {
  color: '#1e1e1e', // Dark default for better visibility
  strokeWidth: 8, // Good default for visibility
  opacity: 1,
  smoothing: 0.5,
  thinning: 0.6, // Excalidraw uses 0.6 for better stroke taper
};

export const usePenSettingsStore = create<
  PenSettings & {
    setColor: (color: string) => void;
    setStrokeWidth: (width: number) => void;
    setOpacity: (opacity: number) => void;
    setSmoothing: (smoothing: number) => void;
    setThinning: (thinning: number) => void;
    reset: () => void;
  }
>()(
  persist(
    (set) => ({
      ...DEFAULT_PEN_SETTINGS,
      setColor: (color) => set({ color }),
      setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
      setOpacity: (opacity) => set({ opacity }),
      setSmoothing: (smoothing) => set({ smoothing }),
      setThinning: (thinning) => set({ thinning }),
      reset: () => set({ ...DEFAULT_PEN_SETTINGS }),
    }),
    {
      name: 'pen-settings',
    },
  ),
);
