import type {
  ArrowConfig,
  ArrowShapeType,
  ArrowHeadType,
  ArrowHeadConfig,
} from '@workyy/core-domain';

export type Point = { x: number; y: number };

/**
 * Generates SVG path for different arrow shapes
 */
export function generateArrowPath(
  shapeType: ArrowShapeType,
  start: Point,
  end: Point,
  config: ArrowConfig,
): string {
  switch (shapeType) {
    case 'straight':
    case 'straight-bidirectional':
      return generateStraightPath(start, end);
    case 'polyline':
      return generatePolylinePath(start, end, config.polylinePoints || []);
    case 'bezier':
      return generateBezierPath(start, end, config.bezierControlPoints);
    case 'curved':
      return generateCurvedPath(start, end, config.curvedRadius);
    case 'orthogonal':
      return generateOrthogonalPath(start, end, config.orthogonalOffset);
    default:
      return generateStraightPath(start, end);
  }
}

/**
 * Generates straight line path
 */
function generateStraightPath(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/**
 * Generates polyline path with intermediate points
 */
function generatePolylinePath(start: Point, end: Point, points: Point[]): string {
  const allPoints = [start, ...points, end];
  return allPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}

/**
 * Generates Bezier curve path
 */
function generateBezierPath(
  start: Point,
  end: Point,
  controlPoints?: {
    startControlX: number;
    startControlY: number;
    endControlX: number;
    endControlY: number;
  },
): string {
  if (controlPoints) {
    // Cubic Bezier curve with custom control points
    return `M ${start.x} ${start.y} C ${controlPoints.startControlX} ${controlPoints.startControlY}, ${controlPoints.endControlX} ${controlPoints.endControlY}, ${end.x} ${end.y}`;
  } else {
    // Default smooth curve
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const controlOffset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5;
    const startControlX = start.x + controlOffset;
    const startControlY = start.y;
    const endControlX = end.x - controlOffset;
    const endControlY = end.y;
    return `M ${start.x} ${start.y} C ${startControlX} ${startControlY}, ${endControlX} ${endControlY}, ${end.x} ${end.y}`;
  }
}

/**
 * Generates curved path (quadratic Bezier)
 */
function generateCurvedPath(start: Point, end: Point, radius?: number): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const defaultRadius = distance * 0.5;
  const curveRadius = radius || defaultRadius;

  // Calculate control point for quadratic Bezier
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const controlX = midX + perpX * curveRadius;
  const controlY = midY + perpY * curveRadius;

  return `M ${start.x} ${start.y} Q ${controlX} ${controlY}, ${end.x} ${end.y}`;
}

/**
 * Generates orthogonal (step) path
 */
function generateOrthogonalPath(start: Point, end: Point, offset: number): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Determine if we should go horizontal first or vertical first
  const horizontalFirst = absDx > absDy;

  if (horizontalFirst) {
    // Go horizontal, then vertical
    const midX = start.x + (dx > 0 ? offset : -offset);
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  } else {
    // Go vertical, then horizontal
    const midY = start.y + (dy > 0 ? offset : -offset);
    return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
  }
}

/**
 * Calculates point on path at given distance (0-1)
 */
export function getPointOnPath(path: string, t: number): Point {
  // Simple approximation: for straight lines
  if (path.startsWith('M') && path.includes('L')) {
    const matches = path.match(/M\s+([\d.]+)\s+([\d.]+)\s+L\s+([\d.]+)\s+([\d.]+)/);
    if (matches) {
      const startX = parseFloat(matches[1]);
      const startY = parseFloat(matches[2]);
      const endX = parseFloat(matches[3]);
      const endY = parseFloat(matches[4]);
      return {
        x: startX + (endX - startX) * t,
        y: startY + (endY - startY) * t,
      };
    }
  }
  // For more complex paths, we'd need to use SVG path length API
  // For now, return midpoint as fallback
  return { x: 0, y: 0 };
}

/**
 * Generates SVG path for arrow head
 */
export function generateArrowHeadPath(
  headType: ArrowHeadType,
  size: number,
): string {
  const halfSize = size / 2;
  const quarterSize = size / 4;

  switch (headType) {
    case 'triangle':
      return `M 0 0 L ${size} ${halfSize} L 0 ${size} Z`;
    case 'line':
      return `M 0 ${halfSize} L ${size} ${halfSize}`;
    case 'circle':
      return `M ${size} ${halfSize} A ${halfSize} ${halfSize} 0 1 1 ${size} ${halfSize - 0.1}`;
    case 'diamond':
      return `M 0 ${halfSize} L ${halfSize} 0 L ${size} ${halfSize} L ${halfSize} ${size} Z`;
    case 'flat':
      return `M 0 0 L ${size} ${halfSize} L 0 ${size}`;
    case 'chevron':
      // V-shaped chevron
      return `M 0 ${halfSize} L ${halfSize} 0 L ${size} ${halfSize} L ${halfSize} ${size} Z`;
    case 'square':
      return `M 0 ${quarterSize} L 0 ${size - quarterSize} L ${size} ${size - quarterSize} L ${size} ${quarterSize} Z`;
    case 'double':
      // Double arrow head - two triangles
      const innerSize = size * 0.6;
      return `M 0 0 L ${size} ${halfSize} L 0 ${size} Z M ${size * 0.4} ${halfSize * 0.5} L ${size * 0.4 + innerSize} ${halfSize} L ${size * 0.4} ${halfSize * 1.5} Z`;
    case 'none':
      return ''; // No head
    default:
      return `M 0 0 L ${size} ${halfSize} L 0 ${size} Z`;
  }
}

/**
 * Calculates angle between two points in degrees
 */
export function calculateAngle(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Calculates distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

