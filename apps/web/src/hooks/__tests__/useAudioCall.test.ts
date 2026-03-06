import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudioCallStore } from '../../state/audioCallStore';
import { useAudioCall } from '../useAudioCall';

// Mock webrtcConfig
vi.mock('../../lib/webrtcConfig', () => ({
  getRTCConfiguration: () => ({
    iceServers: [{ urls: 'stun:stun.test.com:19302' }],
    iceTransportPolicy: 'all',
  }),
  requestMicrophoneStream: vi.fn(),
}));

// ─── Mock Yjs YMap implementation ───────────────────────────────────────────
// We create a minimal mock that implements the same interface as Yjs Y.Map
// This avoids the lib0/observable ESM resolution issue in Vitest
type MockMapObserver = (event: { changes: { keys: Map<string, { action: string }> } }) => void;

class MockYMap<T = unknown> {
  private store = new Map<string, T>();
  private observers: MockMapObserver[] = [];

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  set(key: string, value: T): void {
    const action = this.store.has(key) ? 'update' : 'add';
    this.store.set(key, value);
    this.notifyObservers(key, action);
  }

  delete(key: string): void {
    if (this.store.has(key)) {
      this.store.delete(key);
      this.notifyObservers(key, 'delete');
    }
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get size(): number {
    return this.store.size;
  }

  keys(): IterableIterator<string> {
    return this.store.keys();
  }

  observe(fn: MockMapObserver): void {
    this.observers.push(fn);
  }

  unobserve(fn: MockMapObserver): void {
    const idx = this.observers.indexOf(fn);
    if (idx >= 0) this.observers.splice(idx, 1);
  }

  [Symbol.iterator](): IterableIterator<[string, T]> {
    return this.store[Symbol.iterator]();
  }

  private notifyObservers(key: string, action: string): void {
    const event = { changes: { keys: new Map([[key, { action }]]) } };
    for (const fn of this.observers) {
      try {
        fn(event);
      } catch {
        // Ignore observer errors in tests
      }
    }
  }
}

class MockYDoc {
  private maps = new Map<string, MockYMap>();
  clientID = Math.floor(Math.random() * 1000000);

  getMap<T = unknown>(name: string): MockYMap<T> {
    if (!this.maps.has(name)) {
      this.maps.set(name, new MockYMap<T>());
    }
    return this.maps.get(name) as MockYMap<T>;
  }

  destroy(): void {
    this.maps.clear();
  }
}

// Type alias to match test usage - use 'any' to bypass YMap type checking
// since our MockYMap implements the same interface but isn't the real YMap
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YMapLike = any;

// Get the mocked function for manipulation in tests
import { requestMicrophoneStream } from '../../lib/webrtcConfig';
const mockRequestMicrophoneStream = requestMicrophoneStream as ReturnType<typeof vi.fn>;

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  signalingState: RTCSignalingState = 'stable';
  connectionState: RTCPeerConnectionState = 'new';

  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  addTrack = vi.fn();
  close = vi.fn();

  createOffer = vi.fn().mockResolvedValue({
    type: 'offer',
    sdp: 'mock-sdp-offer',
  } as RTCSessionDescriptionInit);

  createAnswer = vi.fn().mockResolvedValue({
    type: 'answer',
    sdp: 'mock-sdp-answer',
  } as RTCSessionDescriptionInit);

  setLocalDescription = vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
    this.localDescription = new RTCSessionDescription(desc);
    if (desc.type === 'offer') {
      this.signalingState = 'have-local-offer';
    } else {
      this.signalingState = 'stable';
    }
  });

  setRemoteDescription = vi.fn().mockImplementation(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = new RTCSessionDescription(desc);
    if (desc.type === 'offer') {
      this.signalingState = 'have-remote-offer';
    } else {
      this.signalingState = 'stable';
    }
  });

  addIceCandidate = vi.fn().mockResolvedValue(undefined);

  simulateConnectionStateChange(newState: RTCPeerConnectionState) {
    this.connectionState = newState;
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  }
}

// Mock RTCSessionDescription and RTCIceCandidate
class MockRTCSessionDescription implements RTCSessionDescription {
  readonly type: RTCSdpType;
  readonly sdp: string;

  constructor(init: RTCSessionDescriptionInit) {
    this.type = init.type!;
    this.sdp = init.sdp || '';
  }

  toJSON() {
    return { type: this.type, sdp: this.sdp };
  }
}

