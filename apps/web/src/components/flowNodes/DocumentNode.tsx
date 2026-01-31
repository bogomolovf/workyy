'use client';

import {
  Trash,
  FileText,
  FilePdf,
  Download,
  ArrowSquareOut,
  MicrosoftPowerpointLogo,
} from '@phosphor-icons/react';
import { useCallback } from 'react';
import { NodeResizer, type NodeProps, useStore } from 'reactflow';

// Get actual node dimensions from React Flow internal state
function useNodeDimensions(id: string) {
  const node = useStore((state) => state.nodeInternals.get(id));
  return {
    width: node?.width || 0,
    height: node?.height || 0,
  };
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
};

export function DocumentNode({ id, data, selected }: NodeProps<DocumentNodeData>) {
  const { url, originalName, mimeType, fileId } = data ?? {};

  // Get actual dimensions from React Flow
  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? 280);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? 160);

  const isPdf = mimeType === 'application/pdf' || originalName?.toLowerCase().endsWith('.pdf');
  const isPptx =
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    originalName?.toLowerCase().endsWith('.pptx');

  // Resolve full URL for the file
  const fullUrl = url?.startsWith('/')
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${url}`
    : url;

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
    if (fullUrl) {
      window.open(fullUrl, '_blank');
    }
  }, [fullUrl]);

  // Get display name (truncate if too long)
  const displayName = originalName
    ? originalName.length > 25
      ? originalName.slice(0, 22) + '...'
      : originalName
    : 'Document';

  // Get file extension
  const extension =
    originalName?.split('.').pop()?.toUpperCase() || (isPdf ? 'PDF' : isPptx ? 'PPTX' : 'DOC');

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      style={{ width: finalWidth, height: finalHeight }}
    >
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={selected}
        lineClassName="!border-blue-500"
        handleClassName="!w-2.5 !h-2.5 !bg-blue-500 !border-white"
      />

      {/* Header with file name and actions */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
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

        {/* Action buttons */}
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

      {/* Document preview area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        {/* Large icon */}
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-lg ${
            isPdf ? 'bg-red-50' : isPptx ? 'bg-orange-50' : 'bg-slate-50'
          }`}
        >
          {isPdf ? (
            <FilePdf size={40} className="text-red-500" weight="fill" />
          ) : isPptx ? (
            <MicrosoftPowerpointLogo size={40} className="text-orange-500" weight="fill" />
          ) : (
            <FileText size={40} className="text-slate-400" weight="fill" />
          )}
        </div>

        {/* File type badge */}
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isPdf
              ? 'bg-red-100 text-red-700'
              : isPptx
                ? 'bg-orange-100 text-orange-700'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {extension}
        </span>

        {/* Open button */}
        <button
          onClick={handleOpenInNewTab}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
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
