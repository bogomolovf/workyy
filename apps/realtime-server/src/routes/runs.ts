import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { createRunBodySchema, listRunsQuerySchema } from '../validators/runs';
import { NodeNotFoundError } from '../services/runService';

const IDEMPOTENCY_HEADER = 'idempotency-key';

export async function runsRoutes(app: FastifyInstance) {
  app.post('/runs', async (request, reply) => {
    const headerValue = request.headers[IDEMPOTENCY_HEADER] ?? request.headers['Idempotency-Key'];
    const idempotencyKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!idempotencyKey) {
      return sendProblem(reply, {
        title: 'Missing idempotency key',
        status: 400,
        detail: `Header '${IDEMPOTENCY_HEADER}' is required`,
      });
    }

    const parseResult = createRunBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseResult.error.message,
        errors: parseResult.error.flatten(),
      });
    }
    const body = parseResult.data;

    try {
      const result = await container.runService.queueRun({
        nodeId: body.nodeId,
        trigger: body.trigger,
        idempotencyKey,
        inputs: body.inputs ?? {},
      });

      if (result.duplicate) {
        return sendProblem(reply, {
          title: 'Duplicate run request',
          status: 409,
          detail: 'This idempotency key has already been used',
          errors: { runId: result.run.id },
        });
      }

      container.runProcessor.enqueue(result.run.id);

      return reply.code(202).send({
        runId: result.run.id,
        status: result.run.status,
        startedAt: result.run.startedAt,
        finishedAt: result.run.finishedAt,
      });
    } catch (error) {
      if (error instanceof NodeNotFoundError) {
        return sendProblem(reply, {
          title: 'Node not found',
          status: 404,
          detail: `Node ${error.nodeId} does not exist`,
        });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        return sendProblem(reply, {
          title: 'Duplicate run request',
          status: 409,
          detail: 'This idempotency key has already been used',
        });
      }
      request.log.error({ err: error }, 'Failed to queue run');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to queue run',
      });
    }
  });

  app.get('/runs', async (request, reply) => {
    const parseQuery = listRunsQuerySchema.safeParse(request.query);
    if (!parseQuery.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseQuery.error.message,
        errors: parseQuery.error.flatten(),
      });
    }
    const query = parseQuery.data;
    const limit = query.limit ?? 50;

    const runs = await container.prisma.run.findMany({
      where: {
        boardId: query.boardId,
        status: query.status,
      },
      orderBy: { startedAt: 'desc' },
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasNext = runs.length > limit;
    const items = hasNext ? runs.slice(0, limit) : runs;

    if (hasNext) {
      reply.header('x-cursor-next', runs[limit].id);
    }

    return reply.send({
      items: items.map((run) => ({
        runId: run.id,
        nodeId: run.nodeId,
        boardId: run.boardId,
        status: run.status,
        trigger: run.trigger,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      })),
    });
  });
}

