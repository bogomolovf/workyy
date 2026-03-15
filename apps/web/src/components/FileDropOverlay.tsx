'use client';

import {
  Upload,
  Image,
  VideoCamera,
  FileText,
  Notebook,
  X,
  SpinnerGap,
} from '@phosphor-icons/react';
import imageCompression from 'browser-image-compression';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { uploadFile, getNodeTypeFromMimeType, type UploadedFile } from '../lib/api';

const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'],
  'video/*': ['.mp4', '.webm'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/x-ipynb+json': ['.ipynb'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Image compression options
const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

type FileDropOverlayProps = {
  boardId: string;
  onFilesUploaded: (
    files: Array<{
      file: UploadedFile;
      nodeType: 'image' | 'video' | 'document';
      dropPosition?: { x: number; y: number };
    }>,
  ) => void;
  onNotebookDropped?: (file: File, dropPosition?: { x: number; y: number }) => void;
  getDropPosition: (clientX: number, clientY: number) => { x: number; y: number };
  disabled?: boolean;
  children: React.ReactNode;
};

export function FileDropOverlay({
  boardId,
  onFilesUploaded,
  onNotebookDropped,
  getDropPosition,
  disabled = false,
  children,
}: FileDropOverlayProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const processAndUploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      try {
        let fileToUpload = file;

        // Compress images before upload
        if (file.type.startsWith('image/')) {
          setUploadProgress(`Compressing ${file.name}...`);
          try {
            fileToUpload = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
          } catch (compressionError) {
            console.warn('Image compression failed, uploading original:', compressionError);
          }
        }

        setUploadProgress(`Uploading ${file.name}...`);
        const uploaded = await uploadFile(boardId, fileToUpload);
        return uploaded;
      } catch (err) {
        console.error('Upload error:', err);
        setError(
          `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        return null;
      }
    },
    [boardId],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[], event: any) => {
      if (disabled || acceptedFiles.length === 0) return;

      let dropPosition: { x: number; y: number } | undefined;
      if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        dropPosition = getDropPosition(event.clientX, event.clientY);
      } else if (dropPositionRef.current) {
        dropPosition = dropPositionRef.current;
      }

      if (fileRejections.length > 0) {
        const messages = fileRejections.map((rejection) => {
          const errors = rejection.errors.map((e) => e.message).join(', ');
          return `${rejection.file.name}: ${errors}`;
        });
        setError(messages.join('\n'));
      }

      const notebookFiles = acceptedFiles.filter((f) => f.name.endsWith('.ipynb'));
      const mediaFiles = acceptedFiles.filter((f) => !f.name.endsWith('.ipynb'));

      for (const nbFile of notebookFiles) {
        onNotebookDropped?.(nbFile, dropPosition);
      }

      if (mediaFiles.length === 0) return;

      setIsUploading(true);
      setError(null);

      try {
        const uploadedFiles: Array<{
          file: UploadedFile;
          nodeType: 'image' | 'video' | 'document';
          dropPosition?: { x: number; y: number };
        }> = [];

        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          setUploadProgress(`Uploading ${i + 1}/${mediaFiles.length}: ${file.name}`);

          const uploaded = await processAndUploadFile(file);
          if (uploaded) {
            const nodeType = getNodeTypeFromMimeType(file.type);
            const offsetPosition = dropPosition
              ? {
                  x: dropPosition.x + i * 50,
                  y: dropPosition.y + i * 50,
                }
              : undefined;
            uploadedFiles.push({ file: uploaded, nodeType, dropPosition: offsetPosition });
          }
        }

        if (uploadedFiles.length > 0) {
          onFilesUploaded(uploadedFiles);
        }
      } finally {
        setIsUploading(false);
        setUploadProgress(null);
        dropPositionRef.current = null;
      }
    },
    [disabled, boardId, processAndUploadFile, onFilesUploaded, onNotebookDropped, getDropPosition],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    noClick: true, // Don't open file dialog on click (canvas should be clickable)
    noKeyboard: true,
    disabled,
    onDragOver: (event) => {
      // Track mouse position during drag
      dropPositionRef.current = getDropPosition(event.clientX, event.clientY);
    },
  });

  return (
    <div {...getRootProps()} className="relative w-full h-full">
      <input {...getInputProps()} />

      {children}

      {/* Drop overlay */}
      {isDragActive && !disabled && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[1px]" />
          <div className="absolute inset-4 border-2 border-dashed border-blue-500 rounded-xl flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-sm px-8 py-6 rounded-2xl shadow-lg text-center">
              <Upload size={48} className="mx-auto text-blue-500 mb-3" weight="duotone" />
              <p className="text-lg font-medium text-slate-700">Drop files here</p>
              <p className="text-sm text-slate-500 mt-1">Images, videos, documents, or notebooks</p>
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Image size={16} /> Images
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <VideoCamera size={16} /> Videos
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <FileText size={16} /> Documents
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Notebook size={16} /> Notebooks
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <SpinnerGap size={20} className="animate-spin text-blue-500" />
            <span className="text-sm text-slate-700">{uploadProgress}</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-md">
            <span className="text-sm text-red-600 flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 rounded-full transition-colors"
            >
              <X size={16} className="text-red-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileDropOverlay;
