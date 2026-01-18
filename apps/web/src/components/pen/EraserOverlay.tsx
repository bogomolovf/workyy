'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow, type Node } from 'reactflow';
import { eraserTestFreedraw, type LineSegment, type Point } from './excalidrawUtils';
import type { PenNodeData } from './types';

type EraserOverlayProps = {
  eraserSize?: number;
  onDeleteNodes: (nodeIds: string[]) => void;
};

class EraserTrail {
  private points: Point[] = [];
  private elementsToErase: Set<string> = new Set();

  startPath(x: number, y: number): void {
    this.points = [[x, y]];
    this.elementsToErase.clear();
  }

  addPoint(x: number, y: number): LineSegment | null {
    if (this.points.length === 0) {
      this.points.push([x, y]);
      return null;
    }

    const lastPoint = this.points[this.points.length - 1];
    const newPoint: Point = [x, y];

    const dx = newPoint[0] - lastPoint[0];
    const dy = newPoint[1] - lastPoint[1];
    if (dx * dx + dy * dy < 4) {
      return null;
    }

    this.points.push(newPoint);
    return [lastPoint, newPoint];
  }

  markErased(nodeId: string): void {
    this.elementsToErase.add(nodeId);
  }

  isErased(nodeId: string): boolean {
    return this.elementsToErase.has(nodeId);
  }

  endPath(): void {
    this.points = [];
    this.elementsToErase.clear();
  }
}

export function EraserOverlay({ eraserSize = 20, onDeleteNodes }: EraserOverlayProps) {
  const { screenToFlowPosition, getNodes, getViewport } = useReactFlow();
  const eraserTrailRef = useRef(new EraserTrail());
  const isErasingRef = useRef(false);
  const nodesRef = useRef<Node[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: -100, y: -100 });
  const [isOverCanvas, setIsOverCanvas] = useState(false);

  useEffect(() => {
    nodesRef.current = getNodes();
  });

  const testNodeIntersection = useCallback(
    (segment: LineSegment, node: Node, zoom: number): boolean => {
      if (node.type !== 'pen') return false;
      if (!node.position) return false;

      const data = node.data as PenNodeData | undefined;
      if (!data?.points?.length) return false;

      return eraserTestFreedraw(
        segment,
        {
          x: node.position.x,
          y: node.position.y,
          points: data.points,
          strokeWidth: data.strokeWidth ?? 3,
          width: node.width ?? data.initialSize?.width ?? 100,
          height: node.height ?? data.initialSize?.height ?? 100,
        },
        zoom,
      );
    },
    [],
  );

  const isPointInNode = useCallback(
    (flowPos: { x: number; y: number }, node: Node, tolerance: number): boolean => {
      if (node.type !== 'pen') return false;
      if (!node.position) return false;

      const data = node.data as PenNodeData | undefined;
      const width = node.width ?? data?.initialSize?.width ?? 100;
      const height = node.height ?? data?.initialSize?.height ?? 100;

      return (
        flowPos.x >= node.position.x - tolerance &&
        flowPos.x <= node.position.x + width + tolerance &&
        flowPos.y >= node.position.y - tolerance &&
        flowPos.y <= node.position.y + height + tolerance
      );
    },
    [],
  );

  const eraseAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      const viewport = getViewport();
      const tolerance = eraserSize / viewport.zoom / 2;
      const trail = eraserTrailRef.current;

      const nodes = nodesRef.current;
      const nodesToDelete: string[] = [];

      for (const node of nodes) {
        if (trail.isErased(node.id)) continue;
        if (!isPointInNode(flowPos, node, tolerance)) continue;

        const tinyOffset = 1 / viewport.zoom;
        const segment: LineSegment = [
          [flowPos.x - tinyOffset, flowPos.y - tinyOffset],
          [flowPos.x + tinyOffset, flowPos.y + tinyOffset],
        ];

        if (testNodeIntersection(segment, node, viewport.zoom)) {
          trail.markErased(node.id);
          nodesToDelete.push(node.id);
        }
      }

      if (nodesToDelete.length > 0) {
        onDeleteNodes(nodesToDelete);
      }
    },
    [
      screenToFlowPosition,
      getViewport,
      eraserSize,
      isPointInNode,
      testNodeIntersection,
      onDeleteNodes,
    ],
  );

  const processEraserMove = useCallback(
    (clientX: number, clientY: number) => {
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      const viewport = getViewport();
      const trail = eraserTrailRef.current;

      const segment = trail.addPoint(flowPos.x, flowPos.y);
      if (!segment) return;

      const nodes = nodesRef.current;
      const nodesToDelete: string[] = [];

      for (const node of nodes) {
        if (trail.isErased(node.id)) continue;

        if (testNodeIntersection(segment, node, viewport.zoom)) {
          trail.markErased(node.id);
          nodesToDelete.push(node.id);
        }
      }

      if (nodesToDelete.length > 0) {
        onDeleteNodes(nodesToDelete);
      }
    },
    [screenToFlowPosition, getViewport, testNodeIntersection, onDeleteNodes],
  );

  // Pointer event handlers on the overlay
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Capture pointer for continuous tracking
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      isErasingRef.current = true;
      eraserTrailRef.current.startPath(flowPos.x, flowPos.y);
      eraseAtPoint(e.clientX, e.clientY);
    },
    [screenToFlowPosition, eraseAtPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      setIsOverCanvas(true); // We're over the overlay = over canvas

      if (!isErasingRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      processEraserMove(e.clientX, e.clientY);
    },
    [processEraserMove],
  );

  const handlePointerEnter = useCallback(() => {
    setIsOverCanvas(true);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setIsOverCanvas(false);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (isErasingRef.current) {
      eraserTrailRef.current.endPath();
    }
    isErasingRef.current = false;
  }, []);

  // Track cursor position globally (for smooth cursor movement)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // Cursor rendered via portal - only visible when over canvas
  const cursor = isOverCanvas ? (
    <div
      style={{
        position: 'fixed',
        left: cursorPos.x - eraserSize / 2,
        top: cursorPos.y - eraserSize / 2,
        width: eraserSize,
        height: eraserSize,
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.4)',
        border: '2px solid #ef4444',
        pointerEvents: 'none',
        zIndex: 999999,
      }}
    />
  ) : null;

  return (
    <>
      {/* Invisible overlay that captures all pointer events - same approach as FreehandOverlay */}
      {/* Uses clip-path to exclude bottom-left corner where zoom controls are */}
      <div
        ref={overlayRef}
        className="eraser-overlay"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 5, // Above ReactFlow nodes (pen nodes have zIndex 4)
          cursor: 'none',
          touchAction: 'none',
          pointerEvents: 'auto', // Capture all events
          background: 'transparent',
          // Cut out bottom-left corner (50px wide, 150px tall) for zoom controls
          clipPath:
            'polygon(0 0, 100% 0, 100% 100%, 50px 100%, 50px calc(100% - 150px), 0 calc(100% - 150px))',
        }}
      />
      {/* Cursor via portal */}
      {createPortal(cursor, document.body)}
    </>
  );
}
