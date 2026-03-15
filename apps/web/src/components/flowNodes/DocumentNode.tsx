'use client';

import {
  Trash,
  FileText,
  FilePdf,
  Download,
  ArrowSquareOut,
  MicrosoftPowerpointLogo,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { NodeResizer, type NodeProps, useStore } from 'reactflow';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker – serve locally from /public to avoid CDN version mismatches
if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// PDF.js options: fetch only data needed for current page; withCredentials for CORS + cookies
const PDF_OPTIONS = { disableAutoFetch: true, disableStream: true, withCredentials: true };

// Max preview width on widget to reduce decode time
const PREVIEW_MAX_WIDTH = 260;

// Get actual node dimensions from React Flow internal state
function useNodeDimensions(id: string) {
  const node = useStore((state) => state.nodeInternals.get(id));
  return {
    width: node?.width || 0,
    height: node?.height || 0,
  };
}

function useIntersectionObserver(ref: React.RefObject<HTMLElement | null>, once = true) {
  const [isVisible, setIsVisible] = useState(false);
  const observedRef = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || (once && observedRef.current)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observedRef.current = true;
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin: '100px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, once]);
  return isVisible;
}

export type DocumentNodeData = {
  url?: string;
  originalName?: string;
  fileId?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  // Callbacks
  onDelete?: (id: string) => void;
  /** When set, "Open" opens the presentation viewer instead of new tab */
  onOpenViewer?: (nodeId: string) => void;
};

export function DocumentNode({ id, data, selected }: NodeProps<DocumentNodeData>) {
  const { url, originalName, mimeType, fileId, onOpenViewer } = data ?? {};
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useIntersectionObserver(containerRef, true);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);

  // Get actual dimensions from React Flow
  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? 320);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? 380);

  const isPdf = mimeType === 'application/pdf' || originalName?.toLowerCase().endsWith('.pdf');
  const isPptx =
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    originalName?.toLowerCase().endsWith('.pptx');

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Resolve full URL: from url (relative or absolute) or from fileId
  const fullUrl = useMemo(() => {
    if (url?.startsWith('/')) return `${apiBase}${url}`;
    if (url) return url;
    if (fileId) return `${apiBase}/api/files/${fileId}`;
    return undefined;
  }, [url, fileId, apiBase]);

  const handleDelete = useCallback(() => {
    data?.onDelete?.(id);
  }, [data, id]);

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

  const handleOpenInNewTab = useCallback(() => {
    if (onOpenViewer) {
      onOpenViewer(id);
      return;
    }
    if (fullUrl) {
      window.open(fullUrl, '_blank');
    }
  }, [fullUrl, onOpenViewer, id]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(numPages ?? 1, p + 1));
  }, [numPages]);

  const onPdfLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPdfLoadError(null);
    setLoadProgress(null);
  }, []);

  const onPdfLoadError = useCallback((err: Error) => {
    setPdfLoadError(err?.message ?? 'Failed to load PDF');
    setLoadProgress(null);
  }, []);

  const onPdfLoadProgress = useCallback(({ loaded, total }: { loaded: number; total: number }) => {
    setLoadProgress({ loaded, total });
  }, []);

  // Get display name (truncate if too long)
  const displayName = originalName
    ? originalName.length > 25
      ? originalName.slice(0, 22) + '...'
      : originalName
    : 'Document';

  const extension =
    originalName?.split('.').pop()?.toUpperCase() || (isPdf ? 'PDF' : isPptx ? 'PPTX' : 'DOC');

  const previewWidth = Math.min(PREVIEW_MAX_WIDTH, Math.max(180, finalWidth - 24));
  const pdfOptions = useMemo(() => PDF_OPTIONS, []);

  return (
    <div
      ref={containerRef}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      style={{ width: finalWidth, height: finalHeight }}
    >
      <NodeResizer
        minWidth={240}
        minHeight={320}
        isVisible={selected}
        lineClassName="!border-blue-500"
        handleClassName="!w-2.5 !h-2.5 !bg-blue-500 !border-white"
      />

      {/* Header with file name and actions */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {isPdf ? (
            <FilePdf size={18} className="flex-shrink-0 text-red-500" weight="fill" />
          ) : isPptx ? (
            <MicrosoftPowerpointLogo
              size={18}
              className="flex-shrink-0 text-orange-500"
              weight="fill"
            />
          ) : (
            <FileText size={18} className="flex-shrink-0 text-slate-500" weight="fill" />
          )}
          <span className="truncate text-sm font-medium text-slate-700" title={originalName}>
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handleOpenInNewTab}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Open in new tab"
          >
            <ArrowSquareOut size={16} />
          </button>
          <button
            onClick={handleDownload}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Download"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="rounded p-1 text-slate-500 hover:bg-red-100 hover:text-red-600"
            title="Delete"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>

      {/* Preview area: first/current page + pagination (PDF loads only when node is in view) */}
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden p-2">
        {isPdf && fullUrl && (
          <>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded border border-slate-100 bg-slate-50">
              {pdfLoadError ? (
                <p className="px-2 text-center text-xs text-rose-600">{pdfLoadError}</p>
              ) : !isInView ? (
                <div className="flex flex-col items-center gap-2 p-4 text-slate-400">
                  <FilePdf size={32} weight="fill" className="text-red-300" />
                  <span className="text-xs">PDF</span>
                </div>
              ) : (
                <Document
                  file={fullUrl}
                  options={pdfOptions}
                  onLoadSuccess={onPdfLoadSuccess}
                  onLoadError={onPdfLoadError}
                  onLoadProgress={onPdfLoadProgress}
                  loading={
                    <div className="flex flex-col items-center gap-2 p-4 text-center text-slate-600 text-xs">
                      <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-red-500" />
                      {loadProgress && loadProgress.total > 0 ? (
                        <>
                          <span className="font-medium">
                            Осталось до загрузки: ~
                            {Math.round((loadProgress.total - loadProgress.loaded) / 1024)} КБ
                          </span>
                          <span className="text-slate-400">
                            {Math.round((loadProgress.loaded / loadProgress.total) * 100)}%
                          </span>
                        </>
                      ) : loadProgress && loadProgress.loaded > 0 ? (
                        <span>Загружено {Math.round(loadProgress.loaded / 1024)} КБ…</span>
                      ) : (
                        <span>Загрузка…</span>
                      )}
                    </div>
                  }
                >
                  {numPages != null && numPages > 0 && (
                    <Page
                      pageNumber={Math.min(currentPage, numPages)}
                      width={previewWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="shadow-sm"
                    />
                  )}
                </Document>
              )}
            </div>
            {numPages != null && numPages > 0 && (
              <div className="mt-2 flex w-full items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentPage <= 1}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <CaretLeft size={18} />
                </button>
                <span
                  className="min-w-[3rem] text-center text-xs text-slate-600"
                  aria-live="polite"
                >
                  {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentPage >= numPages}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  title="Next page"
                  aria-label="Next page"
                >
                  <CaretRight size={18} />
                </button>
              </div>
            )}
          </>
        )}

        {isPptx && fullUrl && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded border border-slate-100 bg-orange-50/50 p-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-orange-100">
              <MicrosoftPowerpointLogo size={48} className="text-orange-500" weight="fill" />
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
              PPTX
            </span>
            <p className="text-center text-xs text-slate-600">Откройте для просмотра слайдов</p>
          </div>
        )}

        {!isPdf && !isPptx && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-50">
              <FileText size={40} className="text-slate-400" weight="fill" />
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {extension}
            </span>
          </div>
        )}
      </div>

      {/* Open button */}
      <div className="shrink-0 border-t border-slate-100 p-2">
        <button
          onClick={handleOpenInNewTab}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors ${
            isPdf
              ? 'bg-red-500 hover:bg-red-600'
              : isPptx
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-slate-500 hover:bg-slate-600'
          }`}
        >
          <ArrowSquareOut size={16} />
          Open {isPdf ? 'PDF' : isPptx ? 'Presentation' : 'Document'}
        </button>
      </div>
    </div>
  );
}

export default DocumentNode;
