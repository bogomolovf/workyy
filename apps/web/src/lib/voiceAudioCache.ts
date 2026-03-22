/**
 * SessionStorage-backed cache for voice audio data.
 * Persists across HMR, re-renders, and component remounts (until tab close).
 */

const VOICE_AUDIO_STORAGE_KEY = 'workyy_voice_audio_cache';

type VoiceAudioEntry = { audioData: string; duration: number; mimeType: string };

function getVoiceAudioFromStorage(nodeId: string): VoiceAudioEntry | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const cached = sessionStorage.getItem(`${VOICE_AUDIO_STORAGE_KEY}_${nodeId}`);
    return cached ? JSON.parse(cached) : undefined;
  } catch {
    return undefined;
  }
}

function setVoiceAudioToStorage(nodeId: string, data: VoiceAudioEntry) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${VOICE_AUDIO_STORAGE_KEY}_${nodeId}`, JSON.stringify(data));
  } catch {
    /* quota exceeded or other error */
  }
}

function getVoiceAudioKeysFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(VOICE_AUDIO_STORAGE_KEY + '_')) {
        keys.push(key.replace(VOICE_AUDIO_STORAGE_KEY + '_', ''));
      }
    }
    return keys;
  } catch {
    return [];
  }
}

export const globalVoiceAudioCache = {
  get: getVoiceAudioFromStorage,
  set: setVoiceAudioToStorage,
  keys: getVoiceAudioKeysFromStorage,
  get size() {
    return getVoiceAudioKeysFromStorage().length;
  },
};
