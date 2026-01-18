import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    // FIX: Completely disable Prisma logging to avoid logging full CSV data payloads
    // Prisma logs the entire query including payload on validation errors
    // This exposes sensitive data like CSV contents in server logs
    log: [], // No logging at all
    errorFormat: 'minimal', // Minimal error format to reduce logged data
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
