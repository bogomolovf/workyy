import { z } from 'zod';

/**
 * Schema for AI chart config generation request.
 * Accepts column metadata + user prompt, returns PlotConfig.
 */

const columnAnalysisSchema = z.object({
  name: z.string(),
  type: z.enum(['numeric', 'categorical', 'temporal', 'unknown']),
  distinctCount: z.number(),
  sampleValues: z.array(z.union([z.string(), z.number(), z.null()])).optional(),
});

export const generateChartConfigBodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  columns: z.array(columnAnalysisSchema).min(1).max(200),
  rowCount: z.number().int().min(0),
});

export type GenerateChartConfigInput = z.infer<typeof generateChartConfigBodySchema>;
