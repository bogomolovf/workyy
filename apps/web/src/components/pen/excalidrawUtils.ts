/**
 * Drawing utilities adapted from Excalidraw
 * https://github.com/excalidraw/excalidraw
 *
 * Provides improved freehand drawing with:
 * - Better stroke generation using perfect-freehand
 * - Segment-based hit testing for eraser
 * - SVG path optimization
 */

import getStroke from 'perfect-freehand';
import type { PenPoint } from './types';

// ============================================================================
// Types
// ============================================================================

export type Point = [number, number];
export type PointWithPressure = [number, number, number];

export type LineSegment = [Point, Point];

export type FreeDrawElement = {
  x: number;
  y: number;
  points: PenPoint[];
  strokeWidth: number;
  simulatePressure?: boolean;
  pressures?: number[];
};

// ============================================================================
// Stroke Generation (from Excalidraw)
// ============================================================================

/**
 * Get the outline points for a freedraw element using perfect-freehand
 * Adapted from excalidraw/packages/element/src/shape.ts
 */
export function getFreedrawOutlinePoints(
  points: PenPoint[],
  strokeWidth: number,
  options: {
    simulatePressure?: boolean;
    thinning?: number;
    smoothing?: number;
    streamline?: number;
  } = {},
): Point[] {
  if (!points.length) {
    return [[0, 0]];
  }

  const { simulatePressure = true, thinning = 0.6, smoothing = 0.5, streamline = 0.5 } = options;

  // Convert points to format expected by perfect-freehand
  const inputPoints = simulatePressure
    ? points.map(([x, y]) => [x, y])
    : points.map(([x, y, pressure]) => [x, y, pressure ?? 0.5]);

  return getStroke(inputPoints as number[][], {
    simulatePressure,
    size: strokeWidth,
    thinning,
    smoothing,
    streamline,
    easing: (t) => Math.sin((t * Math.PI) / 2), // easeOutSine
    last: true,
  }) as Point[];
}

/**
 * Convert stroke outline points to an SVG path string
 * Optimized version from Excalidraw with decimal precision trimming
 */
export function getSvgPathFromStroke(points: Point[]): string {
  if (!points.length) {
    return '';
  }

  const max = points.length - 1;

  // Helper for midpoint calculation
  const med = (A: number[], B: number[]) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];

  const pathData = points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), 'L', arr[0], 'Z');
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ['M', points[0], 'Q'] as (string | number[])[],
    )
    .join(' ');

  // Trim SVG path data to 2 decimal places for better performance
  return pathData.replace(/(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g, '$1');
}

/**
 * Generate SVG path from points with all Excalidraw optimizations
 */
export function generateFreeDrawPath(
  points: PenPoint[],
  strokeWidth: number,
  options?: {
    simulatePressure?: boolean;
    thinning?: number;
    smoothing?: number;
    streamline?: number;
  },
): string {
  const outlinePoints = getFreedrawOutlinePoints(points, strokeWidth, options);
  return getSvgPathFromStroke(outlinePoints);
}

// ============================================================================
// Geometry Utilities
// ============================================================================

/**
 * Calculate distance between two points
 */
export function pointDistance(p1: Point, p2: Point): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the minimum distance between two line segments
 * Used for eraser hit testing
 */
export function lineSegmentsDistance(seg1: LineSegment, seg2: LineSegment): number {
  const [[x1, y1], [x2, y2]] = seg1;
  const [[x3, y3], [x4, y4]] = seg2;

  // Check if segments intersect
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

  if (Math.abs(denom) > 0.0001) {
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return 0; // Segments intersect
    }
  }

  // Find minimum distance between endpoints and opposite segments
  const distances = [
    pointToSegmentDistance([x1, y1], seg2),
    pointToSegmentDistance([x2, y2], seg2),
    pointToSegmentDistance([x3, y3], seg1),
    pointToSegmentDistance([x4, y4], seg1),
  ];

  return Math.min(...distances);
}

/**
 * Calculate distance from a point to a line segment
 */
export function pointToSegmentDistance(point: Point, segment: LineSegment): number {
  const [px, py] = point;
  const [[x1, y1], [x2, y2]] = segment;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    return pointDistance(point, [x1, y1]);
  }

  // Project point onto line segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return pointDistance(point, [projX, projY]);
}

