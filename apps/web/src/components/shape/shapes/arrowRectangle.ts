import type { ShapeDefinition } from './types';

export const arrowRectangleShape: ShapeDefinition = {
  type: 'arrow-rectangle',
  label: 'Arrow Rectangle',
  category: 'flowchart',
  clipPath: 'polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%)',
  points: (w, h) => [
    [0, 0],
    [w - w * 0.1, 0],
    [w, h / 2],
    [w - w * 0.1, h],
    [0, h],
  ],
};
