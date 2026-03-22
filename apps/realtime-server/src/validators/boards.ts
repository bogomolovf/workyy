import { z } from 'zod';
import { NodeTypeSchema, PositionSchema } from '@workyy/core-domain';
import { uuidSchema } from './common';

export const createBoardBodySchema = z.object({
  workspaceId: uuidSchema,
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
});

export type CreateBoardInput = z.infer<typeof createBoardBodySchema>;

export const getBoardParamsSchema = z.object({
  boardId: uuidSchema,
});

export type GetBoardParams = z.infer<typeof getBoardParamsSchema>;

export const listBoardsQuerySchema = z.object({
  workspaceId: uuidSchema.optional(),
});

export type ListBoardsQuery = z.infer<typeof listBoardsQuerySchema>;

export const updateBoardMetadataSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional().nullable(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: 'At least one of title or description must be provided',
  });

export type UpdateBoardMetadataInput = z.infer<typeof updateBoardMetadataSchema>;

const nodePayloadSchema = z
  .object({
    sql: z.string().max(100_000).optional(),
    python: z.string().max(100_000).optional(),
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

const updateNodeSchema = z.object({
  id: uuidSchema,
  type: NodeTypeSchema,
  position: PositionSchema,
  payload: nodePayloadSchema,
});

const updateEdgeSchema = z.object({
  id: uuidSchema,
  sourceId: uuidSchema,
  targetId: uuidSchema,
  metadata: z.record(z.any()).optional(),
});

export const updateBoardContentSchema = z.object({
  nodes: z.array(updateNodeSchema),
  edges: z.array(updateEdgeSchema),
});

export type UpdateBoardContentInput = z.infer<typeof updateBoardContentSchema>;
