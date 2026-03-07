'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Ensure worker is set when this chunk loads (e.g. if full viewer opened without PDF widget on board)
if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
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
};

export function PresentationViewerPdf({
  file,
  onLoadSuccess,
  onLoadError,
  onLoadProgress,
  loadProgress,
  totalSlides,
  displaySlide,
}: PresentationViewerPdfProps) {
  return (
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
                Загрузка… {Math.round((loadProgress.loaded / loadProgress.total) * 100)}%
              </span>
              <span className="text-sm text-slate-500">
                Осталось ~{Math.round((loadProgress.total - loadProgress.loaded) / 1024)} КБ
              </span>
            </>
          ) : loadProgress ? (
            <span>Загружено {Math.round(loadProgress.loaded / 1024)} КБ…</span>
          ) : (
            <span>Загрузка…</span>
          )}
        </div>
      }
    >
      {totalSlides > 0 && (
        <Page
          pageNumber={displaySlide}
          width={Math.min(900, typeof window !== 'undefined' ? window.innerWidth - 48 : 900)}
          renderTextLayer
          renderAnnotationLayer
        />
      )}
    </Document>
  );
}
