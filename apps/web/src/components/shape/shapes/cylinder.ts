import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function CylinderRenderer({ width, height, fill, stroke, strokeWidth }: ShapeRenderProps) {
  const cap = height * 0.125;
  const d =
    `M0,${cap} L0,${height - cap} ` +
    `A${width / 2} ${cap} 0 1 0 ${width} ${height - cap} ` +
    `L${width},${cap} ` +
    `A${width / 2} ${cap} 0 1 1 0 ${cap} ` +
    `A${width / 2} ${cap} 0 1 1 ${width} ${cap} ` +
    `A${width / 2} ${cap} 0 1 1 0 ${cap} z`;

  return React.createElement('path', { d, fill, stroke, strokeWidth });
}

export const cylinderShape: ShapeDefinition = {
  type: 'cylinder',
  label: 'Cylinder',
  category: 'flowchart',
  clipPath: 'ellipse(50% 50% at 50% 50%)',
  render: (props) => CylinderRenderer(props),
};
