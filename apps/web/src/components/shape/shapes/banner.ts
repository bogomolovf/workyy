import type { ShapeDefinition } from './types';

export const bannerShape: ShapeDefinition = {
  type: 'banner',
  label: 'Banner',
  category: 'basic',
  clipPath: 'polygon(0% 0%, 100% 0%, 100% 75%, 50% 100%, 0% 75%)',
  points: (w, h) => [
    [0, 0],
    [w, 0],
    [w, h * 0.75],
    [w * 0.5, h],
    [0, h * 0.75],
  ],
  defaultWidth: 120,
  defaultHeight: 140,
};
