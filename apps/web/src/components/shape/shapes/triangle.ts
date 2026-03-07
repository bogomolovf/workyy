import type { ShapeDefinition } from './types';

export const triangleShape: ShapeDefinition = {
  type: 'triangle',
  label: 'Triangle',
  category: 'basic',
  clipPath: 'polygon(0% 100%, 50% 0%, 100% 100%)',
  points: (w, h) => [
    [0, h],
    [w / 2, 0],
    [w, h],
  ],
};
