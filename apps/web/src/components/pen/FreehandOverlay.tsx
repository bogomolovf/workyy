'use client';

import { useRef, useState, useMemo, useCallback, type PointerEvent } from 'react';
import { useReactFlow, type ReactFlowInstance } from 'reactflow';

import { pointsToPath, shouldAddPoint, simplifyPoints } from './path';
import type { PenPoint } from './types';
import type { PenNodeType } from './PenNode';
import { usePenSettingsStore } from '../../state/penSettingsStore';

type FreehandOverlayProps = {
  onAddPenNode?: (node: PenNodeType) => void;
};

/**
 * Process raw input points to flow coordinates
 * Converts page coordinates to ReactFlow canvas coordinates
 */
function processPoints(
  points: PenPoint[],
  screenToFlowPosition: ReactFlowInstance['screenToFlowPosition'],
  strokeWidth: number,
) {
  if (points.length === 0) {
    return null;
  }

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  const flowPoints: PenPoint[] = [];

  for (const point of points) {
    // Convert pageX/pageY to clientX/clientY
    const clientX = point[0] - window.scrollX;
    const clientY = point[1] - window.scrollY;

    // Convert to flow coordinates
    const { x, y } = screenToFlowPosition({ x: clientX, y: clientY });
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);

    flowPoints.push([x, y, point[2]]);
  }

  // Add padding for stroke thickness
  const thickness = strokeWidth * 0.5;
  x1 -= thickness;
  y1 -= thickness;
  x2 += thickness;
  y2 += thickness;

  // Normalize points relative to bounding box origin
  for (const flowPoint of flowPoints) {
    flowPoint[0] -= x1;
    flowPoint[1] -= y1;
  }

  const width = x2 - x1;
  const height = y2 - y1;

  // Ensure minimum size
  const minSize = 10;
  const finalWidth = Math.max(width, minSize);
  const finalHeight = Math.max(height, minSize);

  return {
    position: { x: x1, y: y1 },
    width: finalWidth,
    height: finalHeight,
    data: {
      points: flowPoints,
      initialSize: { width: finalWidth, height: finalHeight },
    },
  };
}

export function FreehandOverlay({ onAddPenNode }: FreehandOverlayProps = {}) {
  const { screenToFlowPosition, getViewport, setNodes } = useReactFlow<PenNodeType>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const penSettings = usePenSettingsStore();

  const pointRef = useRef<PenPoint[]>([]);
  const [points, setPoints] = useState<PenPoint[]>([]);
  const isDrawingRef = useRef(false);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    // Prevent default to avoid text selection and other browser behaviors
    e.preventDefault();
    e.stopPropagation();

    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    // Use pageX/pageY for consistent coordinates
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const nextPoints: PenPoint[] = [[e.pageX, e.pageY, pressure]];

    pointRef.current = nextPoints;
    setPoints(nextPoints);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    // Only process if we're drawing and left button is pressed
    if (!isDrawingRef.current || e.buttons !== 1) return;

    e.preventDefault();
    e.stopPropagation();

    const points = pointRef.current;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const newPoint: PenPoint = [e.pageX, e.pageY, pressure];

    // Skip duplicate points (Excalidraw optimization)
    if (!shouldAddPoint(points, newPoint, 1)) {
      return;
    }

    const nextPoints = [...points, newPoint];
    pointRef.current = nextPoints;
    setPoints(nextPoints);
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      const finalPoints = pointRef.current;

      // Ignore lines with too few points (accidental clicks)
      if (finalPoints.length < 3) {
        setPoints([]);
        pointRef.current = [];
        return;
      }

      // Simplify points to reduce complexity
      const simplifiedPoints = simplifyPoints(finalPoints, 1);

      // Get current settings at the moment of node creation
      const storeState = usePenSettingsStore.getState();
      const currentSettings = {
        color: storeState.color,
        strokeWidth: storeState.strokeWidth,
        opacity: storeState.opacity,
        smoothing: storeState.smoothing ?? 0.5,
        thinning: storeState.thinning ?? 0.6,
      };

      const processed = processPoints(
        simplifiedPoints,
        screenToFlowPosition,
        currentSettings.strokeWidth,
      );

      if (!processed) {
        setPoints([]);
        pointRef.current = [];
        return;
      }

      const newNode: PenNodeType = {
        id: crypto.randomUUID(),
        type: 'pen',
        ...processed,
        data: {
          ...processed.data,
          color: currentSettings.color,
          strokeWidth: currentSettings.strokeWidth,
          opacity: currentSettings.opacity,
          smoothing: currentSettings.smoothing,
          thinning: currentSettings.thinning,
        },
      };

      // Use callback if provided, otherwise setNodes
      if (onAddPenNode) {
        onAddPenNode(newNode);
      } else {
        setNodes((nodes) => [...nodes, newNode]);
      }

      setPoints([]);
      pointRef.current = [];
    },
    [screenToFlowPosition, setNodes, onAddPenNode],
  );

  const handlePointerCancel = useCallback((e: PointerEvent) => {
    isDrawingRef.current = false;
    setPoints([]);
    pointRef.current = [];
  }, []);

  const viewport = getViewport();

  // Convert points for preview: pageX/pageY -> coordinates relative to overlay
  const previewPoints = useMemo(() => {
    if (!points.length || !overlayRef.current) return [];

    const rect = overlayRef.current.getBoundingClientRect();
    return points.map((p) => {
      const clientX = p[0] - window.scrollX;
      const clientY = p[1] - window.scrollY;
      return [clientX - rect.left, clientY - rect.top, p[2]] as PenPoint;
    });
  }, [points]);

  // Memoize path data for rendering optimization
  const previewPathData = useMemo(() => {
    if (!previewPoints.length) return '';

    return pointsToPath(previewPoints, viewport.zoom, {
      size: penSettings.strokeWidth,
      smoothing: penSettings.smoothing,
      thinning: penSettings.thinning,
    });
  }, [
    previewPoints,
    viewport.zoom,
    penSettings.strokeWidth,
    penSettings.smoothing,
    penSettings.thinning,
  ]);

  return (
    <div
      ref={overlayRef}
      className="freehand-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={points.length > 0 ? handlePointerMove : undefined}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        touchAction: 'none', // Prevent touch scrolling while drawing
      }}
    >
      <svg>
        {previewPathData && (
          <path
            d={previewPathData}
            fill={penSettings.color}
            opacity={penSettings.opacity}
            style={{
              fill: penSettings.color,
              opacity: penSettings.opacity,
            }}
          />
        )}
      </svg>
    </div>
  );
}
