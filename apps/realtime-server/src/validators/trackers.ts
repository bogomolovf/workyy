import { z } from 'zod';
import { uuidSchema } from './common';

// ── Tracker ──────────────────────────────────────────────────────────

export const listTrackersQuerySchema = z.object({
  workspaceId: uuidSchema.optional(),
});

export const trackerParamsSchema = z.object({
  trackerId: uuidSchema,
});

export const createTrackerBodySchema = z.object({
  workspaceId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
});

export const updateTrackerBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  backgroundUrl: z.string().url().max(2000).nullable().optional(),
});

// ── Columns ──────────────────────────────────────────────────────────

export const columnParamsSchema = z.object({
  trackerId: uuidSchema,
  columnId: uuidSchema,
});

export const createColumnBodySchema = z.object({
  title: z.string().min(1, 'Column title is required').max(100),
  isFinal: z.boolean().optional(),
});

export const updateColumnBodySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  position: z.number().optional(),
  isFinal: z.boolean().optional(),
});

export const reorderColumnsBodySchema = z.object({
  columns: z.array(
    z.object({
      id: uuidSchema,
      position: z.number(),
    }),
  ),
});

// ── Tasks ────────────────────────────────────────────────────────────

export const taskParamsSchema = z.object({
  trackerId: uuidSchema,
  taskId: uuidSchema,
});

export const createTaskBodySchema = z.object({
  title: z.string().min(1, 'Task title is required').max(500),
  columnId: uuidSchema,
  description: z.string().max(5000).optional(),
  parentTaskId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const updateTaskBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  columnId: uuidSchema.optional(),
  assigneeId: uuidSchema.nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  position: z.number().optional(),
});

// ── Labels ───────────────────────────────────────────────────────────

export const labelParamsSchema = z.object({
  trackerId: uuidSchema,
  labelId: uuidSchema,
});

export const taskLabelParamsSchema = z.object({
  trackerId: uuidSchema,
  taskId: uuidSchema,
  labelId: uuidSchema,
});

export const createLabelBodySchema = z.object({
  name: z.string().min(1, 'Label name is required').max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex string like #ff0000')
    .optional(),
});

export const updateLabelBodySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const attachLabelBodySchema = z.object({
  labelId: uuidSchema,
});

// ── Comments ─────────────────────────────────────────────────────────

export const createCommentBodySchema = z.object({
  body: z.string().min(1, 'Comment body is required').max(5000),
});

// ── Activity ─────────────────────────────────────────────────────────

export const activityQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