/**
 * Check if two bounding boxes intersect
 * Bounds format: [minX, minY, maxX, maxY]
 */
export function doBoundsIntersect(
  bounds1: [number, number, number, number],
  bounds2: [number, number, number, number],
): boolean {
  return !(
    bounds1[2] < bounds2[0] ||
    bounds1[0] > bounds2[2] ||
    bounds1[3] < bounds2[1] ||
    bounds1[1] > bounds2[3]
  );
}

/**
 * Get bounding box from points
 */
export function getBoundsFromPoints(points: Point[]): [number, number, number, number] {
  if (!points.length) {
    return [0, 0, 0, 0];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
}

// ============================================================================
// Eraser Utilities (from Excalidraw)
// ============================================================================

/**
 * Convert freedraw outline points to line segments for hit testing
 * Adapted from excalidraw/packages/element/src/renderElement.ts
 */
export function getFreedrawOutlineAsSegments(
  outlinePoints: Point[],
  elementX: number,
  elementY: number,
): LineSegment[] {
  if (outlinePoints.length < 2) {
    return [];
  }

  const segments: LineSegment[] = [];

  for (let i = 0; i < outlinePoints.length - 1; i++) {
    const p1 = outlinePoints[i];
    const p2 = outlinePoints[i + 1];

    segments.push([
      [p1[0] + elementX, p1[1] + elementY],
      [p2[0] + elementX, p2[1] + elementY],
    ]);
  }

  // Close the path
  if (outlinePoints.length > 2) {
    const first = outlinePoints[0];
    const last = outlinePoints[outlinePoints.length - 1];
    segments.push([
      [last[0] + elementX, last[1] + elementY],
      [first[0] + elementX, first[1] + elementY],
    ]);
  }

  return segments;
}

/**
 * Test if eraser path intersects with a freedraw element
 * This is the core of Excalidraw's eraser logic
 */
export function eraserTestFreedraw(
  eraserSegment: LineSegment,
  element: {
    x: number;
    y: number;
    points: PenPoint[];
    strokeWidth: number;
    width?: number;
    height?: number;
  },
  zoom: number,
): boolean {
  // Quick bounds check first for performance
  const threshold = 15; // pixels
  const eraserBounds: [number, number, number, number] = [
    Math.min(eraserSegment[0][0], eraserSegment[1][0]) - threshold,
    Math.min(eraserSegment[0][1], eraserSegment[1][1]) - threshold,
    Math.max(eraserSegment[0][0], eraserSegment[1][0]) + threshold,
    Math.max(eraserSegment[0][1], eraserSegment[1][1]) + threshold,
  ];

  const elementWidth = element.width ?? 100;
  const elementHeight = element.height ?? 100;

  const elementBounds: [number, number, number, number] = [
    element.x - threshold,
    element.y - threshold,
    element.x + elementWidth + threshold,
    element.y + elementHeight + threshold,
  ];

  if (!doBoundsIntersect(eraserBounds, elementBounds)) {
    return false;
  }

  // Get outline points and convert to segments
  const outlinePoints = getFreedrawOutlinePoints(element.points, element.strokeWidth, {
    simulatePressure: true,
  });

  const strokeSegments = getFreedrawOutlineAsSegments(outlinePoints, element.x, element.y);

  // Check distance between eraser segment and each stroke segment
  const tolerance = Math.max(2.25, 5 / zoom);

  for (const seg of strokeSegments) {
    if (lineSegmentsDistance(seg, eraserSegment) <= tolerance) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a point is inside a polygon (freedraw shape)
 * Uses non-zero winding rule
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  const [px, py] = point;
  let windingNumber = 0;

  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];

    if (y1 <= py) {
      if (y2 > py) {
        // Upward crossing
        const cross = (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
        if (cross > 0) windingNumber++;
      }
    } else {
      if (y2 <= py) {
        // Downward crossing
        const cross = (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
        if (cross < 0) windingNumber--;
      }
    }
  }

  return windingNumber !== 0;
}

// ============================================================================
// Animation Utilities
// ============================================================================

/**
 * Ease out function for animations
 */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease in-out function
 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
