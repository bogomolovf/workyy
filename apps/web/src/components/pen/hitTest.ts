/**
 * Hit testing utilities for pen nodes
 * Based on Excalidraw's approach to hit detection
 */

import { pointsToPath } from './path';
import type { PenPoint } from './types';

/**
 * Check if a point hits a pen stroke using SVG path hit testing
 */
export function isPointInPenStroke(
  point: { x: number; y: number },
  nodeData: {
    points: PenPoint[];
    position: { x: number; y: number };
    width: number;
    height: number;
    strokeWidth?: number;
    smoothing?: number;
    thinning?: number;
  },
  eraserSize: number = 20,
): boolean {
  // First check bounding box (fast rejection)
  const bounds = {
    x: nodeData.position.x,
    y: nodeData.position.y,
    width: nodeData.width,
    height: nodeData.height,
  };

  // Expand bounds by eraser radius for better hit detection
  const expandedBounds = {
    x: bounds.x - eraserSize / 2,
    y: bounds.y - eraserSize / 2,
    width: bounds.width + eraserSize,
    height: bounds.height + eraserSize,
  };

  if (
    point.x < expandedBounds.x ||
    point.x > expandedBounds.x + expandedBounds.width ||
    point.y < expandedBounds.y ||
    point.y > expandedBounds.y + expandedBounds.height
  ) {
    return false;
  }

  // Convert point to coordinates relative to the node
  const relativePoint = {
    x: point.x - bounds.x,
    y: point.y - bounds.y,
  };

  // Generate SVG path from points
  const pathData = pointsToPath(nodeData.points, 1, {
    size: nodeData.strokeWidth || 7,
    smoothing: nodeData.smoothing,
    thinning: nodeData.thinning,
  });

  if (!pathData) {
    return false;
  }

  // Use Canvas API for hit testing (more reliable than SVG)
  const canvas = document.createElement('canvas');
  canvas.width = bounds.width;
  canvas.height = bounds.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    // Fallback to bounding box if canvas is not available
    return true;
  }

  // Create Path2D from SVG path data
  const path = new Path2D(pathData);

  // Check if point is in the path
  // Also check a small area around the point (eraser size)
  const checkRadius = eraserSize / 2;
  const samples = 8; // Sample points in a circle around the eraser center

  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * Math.PI * 2;
    const sampleX = relativePoint.x + Math.cos(angle) * checkRadius;
    const sampleY = relativePoint.y + Math.sin(angle) * checkRadius;

    if (ctx.isPointInPath(path, sampleX, sampleY)) {
      return true;
    }
  }

  // Also check if any point on the path is within eraser radius
  // This handles thin strokes that might not be hit by the circle sampling
  const strokeWidth = nodeData.strokeWidth || 7;
  const minDistance = (strokeWidth + eraserSize) / 2;

  // Check distance from point to path segments
  const points = nodeData.points;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Distance from point to line segment
    const distance = distanceToLineSegment(
      relativePoint,
      { x: p1[0], y: p1[1] },
      { x: p2[0], y: p2[1] },
    );

    if (distance <= minDistance) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate distance from a point to a line segment
 */
function distanceToLineSegment(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Simplified hit test using bounding box expansion (faster but less accurate)
 * Use this for performance-critical scenarios
 */
export function isPointInPenStrokeBBox(
  point: { x: number; y: number },
  nodeData: {
    position: { x: number; y: number };
    width: number;
    height: number;
  },
  eraserSize: number = 20,
): boolean {
  const expandedBounds = {
    x: nodeData.position.x - eraserSize / 2,
    y: nodeData.position.y - eraserSize / 2,
    width: nodeData.width + eraserSize,
    height: nodeData.height + eraserSize,
  };

  return (
    point.x >= expandedBounds.x &&
    point.x <= expandedBounds.x + expandedBounds.width &&
    point.y >= expandedBounds.y &&
    point.y <= expandedBounds.y + expandedBounds.height
  );
}
