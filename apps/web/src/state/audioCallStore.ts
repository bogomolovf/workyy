import { create } from 'zustand';

/**
 * Participant in an audio call — one entry per remote user.
 */
export type CallParticipant = {
  /** Server-side userId (from auth) */
  odielId: string;
  /** Yjs clientId (unique per tab) */
  clientId: string;
  /** Display name */
  name: string;
  /** Whether this participant is muted */
  muted: boolean;
  /** Whether the participant is currently speaking (derived from audio level) */
  speaking: boolean;
  /** Connected RTCPeerConnection for this participant (managed outside store) */
};

export type AudioCallState = {
  /** Whether the current user is in the call */
  inCall: boolean;
  /** Whether the local microphone is muted */
  localMuted: boolean;
  /** Remote participants keyed by clientId */
  participants: Record<string, CallParticipant>;
  /** Whether the call UI is expanded (panel open) */
  panelOpen: boolean;
  /** Error message if something went wrong */
  error: string | null;
};

export type AudioCallActions = {
  /** Mark current user as having joined the call */
  joinCall: () => void;
  /** Mark current user as having left the call */
  leaveCall: () => void;
  /** Toggle local mute */
  toggleMute: () => void;
  /** Set mute explicitly */
  setLocalMuted: (muted: boolean) => void;
  /** Add a remote participant */
  addParticipant: (p: CallParticipant) => void;
  /** Remove a remote participant by clientId */
  removeParticipant: (clientId: string) => void;
  /** Update a participant field (e.g. muted, speaking) */
  updateParticipant: (clientId: string, patch: Partial<CallParticipant>) => void;
  /** Set all participants at once (e.g. from Yjs sync) */
  setParticipants: (participants: Record<string, CallParticipant>) => void;
  /** Toggle the call UI panel */
  togglePanel: () => void;
  /** Set error */
  setError: (error: string | null) => void;
  /** Full reset (on board leave) */
  reset: () => void;
};

const initialState: AudioCallState = {
  inCall: false,
  localMuted: false,
  participants: {},
  panelOpen: false,
  error: null,
};

export const useAudioCallStore = create<AudioCallState & AudioCallActions>((set) => ({
  ...initialState,

  joinCall: () => set({ inCall: true, error: null }),

  leaveCall: () => set({ inCall: false, participants: {}, error: null }),

  toggleMute: () => set((s) => ({ localMuted: !s.localMuted })),

  setLocalMuted: (muted) => set({ localMuted: muted }),

  addParticipant: (p) =>
    set((s) => ({
      participants: { ...s.participants, [p.clientId]: p },
    })),

  removeParticipant: (clientId) =>
    set((s) => {
      const { [clientId]: _, ...rest } = s.participants;
      return { participants: rest };
    }),

  updateParticipant: (clientId, patch) =>
    set((s) => {
      const existing = s.participants[clientId];
      if (!existing) return s;
      return {
        participants: {
          ...s.participants,
          [clientId]: { ...existing, ...patch },
        },
      };
    }),

  setParticipants: (participants) => set({ participants }),

  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
