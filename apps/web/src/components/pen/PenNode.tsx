'use client';

import { useMemo } from 'react';
import { NodeResizer, type Node, type NodeProps } from 'reactflow';

import { pointsToPath } from './path';
import type { PenPoint } from './types';

export type PenNodeType = Node<
  {
    points: PenPoint[];
    initialSize: { width: number; height: number };
  },
  'pen'
>;

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

  const pathData = useMemo(() => {
    if (!points || points.length === 0) {
      console.warn('PenNode: No points', { points, data, nodeWidth, nodeHeight });
      return '';
    }
    const path = pointsToPath(points);
    if (!path) {
      console.warn('PenNode: Empty path', { points });
    }
    return path;
  }, [points, data, nodeWidth, nodeHeight]);

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
            fill: '#ef4444',
          }}
          d={pathData}
        />
      </svg>
    </>
  );
}
