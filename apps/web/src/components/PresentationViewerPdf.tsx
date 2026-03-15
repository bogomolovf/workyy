'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Ensure worker is set when this chunk loads (e.g. if full viewer opened without PDF widget on board)
if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const PDF_OPTIONS = {
  disableAutoFetch: true,
  disableStream: true,
  withCredentials: true,
};

export type PresentationViewerPdfProps = {
  file: string;
  onLoadSuccess: (payload: { numPages: number }) => void;
  onLoadError: (error: Error) => void;
  onLoadProgress: (payload: { loaded: number; total: number }) => void;
  loadProgress: { loaded: number; total: number } | null;
  totalSlides: number;
  displaySlide: number;
  /** Scale factor applied to the page (1 = fit width) */
  zoom?: number;
  /** Show thumbnail sidebar */
  showThumbnails?: boolean;
  onGoToSlide?: (page: number) => void;
};

export function PresentationViewerPdf({
  file,
  onLoadSuccess,
  onLoadError,
  onLoadProgress,
  loadProgress,
  totalSlides,
  displaySlide,
  zoom = 1,
  showThumbnails = false,
  onGoToSlide,
}: PresentationViewerPdfProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });
  const thumbsRef = useRef<HTMLDivElement>(null);

  // Measure available space for responsive rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!showThumbnails || !thumbsRef.current) return;
    const active = thumbsRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [displaySlide, showThumbnails]);

  // Main page fits within the container minus padding
  const mainPageWidth = Math.max(
    300,
    Math.floor((containerSize.width - (showThumbnails ? 180 : 0) - 32) * zoom),
  );

  const handleThumbClick = useCallback(
    (page: number) => {
      onGoToSlide?.(page);
    },
    [onGoToSlide],
  );

  return (
    <div ref={containerRef} className="flex h-full w-full min-h-0 min-w-0">
      {/* Thumbnail sidebar */}
      {showThumbnails && totalSlides > 0 && (
        <div
          ref={thumbsRef}
          className="flex w-[160px] flex-shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-700 bg-slate-800/80 p-2"
        >
          <Document file={file} options={PDF_OPTIONS} loading={null}>
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                type="button"
                data-active={displaySlide === i + 1}
                onClick={() => handleThumbClick(i + 1)}
                className={`group relative w-full rounded border-2 transition-all ${
                  displaySlide === i + 1
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'border-transparent hover:border-slate-500'
                }`}
              >
                <Page
                  pageNumber={i + 1}
                  width={140}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                <span
                  className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    displaySlide === i + 1 ? 'bg-blue-500 text-white' : 'bg-black/50 text-white/80'
                  }`}
                >
                  {i + 1}
                </span>
              </button>
            ))}
          </Document>
        </div>
      )}

      {/* Main slide */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <Document
          file={file}
          options={PDF_OPTIONS}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          onLoadProgress={onLoadProgress}
          loading={
            <div className="flex flex-col items-center gap-3 p-8 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
              {loadProgress && loadProgress.total > 0 ? (
                <>
                  <span className="text-lg font-medium">
                    Loading... {Math.round((loadProgress.loaded / loadProgress.total) * 100)}%
                  </span>
                  <span className="text-sm text-slate-500">
                    ~{Math.round((loadProgress.total - loadProgress.loaded) / 1024)} KB remaining
                  </span>
                </>
              ) : loadProgress ? (
                <span>Loaded {Math.round(loadProgress.loaded / 1024)} KB...</span>
              ) : (
                <span>Loading...</span>
              )}
            </div>
          }
        >
          {totalSlides > 0 && (
            <Page
              pageNumber={displaySlide}
              width={mainPageWidth}
              renderTextLayer
              renderAnnotationLayer
              className="shadow-2xl"
            />
          )}
        </Document>
      </div>
    </div>
  );
}
