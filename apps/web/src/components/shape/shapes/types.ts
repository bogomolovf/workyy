import type { ReactNode } from 'react';

/**
 * Minimal style-data contract used by resolveShapeStyle.
 * Keeps the engine decoupled from the full ShapeNodeData type.
 */
export interface ShapeStyleData {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
  arrowHead?: boolean;
  shapeColor?: string; // legacy
}

/**
 * Shape render props passed to custom render functions.
 */
export interface ShapeRenderProps {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
  arrowHead?: boolean;
  /** Unique node id (for SVG marker ids etc.) */
  nodeId?: string;
  /** Line/arrow start/end */
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

/**
 * A shape definition that is registered in the shape registry.
 *
 * HOW TO CREATE A NEW SHAPE
 * ─────────────────────────
 * 1. Create `shapes/<name>.ts` and export a `ShapeDefinition`.
 * 2. Add it to `shapes/index.ts` → `ALL_SHAPES` array.
 * 3. Add the string literal to `ShapeType` in `shapeEngine.ts`.
 *
 * Required fields: type, label, category.
 * Provide EITHER `clipPath` (CSS percentage polygon) OR `render` (JSX factory)
 * depending on the shape complexity.
 */
export interface ShapeDefinition {
  /** Must match a value in the ShapeType union. */
  type: string;

  /** Human-readable label shown in the palette tooltip. */
  label: string;

  /** Grouping category — 'basic' shapes, 'flowchart' shapes, or 'line' tools. */
  category: 'basic' | 'flowchart' | 'line';

  /**
   * CSS `clip-path` value using percentages (scales automatically).
   * Used by ShapeDragOverlay for the preview and as a fallback renderer.
   * Omit for shapes that use border-radius (rectangle, circle) or custom render.
   */
  clipPath?: string;

  /**
   * Returns [x,y][] polygon vertices for a given width/height.
   * Used by SVG icon rendering in the palette and the node renderer.
   * Return `null` from the engine when the shape is not polygon-based.
   */
  points?: (w: number, h: number) => number[][];

  /**
   * Custom SVG/JSX render function for shapes that can't be expressed
   * as a simple clip-path polygon (cylinder, line, arrow, etc.).
   */
  render?: (props: ShapeRenderProps) => ReactNode;

  /** Whether this shape supports the corner-radius control. */
  supportsCornerRadius?: boolean;

  /** Default width when click-creating (no drag). */
  defaultWidth?: number;

  /** Default height when click-creating (no drag). */
  defaultHeight?: number;
}
