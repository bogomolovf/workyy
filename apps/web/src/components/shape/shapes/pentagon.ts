import type { ShapeDefinition } from './types';

export const pentagonShape: ShapeDefinition = {
  type: 'pentagon',
  label: 'Pentagon',
  category: 'basic',
  clipPath: 'polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)',
  points: (w, h) => [
    [w * 0.5, 0],
    [w, h * 0.38],
    [w * 0.81, h],
    [w * 0.19, h],
    [0, h * 0.38],
  ],
};
