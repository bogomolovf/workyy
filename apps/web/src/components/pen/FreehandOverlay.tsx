'use client';

import { useRef, useState, useMemo, type PointerEvent } from 'react';
import { useReactFlow, type ReactFlowInstance, type NodeChange } from 'reactflow';

import { pointsToPath, pathOptions } from './path';
import type { PenPoint } from './types';
import type { PenNodeType } from './PenNode';

type FreehandOverlayProps = {
  onAddPenNode?: (node: PenNodeType) => void;
  onUpdatePenNode?: (nodeId: string, node: PenNodeType) => void;
  yjsOnNodesChange?: (changes: NodeChange[]) => void;
};

function processPoints(
  points: PenPoint[],
  screenToFlowPosition: ReactFlowInstance['screenToFlowPosition'],
) {
  // points в page coordinates (pageX/pageY), конвертируем в flow coordinates
  // screenToFlowPosition ожидает clientX/clientY (координаты относительно viewport)
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  const flowPoints: PenPoint[] = [];

  for (const point of points) {
    // Конвертируем pageX/pageY в clientX/clientY
    const clientX = point[0] - window.scrollX;
    const clientY = point[1] - window.scrollY;

    // Конвертируем client coordinates в flow coordinates
    const { x, y } = screenToFlowPosition({ x: clientX, y: clientY });
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);

    flowPoints.push([x, y, point[2]]);
  }

  // We correct for the thickness of the line
  const thickness = pathOptions.size * 0.5;
  x1 -= thickness;
  y1 -= thickness;
  x2 += thickness;
  y2 += thickness;

  for (const flowPoint of flowPoints) {
    flowPoint[0] -= x1;
    flowPoint[1] -= y1;
  }
  const width = x2 - x1;
  const height = y2 - y1;

  // Убеждаемся, что размеры не слишком маленькие
  const minSize = 10;
  const finalWidth = Math.max(width, minSize);
  const finalHeight = Math.max(height, minSize);

  console.log('processPoints result:', {
    width,
    height,
    finalWidth,
    finalHeight,
    position: { x: x1, y: y1 },
    pointsCount: flowPoints.length,
  });

  return {
    position: { x: x1, y: y1 },
    width: finalWidth,
    height: finalHeight,
    data: { points: flowPoints, initialSize: { width: finalWidth, height: finalHeight } },
  };
}

export function FreehandOverlay({ onAddPenNode, onUpdatePenNode, yjsOnNodesChange }: FreehandOverlayProps = {}) {
  const { screenToFlowPosition, getViewport, setNodes } = useReactFlow<PenNodeType>();
  const overlayRef = useRef<HTMLDivElement>(null);

  const pointRef = useRef<PenPoint[]>([]);
  const [points, setPoints] = useState<PenPoint[]>([]);
  const currentPenNodeIdRef = useRef<string | null>(null);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    // Используем pageX/pageY как в оригинале
    const nextPoints = [[e.pageX, e.pageY, e.pressure || 0.5]] satisfies PenPoint[];
    pointRef.current = nextPoints;
    setPoints(nextPoints);

    // Generate node ID for later use (will be synced only on pointerUp)
    const nodeId = crypto.randomUUID();
    currentPenNodeIdRef.current = nodeId;

    // No synchronization here - line is visible only to the drawing user until pointerUp
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.buttons !== 1) return;
    const points = pointRef.current;
    // Используем pageX/pageY как в оригинале
    const nextPoints = [...points, [e.pageX, e.pageY, e.pressure || 0.5]] satisfies PenPoint[];
    pointRef.current = nextPoints;
    setPoints(nextPoints); // Update local preview only - no synchronization until pointerUp
  }

  function handlePointerUp(e: PointerEvent) {
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);

    // Используем актуальные точки из ref для надежности
    const finalPoints = pointRef.current;
    const nodeId = currentPenNodeIdRef.current;

    // Ignore lines with too few points (accidental clicks)
    if (finalPoints.length < 3) {
      setPoints([]);
      pointRef.current = [];
      currentPenNodeIdRef.current = null;
      return;
    }

    // Process final points and create the pen node
    const processed = processPoints(finalPoints, screenToFlowPosition);
    const finalNode: PenNodeType = {
      id: nodeId || crypto.randomUUID(),
      type: 'pen',
      ...processed,
    };

    console.log('Finalizing pen node:', {
      id: finalNode.id,
      position: finalNode.position,
      width: finalNode.width,
      height: finalNode.height,
      pointsCount: finalNode.data.points.length,
      initialSize: finalNode.data.initialSize,
      firstPoint: finalNode.data.points[0],
      lastPoint: finalNode.data.points[finalNode.data.points.length - 1],
    });

    // NOW sync through Yjs - this is when other users will see the line
    if (yjsOnNodesChange) {
      const reactFlowNode = {
        ...finalNode,
        style: {
          zIndex: 10,
        },
      };
      yjsOnNodesChange([{ type: 'add', item: reactFlowNode }]);
      console.log('Pen node finalized and synced through Yjs (now visible to other users):', finalNode.id);
    }

    // Also call onAddPenNode callback if provided
    if (onAddPenNode) {
      onAddPenNode(finalNode);
    } else {
      setNodes((nodes) => [...nodes, finalNode]);
    }

    // Clear local state
    setPoints([]);
    pointRef.current = [];
    currentPenNodeIdRef.current = null;
  }

  const viewport = getViewport();

  // Конвертируем points для preview: pageX/pageY -> координаты относительно overlay
  const previewPoints = useMemo(() => {
    if (!points.length || !overlayRef.current) return [];
    const rect = overlayRef.current.getBoundingClientRect();
    return points.map((p) => {
      // Конвертируем pageX/pageY в координаты относительно overlay
      // pageX = clientX + scrollX, но нам нужны координаты относительно overlay
      const clientX = p[0] - window.scrollX;
      const clientY = p[1] - window.scrollY;
      return [clientX - rect.left, clientY - rect.top, p[2]] as PenPoint;
    });
  }, [points]);

  return (
    <div
      ref={overlayRef}
      className="freehand-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={points.length > 0 ? handlePointerMove : undefined}
      onPointerUp={handlePointerUp}
    >
      <svg>
        {previewPoints.length > 0 && (
          <path d={pointsToPath(previewPoints, viewport.zoom)} fill="#ef4444" />
        )}
      </svg>
    </div>
  );
}
