import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TrackerSettingsState {
  starredTrackerIds: string[];
  lastVisitedAtByTrackerId: Record<string, number>;

  toggleStarred: (id: string) => void;
  isStarred: (id: string) => boolean;
  recordTrackerVisit: (id: string) => void;
}

export const useTrackerSettingsStore = create<TrackerSettingsState>()(
  persist(
    (set, get) => ({
      starredTrackerIds: [],
      lastVisitedAtByTrackerId: {},

      toggleStarred: (id) =>
        set((s) => ({
          starredTrackerIds: s.starredTrackerIds.includes(id)
            ? s.starredTrackerIds.filter((x) => x !== id)
            : [...s.starredTrackerIds, id],
        })),

      isStarred: (id) => get().starredTrackerIds.includes(id),

      recordTrackerVisit: (id) =>
        set((s) => ({
          lastVisitedAtByTrackerId: {
            ...s.lastVisitedAtByTrackerId,
            [id]: Date.now(),
          },
        })),
    }),
    { name: 'workyy-tracker-settings' },
  ),
);
