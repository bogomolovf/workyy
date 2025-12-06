import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 50))
    .refine((value) => Number.isFinite(value) && value > 0 && value <= 200, {
      message: 'limit must be between 1 and 200',
    }),
  cursor: z.string().uuid().optional(),
});
