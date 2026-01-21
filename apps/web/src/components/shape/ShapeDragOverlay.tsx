'use client';

import { useRef, useState, useMemo, type PointerEvent, useCallback, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import type { ShapeType } from '../flowNodes/ShapeNode';

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
      if (e.button !== 0) return; // Only left mouse button
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();

      const clientX = e.clientX;
      const clientY = e.clientY;
      const { x, y } = screenToFlowPosition({ x: clientX, y: clientY });

      setStartPoint({ x, y });
      setCurrentPoint({ x, y });
      setIsDragging(true);
    },
    [screenToFlowPosition],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !startPoint) return;

      const clientX = e.clientX;
      const clientY = e.clientY;
      const { x, y } = screenToFlowPosition({ x: clientX, y: clientY });

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

      // Calculate dimensions
      let x1 = startPoint.x;
      let y1 = startPoint.y;
      let x2 = currentPoint.x;
      let y2 = currentPoint.y;

      // Handle Shift modifier (keep aspect ratio)
      const isShift = e.shiftKey;
      // Handle Alt modifier (draw from center)
      const isAlt = e.altKey || e.metaKey;

      let width = Math.abs(x2 - x1);
      let height = Math.abs(y2 - y1);

      // For line/arrow types, we need different logic
      const isLineType = selectedShape === 'line' || selectedShape === 'arrow';
      const minSize = isLineType ? 10 : 20;

      if (width < minSize && height < minSize) {
        // Too small, cancel
        setIsDragging(false);
        setStartPoint(null);
        setCurrentPoint(null);
        return;
      }

      // Handle Alt (draw from center) for rectangle/ellipse
      if (!isLineType && isAlt) {
        width = width * 2;
        height = height * 2;
        x1 = startPoint.x - width / 2;
        y1 = startPoint.y - height / 2;
        x2 = startPoint.x + width / 2;
        y2 = startPoint.y + height / 2;
      }

      // Handle Shift (keep aspect ratio) for rectangle/ellipse
      if (!isLineType && isShift) {
        const size = Math.max(width, height);
        width = size;
        height = size;
        // Adjust position to maintain start corner
        if (x2 < x1) {
          x1 = x2;
        }
        if (y2 < y1) {
          y1 = y2;
        }
      }

      // For line/arrow, use start and end points directly
      if (isLineType) {
        // For lines, we use position as start point and calculate relative end point
        // But we'll store it differently - width/height represent the bounding box
        // The actual line will be drawn from (0,0) to (width, height)
        if (isShift) {
          // Snap to 0/45/90 degrees
          const dx = x2 - x1;
          const dy = y2 - y1;
          const angle = Math.atan2(dy, dx);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const distance = Math.sqrt(dx * dx + dy * dy);
          x2 = x1 + Math.cos(snappedAngle) * distance;
          y2 = y1 + Math.sin(snappedAngle) * distance;
        }

        width = Math.abs(x2 - x1);
        height = Math.abs(y2 - y1);

        // For lines, position is the top-left of bounding box
        // We'll store the relative end point in payload
        const finalX1 = Math.min(x1, x2);
        const finalY1 = Math.min(y1, y2);
        const finalX2 = Math.max(x1, x2);
        const finalY2 = Math.max(y1, y2);

        width = finalX2 - finalX1;
        height = finalY2 - finalY1;

        const newNode = {
          id: crypto.randomUUID(),
          type: 'shape' as const,
          position: { x: finalX1, y: finalY1 },
          width: Math.max(width, minSize),
          height: Math.max(height, minSize),
          payload: {
            shapeType: selectedShape,
            fill: 'none',
            stroke: '#1f1f1f',
            strokeWidth: 2,
            opacity: 1.0,
            // For line/arrow, store relative end point
            endX: x2 - x1,
            endY: y2 - y1,
            arrowHead: selectedShape === 'arrow',
          },
        };

        if (onAddShapeNode) {
          onAddShapeNode(newNode);
        }

        setIsDragging(false);
        setStartPoint(null);
        setCurrentPoint(null);
        return;
      }

      // For rectangle/ellipse/circle
      const finalX = Math.min(x1, x2);
      const finalY = Math.min(y1, y2);
      const finalWidth = Math.max(width, minSize);
      const finalHeight = Math.max(height, minSize);

      const newNode = {
        id: crypto.randomUUID(),
        type: 'shape' as const,
        position: { x: finalX, y: finalY },
        width: finalWidth,
        height: finalHeight,
        payload: {
          shapeType: selectedShape,
          fill: 'transparent',
          stroke: '#1f1f1f',
          strokeWidth: 2,
          opacity: 1.0,
          cornerRadius: selectedShape === 'round-rectangle' ? 8 : 0,
        },
      };

      if (onAddShapeNode) {
        onAddShapeNode(newNode);
      }

      setIsDragging(false);
      setStartPoint(null);
      setCurrentPoint(null);
    },
    [isDragging, startPoint, currentPoint, selectedShape, onAddShapeNode],
  );

  // Handle Esc key to cancel
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

  // Calculate preview dimensions - simplified, will render via SVG
  const previewBox = useMemo(() => {
    if (!isDragging || !startPoint || !currentPoint) return null;

    let x1 = startPoint.x;
    let y1 = startPoint.y;
    let x2 = currentPoint.x;
    let y2 = currentPoint.y;

    const isLineType = selectedShape === 'line' || selectedShape === 'arrow';

    let width = Math.abs(x2 - x1);
    let height = Math.abs(y2 - y1);

    if (width < 10 && height < 10 && !isLineType) return null;

    const finalX = Math.min(x1, x2);
    const finalY = Math.min(y1, y2);
    const finalWidth = Math.max(width, isLineType ? 10 : 20);
    const finalHeight = Math.max(height, isLineType ? 10 : 20);

    return {
      x: finalX,
      y: finalY,
      width: finalWidth,
      height: finalHeight,
      isLineType,
      startX: x1,
      startY: y1,
      endX: x2,
      endY: y2,
    };
  }, [isDragging, startPoint, currentPoint, selectedShape]);

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
      {/* Preview will be shown via temporary shape node during drag */}
    </div>
  );
}
