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

      if (isLine) {
        const norm = normalizeDragLine(startPoint, currentPoint, opts);
        const totalSize =
          Math.abs(currentPoint.x - startPoint.x) + Math.abs(currentPoint.y - startPoint.y);
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
            shapeType: selectedShape,
            fill: 'none',
            stroke: SHAPE_DEFAULTS.stroke,
            strokeWidth: SHAPE_DEFAULTS.strokeWidth,
            opacity: SHAPE_DEFAULTS.opacity,
            endX: norm.endX,
            endY: norm.endY,
            arrowHead: selectedShape === 'arrow',
          },
        });
      } else {
        const norm = normalizeDragRect(startPoint, currentPoint, opts);
        const w = Math.abs(currentPoint.x - startPoint.x);
        const h = Math.abs(currentPoint.y - startPoint.y);
        if (w < SHAPE_DEFAULTS.minSize && h < SHAPE_DEFAULTS.minSize) {
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
            shapeType: selectedShape,
            fill: SHAPE_DEFAULTS.fill,
            stroke: SHAPE_DEFAULTS.stroke,
            strokeWidth: SHAPE_DEFAULTS.strokeWidth,
            opacity: SHAPE_DEFAULTS.opacity,
            cornerRadius:
              selectedShape === 'round-rectangle'
                ? SHAPE_DEFAULTS.roundRectCornerRadius
                : SHAPE_DEFAULTS.cornerRadius,
          },
        });
      }

      setIsDragging(false);
      setStartPoint(null);
      setCurrentPoint(null);
    },
    [isDragging, startPoint, currentPoint, selectedShape, onAddShapeNode],
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

  // ── Build preview geometry ─────────────────────────────────────────────────

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

  // ── Convert flow coords to screen pixels ───────────────────────────────────

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
                : preview.shapeType === 'round-rectangle'
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
