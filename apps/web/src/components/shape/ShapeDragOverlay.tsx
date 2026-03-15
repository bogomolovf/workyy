'use client';

import { useRef, useState, useMemo, type PointerEvent, useCallback, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import {
  type ShapeType,
  SHAPE_DEFAULTS,
  normalizeDragRect,
  normalizeDragLine,
  isLineType,
  getShapeClipPath,
  getShapeDefinition,
} from './shapeEngine';

type ShapeDragOverlayProps = {
  selectedShape: ShapeType;
  onAddShapeNode?: (node: {
    id: string;
    type: 'shape';
    position: { x: number; y: number };
    width: number;
    height: number;
    payload: {
      shapeType: ShapeType;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      cornerRadius?: number;
      arrowHead?: boolean;
      startX?: number;
      startY?: number;
      endX?: number;
      endY?: number;
    };
  }) => void;
};

export function ShapeDragOverlay({ selectedShape, onAddShapeNode }: ShapeDragOverlayProps) {
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);

  const getDefaultPayload = useCallback((shape: ShapeType) => {
    const isLine = isLineType(shape);
    return {
      shapeType: shape,
      fill: isLine ? 'none' : SHAPE_DEFAULTS.fill,
      stroke: SHAPE_DEFAULTS.stroke,
      strokeWidth: SHAPE_DEFAULTS.strokeWidth,
      opacity: SHAPE_DEFAULTS.opacity,
      cornerRadius:
        shape === 'round-rectangle'
          ? SHAPE_DEFAULTS.roundRectCornerRadius
          : shape === 'speech-bubble'
            ? 12
            : SHAPE_DEFAULTS.cornerRadius,
      arrowHead: shape === 'arrow' ? true : undefined,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();

      const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setStartPoint({ x, y });
      setCurrentPoint({ x, y });
      setIsDragging(true);
      startTimeRef.current = Date.now();
    },
    [screenToFlowPosition],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !startPoint) return;
      const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCurrentPoint({ x, y });
    },
    [isDragging, startPoint, screenToFlowPosition],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !startPoint || !currentPoint) {
        setIsDragging(false);
        setStartPoint(null);
        setCurrentPoint(null);
        return;
      }

      (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);

      const opts = { shift: e.shiftKey, alt: e.altKey || e.metaKey };
      const isLine = isLineType(selectedShape);
      const elapsed = Date.now() - startTimeRef.current;
      const dx = Math.abs(currentPoint.x - startPoint.x);
      const dy = Math.abs(currentPoint.y - startPoint.y);
      const isClick = elapsed < 300 && dx < 5 && dy < 5;

      // Click-to-add: create shape with default size at click position
      if (isClick && !isLine) {
        const def = getShapeDefinition(selectedShape);
        const w = def?.defaultWidth ?? SHAPE_DEFAULTS.defaultWidth;
        const h = def?.defaultHeight ?? SHAPE_DEFAULTS.defaultHeight;
        onAddShapeNode?.({
          id: crypto.randomUUID(),
          type: 'shape',
          position: { x: startPoint.x - w / 2, y: startPoint.y - h / 2 },
          width: w,
          height: h,
          payload: getDefaultPayload(selectedShape),
        });
        setIsDragging(false);
        setStartPoint(null);
        setCurrentPoint(null);
        return;
      }

      if (isLine) {
        const norm = normalizeDragLine(startPoint, currentPoint, opts);
        const totalSize = dx + dy;
        if (totalSize < SHAPE_DEFAULTS.minLineSize) {
          setIsDragging(false);
          setStartPoint(null);
          setCurrentPoint(null);
          return;
        }
        onAddShapeNode?.({
          id: crypto.randomUUID(),
          type: 'shape',
          position: { x: norm.x, y: norm.y },
          width: norm.width,
          height: norm.height,
          payload: {
            ...getDefaultPayload(selectedShape),
            endX: norm.endX,
            endY: norm.endY,
          },
        });
      } else {
        const norm = normalizeDragRect(startPoint, currentPoint, opts);
        if (dx < SHAPE_DEFAULTS.minSize && dy < SHAPE_DEFAULTS.minSize) {
          setIsDragging(false);
          setStartPoint(null);
          setCurrentPoint(null);
          return;
        }
        onAddShapeNode?.({
          id: crypto.randomUUID(),
          type: 'shape',
          position: { x: norm.x, y: norm.y },
          width: norm.width,
          height: norm.height,
          payload: getDefaultPayload(selectedShape),
        });
      }

      setIsDragging(false);
      setStartPoint(null);
      setCurrentPoint(null);
    },
    [isDragging, startPoint, currentPoint, selectedShape, onAddShapeNode, getDefaultPayload],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDragging(false);
        setStartPoint(null);
        setCurrentPoint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging]);

  const viewport = getViewport();

  const preview = useMemo(() => {
    if (!isDragging || !startPoint || !currentPoint) return null;

    const isLine = isLineType(selectedShape);

    if (isLine) {
      return {
        isLine: true as const,
        x1: startPoint.x,
        y1: startPoint.y,
        x2: currentPoint.x,
        y2: currentPoint.y,
      };
    }

    const w = Math.abs(currentPoint.x - startPoint.x);
    const h = Math.abs(currentPoint.y - startPoint.y);
    if (w < 4 && h < 4) return null;

    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);

    return {
      isLine: false as const,
      x,
      y,
      width: Math.max(w, 1),
      height: Math.max(h, 1),
      clipPath: getShapeClipPath(selectedShape),
      shapeType: selectedShape,
    };
  }, [isDragging, startPoint, currentPoint, selectedShape]);

  const toScreen = useCallback(
    (fx: number, fy: number) => ({
      sx: fx * viewport.zoom + viewport.x,
      sy: fy * viewport.zoom + viewport.y,
    }),
    [viewport],
  );

  return (
    <div
      ref={overlayRef}
      className="shape-drag-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={isDragging ? handlePointerMove : undefined}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        cursor: 'crosshair',
        touchAction: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Shape preview during drag */}
      {preview && !preview.isLine && (
        <div
          style={{
            position: 'absolute',
            left: preview.x * viewport.zoom + viewport.x,
            top: preview.y * viewport.zoom + viewport.y,
            width: preview.width * viewport.zoom,
            height: preview.height * viewport.zoom,
            clipPath: preview.clipPath,
            border: `${SHAPE_DEFAULTS.strokeWidth}px solid ${SHAPE_DEFAULTS.stroke}`,
            borderRadius:
              preview.shapeType === 'circle' || preview.shapeType === 'ellipse'
                ? '50%'
                : preview.shapeType === 'round-rectangle' || preview.shapeType === 'speech-bubble'
                  ? `${SHAPE_DEFAULTS.roundRectCornerRadius * viewport.zoom}px`
                  : undefined,
            background: 'rgba(99, 102, 241, 0.08)',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Line/arrow preview */}
      {preview &&
        preview.isLine &&
        (() => {
          const { sx: sx1, sy: sy1 } = toScreen(preview.x1, preview.y1);
          const { sx: sx2, sy: sy2 } = toScreen(preview.x2, preview.y2);
          const dx = sx2 - sx1;
          const dy = sy2 - sy1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 2) return null;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <div
              style={{
                position: 'absolute',
                left: sx1,
                top: sy1,
                width: len,
                height: 0,
                borderTop: `${SHAPE_DEFAULTS.strokeWidth}px solid ${SHAPE_DEFAULTS.stroke}`,
                transformOrigin: '0 0',
                transform: `rotate(${angle}deg)`,
                pointerEvents: 'none',
              }}
            >
              {selectedShape === 'arrow' && (
                <div
                  style={{
                    position: 'absolute',
                    right: -3,
                    top: -5,
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid ' + SHAPE_DEFAULTS.stroke,
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                  }}
                />
              )}
            </div>
          );
        })()}
    </div>
  );
}
