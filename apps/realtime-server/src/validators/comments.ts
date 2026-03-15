import { z } from 'zod';
import { uuidSchema } from './common';

export const boardThreadParamsSchema = z.object({
  boardId: uuidSchema,
});

export const threadParamsSchema = z.object({
  boardId: uuidSchema,
  threadId: uuidSchema,
});

export const messageParamsSchema = z.object({
  boardId: uuidSchema,
  threadId: uuidSchema,
  messageId: uuidSchema,
});

export const createThreadBodySchema = z.object({
  body: z.string().min(1).max(10_000),
  anchorX: z.number().finite(),
  anchorY: z.number().finite(),
  nodeId: uuidSchema.optional().nullable(),
});

export const listThreadsQuerySchema = z.object({
  resolved: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const resolveThreadBodySchema = z.object({
  resolved: z.boolean(),
});

export const moveThreadBodySchema = z.object({
  anchorX: z.number().finite(),
  anchorY: z.number().finite(),
});

export const addReplyBodySchema = z.object({
  body: z.string().min(1).max(10_000),
});

export const editMessageBodySchema = z.object({
  body: z.string().min(1).max(10_000),
});

export const toggleReactionBodySchema = z.object({
  emoji: z.string().min(1).max(32),
});

export const toggleSubscriptionBodySchema = z.object({
  subscribed: z.boolean(),
});

export type CreateThreadInput = z.infer<typeof createThreadBodySchema>;
export type ListThreadsQuery = z.infer<typeof listThreadsQuerySchema>;
export type ResolveThreadInput = z.infer<typeof resolveThreadBodySchema>;
export type AddReplyInput = z.infer<typeof addReplyBodySchema>;
export type EditMessageInput = z.infer<typeof editMessageBodySchema>;
export type ToggleReactionInput = z.infer<typeof toggleReactionBodySchema>;
export type ToggleSubscriptionInput = z.infer<typeof toggleSubscriptionBodySchema>;
