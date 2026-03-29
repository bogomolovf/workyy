---
name: Development Workflow
description: Commands, ports, env vars, Docker services, build pipeline — quick reference for dev tasks
type: reference
---

# Development Workflow

## Quick Commands

```bash
pnpm install                           # Install all deps
pnpm dev                               # All apps in parallel
pnpm --filter web dev                  # Frontend :3000
pnpm --filter realtime-server dev      # Backend :4000
pnpm --filter landing dev              # Landing :5173
pnpm build                             # Build all (Turborepo)
pnpm lint                              # ESLint + Prettier
pnpm test                              # Vitest all
pnpm --filter realtime-server prisma:studio   # DB GUI
pnpm --filter realtime-server prisma:migrate  # Run migrations
pnpm --filter realtime-server prisma:generate # Generate client
```

## Ports

| Service          | Port |
| ---------------- | ---- |
| Frontend (web)   | 3000 |
| Backend (server) | 4000 |
| Landing          | 5173 |
| PostgreSQL       | 5433 |
| Redis            | 6379 |
| OTEL Collector   | 4317 |

## Docker Compose Services

- `postgres` — PostgreSQL 16 (user: postgres, pass: postgres, db: workyy)
- `redis` — Redis 7
- `otel-collector` — OpenTelemetry
- `web` and `realtime-server` — app containers (optional, usually run locally)

## Environment Variables

### Backend (apps/realtime-server/.env)

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis URL
- `JWT_SECRET` — JWT signing key
- `PORT` — Server port (4000)
- `LANDING_ORIGIN`, `APP_ORIGIN` — CORS origins

### Frontend (apps/web/.env.local)

- `NEXT_PUBLIC_APP_URL` — App base URL
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for Yjs
- `NEXT_PUBLIC_LANDING_URL` — Landing page URL
- `NEXT_PUBLIC_DEMO_BOARD_ID` — Demo board (optional)

## Build Pipeline (turbo.json)

- `build` → depends on `^build` (packages first), outputs: dist/, .next/
- `lint` → no cache
- `test` → caches coverage/
- `dev` → no cache

## Branch Strategy

- `main` — stable
- `feature/*` — feature branches
- PR-based, merge into main

## Pre-commit

- Husky hooks configured
- Runs lint checks

## Useful Debugging

- Health check: `curl http://localhost:4000/health`
- Prisma Studio: `pnpm --filter realtime-server prisma:studio`
- DB logs: `docker compose logs postgres`
- Clear .next cache: `rm -rf apps/web/.next`
