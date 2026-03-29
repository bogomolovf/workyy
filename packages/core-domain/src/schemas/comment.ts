import { z } from 'zod';

import { UuidSchema } from './common';

export const UserRefSchema = z.object({
  id: UuidSchema,
  name: z.string().nullable(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
});

export const ReactionSchema = z.object({
  messageId: UuidSchema,
  emoji: z.string(),
  userId: UuidSchema,
});

export const CommentMessageSchema = z.object({
  id: UuidSchema,
  threadId: UuidSchema,
  authorId: UuidSchema,
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deleted: z.boolean(),
  author: UserRefSchema,
  reactions: z.array(ReactionSchema),
});

export const ThreadSummarySchema = z.object({
  id: UuidSchema,
  boardId: UuidSchema,
  nodeId: z.string().nullable(),
  anchorX: z.number(),
  anchorY: z.number(),
  resolved: z.boolean(),
  resolvedAt: z.string().nullable(),
  createdById: UuidSchema,
  createdBy: UserRefSchema,
  resolvedBy: z.object({ id: UuidSchema, name: z.string().nullable() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().int(),
  firstMessage: z
    .object({
      id: UuidSchema,
      body: z.string(),
      authorId: UuidSchema,
      createdAt: z.string(),
      author: UserRefSchema,
    })
    .nullable(),
  subscribed: z.boolean(),
});

export const ThreadDetailSchema = z.object({
  id: UuidSchema,
  boardId: UuidSchema,
  nodeId: z.string().nullable(),
  anchorX: z.number(),
  anchorY: z.number(),
  resolved: z.boolean(),
  resolvedAt: z.string().nullable(),
  createdById: UuidSchema,
  createdBy: UserRefSchema,
  resolvedBy: z.object({ id: UuidSchema, name: z.string().nullable() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  subscribed: z.boolean(),
  messages: z.array(CommentMessageSchema),
});

export type UserRef = z.infer<typeof UserRefSchema>;
export type Reaction = z.infer<typeof ReactionSchema>;
export type CommentMessageData = z.infer<typeof CommentMessageSchema>;
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;
export type ThreadDetail = z.infer<typeof ThreadDetailSchema>;
