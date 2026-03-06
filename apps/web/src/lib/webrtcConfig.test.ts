import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRTCConfiguration, requestMicrophoneStream } from './webrtcConfig';

describe('webrtcConfig', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ICE_SERVERS;

  beforeEach(() => {
    // Reset env before each test
    delete process.env.NEXT_PUBLIC_ICE_SERVERS;
    console.log('[webrtcConfig.test] Environment reset');
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_ICE_SERVERS = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ICE_SERVERS;
    }
    vi.restoreAllMocks();
  });

  describe('getRTCConfiguration', () => {
    it('returns default STUN servers when NEXT_PUBLIC_ICE_SERVERS is not set', () => {
      const config = getRTCConfiguration();

      console.log('[TEST] getRTCConfiguration without env:', JSON.stringify(config, null, 2));
      expect(config.iceServers).toBeDefined();
      expect(config.iceServers!.length).toBeGreaterThanOrEqual(1);
      expect(config.iceServers![0].urls).toContain('stun.l.google.com');
      expect(config.iceTransportPolicy).toBe('all');
    });

    it('returns default STUN servers when NEXT_PUBLIC_ICE_SERVERS is invalid JSON', () => {
      process.env.NEXT_PUBLIC_ICE_SERVERS = 'not-valid-json';

      const config = getRTCConfiguration();

      console.log('[TEST] getRTCConfiguration with invalid JSON:', JSON.stringify(config, null, 2));
      expect(config.iceServers).toBeDefined();
      expect(config.iceServers![0].urls).toContain('stun.l.google.com');
    });

    it('returns default STUN servers when NEXT_PUBLIC_ICE_SERVERS is empty array', () => {
      process.env.NEXT_PUBLIC_ICE_SERVERS = '[]';

      const config = getRTCConfiguration();

      console.log('[TEST] getRTCConfiguration with empty array:', JSON.stringify(config, null, 2));
      expect(config.iceServers).toBeDefined();
      expect(config.iceServers!.length).toBeGreaterThanOrEqual(1);
    });

    it('uses custom ICE servers from valid NEXT_PUBLIC_ICE_SERVERS', () => {
      const customServers = [
        { urls: 'stun:custom.stun.server:3478' },
        { urls: 'turn:custom.turn.server:3478', username: 'user', credential: 'pass' },
      ];
      process.env.NEXT_PUBLIC_ICE_SERVERS = JSON.stringify(customServers);

      const config = getRTCConfiguration();

      console.log(
        '[TEST] getRTCConfiguration with custom servers:',
        JSON.stringify(config, null, 2),
      );
      expect(config.iceServers).toEqual(customServers);
    });
  });

  describe('requestMicrophoneStream', () => {
    it('calls getUserMedia with correct constraints and returns stream on success', async () => {
      const mockStream = { id: 'mock-stream' } as unknown as MediaStream;
      const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

      // Mock navigator.mediaDevices
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: mockGetUserMedia,
          },
        },
        writable: true,
      });

      console.log('[TEST] requestMicrophoneStream - calling...');
      const stream = await requestMicrophoneStream();

      console.log('[TEST] requestMicrophoneStream - got stream:', stream.id);
      console.log('[TEST] getUserMedia called with:', mockGetUserMedia.mock.calls[0]);

      expect(stream).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    });

    it('throws when getUserMedia rejects (permission denied)', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      const mockGetUserMedia = vi.fn().mockRejectedValue(permissionError);

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: mockGetUserMedia,
          },
        },
        writable: true,
      });

      console.log('[TEST] requestMicrophoneStream - expecting permission denied error...');

      await expect(requestMicrophoneStream()).rejects.toThrow('Permission denied');
      console.log('[TEST] requestMicrophoneStream - correctly threw permission denied error');
    });

    it('throws when no microphone device found', async () => {
      const noDeviceError = new DOMException('Requested device not found', 'NotFoundError');
      const mockGetUserMedia = vi.fn().mockRejectedValue(noDeviceError);

      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: mockGetUserMedia,
          },
        },
        writable: true,
      });

      console.log('[TEST] requestMicrophoneStream - expecting no device error...');

      await expect(requestMicrophoneStream()).rejects.toThrow('Requested device not found');
      console.log('[TEST] requestMicrophoneStream - correctly threw no device error');
    });

    it('throws when mediaDevices is not available (insecure context)', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: undefined,
        },
        writable: true,
      });

      console.log('[TEST] requestMicrophoneStream - expecting mediaDevices undefined error...');

      await expect(requestMicrophoneStream()).rejects.toThrow();
      console.log('[TEST] requestMicrophoneStream - correctly threw when mediaDevices undefined');
    });
  });
});
