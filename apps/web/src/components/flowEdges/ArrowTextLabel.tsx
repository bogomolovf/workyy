'use client';

import { memo } from 'react';

type ArrowTextLabelProps = {
  text: string;
  x: number;
  y: number;
  angle: number;
  style?: {
    fontSize?: number;
    color?: string;
    fontWeight?: 'normal' | 'bold';
  };
};

/**
 * Text label component for arrows
 * Automatically aligns text along the arrow direction
 */
export const ArrowTextLabel = memo(function ArrowTextLabel({
  text,
  x,
  y,
  angle,
  style,
}: ArrowTextLabelProps) {
  const fontSize = style?.fontSize || 12;
  const color = style?.color || '#000000';
  const fontWeight = style?.fontWeight || 'normal';

  // Normalize angle to -90 to 90 for better text readability
  let normalizedAngle = angle;
  if (normalizedAngle > 90) {
    normalizedAngle = normalizedAngle - 180;
  } else if (normalizedAngle < -90) {
    normalizedAngle = normalizedAngle + 180;
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      <text
        x={0}
        y={0}
        fontSize={fontSize}
        fill={color}
        fontWeight={fontWeight}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${normalizedAngle})`}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {text}
      </text>
    </g>
  );
});




