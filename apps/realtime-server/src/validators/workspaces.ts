import { z } from 'zod';
import { uuidSchema } from './common';

export const getWorkspaceParamsSchema = z.object({
  workspaceId: uuidSchema,
});

export type GetWorkspaceParams = z.infer<typeof getWorkspaceParamsSchema>;

export const addWorkspaceMemberBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'editor', 'viewer']).default('viewer'),
});

export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberBodySchema>;

export const removeWorkspaceMemberParamsSchema = z.object({
  workspaceId: uuidSchema,
  userId: uuidSchema,
});

export type RemoveWorkspaceMemberParams = z.infer<typeof removeWorkspaceMemberParamsSchema>;

export const updateWorkspaceMemberRoleBodySchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
});

export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleBodySchema>;

