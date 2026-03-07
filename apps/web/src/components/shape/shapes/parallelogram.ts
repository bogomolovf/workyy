import type { ShapeDefinition } from './types';

export const parallelogramShape: ShapeDefinition = {
  type: 'parallelogram',
  label: 'Parallelogram',
  category: 'flowchart',
  clipPath: 'polygon(0% 100%, 25% 0%, 100% 0%, 75% 100%)',
  points: (w, h) => [
    [0, h],
    [w * 0.25, 0],
    [w, 0],
    [w - w * 0.25, h],
  ],
};
