import type {
  Shape,
  BasicShapeProperties,
  PolygonShapeProperties,
  ArrowShapeObjectProperties,
  ShapeType,
  BasicShapeType,
  PolygonShapeType,
  ArrowShapeObjectType,
  Point,
} from './schemas/shape';

/**
 * ShapeFactory - Factory for creating shapes with default parameters
 */
export class ShapeFactory {
  /**
   * Create a basic geometric shape
   */
  static createBasicShape(
    type: BasicShapeType,
    position: Point,
    options?: {
      width?: number;
      height?: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeStyle?: 'solid' | 'dashed' | 'dotted';
      borderRadius?: number;
      lineDirection?: 'horizontal' | 'vertical' | 'diagonal';
      rotation?: number;
    },
  ): BasicShapeProperties {
    const defaults = this.getDefaultDimensions(type);
    return {
      id: this.generateId(),
      type,
      position,
      width: options?.width ?? defaults.width,
      height: options?.height ?? defaults.height,
      rotation: options?.rotation ?? 0,
      stroke: options?.stroke ?? '#64748b',
      strokeWidth: options?.strokeWidth ?? 2,
      strokeStyle: options?.strokeStyle ?? 'solid',
      fill: options?.fill ?? '#BFDBFE',
      opacity: 1,
      ...(type === 'round-rectangle' && { borderRadius: options?.borderRadius ?? 12 }),
      ...(type === 'line' && { lineDirection: options?.lineDirection ?? 'horizontal' }),
    };
  }

  /**
   * Create a polygon shape
   */
  static createPolygonShape(
    type: PolygonShapeType,
    position: Point,
    options?: {
      width?: number;
      height?: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeStyle?: 'solid' | 'dashed' | 'dotted';
      points?: Point[];
      isRightTriangle?: boolean;
      rotation?: number;
    },
  ): PolygonShapeProperties {
    const defaults = this.getDefaultDimensions(type);
    return {
      id: this.generateId(),
      type,
      position,
      width: options?.width ?? defaults.width,
      height: options?.height ?? defaults.height,
      rotation: options?.rotation ?? 0,
      stroke: options?.stroke ?? '#64748b',
      strokeWidth: options?.strokeWidth ?? 2,
      strokeStyle: options?.strokeStyle ?? 'solid',
      fill: options?.fill ?? '#BFDBFE',
      opacity: 1,
      ...(type === 'polygon' && { points: options?.points ?? this.getDefaultPolygonPoints(defaults.width, defaults.height) }),
      ...(type === 'triangle-right' && { isRightTriangle: options?.isRightTriangle ?? true }),
    };
  }

  /**
   * Create an arrow shape object
   */
  static createArrowShape(
    type: ArrowShapeObjectType,
    position: Point,
    options?: {
      startPoint?: Point;
      endPoint?: Point;
      width?: number;
      height?: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeStyle?: 'solid' | 'dashed' | 'dotted';
      arrowHead?: 'triangle' | 'chevron' | 'circle' | 'square' | 'diamond' | 'none' | 'double';
      arrowTail?: 'triangle' | 'chevron' | 'circle' | 'square' | 'diamond' | 'none' | 'double';
      arrowHeadSize?: number;
      curvature?: number;
      polylinePoints?: Point[];
      bezierControlPoints?: {
        startControlX: number;
        startControlY: number;
        endControlX: number;
        endControlY: number;
      };
      rotation?: number;
    },
  ): ArrowShapeObjectProperties {
    const defaults = this.getDefaultDimensions(type);
    const width = options?.width ?? defaults.width;
    const height = options?.height ?? defaults.height;

    // Default start and end points (relative to position)
    const startPoint: Point = options?.startPoint ?? { x: 0, y: height / 2 };
    const endPoint: Point = options?.endPoint ?? { x: width, y: height / 2 };

    return {
      id: this.generateId(),
      type,
      position,
      width,
      height,
      rotation: options?.rotation ?? 0,
      stroke: options?.stroke ?? '#64748b',
      strokeWidth: options?.strokeWidth ?? 2,
      strokeStyle: options?.strokeStyle ?? 'solid',
      fill: options?.fill ?? '#BFDBFE',
      opacity: 1,
      startPoint,
      endPoint,
      arrowHead: options?.arrowHead ?? 'triangle',
      arrowHeadSize: options?.arrowHeadSize ?? 8,
      ...(options?.arrowTail && { arrowTail: options.arrowTail }),
      ...(type === 'arrow-curved' && { curvature: options?.curvature ?? 0.5 }),
      ...(type === 'arrow-polyline' && { polylinePoints: options?.polylinePoints }),
      ...(options?.bezierControlPoints && { bezierControlPoints: options.bezierControlPoints }),
    };
  }

