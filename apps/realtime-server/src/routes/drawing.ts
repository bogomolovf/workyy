import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../lib/prisma';

const paramsSchema = z.object({
  boardId: z.string().uuid(),
});

const snapshotSchema = z.object({
  snapshot: z.record(z.any()),
  rev: z.number().int().nonnegative(),
});

export async function drawingRoutes(app: FastifyInstance) {
  app.get('/boards/:boardId/drawing', async (request, reply) => {
    const { boardId } = paramsSchema.parse(request.params);
    const drawing = await prisma.boardDrawing.findUnique({ where: { boardId } });
    if (!drawing) {
      return reply.code(204).send();
    }
    return {
      snapshot: drawing.snapshot,
      rev: drawing.rev,
      updatedAt: drawing.updatedAt.toISOString(),
    };
  });

  app.put('/boards/:boardId/drawing', async (request, reply) => {
    const { boardId } = paramsSchema.parse(request.params);
    const payload = snapshotSchema.parse(request.body);

    const existing = await prisma.boardDrawing.findUnique({ where: { boardId } });
    if (existing && payload.rev !== existing.rev) {
      return reply.code(409).send({ detail: 'revision-conflict', expected: existing.rev });
    }

    const next = await prisma.boardDrawing.upsert({
      where: { boardId },
      create: {
        boardId,
        snapshot: payload.snapshot,
        rev: payload.rev,
      },
      update: {
        snapshot: payload.snapshot,
        rev: payload.rev + 1,
      },
    });

    return { rev: next.rev };
  });
}
