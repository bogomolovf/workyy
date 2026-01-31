'use client';

import { useMemo } from 'react';
import { NodeResizer, type Node, type NodeProps } from 'reactflow';

import { pointsToPath } from './path';
import type { PenPoint, PenNodeData } from './types';

export type PenNodeType = Node<PenNodeData, 'pen'>;

export function PenNode({ data, width, height, selected, dragging }: NodeProps<PenNodeType>) {
  // Убеждаемся, что width и height - это числа
  const nodeWidth =
    typeof width === 'number'
      ? width
      : typeof width === 'string'
        ? parseFloat(width)
        : data.initialSize.width;
  const nodeHeight =
    typeof height === 'number'
      ? height
      : typeof height === 'string'
        ? parseFloat(height)
        : data.initialSize.height;

  const scaleX = nodeWidth / data.initialSize.width;
  const scaleY = nodeHeight / data.initialSize.height;

  const points = useMemo(
    () => data.points.map((point) => [point[0] * scaleX, point[1] * scaleY, point[2]] as PenPoint),
    [data.points, scaleX, scaleY],
  );

  // Настройки из payload с дефолтными значениями (matching penSettingsStore defaults)
  const color = data.color || '#000000';
  const strokeWidth = data.strokeWidth || 8;
  const opacity = data.opacity ?? 1;
  const smoothing = data.smoothing ?? 0.5;
  const thinning = data.thinning ?? 0.6; // Excalidraw uses 0.6

  const pathData = useMemo(() => {
    if (!points || points.length === 0) {
      console.warn('PenNode: No points', { points, data, nodeWidth, nodeHeight });
      return '';
    }
    const path = pointsToPath(points, 1, {
      size: strokeWidth,
      smoothing,
      thinning,
    });
    if (!path) {
      console.warn('PenNode: Empty path', { points });
    }
    return path;
  }, [points, strokeWidth, smoothing, thinning]);

  if (!pathData) {
    console.warn('PenNode: No pathData, rendering placeholder', {
      nodeWidth,
      nodeHeight,
      initialSize: data.initialSize,
      pointsCount: data.points.length,
      scaleX,
      scaleY,
    });
    return (
      <svg width={nodeWidth} height={nodeHeight}>
        <circle cx={nodeWidth / 2} cy={nodeHeight / 2} r={5} fill="red" />
      </svg>
    );
  }

  return (
    <>
      <NodeResizer isVisible={selected && !dragging} />
      <svg
        width={nodeWidth}
        height={nodeHeight}
        style={{
          pointerEvents: selected ? 'auto' : 'none',
        }}
      >
        <path
          style={{
            pointerEvents: 'visiblePainted',
            cursor: 'pointer',
            fill: color,
            opacity: opacity,
          }}
          d={pathData}
        />
      </svg>
    </>
  );
}
