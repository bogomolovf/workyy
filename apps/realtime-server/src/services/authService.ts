import type { FastifyInstance, FastifyReply } from 'fastify';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'auth_token';
// Поддерживаем как строку ("1h") так и число (3600)
const AUTH_TOKEN_EXPIRES_IN_RAW = process.env.AUTH_TOKEN_EXPIRES_IN ?? '3600';
const AUTH_TOKEN_EXPIRES_IN = isNaN(Number(AUTH_TOKEN_EXPIRES_IN_RAW)) 
  ? AUTH_TOKEN_EXPIRES_IN_RAW 
  : Number(AUTH_TOKEN_EXPIRES_IN_RAW);
const AUTH_TOKEN_EXPIRES_IN_SECONDS = typeof AUTH_TOKEN_EXPIRES_IN === 'number' 
  ? AUTH_TOKEN_EXPIRES_IN 
  : parseExpiresIn(AUTH_TOKEN_EXPIRES_IN);

function parseExpiresIn(value: string): number {
  // Конвертируем "1h" -> 3600, "30m" -> 1800 и т.д.
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // default 1 hour
  
  const num = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 3600;
  }
}

export function setAuthCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  payload: { userId: string; email?: string },
) {
  const token = app.jwt.sign(payload, {
    expiresIn: typeof AUTH_TOKEN_EXPIRES_IN === 'string' ? AUTH_TOKEN_EXPIRES_IN : `${AUTH_TOKEN_EXPIRES_IN}s`,
  });

  const secure = process.env.AUTH_COOKIE_SECURE === 'true';

  reply.setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: AUTH_TOKEN_EXPIRES_IN_SECONDS,
  });
}

export function clearAuthCookie(reply: FastifyReply) {
  const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'auth_token';
  reply.clearCookie(AUTH_COOKIE_NAME, {
    path: '/',
  });
}

