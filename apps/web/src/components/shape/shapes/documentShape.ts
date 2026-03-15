import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function DocumentShapeRenderer({ width, height, fill, stroke, strokeWidth }: ShapeRenderProps) {
  const w = width;
  const h = height;
  const wave = h * 0.1;
  const bodyH = h - wave;

  const d =
    `M0,0 L${w},0 L${w},${bodyH} ` +
    `C${w * 0.75},${bodyH + wave * 2} ${w * 0.25},${bodyH - wave} 0,${bodyH} Z`;

  return React.createElement('path', { d, fill, stroke, strokeWidth });
}

export const documentShapeShape: ShapeDefinition = {
  type: 'document-shape',
  label: 'Document',
  category: 'flowchart',
  render: (props) => DocumentShapeRenderer(props),
};
