import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function SpeechBubbleRenderer({
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  cornerRadius,
}: ShapeRenderProps) {
  const w = width;
  const h = height;
  const r = Math.min(cornerRadius || 12, Math.min(w, h) * 0.25);
  const tailH = h * 0.2;
  const bodyH = h - tailH;

  // Rounded rectangle body + triangle tail at bottom-left
  const d =
    `M${r},0 ` +
    `L${w - r},0 Q${w},0 ${w},${r} ` +
    `L${w},${bodyH - r} Q${w},${bodyH} ${w - r},${bodyH} ` +
    `L${w * 0.35},${bodyH} ` +
    `L${w * 0.15},${h} ` +
    `L${w * 0.2},${bodyH} ` +
    `L${r},${bodyH} Q0,${bodyH} 0,${bodyH - r} ` +
    `L0,${r} Q0,0 ${r},0 Z`;

  return React.createElement('path', { d, fill, stroke, strokeWidth });
}

export const speechBubbleShape: ShapeDefinition = {
  type: 'speech-bubble',
  label: 'Speech Bubble',
  category: 'basic',
  supportsCornerRadius: true,
  render: (props) => SpeechBubbleRenderer(props),
};
