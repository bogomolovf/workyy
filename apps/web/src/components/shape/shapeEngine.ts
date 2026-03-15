/**
 * Shape Engine — single source of truth for shape geometry, styles and drag helpers.
 *
 * HOW TO ADD A NEW SHAPE
 * ──────────────────────
 * 1. Create a file  `shapes/<your-shape>.ts`  that exports a `ShapeDefinition`.
 * 2. Import it in   `shapes/index.ts`  and add to the `SHAPE_DEFINITIONS` array.
 * 3. Add the literal to the `ShapeType` union below.
 * That's it — ShapeNode, ShapePalette and ShapeDragOverlay will pick it up automatically.
 */

import type { ShapeDefinition, ShapeStyleData } from './shapes';
import { SHAPE_REGISTRY } from './shapes';

// ── ShapeType ────────────────────────────────────────────────────────────────

export type ShapeType =
  | 'rectangle'
  | 'round-rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'ellipse'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'star'
  | 'arrow-rectangle'
  | 'plus'
  | 'line'
  | 'arrow'
  | 'pentagon'
  | 'octagon'
  | 'cloud'
  | 'speech-bubble'
  | 'heart'
  | 'document-shape'
  | 'banner';

// ── Constants ────────────────────────────────────────────────────────────────

export const SHAPE_DEFAULTS = {
  fill: 'transparent',
  stroke: '#1f1f1f',
  strokeWidth: 2,
  opacity: 1.0,
  cornerRadius: 0,
  roundRectCornerRadius: 8,
  defaultWidth: 160,
  defaultHeight: 96,
  lineDefaultWidth: 100,
  lineDefaultHeight: 24,
  minSize: 20,
  minLineSize: 10,
  legacyShapeColor: '#BFDBFE',
} as const;

// ── Registry helpers ─────────────────────────────────────────────────────────

export function getShapeDefinition(shapeType: ShapeType): ShapeDefinition | undefined {
  return SHAPE_REGISTRY.get(shapeType);
}

export function getAllShapeDefinitions(): ShapeDefinition[] {
  return Array.from(SHAPE_REGISTRY.values());
}

// ── Style resolution ─────────────────────────────────────────────────────────

export interface ResolvedShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
  arrowHead: boolean | undefined;
}

