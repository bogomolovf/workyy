'use client';

import {
  CaretLeft,
  CaretRight,
  X,
  ArrowsOut,
  Broadcast,
  XCircle,
  Television,
  User,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Sidebar,
  Download,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as YMap } from 'yjs';
import {
  getBroadcastStateFromYjs,
  isBroadcastActive,
  DEFAULT_BROADCAST_STATE,
  type PresentationBroadcastState,
} from '../lib/presentationBroadcast';

const PresentationViewerPdf = dynamic(
  () => import('./PresentationViewerPdf').then((m) => m.PresentationViewerPdf),
  { ssr: false },
);

export type PresentationViewerProps = {
  nodeId: string;
  url: string;
  originalName?: string;
  mimeType?: string;
  onClose: () => void;
  /** Yjs map: key = presentationNodeId, value = broadcast state (synced) */
  presentationBroadcastsMap: YMap<unknown> | null;
  ydoc: { transact: (fn: () => void, origin?: unknown) => void } | null;
  clientId: string | null;
  userInfo: { userId?: string; userName?: string } | null;
  /** When true, open in "follow broadcast" mode (e.g. from "Join broadcast" button) */
  initialFollowMode?: boolean;
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PresentationViewer({
  nodeId,
  url,
  originalName,
  mimeType,
  onClose,
  presentationBroadcastsMap,
  ydoc,
  clientId,
  userInfo,
  initialFollowMode = false,
}: PresentationViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state (not synced)
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentSlideLocal, setCurrentSlideLocal] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [followMode, setFollowMode] = useState(initialFollowMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [broadcastTakenError, setBroadcastTakenError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [slideInputValue, setSlideInputValue] = useState('');
  const [showSlideInput, setShowSlideInput] = useState(false);

  // Broadcast state from Yjs (synced)
  const [broadcastState, setBroadcastState] = useState<PresentationBroadcastState | null>(null);

  const isPdf =
    mimeType === 'application/pdf' || (originalName ?? '').toLowerCase().endsWith('.pdf');
  const isPptx =
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    (originalName ?? '').toLowerCase().endsWith('.pptx');
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const fullUrl = url?.startsWith('/') ? `${apiBase}${url}` : url;

  // Subscribe to broadcast state for this node
  useEffect(() => {
    if (!presentationBroadcastsMap) return;
    const raw = presentationBroadcastsMap.get(nodeId);
    setBroadcastState(
      raw && typeof raw === 'object'
        ? {
            isActive: Boolean((raw as Record<string, unknown>).isActive),
            presenterUserId: String((raw as Record<string, unknown>).presenterUserId ?? ''),
            presenterName: String((raw as Record<string, unknown>).presenterName ?? ''),
            slideIndex: Number((raw as Record<string, unknown>).slideIndex) || 0,
            updatedAt: Number((raw as Record<string, unknown>).updatedAt) || 0,
          }
        : null,
    );
    const observer = () => {
      const next = getBroadcastStateFromYjs(presentationBroadcastsMap, nodeId);
      setBroadcastState(next ?? null);
    };
    presentationBroadcastsMap.observe(observer);
    return () => presentationBroadcastsMap.unobserve(observer);
  }, [presentationBroadcastsMap, nodeId]);

  const broadcastActive = isBroadcastActive(broadcastState);
  const amPresenter =
    Boolean(clientId && userInfo?.userId && broadcastState?.presenterUserId === userInfo.userId) &&
    broadcastActive;

  // Effective slide: when viewer in follow mode use broadcast; otherwise (private or presenter) use local
  const effectiveSlide = useMemo(() => {
    if (!amPresenter && followMode && broadcastActive && broadcastState != null) {
      const idx = Math.max(0, Math.min(broadcastState.slideIndex, (numPages ?? 1) - 1));
      return idx;
    }
    return Math.max(0, Math.min(currentSlideLocal, (numPages ?? 1) - 1));
  }, [amPresenter, followMode, broadcastActive, broadcastState, currentSlideLocal, numPages]);

  const totalSlides = numPages ?? 0;
  const displaySlide = totalSlides > 0 ? effectiveSlide + 1 : 0;

  // Sync local index when switching to follow mode or when broadcast slide changes
  useEffect(() => {
    if (followMode && broadcastActive && broadcastState != null) {
      setCurrentSlideLocal(broadcastState.slideIndex);
    }
  }, [followMode, broadcastActive, broadcastState?.slideIndex]);

  const navigateToSlide = useCallback(
    (slideIndex: number) => {
      const clamped = Math.max(0, Math.min(totalSlides - 1, slideIndex));
      if (amPresenter && ydoc && presentationBroadcastsMap && clientId) {
        ydoc.transact(() => {
          presentationBroadcastsMap.set(nodeId, {
            ...(broadcastState ?? DEFAULT_BROADCAST_STATE),
            isActive: true,
            presenterUserId: userInfo?.userId ?? '',
            presenterName: userInfo?.userName ?? 'User',
            slideIndex: clamped,
            updatedAt: Date.now(),
          });
        }, clientId);
      }
      setCurrentSlideLocal(clamped);
    },
    [
      amPresenter,
      ydoc,
      presentationBroadcastsMap,
      nodeId,
      clientId,
      broadcastState,
      userInfo,
      totalSlides,
    ],
  );

  const goPrev = useCallback(() => {
    navigateToSlide(effectiveSlide - 1);
  }, [navigateToSlide, effectiveSlide]);

  const goNext = useCallback(() => {
    navigateToSlide(effectiveSlide + 1);
  }, [navigateToSlide, effectiveSlide]);

  const goToSlide = useCallback(
    (page: number) => {
      navigateToSlide(page - 1);
    },
    [navigateToSlide],
  );

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const nextStep = ZOOM_STEPS.find((s) => s > z);
      return nextStep ?? z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const prevStep = [...ZOOM_STEPS].reverse().find((s) => s < z);
      return prevStep ?? z;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const startBroadcast = useCallback(() => {
    setBroadcastTakenError(null);
    if (!ydoc || !presentationBroadcastsMap || !clientId || !userInfo?.userId) return;
    const current = getBroadcastStateFromYjs(presentationBroadcastsMap, nodeId);
    if (isBroadcastActive(current) && current!.presenterUserId !== userInfo.userId) {
      setBroadcastTakenError(
        `Broadcast is already in progress by ${current!.presenterName || 'another user'}.`,
      );
      return;
    }
    ydoc.transact(() => {
      presentationBroadcastsMap.set(nodeId, {
        isActive: true,
        presenterUserId: userInfo.userId,
        presenterName: userInfo.userName ?? userInfo.userId ?? 'User',
        slideIndex: effectiveSlide,
        updatedAt: Date.now(),
      });
    }, clientId);
  }, [ydoc, presentationBroadcastsMap, nodeId, clientId, userInfo, effectiveSlide]);

  const endBroadcast = useCallback(() => {
    if (!ydoc || !presentationBroadcastsMap || !clientId) return;
    if (!amPresenter) return;
    ydoc.transact(() => {
      presentationBroadcastsMap.set(nodeId, {
        ...DEFAULT_BROADCAST_STATE,
        isActive: false,
      });
    }, clientId);
  }, [ydoc, presentationBroadcastsMap, nodeId, clientId, amPresenter]);

  const handleDownload = useCallback(() => {
    if (fullUrl) {
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = originalName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [fullUrl, originalName]);

  const handleSlideInputSubmit = useCallback(() => {
    const page = parseInt(slideInputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalSlides) {
      goToSlide(page);
    }
    setShowSlideInput(false);
    setSlideInputValue('');
  }, [slideInputValue, totalSlides, goToSlide]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle keys when typing in the slide input
      if (showSlideInput) return;

      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else {
          onClose();
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goPrev();
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        goNext();
        e.preventDefault();
        return;
      }
      // Zoom: Ctrl/Cmd + / -
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        zoomIn();
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        zoomOut();
        e.preventDefault();
        return;
      }
      // Reset zoom: Ctrl/Cmd + 0
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        setZoom(1);
        e.preventDefault();
        return;
      }
      // Toggle thumbnails: T
      if (e.key === 't' || e.key === 'T') {
        setShowThumbnails((v) => !v);
        e.preventDefault();
        return;
      }
      // Go to slide: G
      if (e.key === 'g' || e.key === 'G') {
        setShowSlideInput(true);
        e.preventDefault();
        return;
      }
      // Toggle fullscreen: F
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
        e.preventDefault();
      }
    },
    [onClose, goPrev, goNext, zoomIn, zoomOut, toggleFullscreen, showSlideInput],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(null);
    setLoadProgress(null);
  }, []);

  const handleLoadError = useCallback((err: Error) => {
    setLoadError(err?.message ?? 'Failed to load PDF');
    setLoadProgress(null);
  }, []);

  const handleLoadProgress = useCallback(({ loaded, total }: { loaded: number; total: number }) => {
    setLoadProgress({ loaded, total });
  }, []);

  if (!isPdf && !isPptx) {
    return (
      <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-4">
        <div className="relative max-h-full w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-900">Presentation</h2>
          <p className="mt-2 text-sm text-slate-600">
            Full-screen presentation viewer is available for PDF and PPTX. For other formats, open
            in a new tab.
          </p>
          <div className="mt-4 flex gap-2">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Open in new tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100000] flex flex-col bg-slate-900"
      data-presentation-viewer
    >
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 bg-slate-800 px-4 py-2 text-white">
        {/* Left: close + name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <span className="truncate text-sm font-medium text-slate-200" title={originalName}>
            {originalName ?? 'Presentation'}
          </span>
        </div>

        {/* Center: navigation + zoom */}
        <div className="flex items-center gap-1">
          {isPdf && (
            <>
              {/* Thumbnails toggle */}
              <button
                type="button"
                onClick={() => setShowThumbnails((v) => !v)}
                className={`rounded p-1.5 transition-colors ${
                  showThumbnails
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                }`}
                title="Toggle thumbnails (T)"
                aria-label="Toggle thumbnails"
              >
                <Sidebar size={18} />
              </button>

              <div className="mx-1 h-5 w-px bg-slate-600" />

              {/* Navigation */}
              <button
                type="button"
                onClick={goPrev}
                disabled={displaySlide <= 1}
                className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-40"
                title="Previous slide"
                aria-label="Previous slide"
              >
                <CaretLeft size={20} />
              </button>

              {/* Slide counter - click to open go-to input */}
              {showSlideInput ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSlideInputSubmit();
                  }}
                  className="flex items-center"
                >
                  <input
                    type="number"
                    min={1}
                    max={totalSlides}
                    value={slideInputValue}
                    onChange={(e) => setSlideInputValue(e.target.value)}
                    onBlur={handleSlideInputSubmit}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowSlideInput(false);
                        setSlideInputValue('');
                      }
                      e.stopPropagation();
                    }}
                    autoFocus
                    className="w-12 rounded bg-slate-700 px-2 py-1 text-center text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={String(displaySlide)}
                  />
                  <span className="mx-1 text-sm text-slate-400">/ {totalSlides || '-'}</span>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSlideInputValue(String(displaySlide));
                    setShowSlideInput(true);
                  }}
                  className="min-w-[4rem] rounded px-2 py-1 text-center text-sm text-slate-300 hover:bg-slate-700"
                  title="Go to slide (G)"
                  aria-live="polite"
                >
                  {displaySlide} / {totalSlides || '-'}
                </button>
              )}

              <button
                type="button"
                onClick={goNext}
                disabled={totalSlides > 0 && displaySlide >= totalSlides}
                className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-40"
                title="Next slide"
                aria-label="Next slide"
              >
                <CaretRight size={20} />
              </button>

              <div className="mx-1 h-5 w-px bg-slate-600" />

              {/* Zoom controls */}
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= ZOOM_STEPS[0]}
                className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-40"
                title="Zoom out (Ctrl+-)"
                aria-label="Zoom out"
              >
                <MagnifyingGlassMinus size={18} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="min-w-[3rem] rounded px-1.5 py-1 text-center text-xs text-slate-300 hover:bg-slate-700"
                title="Reset zoom (Ctrl+0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-40"
                title="Zoom in (Ctrl++)"
                aria-label="Zoom in"
              >
                <MagnifyingGlassPlus size={18} />
              </button>

              <div className="mx-1 h-5 w-px bg-slate-600" />
            </>
          )}
          {isPptx && <span className="text-sm text-slate-400">PPTX</span>}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white"
            title="Fullscreen (F)"
            aria-label="Fullscreen"
          >
            <ArrowsOut size={20} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-600 hover:text-white"
            title="Download"
            aria-label="Download"
          >
            <Download size={18} />
          </button>
        </div>

        {/* Right: broadcast controls */}
        <div className="flex items-center gap-2">
          {isPdf && (
            <>
              {broadcastActive && (
                <span className="flex items-center gap-1.5 rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">
                  <Television size={14} />
                  {amPresenter ? (
                    'You are presenting'
                  ) : (
                    <>
                      <User size={14} />
                      {broadcastState?.presenterName ?? 'Someone'} - Slide {displaySlide}
                    </>
                  )}
                </span>
              )}
              {broadcastActive && !amPresenter && (
                <button
                  type="button"
                  onClick={() => setFollowMode((f) => !f)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    followMode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {followMode ? 'Following presenter' : 'Follow presenter'}
                </button>
              )}
              {!broadcastActive && (
                <>
                  <button
                    type="button"
                    onClick={startBroadcast}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    <Broadcast size={16} />
                    Start broadcast
                  </button>
                  {broadcastTakenError && (
                    <span
                      className="max-w-[200px] truncate rounded bg-rose-900/80 px-2 py-1 text-xs text-rose-200"
                      title={broadcastTakenError}
                    >
                      {broadcastTakenError}
                    </span>
                  )}
                </>
              )}
              {amPresenter && (
                <button
                  type="button"
                  onClick={endBroadcast}
                  className="flex items-center gap-1.5 rounded bg-rose-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
                >
                  <XCircle size={16} />
                  End broadcast
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Slide area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {loadError && (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
              <p className="font-medium">Failed to load document</p>
              <p className="mt-1 text-rose-600">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setLoadProgress(null);
                }}
                className="mt-3 rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {isPdf && fullUrl && !loadError && (
          <PresentationViewerPdf
            file={fullUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            onLoadProgress={handleLoadProgress}
            loadProgress={loadProgress}
            totalSlides={totalSlides}
            displaySlide={displaySlide}
            zoom={zoom}
            showThumbnails={showThumbnails}
            onGoToSlide={goToSlide}
          />
        )}
        {isPptx && fullUrl && (
          <div className="flex h-full w-full flex-1 flex-col items-center justify-center gap-4 p-6">
            {typeof window !== 'undefined' &&
            (fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1')) ? (
              <>
                <p className="max-w-md text-center text-slate-300">
                  The presentation is on a local server. Microsoft Office Online cannot access
                  localhost — please open the file in a new tab.
                </p>
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-orange-500 px-6 py-3 font-medium text-white hover:bg-orange-600"
                >
                  Open in new tab
                </a>
              </>
            ) : (
              <>
                <iframe
                  title={originalName ?? 'PPTX Presentation'}
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullUrl)}`}
                  className="min-h-[60vh] w-full max-w-4xl flex-1 rounded border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts allow-popups"
                />
                <p className="text-sm text-slate-400">
                  If the presentation doesn't load,{' '}
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 underline hover:text-indigo-300"
                  >
                    open in a new tab
                  </a>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom hint bar */}
      {isPdf && totalSlides > 0 && (
        <div className="flex shrink-0 items-center justify-center gap-4 border-t border-slate-700 bg-slate-800/50 px-4 py-1.5 text-[11px] text-slate-500">
          <span>Arrow keys: navigate</span>
          <span>F: fullscreen</span>
          <span>T: thumbnails</span>
          <span>G: go to slide</span>
          <span>Ctrl+/-: zoom</span>
          <span>Esc: close</span>
        </div>
      )}
    </div>
  );
}
