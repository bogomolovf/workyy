import { z } from 'zod';

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/** All node types supported by the board */
export const NodeTypeSchema = z.enum([
  'sql',
  'python',
  'table',
  'plot',
  'note',
  'text',
  'shape',
  'image',
  'video',
  'document',
  'draw',
  'pen',
  'database',
  'csv',
  'voice',
  'notebook',
  // Notebook sub-types (internal)
  'pythonCell',
  'markdownCell',
  'sqlCell',
  'notebookFrame',
]);

export const NodePayloadSchema = z
  .object({
    sql: z.string().max(100_000).optional(),
    python: z.string().max(100_000).optional(),
    label: z.string().optional(),
    ui: z
      .object({
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough()
  .optional();

export const NodeSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  type: NodeTypeSchema,
  position: PositionSchema,
  payload: NodePayloadSchema,
});

export type Position = z.infer<typeof PositionSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type NodePayload = z.infer<typeof NodePayloadSchema>;
export type Node = z.infer<typeof NodeSchema>;
