import type { ShapeDefinition } from './types';

export const starShape: ShapeDefinition = {
  type: 'star',
  label: 'Star',
  category: 'basic',
  clipPath:
    'polygon(50% 10%, 60% 35%, 100% 35%, 70% 55%, 85% 90%, 50% 70%, 15% 90%, 30% 55%, 0% 35%, 40% 35%)',
  points: (w, h) => [
    [w / 2, h * 0.1],
    [w * 0.6, h * 0.35],
    [w, h * 0.35],
    [w * 0.7, h * 0.55],
    [w * 0.85, h * 0.9],
    [w / 2, h * 0.7],
    [w * 0.15, h * 0.9],
    [w * 0.3, h * 0.55],
    [0, h * 0.35],
    [w * 0.4, h * 0.35],
  ],
};
