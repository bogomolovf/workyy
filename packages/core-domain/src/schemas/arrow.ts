import { z } from 'zod';

/**
 * Arrow head types
 */
export const ArrowHeadTypeSchema = z.enum([
  'triangle', // Треугольник (по умолчанию)
  'line', // Линия
  'circle', // Круг
  'diamond', // Ромб
  'flat', // Плоский наконечник
  'chevron', // Шеврон (V-образный)
  'square', // Квадрат
  'double', // Двойная голова
  'none', // Без головы
]);

export type ArrowHeadType = z.infer<typeof ArrowHeadTypeSchema>;

/**
 * Arrow head configuration
 */
export const ArrowHeadConfigSchema = z.object({
  type: ArrowHeadTypeSchema,
  size: z.number().positive().default(8),
  color: z.string().optional(), // Если не указан, используется цвет линии
});

export type ArrowHeadConfig = z.infer<typeof ArrowHeadConfigSchema>;

/**
 * Arrow head placement
 */
export const ArrowHeadPlacementSchema = z.enum(['start', 'end', 'both', 'none']);

export type ArrowHeadPlacement = z.infer<typeof ArrowHeadPlacementSchema>;

/**
 * Arrow line style
 */
export const ArrowLineStyleSchema = z.object({
  width: z.number().positive().default(2),
  color: z.string().default('#94a3b8'),
  dashArray: z
    .union([
      z.literal('solid'), // Сплошная линия
      z.string().regex(/^\d+(\.\d+)?(\s+\d+(\.\d+)?)*$/), // Пунктирная (например, "5 5" или "10 5")
    ])
    .default('solid'),
});

export type ArrowLineStyle = z.infer<typeof ArrowLineStyleSchema>;

/**
 * Arrow text label configuration
 */
export const ArrowTextLabelSchema = z.object({
  text: z.string(),
  position: z.enum(['start', 'middle', 'end']).default('middle'),
  offset: z
    .object({
      x: z.number().default(0),
      y: z.number().default(0),
    })
    .optional(),
  style: z
    .object({
      fontSize: z.number().positive().default(12),
      color: z.string().default('#000000'),
      fontWeight: z.union([z.literal('normal'), z.literal('bold')]).default('normal'),
    })
    .optional(),
});

export type ArrowTextLabel = z.infer<typeof ArrowTextLabelSchema>;

/**
 * Arrow shape types
 */
export const ArrowShapeTypeSchema = z.enum([
  'straight', // Прямая линия
  'straight-bidirectional', // Двухсторонняя прямая
  'polyline', // Ломаная линия
  'bezier', // Кривая Безье
  'curved', // Криволинейный соединитель
  'orthogonal', // Угловой соединитель
]);

export type ArrowShapeType = z.infer<typeof ArrowShapeTypeSchema>;

/**
 * Anchor point configuration for connecting arrows to shapes
 */
export const AnchorPointSchema = z.object({
  id: z.string(),
  position: z.enum([
    'center',
    'boundary',
    'top',
    'right',
    'bottom',
    'left',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'custom',
  ]),
  // Для 'boundary' - автоматически вычисляется ближайшая точка
  // Для 'custom' - используются customX и customY
  customX: z.number().optional(),
  customY: z.number().optional(),
  // Для 'boundary' - можно указать предпочтительное направление
  preferredDirection: z.enum(['left', 'top', 'right', 'bottom']).optional(),
});

export type AnchorPoint = z.infer<typeof AnchorPointSchema>;

/**
 * Arrow configuration stored in edge metadata
 */
export const ArrowConfigSchema = z.object({
  shapeType: ArrowShapeTypeSchema.default('straight'),
  lineStyle: ArrowLineStyleSchema.optional(),
  headStart: ArrowHeadConfigSchema.optional(), // Наконечник на начале
  headEnd: ArrowHeadConfigSchema.optional(), // Наконечник на конце
  headPlacement: ArrowHeadPlacementSchema.default('end'), // Упрощенная настройка
  textLabel: ArrowTextLabelSchema.optional(),
  // Для polyline - точки излома
  polylinePoints: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
      }),
    )
    .optional(),
  // Для bezier - контрольные точки
  bezierControlPoints: z
    .object({
      startControlX: z.number(),
      startControlY: z.number(),
      endControlX: z.number(),
      endControlY: z.number(),
    })
    .optional(),
  // Для curved - радиус кривизны
  curvedRadius: z.number().positive().optional(),
  // Для orthogonal - отступы
  orthogonalOffset: z.number().default(24),
  // Anchor points
  sourceAnchor: AnchorPointSchema.optional(),
  targetAnchor: AnchorPointSchema.optional(),
});

export type ArrowConfig = z.infer<typeof ArrowConfigSchema>;

/**
 * Default arrow configuration
 */
export const DEFAULT_ARROW_CONFIG: ArrowConfig = {
  shapeType: 'straight',
  headPlacement: 'end',
  lineStyle: {
    width: 2,
    color: '#94a3b8',
    dashArray: 'solid',
  },
  headEnd: {
    type: 'triangle',
    size: 8,
  },
  orthogonalOffset: 24,
};


