import 'dotenv/config';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createServer } from './server';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: { userId: string; email?: string };
  }
}

async function bootstrap() {
  const fastify = Fastify({
    logger: true,
  });

  // CORS: in dev allow any localhost/127.0.0.1 origin; in prod use env list
  const isDev = process.env.NODE_ENV !== 'production';
  await fastify.register(cors, {
    origin: isDev
      ? (origin, cb) => {
          const allowed = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
          cb(null, allowed ? (origin ?? true) : false);
        }
      : [
          process.env.LANDING_ORIGIN ?? 'http://localhost:5173',
          process.env.APP_ORIGIN ?? 'http://localhost:3000',
        ],
    credentials: true,
  });

  // Cookie plugin
  await fastify.register(cookie, {
    secret: process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret',
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
    },
  });

  // JWT plugin
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    cookie: {
      cookieName: process.env.AUTH_COOKIE_NAME ?? 'auth_token',
      signed: false,
    },
  });

  // Authenticate decorator
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<{ userId: string; email?: string }>();
      request.user = decoded;
    } catch (err) {
      reply.code(401).send({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
      });
    }
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(websocket);

  await createServer(fastify);

  const port = Number(process.env.PORT ?? 4000);
  const host = '0.0.0.0';

  try {
    await fastify.listen({ port, host });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
