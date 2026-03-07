import type { ShapeDefinition } from './types';

export const diamondShape: ShapeDefinition = {
  type: 'diamond',
  label: 'Diamond',
  category: 'basic',
  clipPath: 'polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)',
  points: (w, h) => [
    [0, h / 2],
    [w / 2, 0],
    [w, h / 2],
    [w / 2, h],
  ],
};
