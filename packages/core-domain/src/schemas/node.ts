import { z } from 'zod';

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const NodeTypeSchema = z.enum([
  'sql',
  'python',
  'table',
  'plot',
  'pythonCell',
  'markdownCell',
  'sqlCell',
  'notebookFrame',
]);

export const NodePayloadSchema = z.union([
  z.object({
    sql: z.string(),
    lastRunId: z.string().uuid().nullable(),
  }),
  z.object({
    python: z.string(),
    requirements: z.array(z.string()).max(20),
  }),
  z.object({
    tableConfig: z.record(z.unknown()),
  }),
  z.object({
    plotConfig: z.record(z.unknown()),
  }),
  z.object({
    cellSource: z.string(),
    cellLanguage: z.enum(['python', 'sql', 'markdown']),
    frameId: z.string().uuid().optional(),
    cellIndex: z.number().int().nonneg().optional(),
  }),
  z.object({
    frameName: z.string(),
    cellIds: z.array(z.string().uuid()),
  }),
]);

export const NodeSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  type: NodeTypeSchema,
  position: PositionSchema,
  payload: NodePayloadSchema.optional(),
});

export type Position = z.infer<typeof PositionSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type NodePayload = z.infer<typeof NodePayloadSchema>;
export type Node = z.infer<typeof NodeSchema>;
