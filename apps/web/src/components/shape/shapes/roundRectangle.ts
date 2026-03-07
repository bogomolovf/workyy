import type { ShapeDefinition } from './types';

export const roundRectangleShape: ShapeDefinition = {
  type: 'round-rectangle',
  label: 'Round Rectangle',
  category: 'basic',
  supportsCornerRadius: true,
  points: (w, h) => [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ],
};
