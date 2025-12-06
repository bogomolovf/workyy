import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createUserWithPassword, verifyUserPassword, getUserById } from '../services/userService';
import { setAuthCookie, clearAuthCookie } from '../services/authService';
import { prisma } from '../lib/prisma';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400).send({
        type: 'about:blank',
        title: 'Invalid request',
        status: 400,
        detail: 'Invalid registration data',
        errors: result.error.flatten(),
      });
      return;
    }

    const { email, password, name } = result.data;

    try {
      const user = await createUserWithPassword({ email, password, name });

      // Record audit event
      await prisma.auditEvent.create({
        data: {
          type: 'user.registered',
          workspaceId: user.roles[0]?.workspaceId ?? null,
          payload: { email: user.email, userId: user.id },
        },
      });

      setAuthCookie(app, reply, { userId: user.id, email: user.email });

      reply.code(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        workspaces: user.roles.map((r) => ({
          id: r.workspaceId,
          name: r.workspace.name,
          role: r.role,
        })),
      });
    } catch (err: any) {
      if (err.message?.includes('User already exists')) {
        reply.code(409).send({
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'User already exists',
        });
      } else {
        app.log.error(err);
        reply.code(500).send({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
        });
      }
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      reply.code(400).send({
        type: 'about:blank',
        title: 'Invalid request',
        status: 400,
        detail: 'Invalid login data',
      });
      return;
    }

    const { email, password } = result.data;

    const user = await verifyUserPassword(email, password);
    if (!user) {
      reply.code(401).send({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password',
      });
      return;
    }

    await prisma.auditEvent.create({
      data: {
        type: 'user.logged_in',
        workspaceId: user.roles[0]?.workspaceId ?? null,
        payload: { email: user.email, userId: user.id },
      },
    });

    setAuthCookie(app, reply, { userId: user.id, email: user.email });

    reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      workspaces: user.roles.map((r) => ({
        id: r.workspaceId,
        name: r.workspace.name,
        role: r.role,
      })),
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    if (request.user?.userId) {
      await prisma.auditEvent.create({
        data: {
          type: 'user.logged_out',
          payload: { userId: request.user.userId },
        },
      });
    }

    clearAuthCookie(reply);
    reply.send({ ok: true });
  });

  app.get('/auth/me', { preValidation: [app.authenticate] }, async (request, reply) => {
    if (!request.user?.userId) {
      reply.code(401).send({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
      });
      return;
    }

    const user = await getUserById(request.user.userId);
    if (!user) {
      clearAuthCookie(reply);
      reply.code(401).send({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
      });
      return;
    }

    reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      workspaces: user.roles.map((r) => ({
        id: r.workspaceId,
        name: r.workspace.name,
        role: r.role,
      })),
    });
  });
}
