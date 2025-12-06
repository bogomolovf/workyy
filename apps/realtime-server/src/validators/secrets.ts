import { z } from 'zod';
import { uuidSchema } from './common';

export const createSecretBodySchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().min(1).max(64),
  value: z.string().min(1),
});

export type CreateSecretInput = z.infer<typeof createSecretBodySchema>;

export const listSecretsQuerySchema = z.object({
  workspaceId: uuidSchema,
});

export type ListSecretsQuery = z.infer<typeof listSecretsQuerySchema>;