export function resolveShapeStyle(
  data: ShapeStyleData | undefined,
  shapeType: ShapeType,
): ResolvedShapeStyle {
  const fill = data?.fill ?? data?.shapeColor ?? SHAPE_DEFAULTS.fill;
  const stroke = data?.stroke ?? SHAPE_DEFAULTS.stroke;
  const strokeWidth = data?.strokeWidth ?? SHAPE_DEFAULTS.strokeWidth;
  const opacity = data?.opacity ?? SHAPE_DEFAULTS.opacity;
  const cornerRadius =
    data?.cornerRadius ??
    (shapeType === 'round-rectangle'
      ? SHAPE_DEFAULTS.roundRectCornerRadius
      : SHAPE_DEFAULTS.cornerRadius);
  const arrowHead = data?.arrowHead ?? (shapeType === 'arrow' ? true : undefined);
  return { fill, stroke, strokeWidth, opacity, cornerRadius, arrowHead };
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Build an SVG "M…L…Z" closed path from an array of [x,y] points. */
export function generateShapePath(points: number[][]): string {
  const d = points.map(([x, y]) => `${x},${y}`).join(' L');
  return `M${d} Z`;
}

/**
 * Return an array of [x,y] vertices for the given shape at the given size.
 * Used by ShapeNode (SVG rendering) and ShapePalette (icon rendering).
 * Returns `null` for shapes that are not polygon-based (circle, ellipse, cylinder, line, arrow).
 */
export function getShapePoints(shapeType: ShapeType, w: number, h: number): number[][] | null {
  const def = SHAPE_REGISTRY.get(shapeType);
  if (!def || !def.points) return null;
  return def.points(w, h);
}

/**
 * Return a CSS `clip-path` value (percentage-based, so it scales automatically).
 * Returns `undefined` for shapes that use CSS border-radius instead (rect, round-rect, circle, ellipse)
 * and for line types.
 */
export function getShapeClipPath(shapeType: ShapeType): string | undefined {
  const def = SHAPE_REGISTRY.get(shapeType);
  return def?.clipPath;
}

/**
 * Build the cylinder SVG path string (body + top ellipse).
 */
export function getCylinderPath(w: number, h: number): string {
  const cap = h * 0.125;
  return (
    `M0,${cap} L0,${h - cap} ` +
    `A${w / 2} ${cap} 0 1 0 ${w} ${h - cap} ` +
    `L${w},${cap} ` +
    `A${w / 2} ${cap} 0 1 1 0 ${cap} ` +
    `A${w / 2} ${cap} 0 1 1 ${w} ${cap} ` +
    `A${w / 2} ${cap} 0 1 1 0 ${cap} z`
  );
}

/**
 * Star polygon points (five-pointed star).
 */
export function getStarPoints(w: number, h: number): string {
  return [
    `${w / 2},${h * 0.1}`,
    `${w * 0.6},${h * 0.35}`,
    `${w},${h * 0.35}`,
    `${w * 0.7},${h * 0.55}`,
    `${w * 0.85},${h * 0.9}`,
    `${w / 2},${h * 0.7}`,
    `${w * 0.15},${h * 0.9}`,
    `${w * 0.3},${h * 0.55}`,
    `0,${h * 0.35}`,
    `${w * 0.4},${h * 0.35}`,
  ].join(' ');
}

// ── Predicates ───────────────────────────────────────────────────────────────

export function isLineType(shapeType: ShapeType): boolean {
  return shapeType === 'line' || shapeType === 'arrow';
}

// ── Drag normalisation ───────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

interface DragOptions {
  shift?: boolean;
  alt?: boolean;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedLine extends NormalizedRect {
  endX: number;
  endY: number;
}

/**
 * Normalise a rectangular drag gesture so width/height are always positive.
 * Supports Shift (aspect ratio lock) and Alt/Meta (draw from center).
 */
export function normalizeDragRect(
  start: Point,
  current: Point,
  opts: DragOptions = {},
): NormalizedRect {
  let x1 = start.x;
  let y1 = start.y;
  let x2 = current.x;
  let y2 = current.y;

  let w = Math.abs(x2 - x1);
  let h = Math.abs(y2 - y1);

  if (opts.alt) {
    w *= 2;
    h *= 2;
    x1 = start.x - w / 2;
    y1 = start.y - h / 2;
    x2 = start.x + w / 2;
    y2 = start.y + h / 2;
  }

  if (opts.shift) {
    const size = Math.max(w, h);
    w = size;
    h = size;
    if (x2 < x1) x1 = start.x - size + (opts.alt ? size / 2 : 0);
    if (y2 < y1) y1 = start.y - size + (opts.alt ? size / 2 : 0);
  }

  const finalX = opts.alt ? x1 : Math.min(x1, x2);
  const finalY = opts.alt ? y1 : Math.min(y1, y2);

  return {
    x: finalX,
    y: finalY,
    width: Math.max(w, SHAPE_DEFAULTS.minSize),
    height: Math.max(h, SHAPE_DEFAULTS.minSize),
  };
}

/**
 * Normalise a line/arrow drag gesture.
 * Shift snaps angle to nearest 45 degrees.
 * Returns bounding-box position/size plus relative endX/endY.
 */
export function normalizeDragLine(
  start: Point,
  current: Point,
  opts: DragOptions = {},
): NormalizedLine {
  let x2 = current.x;
  let y2 = current.y;

  if (opts.shift) {
    const dx = x2 - start.x;
    const dy = y2 - start.y;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.sqrt(dx * dx + dy * dy);
    x2 = start.x + Math.cos(snapped) * dist;
    y2 = start.y + Math.sin(snapped) * dist;
  }

  const bboxX = Math.min(start.x, x2);
  const bboxY = Math.min(start.y, y2);
  const w = Math.abs(x2 - start.x);
  const h = Math.abs(y2 - start.y);

  return {
    x: bboxX,
    y: bboxY,
    width: Math.max(w, SHAPE_DEFAULTS.minLineSize),
    height: Math.max(h, SHAPE_DEFAULTS.minLineSize),
    endX: x2 - start.x,
    endY: y2 - start.y,
  };
}

// Re-export types used across files
export type { ShapeDefinition, ShapeStyleData } from './shapes';
