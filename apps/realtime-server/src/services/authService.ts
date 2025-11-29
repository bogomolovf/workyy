import type { FastifyInstance, FastifyReply } from 'fastify';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'auth_token';
const AUTH_TOKEN_EXPIRES_IN = Number(process.env.AUTH_TOKEN_EXPIRES_IN ?? 3600);

export function setAuthCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  payload: { userId: string; email?: string },
) {
  const token = app.jwt.sign(payload, {
    expiresIn: AUTH_TOKEN_EXPIRES_IN,
  });

  const secure = process.env.AUTH_COOKIE_SECURE === 'true';

  reply.setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: AUTH_TOKEN_EXPIRES_IN,
  });
}

export function clearAuthCookie(reply: FastifyReply) {
  const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'auth_token';
  reply.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
  });
}

