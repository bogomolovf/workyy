# ADR 0001: Workyy Bootstrap Stack

- Status: Accepted
- Date: 2025-11-08

## Контекст

Необходимо быстро запустить браузерное MVP для Workyy со смешанными SQL/Python узлами и коллаборацией.

## Решение

- Next.js 14 для фронтенда.
- Fastify + y-websocket для realtime API.
- pnpm монорепо с Turbo.
- Prisma + PostgreSQL для серверных метаданных.
- Redis для rate limiting и presence.

## Последствия

- Простая разработка и деплой через Docker и GitHub Actions.
- Можно масштабировать сервисы независимо.
