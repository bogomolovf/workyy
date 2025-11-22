import { z } from 'zod';
import { uuidSchema, paginationSchema } from './common';

export const runTriggerSchema = z.enum(['manual', 'upstream', 'schedule']);

export const createRunBodySchema = z.object({
  nodeId: uuidSchema,
  trigger: runTriggerSchema,
  inputs: z.record(z.unknown()).optional().default({}),
});

export type CreateRunInput = z.infer<typeof createRunBodySchema>;

export const listRunsQuerySchema = paginationSchema.extend({
  boardId: uuidSchema.optional(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']).optional(),
});

export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

