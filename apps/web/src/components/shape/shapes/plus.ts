import type { ShapeDefinition } from './types';

export const plusShape: ShapeDefinition = {
  type: 'plus',
  label: 'Plus',
  category: 'basic',
  clipPath:
    'polygon(33% 0%, 67% 0%, 67% 33%, 100% 33%, 100% 67%, 67% 67%, 67% 100%, 33% 100%, 33% 67%, 0% 67%, 0% 33%, 33% 33%)',
  points: (w, h) => [
    [w / 3, 0],
    [w * (2 / 3), 0],
    [w * (2 / 3), h / 3],
    [w, h / 3],
    [w, h * (2 / 3)],
    [w * (2 / 3), h * (2 / 3)],
    [w * (2 / 3), h],
    [w / 3, h],
    [w / 3, h * (2 / 3)],
    [0, h * (2 / 3)],
    [0, h / 3],
    [w / 3, h / 3],
  ],
};
