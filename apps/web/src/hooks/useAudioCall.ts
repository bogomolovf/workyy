import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as YMap } from 'yjs';
import { getRTCConfiguration, requestMicrophoneStream } from '../lib/webrtcConfig';
import { useAudioCallStore } from '../state/audioCallStore';

// ─── Yjs audioCallMap key conventions ───────────────────────────────
//
//  participant:<clientId>  → { userId, clientId, name, muted, joinedAt }
//  signal:<from>:<to>      → { type: 'offer'|'answer'|'ice', payload: ... , ts }
//
// Participants write their own entry on join and delete it on leave.
// Signals are ephemeral: written by sender, consumed (deleted) by receiver.
// ────────────────────────────────────────────────────────────────────

type ParticipantEntry = {
  userId: string;
  clientId: string;
  name: string;
  muted: boolean;
  joinedAt: number;
};

type SignalEntry = {
  type: 'offer' | 'answer' | 'ice';
  payload: unknown; // RTCSessionDescriptionInit | RTCIceCandidateInit
  ts: number;
};

const PARTICIPANT_PREFIX = 'participant:';
const SIGNAL_PREFIX = 'signal:';

// ─── Stable action references ────────────────────────────────────────
// Zustand actions are stable across renders — extract them once at module
// level so they never appear in dependency arrays or cause re-renders.
const storeActions = () => {
  const s = useAudioCallStore.getState();
  return {
    joinCall: s.joinCall,
    leaveCall: s.leaveCall,
    toggleMute: s.toggleMute,
    addParticipant: s.addParticipant,
    removeParticipant: s.removeParticipant,
    updateParticipant: s.updateParticipant,
    setError: s.setError,
    reset: s.reset,
    togglePanel: s.togglePanel,
  };
};

/**
 * Hook that manages the full audio-call lifecycle for a board.
 *
 * Usage:
 *   const call = useAudioCall(audioCallMap, clientId, userInfo);
 *   call.join();   // start
 *   call.leave();  // stop
 *   call.toggleMute();
 *
 * Internals:
 *   - Writes participant entry to Yjs audioCallMap on join
 *   - Observes map for new participants → creates RTCPeerConnection per peer
 *   - Exchanges SDP offers/answers and ICE candidates through the map
 *   - Cleans up on leave or unmount
 */
