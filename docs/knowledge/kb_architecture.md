---
name: Project Architecture
description: Full architecture overview - monorepo structure, tech stack, data flow, execution pipeline, collaboration model
type: reference
---

# Workyy Architecture

## Overview

Workyy — browser-based analytics platform on infinite canvas. Users build DAG pipelines from SQL/Python nodes, visualize data, collaborate in real-time. Think Miro + Jupyter.

## Monorepo Structure

```
apps/
  web/              — Next.js 14 frontend (:3000)
  realtime-server/  — Fastify backend (:4000)
  landing/          — Vite marketing SPA (:5173)
packages/
  core-domain/      — Shared Zod schemas & TypeScript types
  dag-executor/     — topologicalSort(), getDownstreamNodeIds()
  wasm-bridge/      — WASM init placeholder (DuckDB, Pyodide)
  ui-kit/           — Shared React components (minimal)
```

## Tech Stack

### Frontend

- React 18.3 + Next.js 14 (App Router)
- ReactFlow 11.10 — node-edge graph editor
- Zustand 5 — state management (19 stores)
- TanStack Query 5 — server data fetching
- Yjs 13.6 — CRDT real-time collaboration
- DuckDB WASM 1.29 — SQL execution in browser
- Pyodide 0.26 — Python in browser (Web Worker)
- ECharts 5.5 — chart visualization
- Monaco Editor — code editing
- Tiptap 2.1 — rich text (notes, markdown)
- Radix UI — dropdown menus (board menu)

### Backend

- Fastify 4.27 + plugins (cors, cookie, jwt, multipart, websocket, rate-limit)
- Prisma 5.17 + PostgreSQL 16
- Zod 3.23 — request validation
- y-websocket 1.5 — Yjs provider
- bcrypt — password hashing
- DB drivers: pg, mysql2, oracledb, mssql, @clickhouse/client

### Infrastructure

- Docker Compose: postgres (5433), redis (6379), otel-collector (4317)
- Turborepo — build orchestration
- pnpm 8.15 workspaces
- Node >=20
- Husky — pre-commit hooks

## Key Data Flows

### Yjs Collaboration (real-time sync)

1. Client connects to `/collab/{boardId}` WebSocket
2. Fastify validates JWT + board access
3. Yjs provider syncs Y.Doc between all clients
4. Y.Maps used: `nodes`, `edges`, `cursors`, `datasets`, `editing`
5. Hooks convert Yjs state → React state (useNodesStateSynced, useEdgesStateSynced)

### Execution Pipeline

1. User runs node → frontend calls backend `POST /runs`
2. RunService creates Run (status: queued), resolves DAG dependencies
3. Frontend executes in-browser via DuckDB (SQL) or Pyodide (Python) Worker
4. Result stored in executionStore (Zustand), synced via Yjs `datasets` map
5. Downstream nodes (PlotNode) read from upstream results

### Comments System

- CommentThread anchored to board (x,y) or node
- Messages with reactions (emoji), soft delete, subscriptions
- API: list, create, resolve, react, subscribe
- Frontend: CommentLayer → CommentAnchor → CommentThreadCard

### Presentation Broadcast

- Single presenter lock per presentation node
- Viewers see live slide sync via Yjs `presentationBroadcastsMap`
- Private mode: local navigation independent of broadcast

## Database (Prisma Schema)

17 models: User, Workspace, UserWorkspaceRole, Board, Node, Edge, Run, RunRequest, Snapshot, CommentThread, CommentMessage, MessageReaction, ThreadSubscription, Secret, DatabaseConnection, RetentionPolicy, AuditEvent, BoardDrawing, File

### NodeType enum (24 types)

sql, python, table, plot, note, text, shape, image, video, document, draw, pen, database, csv, voice, notebook, pythonCell, markdownCell, sqlCell, notebookFrame

### Run status: queued → running → succeeded | failed

### Run trigger: manual, upstream, schedule

## API

- OpenAPI spec: `docs/api/openapi.yaml`
- Base: `/api/*` (Fastify), `/collab` (WebSocket)
- Auth: JWT Bearer token via cookie
- Error format: Problem+JSON (RFC 7807)
