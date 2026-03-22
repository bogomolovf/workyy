import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type UUID = z.infer<typeof UuidSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