class MockRTCIceCandidate implements RTCIceCandidate {
  readonly candidate: string;
  readonly sdpMid: string | null;
  readonly sdpMLineIndex: number | null;
  readonly foundation: string | null = null;
  readonly component: RTCIceComponent | null = null;
  readonly priority: number | null = null;
  readonly address: string | null = null;
  readonly protocol: RTCIceProtocol | null = null;
  readonly port: number | null = null;
  readonly type: RTCIceCandidateType | null = null;
  readonly tcpType: RTCIceTcpCandidateType | null = null;
  readonly relatedAddress: string | null = null;
  readonly relatedPort: number | null = null;
  readonly usernameFragment: string | null = null;

  constructor(init?: RTCIceCandidateInit) {
    this.candidate = init?.candidate || '';
    this.sdpMid = init?.sdpMid || null;
    this.sdpMLineIndex = init?.sdpMLineIndex ?? null;
  }

  toJSON() {
    return {
      candidate: this.candidate,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex,
    };
  }
}

// Setup global mocks
(global as any).RTCPeerConnection = MockRTCPeerConnection;
(global as any).RTCSessionDescription = MockRTCSessionDescription;
(global as any).RTCIceCandidate = MockRTCIceCandidate;

describe('useAudioCall', () => {
  let ydoc: MockYDoc;
  let audioCallMap: YMapLike;
  const clientId = 'test-client-123';
  const userInfo = { userId: 'user-456', userName: 'Test User' };

  // Mock MediaStream
  const mockMediaStream = {
    id: 'mock-stream-id',
    getTracks: vi.fn(() => [
      {
        kind: 'audio',
        enabled: true,
        stop: vi.fn(),
      },
    ]),
    getAudioTracks: vi.fn(() => [
      {
        kind: 'audio',
        enabled: true,
        stop: vi.fn(),
      },
    ]),
  } as unknown as MediaStream;

  beforeEach(() => {
    // Reset store
    useAudioCallStore.getState().reset();

    // Create fresh mock Yjs doc and map
    ydoc = new MockYDoc();
    audioCallMap = ydoc.getMap('audioCall');

    // Reset mocks
    vi.clearAllMocks();
    mockRequestMicrophoneStream.mockResolvedValue(mockMediaStream);

    console.log('[useAudioCall.test] Test setup complete');
  });

  afterEach(() => {
    ydoc.destroy();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('initializes with default state when not in call', () => {
      console.log('[TEST] Rendering useAudioCall hook');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      console.log('[TEST] Initial state:', {
        inCall: result.current.inCall,
        localMuted: result.current.localMuted,
        participantCount: Object.keys(result.current.participants).length,
        panelOpen: result.current.panelOpen,
        error: result.current.error,
      });

      expect(result.current.inCall).toBe(false);
      expect(result.current.localMuted).toBe(false);
      expect(Object.keys(result.current.participants)).toHaveLength(0);
      expect(result.current.panelOpen).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('provides join, leave, toggleMute, togglePanel functions', () => {
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      expect(typeof result.current.join).toBe('function');
      expect(typeof result.current.leave).toBe('function');
      expect(typeof result.current.toggleMute).toBe('function');
      expect(typeof result.current.togglePanel).toBe('function');
      console.log('[TEST] All expected functions are available');
    });
  });

  describe('join()', () => {
    it('joins call successfully - requests microphone, writes to map, sets inCall', async () => {
      console.log('[TEST] Testing successful join');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      console.log('[TEST] After join:', {
        inCall: result.current.inCall,
        error: result.current.error,
        mapSize: audioCallMap.size,
        participantKey: `participant:${clientId}`,
        hasParticipant: audioCallMap.has(`participant:${clientId}`),
      });

      expect(mockRequestMicrophoneStream).toHaveBeenCalledTimes(1);
      expect(result.current.inCall).toBe(true);
      expect(result.current.error).toBeNull();

      // Check participant entry in map
      const entry = audioCallMap.get(`participant:${clientId}`) as any;
      expect(entry).toBeDefined();
      expect(entry.userId).toBe(userInfo.userId);
      expect(entry.clientId).toBe(clientId);
      expect(entry.name).toBe(userInfo.userName);
      expect(entry.muted).toBe(false);
      console.log('[TEST] Participant entry in map:', entry);
    });

    it('sets error when microphone access is denied', async () => {
      const permissionError = new Error('Microphone permission denied');
      mockRequestMicrophoneStream.mockRejectedValueOnce(permissionError);

      console.log('[TEST] Testing join with permission denied');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      console.log('[TEST] After failed join:', {
        inCall: result.current.inCall,
        error: result.current.error,
      });

      expect(result.current.inCall).toBe(false);
      expect(result.current.error).toBe('Microphone permission denied');
    });

    it('sets generic error message when non-Error is thrown', async () => {
      // When a non-Error value is thrown, the hook falls back to generic message
      mockRequestMicrophoneStream.mockRejectedValueOnce('string error');

      console.log('[TEST] Testing join with non-Error rejection');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      console.log('[TEST] After failed join:', {
        inCall: result.current.inCall,
        error: result.current.error,
      });

      expect(result.current.inCall).toBe(false);
      expect(result.current.error).toBe('Failed to join call');
    });

    it('does nothing when audioCallMap is null', async () => {
      console.log('[TEST] Testing join with null map');
      const { result } = renderHook(() => useAudioCall(null, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      console.log('[TEST] After join with null map:', {
        inCall: result.current.inCall,
        getUserMediaCalled: mockRequestMicrophoneStream.mock.calls.length,
      });

      expect(mockRequestMicrophoneStream).not.toHaveBeenCalled();
      expect(result.current.inCall).toBe(false);
    });

    it('does nothing when clientId is undefined', async () => {
      console.log('[TEST] Testing join with undefined clientId');
      const { result } = renderHook(() => useAudioCall(audioCallMap, undefined, userInfo));

      await act(async () => {
        await result.current.join();
      });

      console.log('[TEST] After join with undefined clientId:', {
        inCall: result.current.inCall,
        getUserMediaCalled: mockRequestMicrophoneStream.mock.calls.length,
      });

      expect(mockRequestMicrophoneStream).not.toHaveBeenCalled();
      expect(result.current.inCall).toBe(false);
    });

    it('connects to existing participants on join', async () => {
      // Add an existing participant to the map before joining
      const existingParticipant = {
        userId: 'existing-user',
        clientId: 'existing-client',
        name: 'Existing User',
        muted: false,
        joinedAt: Date.now() - 10000,
      };
      audioCallMap.set('participant:existing-client', existingParticipant);

      console.log('[TEST] Testing join with existing participant');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      // Wait for participant to be added to store
      await waitFor(() => {
        const participants = result.current.participants;
        console.log('[TEST] Participants after join:', Object.keys(participants));
        return Object.keys(participants).length > 0;
      });

      expect(result.current.participants['existing-client']).toBeDefined();
      expect(result.current.participants['existing-client'].name).toBe('Existing User');
      console.log('[TEST] Connected to existing participant');
    });
  });

  describe('leave()', () => {
    it('removes participant from map and resets state on leave', async () => {
      console.log('[TEST] Testing leave');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      // First join
      await act(async () => {
        await result.current.join();
      });

      expect(result.current.inCall).toBe(true);
      expect(audioCallMap.has(`participant:${clientId}`)).toBe(true);

      // Then leave
      act(() => {
        result.current.leave();
      });

      console.log('[TEST] After leave:', {
        inCall: result.current.inCall,
        hasParticipantInMap: audioCallMap.has(`participant:${clientId}`),
      });

      expect(result.current.inCall).toBe(false);
      expect(audioCallMap.has(`participant:${clientId}`)).toBe(false);
    });

    it('handles leave when not in call gracefully', () => {
      console.log('[TEST] Testing leave when not in call');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      // Should not throw
      act(() => {
        result.current.leave();
      });

      console.log('[TEST] Leave when not in call completed without error');
      expect(result.current.inCall).toBe(false);
    });

    it('handles leave when map is null', async () => {
      console.log('[TEST] Testing leave with null map');
      // Start with valid map, then test leave behavior
      const { result, rerender } = renderHook(({ map }) => useAudioCall(map, clientId, userInfo), {
        initialProps: { map: audioCallMap as YMapLike | null },
      });

      await act(async () => {
        await result.current.join();
      });

      // Simulate map becoming null (edge case)
      rerender({ map: null });

      // Should not throw
      act(() => {
        result.current.leave();
      });

      console.log('[TEST] Leave with null map completed without error');
      expect(result.current.inCall).toBe(false);
    });
  });

  describe('toggleMute()', () => {
    it('toggles mute state and updates map entry', async () => {
      console.log('[TEST] Testing toggleMute');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      expect(result.current.localMuted).toBe(false);

      act(() => {
        result.current.toggleMute();
      });

      console.log('[TEST] After first toggleMute:', {
        localMuted: result.current.localMuted,
        mapEntry: audioCallMap.get(`participant:${clientId}`),
      });

      expect(result.current.localMuted).toBe(true);
      const entry = audioCallMap.get(`participant:${clientId}`) as any;
      expect(entry.muted).toBe(true);

      act(() => {
        result.current.toggleMute();
      });

      console.log('[TEST] After second toggleMute:', { localMuted: result.current.localMuted });
      expect(result.current.localMuted).toBe(false);
    });

    it('toggleMute works even when not in call (store update only)', () => {
      console.log('[TEST] Testing toggleMute when not in call');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      act(() => {
        result.current.toggleMute();
      });

      console.log('[TEST] toggleMute when not in call:', { localMuted: result.current.localMuted });
      expect(result.current.localMuted).toBe(true);
    });
  });

  describe('togglePanel()', () => {
    it('toggles panel open state', () => {
      console.log('[TEST] Testing togglePanel');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      expect(result.current.panelOpen).toBe(false);

      act(() => {
        result.current.togglePanel();
      });

      console.log('[TEST] After first togglePanel:', { panelOpen: result.current.panelOpen });
      expect(result.current.panelOpen).toBe(true);

      act(() => {
        result.current.togglePanel();
      });

      console.log('[TEST] After second togglePanel:', { panelOpen: result.current.panelOpen });
      expect(result.current.panelOpen).toBe(false);
    });
  });

  describe('Yjs observer - participant changes', () => {
    it('adds participant when new participant joins the map', async () => {
      console.log('[TEST] Testing observer for new participant');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      // Simulate another participant joining
      const newParticipant = {
        userId: 'new-user',
        clientId: 'new-client',
        name: 'New User',
        muted: false,
        joinedAt: Date.now(),
      };

      act(() => {
        audioCallMap.set('participant:new-client', newParticipant);
      });

      await waitFor(() => {
        return result.current.participants['new-client'] !== undefined;
      });

      console.log('[TEST] After new participant joined:', {
        participantCount: Object.keys(result.current.participants).length,
        newParticipant: result.current.participants['new-client'],
      });

      expect(result.current.participants['new-client']).toBeDefined();
      expect(result.current.participants['new-client'].name).toBe('New User');
    });

    it('removes participant when they leave the map', async () => {
      console.log('[TEST] Testing observer for participant leave');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      // Add a participant first
      const otherParticipant = {
        userId: 'other-user',
        clientId: 'other-client',
        name: 'Other User',
        muted: false,
        joinedAt: Date.now() - 5000,
      };
      audioCallMap.set('participant:other-client', otherParticipant);

      await act(async () => {
        await result.current.join();
      });

      await waitFor(() => {
        return result.current.participants['other-client'] !== undefined;
      });

      console.log('[TEST] Participant present:', Object.keys(result.current.participants));

      // Remove the participant
      act(() => {
        audioCallMap.delete('participant:other-client');
      });

      await waitFor(() => {
        return result.current.participants['other-client'] === undefined;
      });

      console.log('[TEST] After participant left:', Object.keys(result.current.participants));
      expect(result.current.participants['other-client']).toBeUndefined();
    });

    it('updates participant when their entry changes (mute status)', async () => {
      console.log('[TEST] Testing observer for participant update');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      const otherParticipant = {
        userId: 'other-user',
        clientId: 'other-client',
        name: 'Other User',
        muted: false,
        joinedAt: Date.now() - 5000,
      };
      audioCallMap.set('participant:other-client', otherParticipant);

      await act(async () => {
        await result.current.join();
      });

      await waitFor(() => {
        return result.current.participants['other-client'] !== undefined;
      });

      expect(result.current.participants['other-client'].muted).toBe(false);

      // Update mute status
      act(() => {
        audioCallMap.set('participant:other-client', { ...otherParticipant, muted: true });
      });

      await waitFor(() => {
        return result.current.participants['other-client']?.muted === true;
      });

      console.log('[TEST] After mute update:', result.current.participants['other-client']);
      expect(result.current.participants['other-client'].muted).toBe(true);
    });
  });

  describe('cleanup on unmount', () => {
    it('cleans up when component unmounts while in call', async () => {
      console.log('[TEST] Testing cleanup on unmount');
      const { result, unmount } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      expect(audioCallMap.has(`participant:${clientId}`)).toBe(true);

      // Unmount
      unmount();

      console.log('[TEST] After unmount:', {
        hasParticipantInMap: audioCallMap.has(`participant:${clientId}`),
      });

      // Participant should be removed from map on unmount
      expect(audioCallMap.has(`participant:${clientId}`)).toBe(false);
    });
  });

  describe('error handling in signaling', () => {
    it('handles ICE candidate error gracefully (non-fatal)', async () => {
      console.log('[TEST] Testing ICE candidate error handling');
      const { result } = renderHook(() => useAudioCall(audioCallMap, clientId, userInfo));

      await act(async () => {
        await result.current.join();
      });

      // Simulate receiving an ICE candidate signal before connection is established
      // This should be caught and not crash
      const iceSignal = {
        type: 'ice',
        payload: { candidate: 'invalid-candidate' },
        ts: Date.now(),
      };

      act(() => {
        audioCallMap.set(`signal:unknown-client:${clientId}`, iceSignal);
      });

      // Should not throw, state should remain stable
      console.log('[TEST] After ICE signal with no peer:', {
        inCall: result.current.inCall,
        error: result.current.error,
      });

      expect(result.current.inCall).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });
});
