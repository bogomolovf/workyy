'use client';

import React from 'react';
import { getStraightPath } from 'reactflow';

type CustomConnectionLineProps = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  connectionLineStyle?: React.CSSProperties;
};

export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle,
}: CustomConnectionLineProps) {
  const [edgePath] = getStraightPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  const defaultStyle: React.CSSProperties = {
    stroke: '#94a3b8',
    strokeWidth: 4,
    fill: 'none',
  };

  return (
    <g>
      <path d={edgePath} style={{ ...defaultStyle, ...connectionLineStyle }} />
    </g>
  );
}

export default CustomConnectionLine;