  /**
   * Create a shape from type (generic factory method)
   */
  static createShape(
    type: ShapeType,
    position: Point,
    options?: {
      width?: number;
      height?: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeStyle?: 'solid' | 'dashed' | 'dotted';
      rotation?: number;
      [key: string]: unknown;
    },
  ): Shape {
    if (this.isBasicShapeType(type)) {
      return this.createBasicShape(type, position, options);
    }
    if (this.isPolygonShapeType(type)) {
      return this.createPolygonShape(type, position, options);
    }
    if (this.isArrowShapeObjectType(type)) {
      return this.createArrowShape(type, position, options);
    }
    throw new Error(`Unknown shape type: ${type}`);
  }

  /**
   * Get default dimensions for a shape type
   */
  private static getDefaultDimensions(type: ShapeType): { width: number; height: number } {
    const defaults: Record<ShapeType, { width: number; height: number }> = {
      // Basic shapes
      rectangle: { width: 160, height: 96 },
      'round-rectangle': { width: 160, height: 96 },
      square: { width: 120, height: 120 },
      circle: { width: 120, height: 120 },
      ellipse: { width: 160, height: 96 },
      line: { width: 200, height: 2 },

      // Polygons
      triangle: { width: 120, height: 104 },
      'triangle-right': { width: 120, height: 96 },
      diamond: { width: 120, height: 120 },
      pentagon: { width: 120, height: 120 },
      hexagon: { width: 120, height: 104 },
      polygon: { width: 160, height: 120 },

      // Arrow shapes
      'arrow-straight': { width: 200, height: 40 },
      'arrow-curved': { width: 200, height: 100 },
      'arrow-polyline': { width: 200, height: 100 },
      'arrow-bidirectional': { width: 200, height: 40 },
      'arrow-outline': { width: 200, height: 40 },
      'arrow-filled': { width: 200, height: 40 },
      'arrow-dashed': { width: 200, height: 40 },
    };

    return defaults[type] ?? { width: 160, height: 96 };
  }

  /**
   * Get default polygon points for custom polygon
   */
  private static getDefaultPolygonPoints(width: number, height: number): Point[] {
    // Default to hexagon-like shape
    return [
      { x: width / 2, y: 0 },
      { x: width, y: height * 0.25 },
      { x: width, y: height * 0.75 },
      { x: width / 2, y: height },
      { x: 0, y: height * 0.75 },
      { x: 0, y: height * 0.25 },
    ];
  }

  /**
   * Type guards
   */
  private static isBasicShapeType(type: ShapeType): type is BasicShapeType {
    return ['rectangle', 'round-rectangle', 'square', 'circle', 'ellipse', 'line'].includes(type);
  }

  private static isPolygonShapeType(type: ShapeType): type is PolygonShapeType {
    return ['triangle', 'triangle-right', 'diamond', 'pentagon', 'hexagon', 'polygon'].includes(type);
  }

  private static isArrowShapeObjectType(type: ShapeType): type is ArrowShapeObjectType {
    return [
      'arrow-straight',
      'arrow-curved',
      'arrow-polyline',
      'arrow-bidirectional',
      'arrow-outline',
      'arrow-filled',
      'arrow-dashed',
    ].includes(type);
  }

  /**
   * Generate unique ID for shape
   */
  private static generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

