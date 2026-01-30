'use client';

import { useState, useCallback, useMemo } from 'react';
import { NodeResizer, type NodeProps, useStore } from 'reactflow';
import Lightbox from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { ArrowsOut, Trash, Image as ImageIcon } from '@phosphor-icons/react';

// Get actual node dimensions from React Flow internal state
function useNodeDimensions(id: string) {
  const node = useStore((state) => state.nodeInternals.get(id));
  return {
    width: node?.width || 0,
    height: node?.height || 0,
  };
}

export type ImageNodeData = {
  url?: string;
  originalName?: string;
  fileId?: string;
  caption?: string;
  width?: number;
  height?: number;
  // Callbacks
  onDelete?: (id: string) => void;
};

export function ImageNode({ id, data, selected }: NodeProps<ImageNodeData>) {
  const { url, originalName, caption, fileId } = data ?? {};
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Get actual dimensions from React Flow
  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? 300);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? 300);

  const handleOpenLightbox = useCallback(() => {
    if (url) {
      setLightboxOpen(true);
    }
  }, [url]);

  const handleDelete = useCallback(() => {
    data?.onDelete?.(id);
  }, [data, id]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
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

  const hasImage = !!resolvedUrl && !imageError;

  return (
    <div
      className="workyy-image-node relative bg-white rounded-lg shadow-md overflow-hidden"
      style={{ width: finalWidth, height: finalHeight }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={100}
        keepAspectRatio={true}
        lineClassName="!border-blue-400"
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: '2px solid #3b82f6',
          background: '#ffffff',
        }}
      />

      {/* Toolbar */}
      {selected && hasImage && (
        <div className="absolute top-2 right-2 z-20 flex gap-1">
          <button
            onClick={handleOpenLightbox}
            className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm transition-colors"
            title="View fullscreen"
          >
            <ArrowsOut size={16} className="text-slate-600" />
          </button>
          {data?.onDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 bg-white/90 hover:bg-red-50 rounded-md shadow-sm transition-colors"
              title="Delete image"
            >
              <Trash size={16} className="text-red-500" />
            </button>
          )}
        </div>
      )}

      {/* Image content */}
      {hasImage ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="animate-pulse text-slate-400">Loading...</div>
            </div>
          )}
          <img
            src={resolvedUrl}
            alt={originalName || caption || 'Image'}
            className="w-full h-full object-contain cursor-pointer"
            style={{ opacity: imageLoaded ? 1 : 0 }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onDoubleClick={handleOpenLightbox}
            draggable={false}
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <ImageIcon size={48} weight="thin" />
          <span className="mt-2 text-sm">{imageError ? 'Failed to load image' : 'No image'}</span>
        </div>
      )}

      {/* Caption */}
      {caption && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
          {caption}
        </div>
      )}

      {/* Lightbox */}
      {resolvedUrl && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: resolvedUrl }]}
          plugins={[Fullscreen, Zoom]}
          carousel={{ finite: true }}
          render={{
            buttonPrev: () => null,
            buttonNext: () => null,
          }}
        />
      )}
    </div>
  );
}

export default ImageNode;
