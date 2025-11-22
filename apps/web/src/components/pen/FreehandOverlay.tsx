"use client";

import { useRef, useState, useMemo, type PointerEvent } from "react";
import { useReactFlow, type ReactFlowInstance } from "reactflow";

import { pointsToPath, pathOptions } from "./path";
import type { PenPoint } from "./types";
import type { PenNodeType } from "./PenNode";

type FreehandOverlayProps = {
  onAddPenNode?: (node: PenNodeType) => void;
};

function processPoints(
  points: PenPoint[],
  screenToFlowPosition: ReactFlowInstance["screenToFlowPosition"],
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

  console.log("processPoints result:", {
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

export function FreehandOverlay({ onAddPenNode }: FreehandOverlayProps = {}) {
  const { screenToFlowPosition, getViewport, setNodes } = useReactFlow<PenNodeType>();
  const overlayRef = useRef<HTMLDivElement>(null);

  const pointRef = useRef<PenPoint[]>([]);
  const [points, setPoints] = useState<PenPoint[]>([]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    // Используем pageX/pageY как в оригинале
    const nextPoints = [
      [e.pageX, e.pageY, e.pressure || 0.5],
    ] satisfies PenPoint[];
    pointRef.current = nextPoints;
    setPoints(nextPoints);
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.buttons !== 1) return;
    const points = pointRef.current;
    // Используем pageX/pageY как в оригинале
    const nextPoints = [
      ...points,
      [e.pageX, e.pageY, e.pressure || 0.5],
    ] satisfies PenPoint[];
    pointRef.current = nextPoints;
    setPoints(nextPoints);
  }

  function handlePointerUp(e: PointerEvent) {
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);

    // Используем актуальные точки из ref для надежности
    const finalPoints = pointRef.current;
    
    // Ignore lines with too few points (accidental clicks)
    if (finalPoints.length < 3) {
      setPoints([]);
      pointRef.current = [];
      return;
    }

    const processed = processPoints(finalPoints, screenToFlowPosition);
    const newNode: PenNodeType = {
      id: crypto.randomUUID(),
      type: "pen",
      ...processed,
    };

    console.log("Creating pen node:", {
      id: newNode.id,
      position: newNode.position,
      width: newNode.width,
      height: newNode.height,
      pointsCount: newNode.data.points.length,
      initialSize: newNode.data.initialSize,
      firstPoint: newNode.data.points[0],
      lastPoint: newNode.data.points[newNode.data.points.length - 1],
    });

    // Используем callback если он передан, иначе setNodes
    if (onAddPenNode) {
      onAddPenNode(newNode);
    } else {
      setNodes((nodes) => [...nodes, newNode]);
    }
    setPoints([]);
    pointRef.current = [];
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
          <path
            d={pointsToPath(previewPoints, viewport.zoom)}
            fill="#ef4444"
          />
        )}
      </svg>
    </div>
  );
}

