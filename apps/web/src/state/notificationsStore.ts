import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationsPreferences = {
  // Board activity & conversation
  boardSharedWithMe: boolean;
  boardSharedWithTeam: boolean;
  someoneRequestsAccessToMyBoard: boolean;
  someoneCommentsInThreadsFollowing: boolean;
  someoneMentionsMe: boolean;
  // Talktrack updates
  talktrackSummaryEnabled: boolean;
  talktrackSummaryStartHour: number;
  talktrackSummaryIntervalHours: number;
  // Tables
  recordAssignedToMe: boolean;
  // Space activity
  someoneAddsMeToSpace: boolean;
  // Team activity
  inviteesSignUp: boolean;
  someoneRequestsAccessToTeam: boolean;
  someoneInvitesMeToTeam: boolean;
  // Other email updates
  tipsAndHowTos: boolean;
  productFeatureUpdates: boolean;
  eventsPromotions: boolean;
  surveysProductTesting: boolean;
};

const DEFAULTS: NotificationsPreferences = {
  boardSharedWithMe: true,
  boardSharedWithTeam: true,
  someoneRequestsAccessToMyBoard: true,
  someoneCommentsInThreadsFollowing: true,
  someoneMentionsMe: true,
  talktrackSummaryEnabled: false,
  talktrackSummaryStartHour: 9,
  talktrackSummaryIntervalHours: 24,
  recordAssignedToMe: true,
  someoneAddsMeToSpace: true,
  inviteesSignUp: true,
  someoneRequestsAccessToTeam: true,
  someoneInvitesMeToTeam: true,
  tipsAndHowTos: false,
  productFeatureUpdates: true,
  eventsPromotions: false,
  surveysProductTesting: false,
};

type NotificationsState = NotificationsPreferences & {
  set: (key: keyof NotificationsPreferences, value: boolean | number) => void;
  setMultiple: (updates: Partial<NotificationsPreferences>) => void;
  reset: () => void;
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set((s) => ({ [key]: value }) as Partial<NotificationsPreferences>),
      setMultiple: (updates) => set((s) => ({ ...s, ...updates })),
      reset: () => set(DEFAULTS),
    }),
    { name: 'workyy.notifications' },
  ),
);