export function useAudioCall(
  audioCallMap: YMap<unknown> | null,
  clientId: string | undefined,
  userInfo?: { userId?: string; userName?: string },
) {
  // ─── Subscribe to only the state slices we expose ──────────────────
  const inCall = useAudioCallStore((s) => s.inCall);
  const localMuted = useAudioCallStore((s) => s.localMuted);
  const participants = useAudioCallStore((s) => s.participants);
  const panelOpen = useAudioCallStore((s) => s.panelOpen);
  const error = useAudioCallStore((s) => s.error);

  // Track active call participants count (even when not in call)
  const [activeCallParticipantCount, setActiveCallParticipantCount] = useState(0);

  // Refs to avoid stale closures in Yjs observer
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCallMapRef = useRef(audioCallMap);
  const clientIdRef = useRef(clientId);
  const userInfoRef = useRef(userInfo);

  // Keep refs up-to-date
  useEffect(() => {
    audioCallMapRef.current = audioCallMap;
  }, [audioCallMap]);
  useEffect(() => {
    clientIdRef.current = clientId;
  }, [clientId]);
  useEffect(() => {
    userInfoRef.current = userInfo;
  }, [userInfo]);

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Stop all tracks on the local stream */
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  /** Close and remove a single peer connection */
  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    storeActions().removeParticipant(peerId);
  }, []);

  /** Close all peer connections */
  const closeAllPeers = useCallback(() => {
    for (const [id] of peerConnectionsRef.current) {
      closePeer(id);
    }
  }, [closePeer]);

  // ─── Create PeerConnection to a remote participant ────────────────

  const createPeerConnection = useCallback(
    (remoteClientId: string, remoteEntry: ParticipantEntry) => {
      const map = audioCallMapRef.current;
      const myId = clientIdRef.current;
      if (!map || !myId) return null;

      const config = getRTCConfiguration();
      const pc = new RTCPeerConnection(config);

      // Add local audio tracks
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      // Handle incoming remote audio → play through <audio>
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          let audio = document.getElementById(`audio-${remoteClientId}`) as HTMLAudioElement | null;
          if (!audio) {
            audio = document.createElement('audio');
            audio.id = `audio-${remoteClientId}`;
            audio.autoplay = true;
            audio.style.display = 'none';
            document.body.appendChild(audio);
          }
          audio.srcObject = remoteStream;
        }
      };

      // Send ICE candidates through Yjs
      pc.onicecandidate = (event) => {
        if (event.candidate && map) {
          const key = `${SIGNAL_PREFIX}${myId}:${remoteClientId}`;
          map.set(key, {
            type: 'ice',
            payload: event.candidate.toJSON(),
            ts: Date.now(),
          } satisfies SignalEntry);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          closePeer(remoteClientId);
        }
      };

      peerConnectionsRef.current.set(remoteClientId, pc);

      storeActions().addParticipant({
        odielId: remoteEntry.userId,
        clientId: remoteClientId,
        name: remoteEntry.name,
        muted: remoteEntry.muted,
        speaking: false,
      });

      return pc;
    },
    [closePeer],
  );

  // ─── Signaling: initiate offer to a peer ──────────────────────────

  const sendOffer = useCallback(async (remoteClientId: string, pc: RTCPeerConnection) => {
    const map = audioCallMapRef.current;
    const myId = clientIdRef.current;
    if (!map || !myId) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    map.set(`${SIGNAL_PREFIX}${myId}:${remoteClientId}`, {
      type: 'offer',
      payload: pc.localDescription!.toJSON(),
      ts: Date.now(),
    } satisfies SignalEntry);
  }, []);

  // ─── Signaling: handle incoming signal ────────────────────────────

  const handleSignal = useCallback(
    async (from: string, signal: SignalEntry) => {
      const myId = clientIdRef.current;
      const map = audioCallMapRef.current;
      if (!myId || !map) return;

      let pc = peerConnectionsRef.current.get(from);

      if (signal.type === 'offer') {
        if (!pc) {
          const participantKey = `${PARTICIPANT_PREFIX}${from}`;
          const entry = map.get(participantKey) as ParticipantEntry | undefined;
          if (!entry) return;
          pc = createPeerConnection(from, entry);
          if (!pc) return;
        }

        await pc.setRemoteDescription(
          new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        map.set(`${SIGNAL_PREFIX}${myId}:${from}`, {
          type: 'answer',
          payload: pc.localDescription!.toJSON(),
          ts: Date.now(),
        } satisfies SignalEntry);
      } else if (signal.type === 'answer') {
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit),
          );
        }
      } else if (signal.type === 'ice') {
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
          } catch {
            // Non-fatal: ICE candidate may arrive before remote description
          }
        }
      }

      // Consume (delete) the signal so it doesn't trigger again
      const signalKey = `${SIGNAL_PREFIX}${from}:${myId}`;
      if (map.has(signalKey)) {
        map.delete(signalKey);
      }
    },
    [createPeerConnection],
  );

  // ─── Count participants in call (works even when not joined) ──────

  const countParticipantsInMap = useCallback(() => {
    if (!audioCallMap) return 0;
    let count = 0;
    for (const key of audioCallMap.keys()) {
      if (typeof key === 'string' && key.startsWith(PARTICIPANT_PREFIX)) {
        count++;
      }
    }
    return count;
  }, [audioCallMap]);

  // Update participant count on map changes (always active)
  useEffect(() => {
    if (!audioCallMap) {
      setActiveCallParticipantCount(0);
      return;
    }

    // Initial count
    setActiveCallParticipantCount(countParticipantsInMap());

    const countObserver = () => {
      setActiveCallParticipantCount(countParticipantsInMap());
    };

    audioCallMap.observe(countObserver);
    return () => {
      audioCallMap.unobserve(countObserver);
    };
  }, [audioCallMap, countParticipantsInMap]);

  // ─── Observe Yjs audioCallMap for signaling (only when in call) ───

  useEffect(() => {
    if (!audioCallMap || !clientId) return;

    const observer = (event: any) => {
      const myId = clientIdRef.current;
      if (!myId) return;
      const currentlyInCall = useAudioCallStore.getState().inCall;
      if (!currentlyInCall) return;

      for (const [key, change] of event.changes.keys) {
        // New participant joined
        if (key.startsWith(PARTICIPANT_PREFIX) && change.action === 'add') {
          const remoteClientId = key.slice(PARTICIPANT_PREFIX.length);
          if (remoteClientId === myId) continue;
          if (peerConnectionsRef.current.has(remoteClientId)) continue;

          const entry = audioCallMap.get(key) as ParticipantEntry | undefined;
          if (!entry) continue;

          const pc = createPeerConnection(remoteClientId, entry);
          if (pc && myId < remoteClientId) {
            sendOffer(remoteClientId, pc).catch(console.error);
          }
        }

        // Participant left
        if (key.startsWith(PARTICIPANT_PREFIX) && change.action === 'delete') {
          const remoteClientId = key.slice(PARTICIPANT_PREFIX.length);
          closePeer(remoteClientId);
          const audio = document.getElementById(`audio-${remoteClientId}`);
          if (audio) audio.remove();
        }

        // Participant updated (e.g. muted changed)
        if (key.startsWith(PARTICIPANT_PREFIX) && change.action === 'update') {
          const remoteClientId = key.slice(PARTICIPANT_PREFIX.length);
          if (remoteClientId === myId) continue;
          const entry = audioCallMap.get(key) as ParticipantEntry | undefined;
          if (entry) {
            storeActions().updateParticipant(remoteClientId, {
              muted: entry.muted,
            });
          }
        }

        // Incoming signal addressed to us
        if (key.startsWith(SIGNAL_PREFIX)) {
          const parts = key.slice(SIGNAL_PREFIX.length).split(':');
          if (parts.length === 2) {
            const [from, to] = parts;
            if (to === myId) {
              const signal = audioCallMap.get(key) as SignalEntry | undefined;
              if (signal) {
                handleSignal(from, signal).catch(console.error);
              }
            }
          }
        }
      }
    };

    audioCallMap.observe(observer);
    return () => {
      audioCallMap.unobserve(observer);
    };
  }, [audioCallMap, clientId, createPeerConnection, sendOffer, closePeer, handleSignal]);

  // ─── Public API ───────────────────────────────────────────────────

  const join = useCallback(async () => {
    const map = audioCallMapRef.current;
    const myId = clientIdRef.current;
    const info = userInfoRef.current;
    if (!map || !myId) return;

    try {
      const stream = await requestMicrophoneStream();
      localStreamRef.current = stream;

      const entry: ParticipantEntry = {
        userId: info?.userId ?? myId,
        clientId: myId,
        name: info?.userName ?? 'Anonymous',
        muted: false,
        joinedAt: Date.now(),
      };
      map.set(`${PARTICIPANT_PREFIX}${myId}`, entry);

      storeActions().joinCall();

      // Connect to existing participants already in the call
      for (const [key, value] of map) {
        if (typeof key !== 'string') continue;
        if (!key.startsWith(PARTICIPANT_PREFIX)) continue;
        const remoteClientId = key.slice(PARTICIPANT_PREFIX.length);
        if (remoteClientId === myId) continue;

        const remoteEntry = value as ParticipantEntry;
        const pc = createPeerConnection(remoteClientId, remoteEntry);
        if (pc && myId < remoteClientId) {
          await sendOffer(remoteClientId, pc);
        }
      }
    } catch (err) {
      storeActions().setError(err instanceof Error ? err.message : 'Failed to join call');
    }
  }, [createPeerConnection, sendOffer]);

  const leave = useCallback(() => {
    const map = audioCallMapRef.current;
    const myId = clientIdRef.current;

    if (map && myId) {
      map.delete(`${PARTICIPANT_PREFIX}${myId}`);
      for (const key of map.keys()) {
        if (typeof key === 'string' && key.startsWith(`${SIGNAL_PREFIX}${myId}:`)) {
          map.delete(key);
        }
      }
    }

    closeAllPeers();
    stopLocalStream();
    storeActions().leaveCall();

    document.querySelectorAll('audio[id^="audio-"]').forEach((el) => el.remove());
  }, [closeAllPeers, stopLocalStream]);

  const toggleMute = useCallback(() => {
    storeActions().toggleMute();
    const newMuted = useAudioCallStore.getState().localMuted;

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = !newMuted;
      }
    }

    const map = audioCallMapRef.current;
    const myId = clientIdRef.current;
    if (map && myId) {
      const key = `${PARTICIPANT_PREFIX}${myId}`;
      const entry = map.get(key) as ParticipantEntry | undefined;
      if (entry) {
        map.set(key, { ...entry, muted: newMuted });
      }
    }
  }, []);

  // ─── Cleanup on unmount ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (useAudioCallStore.getState().inCall) {
        const map = audioCallMapRef.current;
        const myId = clientIdRef.current;
        if (map && myId) {
          map.delete(`${PARTICIPANT_PREFIX}${myId}`);
        }
      }
      closeAllPeers();
      stopLocalStream();
      storeActions().reset();
      document.querySelectorAll('audio[id^="audio-"]').forEach((el) => el.remove());
    };
    // Only depend on stable callbacks — NOT on store state
  }, [closeAllPeers, stopLocalStream]);

  return {
    join,
    leave,
    toggleMute,
    inCall,
    localMuted,
    participants,
    panelOpen,
    togglePanel: storeActions().togglePanel,
    error,
    /** Number of participants currently in call (updated even when not joined) */
    activeCallParticipantCount,
  };
}
