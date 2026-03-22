import 'dotenv/config';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
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
    logger: {
      level: 'info',
      serializers: {
        req(request) {
          const url = request.url || '';
          const isNodesUpdate =
            url.includes('/boards/') && url.includes('/nodes') && request.method === 'PUT';

          // For PUT /boards/:boardId/nodes - never log body to avoid CSV data in logs
          if (isNodesUpdate) {
            return {
              method: request.method,
              url: request.url,
              hostname: request.hostname,
              remoteAddress: request.ip,
            };
          }

          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
        res(reply) {
          return {
            statusCode: reply.statusCode,
          };
        },
      },
    },
  });

  // CORS configuration: allow requests from landing page and product app
  const landingOrigin = process.env.LANDING_ORIGIN ?? 'http://localhost:5173';
  const appOrigin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  const allowedOrigins = [
    landingOrigin,
    appOrigin,
    landingOrigin.replace('localhost', '127.0.0.1'),
    appOrigin.replace('localhost', '127.0.0.1'),
  ].filter((o, i, arr) => arr.indexOf(o) === i);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // In development, allow any localhost/127.0.0.1 origin so CORS never blocks
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
      cb(null, false);
    },
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
    max: 5000,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => request.ip,
  });

  await fastify.register(websocket);

  // Multipart plugin for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
      files: 10, // Max 10 files per request
    },
  });

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
