import React from 'react';
import type { ShapeDefinition, ShapeRenderProps } from './types';

function ArrowRenderer({
  width,
  height,
  stroke,
  strokeWidth,
  arrowHead,
  nodeId,
  startX,
  startY,
  endX,
  endY,
}: ShapeRenderProps) {
  const markerId = `arrowhead-${nodeId ?? 'preview'}`;
  const showHead = arrowHead !== false;

  return React.createElement(
    React.Fragment,
    null,
    showHead &&
      React.createElement(
        'defs',
        null,
        React.createElement(
          'marker',
          {
            id: markerId,
            markerWidth: '10',
            markerHeight: '10',
            refX: '9',
            refY: '3',
            orient: 'auto',
            markerUnits: 'strokeWidth',
          },
          React.createElement('path', { d: 'M0,0 L0,6 L9,3 z', fill: stroke }),
        ),
      ),
    React.createElement('line', {
      x1: startX ?? 0,
      y1: startY ?? 0,
      x2: endX ?? width,
      y2: endY ?? height,
      stroke,
      strokeWidth,
      fill: 'none',
      strokeLinecap: 'round',
      markerEnd: showHead ? `url(#${markerId})` : undefined,
    }),
  );
}

export const arrowShape: ShapeDefinition = {
  type: 'arrow',
  label: 'Arrow',
  category: 'line',
  defaultWidth: 100,
  defaultHeight: 24,
  render: (props) => ArrowRenderer(props),
};
