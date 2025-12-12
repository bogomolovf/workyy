import { z } from 'zod';

/**
 * Basic geometric shapes
 */
export const BasicShapeTypeSchema = z.enum([
  'rectangle',
  'round-rectangle',
  'square',
  'circle',
  'ellipse',
  'line',
]);

export type BasicShapeType = z.infer<typeof BasicShapeTypeSchema>;

/**
 * Polygon shapes
 */
export const PolygonShapeTypeSchema = z.enum([
  'triangle',
  'triangle-right',
  'diamond',
  'pentagon',
  'hexagon',
  'polygon', // Custom polygon with arbitrary points
]);

export type PolygonShapeType = z.infer<typeof PolygonShapeTypeSchema>;

/**
 * Arrow shapes (standalone arrow objects, not connections)
 */
export const ArrowShapeObjectTypeSchema = z.enum([
  'arrow-straight',
  'arrow-curved',
  'arrow-polyline',
  'arrow-bidirectional',
  'arrow-outline',
  'arrow-filled',
  'arrow-dashed',
]);

export type ArrowShapeObjectType = z.infer<typeof ArrowShapeObjectTypeSchema>;

/**
 * All shape types
 */
export const ShapeTypeSchema = z.union([
  BasicShapeTypeSchema,
  PolygonShapeTypeSchema,
  ArrowShapeObjectTypeSchema,
]);

export type ShapeType = z.infer<typeof ShapeTypeSchema>;

/**
 * Stroke style
 */
export const StrokeStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export type StrokeStyle = z.infer<typeof StrokeStyleSchema>;

/**
 * Arrow head types for standalone arrows (different from connection arrows)
 */
export const StandaloneArrowHeadTypeSchema = z.enum([
  'triangle',
  'chevron',
  'circle',
  'square',
  'diamond',
  'none',
  'double',
]);

export type StandaloneArrowHeadType = z.infer<typeof StandaloneArrowHeadTypeSchema>;

/**
 * Point coordinates
 */
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Point = z.infer<typeof PointSchema>;

/**
 * Base shape properties
 */
export const BaseShapePropertiesSchema = z.object({
  id: z.string().uuid(),
  type: ShapeTypeSchema,
  position: PointSchema,
  width: z.number().positive().default(160),
  height: z.number().positive().default(96),
  rotation: z.number().default(0), // Rotation in degrees
  stroke: z.string().default('#64748b'),
  strokeWidth: z.number().positive().default(2),
  strokeStyle: StrokeStyleSchema.default('solid'),
  fill: z.string().default('#BFDBFE'),
  opacity: z.number().min(0).max(1).default(1),
});

export type BaseShapeProperties = z.infer<typeof BaseShapePropertiesSchema>;

/**
 * Basic shape specific properties
 */
export const BasicShapePropertiesSchema = BaseShapePropertiesSchema.extend({
  type: BasicShapeTypeSchema,
  // For round-rectangle
  borderRadius: z.number().nonnegative().optional(),
  // For line
  lineDirection: z.enum(['horizontal', 'vertical', 'diagonal']).optional(),
});

export type BasicShapeProperties = z.infer<typeof BasicShapePropertiesSchema>;

/**
 * Polygon shape specific properties
 */
export const PolygonShapePropertiesSchema = BaseShapePropertiesSchema.extend({
  type: PolygonShapeTypeSchema,
  // For custom polygon
  points: z.array(PointSchema).optional(),
  // For triangle-right
  isRightTriangle: z.boolean().optional(),
});

export type PolygonShapeProperties = z.infer<typeof PolygonShapePropertiesSchema>;

/**
 * Arrow shape object specific properties
 */
export const ArrowShapeObjectPropertiesSchema = BaseShapePropertiesSchema.extend({
  type: ArrowShapeObjectTypeSchema,
  // Start and end points for arrow
  startPoint: PointSchema,
  endPoint: PointSchema,
  // Arrow head configuration
  arrowHead: StandaloneArrowHeadTypeSchema.default('triangle'),
  arrowTail: StandaloneArrowHeadTypeSchema.optional(), // For bidirectional arrows
  arrowHeadSize: z.number().positive().default(8),
  // For curved arrows
  curvature: z.number().optional(), // 0-1, controls curve amount
  // For polyline arrows
  polylinePoints: z.array(PointSchema).optional(),
  // For bezier curves
  bezierControlPoints: z
    .object({
      startControlX: z.number(),
      startControlY: z.number(),
      endControlX: z.number(),
      endControlY: z.number(),
    })
    .optional(),
});

export type ArrowShapeObjectProperties = z.infer<typeof ArrowShapeObjectPropertiesSchema>;

/**
 * Complete shape schema (union of all shape types)
 */
export const ShapeSchema = z.union([
  BasicShapePropertiesSchema,
  PolygonShapePropertiesSchema,
  ArrowShapeObjectPropertiesSchema,
]);

export type Shape = z.infer<typeof ShapeSchema>;

/**
 * Anchor point for connecting arrows to shapes
 */
export const ShapeAnchorPointSchema = z.object({
  id: z.string(),
  position: z.enum(['center', 'top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom']),
  customX: z.number().optional(),
  customY: z.number().optional(),
  // For auto-routing
  preferredDirection: z.enum(['left', 'top', 'right', 'bottom']).optional(),
});

export type ShapeAnchorPoint = z.infer<typeof ShapeAnchorPointSchema>;

/**
 * Shape with anchor points
 */
export const ShapeWithAnchorsSchema = z.intersection(
  ShapeSchema,
  z.object({
    anchorPoints: z.array(ShapeAnchorPointSchema).default([]),
  }),
);

export type ShapeWithAnchors = z.infer<typeof ShapeWithAnchorsSchema>;

