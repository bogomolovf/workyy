import { z } from 'zod';

import { UuidSchema } from './common';
import { NodeTypeSchema, PositionSchema } from './node';

export const PersistedNodeSchema = z.object({
  id: UuidSchema,
  type: NodeTypeSchema,
  position: PositionSchema,
  payload: z.record(z.unknown()).optional(),
  boardId: UuidSchema.optional(),
});

export const EdgeHandleMetadataSchema = z.object({
  sourceHandleId: z.string().optional(),
  targetHandleId: z.string().optional(),
});

export const PersistedEdgeSchema = z.object({
  id: UuidSchema,
  sourceId: UuidSchema,
  targetId: UuidSchema,
  metadata: EdgeHandleMetadataSchema.and(z.record(z.unknown())).optional(),
});

export const BoardResponseSchema = z.object({
  board: z.object({
    id: UuidSchema,
    workspaceId: UuidSchema,
    title: z.string(),
    description: z.string().nullable(),
  }),
  nodes: z.array(
    z.object({
      id: UuidSchema,
      boardId: UuidSchema,
      type: NodeTypeSchema,
      position: PositionSchema,
      payload: z.record(z.unknown()).optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: UuidSchema,
      sourceId: UuidSchema,
      targetId: UuidSchema,
      metadata: z.record(z.unknown()),
    }),
  ),
});

export type PersistedNode = z.infer<typeof PersistedNodeSchema>;
export type PersistedEdge = z.infer<typeof PersistedEdgeSchema>;
export type EdgeHandleMetadata = z.infer<typeof EdgeHandleMetadataSchema>;
export type BoardResponse = z.infer<typeof BoardResponseSchema>;
