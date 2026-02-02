'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { type NodeProps } from 'reactflow';
import WaveSurfer from 'wavesurfer.js';

// Voice message data structure
type VoiceData = {
  audioData: string | null; // Base64 encoded audio
  duration: number; // Duration in seconds
  mimeType: string; // 'audio/webm' or 'audio/mp4'
  recordedBy?: { // Who recorded this message
    id: string;
    name: string;
  };
  recordedAt?: number; // Timestamp when recorded
  currentUser?: { // Current user info for new recordings
    id: string;
    name: string;
  };
  onChangeAudio?: (
    id: string,
    data: { 
      audioData: string; 
      duration: number; 
      mimeType: string;
      recordedBy?: { id: string; name: string };
      recordedAt?: number;
    },
  ) => void;
};

// Maximum recording duration (5 minutes in milliseconds)
const MAX_RECORDING_DURATION = 5 * 60 * 1000;

// Playback speed options
const SPEED_OPTIONS = [1, 1.5, 2] as const;
type SpeedOption = (typeof SPEED_OPTIONS)[number];

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Convert Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Get supported MIME type for recording
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  if (MediaRecorder.isTypeSupported('audio/ogg')) {
    return 'audio/ogg';
  }
  return 'audio/webm';
}

// Microphone icon component
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

// Stop icon component
function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

// Play icon component
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}

