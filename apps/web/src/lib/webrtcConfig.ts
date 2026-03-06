/**
 * WebRTC configuration helpers for audio calls.
 *
 * ICE servers are read from NEXT_PUBLIC_ICE_SERVERS env var (JSON array).
 * Falls back to Google STUN servers for development.
 */

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function parseIceServers(): RTCIceServer[] {
  const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as RTCIceServer[];
    }
  } catch {
    console.warn('[webrtcConfig] Failed to parse NEXT_PUBLIC_ICE_SERVERS, using defaults');
  }
  return DEFAULT_ICE_SERVERS;
}

/**
 * Returns an RTCConfiguration with ICE servers from env or defaults.
 */
export function getRTCConfiguration(): RTCConfiguration {
  return {
    iceServers: parseIceServers(),
    // Gather only relay candidates when TURN is available (production);
    // for dev with STUN-only, leave as 'all'
    iceTransportPolicy: 'all',
  };
}

/**
 * Request microphone access with echo cancellation and noise suppression.
 * Returns the MediaStream or throws.
 */
export async function requestMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}
