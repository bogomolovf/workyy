import type { ShapeDefinition } from './types';

export const hexagonShape: ShapeDefinition = {
  type: 'hexagon',
  label: 'Hexagon',
  category: 'basic',
  clipPath: 'polygon(0% 50%, 10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%)',
  points: (w, h) => [
    [0, h / 2],
    [w * 0.1, 0],
    [w * 0.9, 0],
    [w, h / 2],
    [w * 0.9, h],
    [w * 0.1, h],
  ],
};
