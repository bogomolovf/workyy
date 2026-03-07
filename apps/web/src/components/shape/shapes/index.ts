/**
 * Shape registry — collects all shape definitions into a lookup map.
 *
 * TO ADD A NEW SHAPE:
 * 1. Create  `shapes/<name>.ts`  exporting a ShapeDefinition.
 * 2. Import it below and append to ALL_SHAPES.
 * 3. Add the string literal to `ShapeType` in `../shapeEngine.ts`.
 */

export type { ShapeDefinition, ShapeStyleData, ShapeRenderProps } from './types';

import { arrowShape } from './arrow';
import { arrowRectangleShape } from './arrowRectangle';
import { circleShape } from './circle';
import { cylinderShape } from './cylinder';
import { diamondShape } from './diamond';
import { ellipseShape } from './ellipse';
import { hexagonShape } from './hexagon';
import { lineShape } from './line';
import { parallelogramShape } from './parallelogram';
import { plusShape } from './plus';
import { rectangleShape } from './rectangle';
import { roundRectangleShape } from './roundRectangle';
import { starShape } from './star';
import { triangleShape } from './triangle';

import type { ShapeDefinition } from './types';

/** Ordered list — controls palette display order. */
const ALL_SHAPES: ShapeDefinition[] = [
  rectangleShape,
  roundRectangleShape,
  circleShape,
  diamondShape,
  triangleShape,
  ellipseShape,
  hexagonShape,
  parallelogramShape,
  cylinderShape,
  arrowRectangleShape,
  plusShape,
  starShape,
  lineShape,
  arrowShape,
];

/** Fast lookup by type string. */
export const SHAPE_REGISTRY: ReadonlyMap<string, ShapeDefinition> = new Map(
  ALL_SHAPES.map((s) => [s.type, s]),
);

/** Ordered array for palette rendering. */
export const SHAPE_LIST: readonly ShapeDefinition[] = ALL_SHAPES;
