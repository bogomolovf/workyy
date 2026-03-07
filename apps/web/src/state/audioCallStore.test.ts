import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioCallStore, type CallParticipant } from './audioCallStore';

const mockParticipant: CallParticipant = {
  odielId: 'user-1',
  clientId: 'client-1',
  name: 'Alice',
  muted: false,
  speaking: false,
};

const mockParticipant2: CallParticipant = {
  odielId: 'user-2',
  clientId: 'client-2',
  name: 'Bob',
  muted: true,
  speaking: false,
};

describe('audioCallStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAudioCallStore.getState().reset();
    console.log('[audioCallStore.test] Store reset to initial state');
  });

  describe('joinCall / leaveCall', () => {
    it('sets inCall to true on joinCall and clears error', () => {
      const store = useAudioCallStore.getState();
      store.setError('Previous error');
      console.log('[TEST] Before joinCall:', {
        inCall: useAudioCallStore.getState().inCall,
        error: useAudioCallStore.getState().error,
      });

      store.joinCall();

      const state = useAudioCallStore.getState();
      console.log('[TEST] After joinCall:', { inCall: state.inCall, error: state.error });
      expect(state.inCall).toBe(true);
      expect(state.error).toBeNull();
    });

    it('sets inCall to false and clears participants on leaveCall', () => {
      const store = useAudioCallStore.getState();
      store.joinCall();
      store.addParticipant(mockParticipant);
      console.log('[TEST] Before leaveCall:', {
        inCall: useAudioCallStore.getState().inCall,
        participantCount: Object.keys(useAudioCallStore.getState().participants).length,
      });

      store.leaveCall();

      const state = useAudioCallStore.getState();
      console.log('[TEST] After leaveCall:', {
        inCall: state.inCall,
        participantCount: Object.keys(state.participants).length,
      });
      expect(state.inCall).toBe(false);
      expect(Object.keys(state.participants)).toHaveLength(0);
      expect(state.error).toBeNull();
    });
  });

  describe('toggleMute / setLocalMuted', () => {
    it('toggles localMuted from false to true and back', () => {
      const store = useAudioCallStore.getState();
      console.log('[TEST] Initial localMuted:', useAudioCallStore.getState().localMuted);
      expect(useAudioCallStore.getState().localMuted).toBe(false);

      store.toggleMute();
      console.log('[TEST] After first toggle:', useAudioCallStore.getState().localMuted);
      expect(useAudioCallStore.getState().localMuted).toBe(true);

      store.toggleMute();
      console.log('[TEST] After second toggle:', useAudioCallStore.getState().localMuted);
      expect(useAudioCallStore.getState().localMuted).toBe(false);
    });

    it('setLocalMuted sets muted state explicitly', () => {
      const store = useAudioCallStore.getState();

      store.setLocalMuted(true);
      console.log('[TEST] After setLocalMuted(true):', useAudioCallStore.getState().localMuted);
      expect(useAudioCallStore.getState().localMuted).toBe(true);

      store.setLocalMuted(false);
      console.log('[TEST] After setLocalMuted(false):', useAudioCallStore.getState().localMuted);
      expect(useAudioCallStore.getState().localMuted).toBe(false);
    });
  });

  describe('participant management', () => {
    it('addParticipant adds a new participant', () => {
      const store = useAudioCallStore.getState();

      store.addParticipant(mockParticipant);

      const state = useAudioCallStore.getState();
      console.log('[TEST] After addParticipant:', {
        participantCount: Object.keys(state.participants).length,
        participant: state.participants[mockParticipant.clientId],
      });
      expect(state.participants[mockParticipant.clientId]).toEqual(mockParticipant);
    });

    it('addParticipant overwrites existing participant with same clientId', () => {
      const store = useAudioCallStore.getState();
      store.addParticipant(mockParticipant);

      const updatedParticipant = { ...mockParticipant, name: 'Alice Updated' };
      store.addParticipant(updatedParticipant);

      const state = useAudioCallStore.getState();
      console.log(
        '[TEST] After overwriting participant:',
        state.participants[mockParticipant.clientId],
      );
      expect(state.participants[mockParticipant.clientId].name).toBe('Alice Updated');
      expect(Object.keys(state.participants)).toHaveLength(1);
    });

    it('removeParticipant removes participant by clientId', () => {
      const store = useAudioCallStore.getState();
      store.addParticipant(mockParticipant);
      store.addParticipant(mockParticipant2);
      console.log(
        '[TEST] Before removeParticipant:',
        Object.keys(useAudioCallStore.getState().participants),
      );

      store.removeParticipant(mockParticipant.clientId);

      const state = useAudioCallStore.getState();
      console.log('[TEST] After removeParticipant:', Object.keys(state.participants));
      expect(state.participants[mockParticipant.clientId]).toBeUndefined();
      expect(state.participants[mockParticipant2.clientId]).toEqual(mockParticipant2);
    });

    it('removeParticipant does nothing for non-existent clientId', () => {
      const store = useAudioCallStore.getState();
      store.addParticipant(mockParticipant);
      const before = { ...useAudioCallStore.getState().participants };

      store.removeParticipant('non-existent-client');

      const after = useAudioCallStore.getState().participants;
      console.log('[TEST] removeParticipant non-existent:', {
        before: Object.keys(before),
        after: Object.keys(after),
      });
      expect(Object.keys(after)).toHaveLength(1);
      expect(after[mockParticipant.clientId]).toEqual(mockParticipant);
    });

    it('updateParticipant patches existing participant', () => {
      const store = useAudioCallStore.getState();
      store.addParticipant(mockParticipant);

      store.updateParticipant(mockParticipant.clientId, { muted: true, speaking: true });

      const state = useAudioCallStore.getState();
      const p = state.participants[mockParticipant.clientId];
      console.log('[TEST] After updateParticipant:', p);
      expect(p.muted).toBe(true);
      expect(p.speaking).toBe(true);
      expect(p.name).toBe('Alice'); // unchanged
    });

    it('updateParticipant does nothing for non-existent clientId', () => {
      const store = useAudioCallStore.getState();
      store.addParticipant(mockParticipant);
      const before = { ...useAudioCallStore.getState().participants };

      store.updateParticipant('non-existent', { muted: true });

      const after = useAudioCallStore.getState().participants;
      console.log('[TEST] updateParticipant non-existent - state unchanged:', {
        beforeKeys: Object.keys(before),
        afterKeys: Object.keys(after),
      });
      expect(after).toEqual(before);
    });

    it('setParticipants replaces all participants at once', () => {
      const store = useAudioCallStore.getState();
      store.addParticipant(mockParticipant);

      const newParticipants = {
        [mockParticipant2.clientId]: mockParticipant2,
      };
      store.setParticipants(newParticipants);

      const state = useAudioCallStore.getState();
      console.log('[TEST] After setParticipants:', Object.keys(state.participants));
      expect(state.participants[mockParticipant.clientId]).toBeUndefined();
      expect(state.participants[mockParticipant2.clientId]).toEqual(mockParticipant2);
    });
  });

  describe('panel and error management', () => {
    it('togglePanel toggles panelOpen state', () => {
      const store = useAudioCallStore.getState();
      console.log('[TEST] Initial panelOpen:', useAudioCallStore.getState().panelOpen);
      expect(useAudioCallStore.getState().panelOpen).toBe(false);

      store.togglePanel();
      console.log('[TEST] After first togglePanel:', useAudioCallStore.getState().panelOpen);
      expect(useAudioCallStore.getState().panelOpen).toBe(true);

      store.togglePanel();
      console.log('[TEST] After second togglePanel:', useAudioCallStore.getState().panelOpen);
      expect(useAudioCallStore.getState().panelOpen).toBe(false);
    });

    it('setError sets error message', () => {
      const store = useAudioCallStore.getState();

      store.setError('Microphone access denied');

      const state = useAudioCallStore.getState();
      console.log('[TEST] After setError:', state.error);
      expect(state.error).toBe('Microphone access denied');
    });

    it('setError clears error when called with null', () => {
      const store = useAudioCallStore.getState();
      store.setError('Some error');

      store.setError(null);

      const state = useAudioCallStore.getState();
      console.log('[TEST] After setError(null):', state.error);
      expect(state.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const store = useAudioCallStore.getState();

      // Set various state
      store.joinCall();
      store.setLocalMuted(true);
      store.addParticipant(mockParticipant);
      store.togglePanel();
      store.setError('Some error');

      console.log('[TEST] Before reset:', {
        inCall: useAudioCallStore.getState().inCall,
        localMuted: useAudioCallStore.getState().localMuted,
        participantCount: Object.keys(useAudioCallStore.getState().participants).length,
        panelOpen: useAudioCallStore.getState().panelOpen,
        error: useAudioCallStore.getState().error,
      });

      store.reset();

      const state = useAudioCallStore.getState();
      console.log('[TEST] After reset:', {
        inCall: state.inCall,
        localMuted: state.localMuted,
        participantCount: Object.keys(state.participants).length,
        panelOpen: state.panelOpen,
        error: state.error,
      });

      expect(state.inCall).toBe(false);
      expect(state.localMuted).toBe(false);
      expect(Object.keys(state.participants)).toHaveLength(0);
      expect(state.panelOpen).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
