import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { createSecretBodySchema, listSecretsQuerySchema } from '../validators/secrets';

export async function secretsRoutes(app: FastifyInstance) {
  app.post('/secrets', async (request, reply) => {
    const parse = createSecretBodySchema.safeParse(request.body);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }
    const body = parse.data;

    const workspaceExists = await container.prisma.workspace.count({
      where: { id: body.workspaceId },
    });
    if (!workspaceExists) {
      return sendProblem(reply, {
        title: 'Workspace not found',
        status: 404,
        detail: `Workspace ${body.workspaceId} does not exist`,
      });
    }

    try {
      const secret = await container.prisma.secret.create({
        data: {
          workspaceId: body.workspaceId,
          name: body.name,
          value: body.value,
        },
      });

      await container.auditService.record({
        type: 'secret.created',
        workspaceId: body.workspaceId,
        payload: { name: secret.name },
      });

      return reply.code(201).send({
        id: secret.id,
        workspaceId: secret.workspaceId,
        name: secret.name,
        createdAt: secret.createdAt,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return sendProblem(reply, {
          title: 'Secret name conflict',
          status: 409,
          detail: 'Secret name must be unique within the workspace',
        });
      }
      request.log.error({ err: error }, 'Failed to store secret');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to store secret',
      });
    }
  });

  app.get('/secrets', async (request, reply) => {
    const parse = listSecretsQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }
    const { workspaceId } = parse.data;

    const secrets = await container.prisma.secret.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      items: secrets.map((secret) => ({
        id: secret.id,
        workspaceId: secret.workspaceId,
        name: secret.name,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
      })),
    });
  });
}
