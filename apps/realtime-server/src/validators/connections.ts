import { z } from 'zod';

export const supportedDrivers = ['postgres', 'mysql', 'snowflake', 'bigquery'] as const;

export const testConnectionBodySchema = z.object({
  driver: z.enum(supportedDrivers),
  config: z.record(z.unknown()),
});

export type TestConnectionInput = z.infer<typeof testConnectionBodySchema>;
