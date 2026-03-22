# Workyy

## Build & Test
- `pnpm install` — install all deps
- `pnpm build` — build all (Turborepo orchestrates order)
- `pnpm test` — run all tests (Vitest)
- `pnpm lint` — ESLint + Prettier check
- `pnpm --filter web dev` — frontend on :3000
- `pnpm --filter realtime-server dev` — backend on :4000
- `pnpm --filter realtime-server prisma:studio` — DB GUI

## Conventions
- TypeScript strict mode everywhere
- Zod for runtime validation (backend validators/)
- Zustand for client state (state/ directory, domain-grouped)
- Shared types live in @workyy/core-domain
- Components grouped by domain: board/, comments/, collaboration/, common/
- Tests co-located as `*.test.ts` next to source
- Commit messages in English, code comments in English
- No console.log in production code (use logger utility)

## Architecture
- Monorepo: pnpm workspaces + Turborepo
- Frontend: Next.js 14, React 18, ReactFlow, Zustand, TanStack Query
- Backend: Fastify, Prisma, PostgreSQL, Zod
- Realtime: Yjs CRDT over WebSocket
- WASM: DuckDB (SQL), Pyodide (Python) via wasm-bridge package

## Branch Strategy
- `main` — stable branch
- `feature/*` — feature branches
- PR-based workflow, merge into main

## Knowledge Base
Detailed project knowledge for AI-assisted development lives in `docs/knowledge/`:
- `kb_architecture.md` — full architecture, data flows, Yjs collaboration, execution pipeline, DB models
- `kb_frontend_map.md` — all frontend components, hooks, stores, libs, routes
- `kb_backend_map.md` — all backend routes, services, validators, Prisma schema
- `kb_shared_types.md` — core-domain exports, Zod schemas, dag-executor API
- `kb_key_patterns.md` — how to add nodes, routes, stores, charts
- `kb_dev_workflow.md` — commands, ports, env vars, Docker, build pipeline
