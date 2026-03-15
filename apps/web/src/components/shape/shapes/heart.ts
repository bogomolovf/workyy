import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function HeartRenderer({ width, height, fill, stroke, strokeWidth }: ShapeRenderProps) {
  const w = width;
  const h = height;
  const d =
    `M${w * 0.5},${h * 0.3} ` +
    `C${w * 0.5},${h * 0.2} ${w * 0.35},0 ${w * 0.15},0 ` +
    `C0,0 0,${h * 0.25} 0,${h * 0.25} ` +
    `C0,${h * 0.5} ${w * 0.25},${h * 0.7} ${w * 0.5},${h} ` +
    `C${w * 0.75},${h * 0.7} ${w},${h * 0.5} ${w},${h * 0.25} ` +
    `C${w},${h * 0.25} ${w},0 ${w * 0.85},0 ` +
    `C${w * 0.65},0 ${w * 0.5},${h * 0.2} ${w * 0.5},${h * 0.3} Z`;

  return React.createElement('path', { d, fill, stroke, strokeWidth });
}

export const heartShape: ShapeDefinition = {
  type: 'heart',
  label: 'Heart',
  category: 'basic',
  clipPath: 'ellipse(50% 50% at 50% 50%)',
  render: (props) => HeartRenderer(props),
  defaultWidth: 120,
  defaultHeight: 110,
};
