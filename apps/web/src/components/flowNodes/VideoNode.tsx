'use client';

import { Play, Pause, SpeakerHigh, SpeakerSlash, Trash, VideoCamera } from '@phosphor-icons/react';
import { useState, useCallback, useMemo, useRef } from 'react';
import ReactPlayer from 'react-player';
import { NodeResizer, type NodeProps, useStore } from 'reactflow';

// Get actual node dimensions from React Flow internal state
function useNodeDimensions(id: string) {
  const node = useStore((state) => state.nodeInternals.get(id));
  return {
    width: node?.width || 0,
    height: node?.height || 0,
  };
}

export type VideoNodeData = {
  url?: string;
  originalName?: string;
  fileId?: string;
  width?: number;
  height?: number;
  // Callbacks
  onDelete?: (id: string) => void;
};

export function VideoNode({ id, data, selected }: NodeProps<VideoNodeData>) {
  const { url, originalName, fileId } = data ?? {};
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // Start muted to avoid autoplay issues
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [ready, setReady] = useState(false);
  const playerRef = useRef<ReactPlayer>(null);

  // Get actual dimensions from React Flow
  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? 400);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? 300);

  const handlePlayPause = useCallback(() => {
    setPlaying((prev) => !prev);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const handleDelete = useCallback(() => {
    data?.onDelete?.(id);
  }, [data, id]);

  const handleProgress = useCallback((state: { played: number; playedSeconds: number }) => {
    setProgress(state.played * 100);
  }, []);

  const handleDuration = useCallback((dur: number) => {
    setDuration(dur);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    playerRef.current?.seekTo(newProgress / 100);
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
    setVideoError(false);
  }, []);

  const handleError = useCallback(() => {
    setVideoError(true);
    setReady(false);
  }, []);

  // Format time (seconds to MM:SS)
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Resolve URL (handle relative paths)
  const resolvedUrl = useMemo(() => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    // Relative path - prepend API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [url]);

  const hasVideo = !!resolvedUrl && !videoError;

  return (
    <div
      className="workyy-video-node relative bg-slate-900 rounded-lg shadow-md overflow-hidden"
      style={{ width: finalWidth, height: finalHeight }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        keepAspectRatio={false}
        lineClassName="!border-purple-400"
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: '2px solid #a855f7',
          background: '#ffffff',
        }}
      />

      {/* Delete button */}
      {selected && data?.onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 z-20 p-1.5 bg-white/90 hover:bg-red-50 rounded-md shadow-sm transition-colors"
          title="Delete video"
        >
          <Trash size={16} className="text-red-500" />
        </button>
      )}

      {/* Video content */}
      {hasVideo ? (
        <div className="w-full h-full flex flex-col">
          {/* Player area */}
          <div className="flex-1 relative">
            <ReactPlayer
              ref={playerRef}
              url={resolvedUrl}
              playing={playing}
              muted={muted}
              width="100%"
              height="100%"
              onProgress={handleProgress}
              onDuration={handleDuration}
              onReady={handleReady}
              onError={handleError}
              style={{ position: 'absolute', top: 0, left: 0 }}
              config={{
                file: {
                  attributes: {
                    style: { objectFit: 'contain' },
                  },
                },
              }}
            />

            {/* Loading overlay */}
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="animate-pulse text-slate-400">Loading video...</div>
              </div>
            )}

            {/* Play/Pause overlay on click */}
            <div className="absolute inset-0 cursor-pointer" onClick={handlePlayPause} />
          </div>

          {/* Controls bar */}
          <div className="h-10 px-3 flex items-center gap-2 bg-slate-800/90 nodrag">
            {/* Play/Pause button */}
            <button
              onClick={handlePlayPause}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause size={18} className="text-white" weight="fill" />
              ) : (
                <Play size={18} className="text-white" weight="fill" />
              )}
            </button>

            {/* Progress bar */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-slate-400 min-w-[40px]">
                {formatTime((progress / 100) * duration)}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={handleSeek}
                className="flex-1 h-1 bg-slate-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-xs text-slate-400 min-w-[40px]">{formatTime(duration)}</span>
            </div>

            {/* Mute button */}
            <button
              onClick={handleMuteToggle}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <SpeakerSlash size={18} className="text-slate-400" />
              ) : (
                <SpeakerHigh size={18} className="text-white" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400">
          <VideoCamera size={48} weight="thin" />
          <span className="mt-2 text-sm">{videoError ? 'Failed to load video' : 'No video'}</span>
        </div>
      )}

      {/* File name */}
      {originalName && hasVideo && (
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded truncate max-w-[60%]">
          {originalName}
        </div>
      )}
    </div>
  );
}

export default VideoNode;