// Pause icon component
function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function VoiceNode({ id, data, selected }: NodeProps<VoiceData>) {
  const { 
    audioData, 
    duration: savedDuration, 
    mimeType: savedMimeType, 
    recordedBy,
    recordedAt,
    currentUser,
    onChangeAudio 
  } = data;

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(savedDuration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<SpeedOption>(1);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  // Permission state
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [microphoneNotFound, setMicrophoneNotFound] = useState(false);

  // Initialize WaveSurfer when audio data is available
  useEffect(() => {
    if (!audioData || !waveformRef.current) return;

    // Create audio URL from base64
    const audioUrl = `data:${savedMimeType || 'audio/webm'};base64,${audioData}`;

    // Track if this effect has been cleaned up
    let isDestroyed = false;

    // Initialize WaveSurfer
    let wavesurfer: WaveSurfer | null = null;
    
    try {
      wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#CBD5E1',
        progressColor: '#3B82F6',
        cursorColor: 'transparent',
        barWidth: 3,
        barGap: 2,
        barRadius: 2,
        height: 36,
        normalize: true,
        backend: 'WebAudio',
      });
    } catch {
      // Ignore creation errors
      return;
    }

    const ws = wavesurfer;

    // Handle errors silently (AbortError when component unmounts during load)
    ws.on('error', () => {
      // Ignore errors - likely AbortError from unmount during load
    });

    // Load audio and catch any errors
    ws.load(audioUrl).catch(() => {
      // Ignore load errors (AbortError when component unmounts)
    });

    ws.on('ready', () => {
      if (isDestroyed) return;
      setDuration(ws.getDuration());
      wavesurferRef.current = ws;
    });

    ws.on('audioprocess', () => {
      if (isDestroyed) return;
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => !isDestroyed && setIsPlaying(true));
    ws.on('pause', () => !isDestroyed && setIsPlaying(false));
    ws.on('finish', () => {
      if (isDestroyed) return;
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      isDestroyed = true;
      // Stop playback first to prevent async errors
      try {
        ws.stop();
      } catch {
        // Ignore stop errors
      }
      // Use setTimeout to allow pending operations to complete
      setTimeout(() => {
        try {
          ws.destroy();
        } catch {
          // Ignore AbortError when wavesurfer is already destroyed or not fully initialized
        }
      }, 0);
      wavesurferRef.current = null;
    };
  }, [audioData, savedMimeType]);

  // Update playback speed
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setPermissionDenied(false);
      setMicrophoneNotFound(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      // Set up audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate audio level
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average / 255);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Cancel animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Close audio context
        audioContext.close();

        // Create blob and convert to base64
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const base64Data = await blobToBase64(blob);

        // Calculate duration
        const finalDuration = (Date.now() - recordingStartTimeRef.current) / 1000;

        // Save to node data with user info
        onChangeAudio?.(id, {
          audioData: base64Data,
          duration: finalDuration,
          mimeType,
          recordedBy: currentUser,
          recordedAt: Date.now(),
        });

        setRecordingDuration(0);
        setAudioLevel(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Update recording duration
      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingDuration(elapsed / 1000);

        // Auto-stop at max duration
        if (elapsed >= MAX_RECORDING_DURATION) {
          stopRecording();
        }
      }, 100);
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorName = (error as Error).name;
      if (errorName === 'NotAllowedError') {
        setPermissionDenied(true);
        setMicrophoneNotFound(false);
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setMicrophoneNotFound(true);
        setPermissionDenied(false);
      }
    }
  }, [id, onChangeAudio]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  // Cycle playback speed
  const cycleSpeed = useCallback(() => {
    setPlaybackSpeed((current) => {
      const currentIndex = SPEED_OPTIONS.indexOf(current);
      const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
      return SPEED_OPTIONS[nextIndex];
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Recording bars animation
  const recordingBars = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const baseHeight = 0.2 + Math.random() * 0.3;
      const scale = audioLevel * 2;
      const height = Math.min(1, baseHeight + scale * Math.sin((i / 20) * Math.PI));
      return height;
    });
  }, [audioLevel]);

  // Render empty state (no audio, not recording)
  if (!audioData && !isRecording) {
    return (
      <div
        className={`
          flex items-center gap-3 rounded-[20px] bg-slate-100 px-4 py-3
          transition-shadow duration-200
          ${selected ? 'shadow-lg ring-2 ring-blue-400' : 'shadow-md'}
        `}
        style={{ minWidth: 200 }}
      >
        <button
          onClick={startRecording}
          className="nodrag flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          title="Нажмите для записи"
        >
          <MicrophoneIcon className="h-5 w-5" />
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">Голосовое сообщение</span>
          {permissionDenied ? (
            <span className="text-xs text-red-500">Доступ к микрофону запрещён</span>
          ) : microphoneNotFound ? (
            <span className="text-xs text-red-500">Микрофон не найден</span>
          ) : (
            <span className="text-xs text-slate-500">Нажмите для записи</span>
          )}
        </div>
      </div>
    );
  }

  // Render recording state
  if (isRecording) {
    return (
      <div
        className={`
          flex items-center gap-3 rounded-[20px] bg-red-50 px-4 py-3
          transition-shadow duration-200
          ${selected ? 'shadow-lg ring-2 ring-red-400' : 'shadow-md'}
        `}
        style={{ minWidth: 280 }}
      >
        <button
          onClick={stopRecording}
          className="nodrag flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600 active:bg-red-700"
          title="Остановить запись"
        >
          <StopIcon className="h-5 w-5" />
        </button>

        {/* Recording visualization */}
        <div className="flex flex-1 items-center gap-0.5">
          {recordingBars.map((height, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-red-400 transition-all duration-75"
              style={{ height: `${height * 36}px` }}
            />
          ))}
        </div>

        <span className="min-w-[48px] text-right text-sm font-medium text-red-600">
          {formatTime(recordingDuration)}
        </span>
      </div>
    );
  }

  // Get initials from user name
  const getInitials = (name: string) => {
    const parts = name.split(/[\s@.]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Render playback state (Telegram-style)
  return (
    <div
      className={`
        flex items-center gap-2 rounded-full bg-slate-100 py-2 pl-2 pr-3
        transition-shadow duration-200
        ${selected ? 'shadow-lg ring-2 ring-blue-400' : 'shadow-md'}
      `}
      style={{ minWidth: 280 }}
    >
      {/* Play/Pause button with user avatar overlay */}
      <div className="relative flex-shrink-0">
        <button
          onClick={togglePlayback}
          className="nodrag flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600 active:bg-blue-700"
          title={isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
          {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
        </button>
        {/* User avatar badge - bottom right corner of play button */}
        {recordedBy && (
          <div
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white ring-2 ring-slate-100"
            title={`Записал: ${recordedBy.name}`}
          >
            {getInitials(recordedBy.name)}
          </div>
        )}
      </div>

      {/* Waveform */}
      <div ref={waveformRef} className="nodrag min-w-[120px] flex-1 cursor-pointer" />

      {/* Duration */}
      <span className="min-w-[40px] text-right text-xs text-slate-500">
        {formatTime(isPlaying ? currentTime : duration)}
      </span>

      {/* Speed button */}
      <button
        onClick={cycleSpeed}
        className="nodrag flex h-6 min-w-[32px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300"
        title="Изменить скорость"
      >
        {playbackSpeed}x
      </button>
    </div>
  );
}
