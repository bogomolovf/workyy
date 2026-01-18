/**
 * Path generation utilities for freehand drawing
 * Uses improved algorithms from Excalidraw
 */

import getStroke from 'perfect-freehand';
import type { PenPoint } from './types';

// Default path options based on Excalidraw's optimized values
export const pathOptions = {
  size: 7,
  thinning: 0.6, // Excalidraw uses 0.6
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => Math.sin((t * Math.PI) / 2), // easeOutSine from Excalidraw
  start: {
    taper: 0,
    easing: (t: number) => t,
    cap: true,
  },
  end: {
    taper: 0.1,
    easing: (t: number) => t,
    cap: true,
  },
  last: true, // Important for proper stroke endings
};

export type PathOptions = {
  size?: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
};

/**
 * Convert stroke outline points to SVG path
 * Optimized version from Excalidraw with decimal precision trimming
 */
export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';

  const max = stroke.length - 1;

  // Helper for midpoint calculation
  const med = (A: number[], B: number[]) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];

  const pathData = stroke
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          // Close the path smoothly
          acc.push(point, med(point, arr[0]), 'L', arr[0], 'Z');
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ['M', stroke[0], 'Q'] as (string | number[])[],
    )
    .join(' ');

  // Trim to 2 decimal places for better performance and smaller paths
  return pathData.replace(/(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g, '$1');
}

/**
 * Generate SVG path from points
 * @param points - Array of [x, y, pressure] points
 * @param zoom - Current zoom level for size adjustment
 * @param customOptions - Custom stroke options
 */
export function pointsToPath(points: PenPoint[], zoom = 1, customOptions?: PathOptions): string {
  if (!points.length) return '';

  // Merge options with optimized defaults
  const options = {
    ...pathOptions,
    ...customOptions,
    // Size is the stroke width, adjusted for zoom
    size: (customOptions?.size ?? pathOptions.size) * zoom,
    thinning: customOptions?.thinning ?? pathOptions.thinning,
    smoothing: customOptions?.smoothing ?? pathOptions.smoothing,
    streamline: customOptions?.streamline ?? pathOptions.streamline,
  };

  const stroke = getStroke(points, options);
  return getSvgPathFromStroke(stroke);
}

/**
 * Generate path with simulatePressure option
 * This mimics Excalidraw's behavior where pressure can be simulated or actual
 */
export function pointsToPathWithPressure(
  points: PenPoint[],
  strokeWidth: number,
  options: {
    simulatePressure?: boolean;
    thinning?: number;
    smoothing?: number;
    streamline?: number;
  } = {},
): string {
  if (!points.length) return '';

  const { simulatePressure = true, thinning = 0.6, smoothing = 0.5, streamline = 0.5 } = options;

  // Convert points based on pressure mode
  const inputPoints = simulatePressure
    ? points.map(([x, y]) => [x, y])
    : points.map(([x, y, pressure]) => [x, y, pressure ?? 0.5]);

  const stroke = getStroke(inputPoints as number[][], {
    simulatePressure,
    size: strokeWidth,
    thinning,
    smoothing,
    streamline,
    easing: (t) => Math.sin((t * Math.PI) / 2),
    last: true,
  });

  return getSvgPathFromStroke(stroke);
}

/**
 * Check if a new point should be added (not duplicate)
 * Excalidraw skips duplicate points
 */
export function shouldAddPoint(points: PenPoint[], newPoint: PenPoint, threshold = 0.5): boolean {
  if (points.length === 0) return true;

  const lastPoint = points[points.length - 1];
  const dx = newPoint[0] - lastPoint[0];
  const dy = newPoint[1] - lastPoint[1];
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance > threshold;
}

/**
 * Simplify points by removing duplicates and very close points
 */
export function simplifyPoints(points: PenPoint[], threshold = 1): PenPoint[] {
  if (points.length < 2) return points;

  const result: PenPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];

    const dx = curr[0] - prev[0];
    const dy = curr[1] - prev[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= threshold) {
      result.push(curr);
    }
  }

  // Always include the last point
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }

  return result;
}
