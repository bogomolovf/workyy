import { z } from 'zod';
import { uuidSchema } from './common';

export const dbTypeSchema = z
  .enum(['postgresql', 'mysql', 'oracle', 'sqlserver', 'clickhouse'])
  .default('postgresql');

export type DatabaseType = z.infer<typeof dbTypeSchema>;

export const testConnectionBodySchema = z.object({
  dbType: dbTypeSchema,
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(false),
});

export type TestConnectionInput = z.infer<typeof testConnectionBodySchema>;

export const createDatabaseConnectionBodySchema = z.object({
  workspaceId: uuidSchema,
  connectionName: z.string().min(1).max(128),
  dbType: dbTypeSchema,
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(false),
});

export type CreateDatabaseConnectionInput = z.infer<typeof createDatabaseConnectionBodySchema>;

export const updateDatabaseConnectionBodySchema = z.object({
  connectionName: z.string().min(1).max(128).optional(),
  dbType: dbTypeSchema.optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  ssl: z.boolean().optional(),
});

export type UpdateDatabaseConnectionInput = z.infer<typeof updateDatabaseConnectionBodySchema>;

export const executeQueryBodySchema = z.object({
  query: z.string().min(1),
  nodeId: z.string().uuid().optional(),
});

export type ExecuteQueryInput = z.infer<typeof executeQueryBodySchema>;
