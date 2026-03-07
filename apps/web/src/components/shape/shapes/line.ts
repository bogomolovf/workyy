import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function LineRenderer({
  width,
  height,
  stroke,
  strokeWidth,
  startX,
  startY,
  endX,
  endY,
}: ShapeRenderProps) {
  return React.createElement('line', {
    x1: startX ?? 0,
    y1: startY ?? 0,
    x2: endX ?? width,
    y2: endY ?? height,
    stroke,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round',
  });
}

export const lineShape: ShapeDefinition = {
  type: 'line',
  label: 'Line',
  category: 'line',
  defaultWidth: 100,
  defaultHeight: 24,
  render: (props) => LineRenderer(props),
};
