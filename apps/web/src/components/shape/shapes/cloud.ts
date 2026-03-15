import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function CloudRenderer({ width, height, fill, stroke, strokeWidth }: ShapeRenderProps) {
  // Cloud shape using cubic bezier curves
  const w = width;
  const h = height;
  const d =
    `M${w * 0.25},${h * 0.55} ` +
    `C${w * 0.05},${h * 0.55} ${w * 0.0},${h * 0.3} ${w * 0.2},${h * 0.25} ` +
    `C${w * 0.15},${h * 0.05} ${w * 0.4},${h * 0.0} ${w * 0.5},${h * 0.15} ` +
    `C${w * 0.6},${h * 0.0} ${w * 0.85},${h * 0.05} ${w * 0.8},${h * 0.25} ` +
    `C${w * 1.0},${h * 0.3} ${w * 0.95},${h * 0.55} ${w * 0.75},${h * 0.55} ` +
    `C${w * 0.95},${h * 0.6} ${w * 0.95},${h * 0.8} ${w * 0.75},${h * 0.8} ` +
    `L${w * 0.25},${h * 0.8} ` +
    `C${w * 0.05},${h * 0.8} ${w * 0.05},${h * 0.6} ${w * 0.25},${h * 0.55} Z`;

  return React.createElement('path', { d, fill, stroke, strokeWidth });
}

export const cloudShape: ShapeDefinition = {
  type: 'cloud',
  label: 'Cloud',
  category: 'basic',
  clipPath: 'ellipse(50% 45% at 50% 50%)',
  render: (props) => CloudRenderer(props),
};
