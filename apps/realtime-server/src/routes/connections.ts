import { FastifyInstance } from 'fastify';
import { container } from '../container';
import { testConnectionBodySchema } from '../validators/connections';
import { sendProblem } from '../lib/problem';

export async function connectionsRoutes(app: FastifyInstance) {
  app.post('/connections/test', async (request, reply) => {
    const parse = testConnectionBodySchema.safeParse(request.body);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }

    // TODO: Stage 3 – implement real connectivity checks via secure proxy.
    app.log.info({ driver: parse.data.driver }, 'Received connection test request');

    await container.auditService.record({
      type: 'connection.test.requested',
      payload: { driver: parse.data.driver },
    });

    return reply.send({
      status: 'ok',
      message: 'Connection validation deferred to Stage 3 implementation.',
    });
  });
}
