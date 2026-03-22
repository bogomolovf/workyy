import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { ensureBoardAccess } from '../services/authorizationService';

const boardIdParamsSchema = z.object({
  boardId: z.string().uuid(),
});

const datasetParamsSchema = z.object({
  boardId: z.string().uuid(),
  tableName: z.string().min(1).max(255),
});

const createDatasetBodySchema = z.object({
  tableName: z.string().min(1).max(255),
  fileName: z.string().min(1).max(500),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});

export async function datasetsRoutes(app: FastifyInstance) {
  // POST /boards/:boardId/datasets — upload dataset
  app.post(
    '/boards/:boardId/datasets',
    {
      preValidation: [app.authenticate],
      bodyLimit: 50 * 1024 * 1024, // 50MB for large datasets
    },
    async (request, reply) => {
      const userId = (request.user as any)?.userId as string;

      const parsedParams = boardIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const { boardId } = parsedParams.data;

      const access = await ensureBoardAccess({ userId, boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status!,
          detail: access.reason,
        });
      }

      const parsedBody = createDatasetBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const { tableName, fileName, columns, rows } = parsedBody.data;

      // Serialize rows as JSON bytes for storage
      const fileData = Buffer.from(JSON.stringify({ columns, rows }));

      try {
        const dataset = await container.prisma.boardDataset.upsert({
          where: { boardId_tableName: { boardId, tableName } },
          create: {
            boardId,
            tableName,
            fileName,
            columns,
            fileData,
            rowCount: rows.length,
          },
          update: {
            fileName,
            columns,
            fileData,
            rowCount: rows.length,
          },
        });

        return reply.code(201).send({
          id: dataset.id,
          tableName: dataset.tableName,
          fileName: dataset.fileName,
          columns: dataset.columns,
          rowCount: dataset.rowCount,
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to save dataset');
        return sendProblem(reply, {
          title: 'Internal error',
          status: 500,
          detail: 'Failed to save dataset',
        });
      }
    },
  );

  // GET /boards/:boardId/datasets/:tableName — download dataset
  app.get(
    '/boards/:boardId/datasets/:tableName',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any)?.userId as string;

      const parsedParams = datasetParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const { boardId, tableName } = parsedParams.data;

      const access = await ensureBoardAccess({ userId, boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status!,
          detail: access.reason,
        });
      }

      const dataset = await container.prisma.boardDataset.findUnique({
        where: { boardId_tableName: { boardId, tableName } },
      });

      if (!dataset) {
        return sendProblem(reply, {
          title: 'Dataset not found',
          status: 404,
          detail: `Dataset "${tableName}" not found on this board`,
        });
      }

      // Parse stored data
      const parsed = JSON.parse(dataset.fileData.toString());

      return reply.send({
        tableName: dataset.tableName,
        fileName: dataset.fileName,
        columns: parsed.columns,
        rows: parsed.rows,
        rowCount: dataset.rowCount,
      });
    },
  );

  // GET /boards/:boardId/datasets — list all datasets for a board
  app.get(
    '/boards/:boardId/datasets',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any)?.userId as string;

      const parsedParams = boardIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const { boardId } = parsedParams.data;

      const access = await ensureBoardAccess({ userId, boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status!,
          detail: access.reason,
        });
      }

      const datasets = await container.prisma.boardDataset.findMany({
        where: { boardId },
        select: {
          id: true,
          tableName: true,
          fileName: true,
          columns: true,
          rowCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({ datasets });
    },
  );

  // DELETE /boards/:boardId/datasets/:tableName — delete dataset
  app.delete(
    '/boards/:boardId/datasets/:tableName',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = (request.user as any)?.userId as string;

      const parsedParams = datasetParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const { boardId, tableName } = parsedParams.data;

      const access = await ensureBoardAccess({ userId, boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status!,
          detail: access.reason,
        });
      }

      try {
        await container.prisma.boardDataset.delete({
          where: { boardId_tableName: { boardId, tableName } },
        });
        return reply.code(204).send();
      } catch {
        return sendProblem(reply, {
          title: 'Dataset not found',
          status: 404,
          detail: `Dataset "${tableName}" not found`,
        });
      }
    },
  );
}
