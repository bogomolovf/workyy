import type { ShapeDefinition } from './types';

export const octagonShape: ShapeDefinition = {
  type: 'octagon',
  label: 'Octagon',
  category: 'basic',
  clipPath: 'polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)',
  points: (w, h) => [
    [w * 0.29, 0],
    [w * 0.71, 0],
    [w, h * 0.29],
    [w, h * 0.71],
    [w * 0.71, h],
    [w * 0.29, h],
    [0, h * 0.71],
    [0, h * 0.29],
  ],
};
