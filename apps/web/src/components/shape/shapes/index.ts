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
import { bannerShape } from './banner';
import { circleShape } from './circle';
import { cloudShape } from './cloud';
import { cylinderShape } from './cylinder';
import { diamondShape } from './diamond';
import { documentShapeShape } from './documentShape';
import { ellipseShape } from './ellipse';
import { heartShape } from './heart';
import { hexagonShape } from './hexagon';
import { lineShape } from './line';
import { octagonShape } from './octagon';
import { parallelogramShape } from './parallelogram';
import { pentagonShape } from './pentagon';
import { plusShape } from './plus';
import { rectangleShape } from './rectangle';
import { roundRectangleShape } from './roundRectangle';
import { speechBubbleShape } from './speechBubble';
import { starShape } from './star';
import { triangleShape } from './triangle';

import type { ShapeDefinition } from './types';

/** Ordered list — controls palette display order, grouped by category. */
const ALL_SHAPES: ShapeDefinition[] = [
  // Basic shapes
  rectangleShape,
  roundRectangleShape,
  circleShape,
  ellipseShape,
  triangleShape,
  diamondShape,
  pentagonShape,
  hexagonShape,
  octagonShape,
  starShape,
  heartShape,
  cloudShape,
  bannerShape,
  // Flowchart
  parallelogramShape,
  cylinderShape,
  arrowRectangleShape,
  plusShape,
  documentShapeShape,
  speechBubbleShape,
  // Lines
  lineShape,
  arrowShape,
];

/** Fast lookup by type string. */
export const SHAPE_REGISTRY: ReadonlyMap<string, ShapeDefinition> = new Map(
  ALL_SHAPES.map((s) => [s.type, s]),
);

/** Ordered array for palette rendering. */
export const SHAPE_LIST: readonly ShapeDefinition[] = ALL_SHAPES;
