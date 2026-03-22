---
name: Backend File Map
description: Complete map of backend routes, services, validators, prisma models — use when navigating apps/realtime-server
type: reference
---

# Backend File Map (apps/realtime-server/src/)

## Server Entry (index.ts)
Fastify server with plugins:
- `@fastify/cors` — CORS (localhost + web + landing origins)
- `@fastify/cookie` — Session cookies
- `@fastify/jwt` — JWT auth
- `@fastify/multipart` — File uploads
- `@fastify/websocket` — WebSocket (Yjs collaboration)
- `@fastify/rate-limit` — Rate limiting
- Pino logger (custom serializers to avoid logging large payloads)
- `app.authenticate` decorator for protected routes

## Routes (routes/)

### Auth
- `auth.ts` — POST /register, POST /login, POST /logout, GET /verify

### Resources
- `boards.ts` — Board CRUD: GET /boards, GET /boards/:id, POST /boards, PUT /boards/:id (metadata), PUT /boards/:id/structure (save nodes+edges), DELETE /boards/:id
- `workspaces.ts` — Workspace members: GET /workspaces/:id/members, POST (add), PUT (update role), DELETE (remove)
- `comments.ts` — Threads: list, create, resolve, move anchor, add reply, edit, react, subscribe
- `files.ts` — File upload/management
- `drawing.ts` — Drawing state sync

### Execution
- `runs.ts` — POST /runs (queue), GET /runs (list), GET /runs/:id (details)

### Connections
- `connections.ts` — WebSocket connection management
- `database-connections.ts` — DB connection CRUD (create, test, list, delete)
- `secrets.ts` — Workspace secrets CRUD

### Route Registration
- `index.ts` — Registers all routes with `/api` prefix

## Services (services/)

### Core
- `collaborationService.ts` — WebSocket Yjs setup (auth check, board access, provider init)
- `yjsPersistence.ts` — Persist Yjs document state to DB (board.yjsState field)
- `authService.ts` — JWT cookie management (set/clear, token expiry)
- `userService.ts` — User CRUD (create with bcrypt hash, verify password, get by ID/email)
- `authorizationService.ts` — Access control (ensureBoardAccess, ensureWorkspaceAccess, role checks)

### Execution
- `runService.ts` — Queue runs, track status, resolve downstream nodes
- `dependencyResolver.ts` — DAG dependency resolution for execution ordering

### Database Connectors
- `postgresService.ts` — PostgreSQL (pg library, connection pools)
- `mysqlService.ts` — MySQL (mysql2/promise)
- `oracleService.ts` — Oracle (oracledb)
- `sqlserverService.ts` — SQL Server (mssql)
- `clickhouseService.ts` — ClickHouse (@clickhouse/client)

### Infrastructure
- `auditService.ts` — Audit event logging

## Validators (validators/) — Zod schemas
- `boards.ts` — Board create/update/structure schemas
- `comments.ts` — Thread CRUD, message ops, reactions
- `workspaces.ts` — Workspace member management
- `connections.ts` — WebSocket connection config
- `databaseConnections.ts` — DB connection validation (host, port, dbType, ssl)
- `secrets.ts` — Secret name/value
- `runs.ts` — Run execution params
- `common.ts` — Shared (UUID schema)

## Lib (lib/)
- `prisma.ts` — Prisma client singleton
- `problem.ts` — HTTP Problem+JSON responses (RFC 7807)

## Prisma Schema (prisma/schema.prisma)

### Enums
- **NodeType**: sql, python, table, plot, note, text, shape, image, video, document, draw, pen, database, csv, voice, notebook, pythonCell, markdownCell, sqlCell, notebookFrame
- **WorkspaceRole**: owner, editor, viewer
- **RunStatus**: queued, running, succeeded, failed
- **RunTrigger**: manual, upstream, schedule
- **RetentionType**: board, run, snapshot
- **DatabaseType**: postgresql, mysql, oracle, sqlserver, clickhouse

### Models (17)
- **User** (id, email, name, avatarUrl, passwordHash)
- **Workspace** (id, name) → boards, members, secrets, connections, policies
- **UserWorkspaceRole** (userId, workspaceId, role) — composite PK
- **Board** (id, workspaceId, ownerId, title, description, yjsState Bytes, snapshotCount)
- **Node** (id, boardId, type NodeType, positionX/Y Float, payload Json)
- **Edge** (id, sourceId, targetId, boardId, metadata Json) — unique [source, target]
- **Run** (id, nodeId, boardId, status, trigger, startedAt, finishedAt, outputArrow Bytes, error)
- **RunRequest** (id, boardId, nodeId, idempotencyKey, status, inputs Json)
- **Snapshot** (id, boardId, createdBy, arrowBlob Bytes)
- **CommentThread** (id, boardId, nodeId?, anchorX/Y Float, resolved, createdById, resolvedById)
- **CommentMessage** (id, threadId, authorId, body, createdAt, updatedAt, deletedAt?)
- **MessageReaction** (messageId, emoji, userId) — composite PK
- **ThreadSubscription** (threadId, userId) — composite PK
- **Secret** (id, workspaceId, name, value) — unique [workspaceId, name]
- **DatabaseConnection** (id, workspaceId, connectionName, dbType, host, port, database, username, ssl, secretId)
- **RetentionPolicy** (id, workspaceId, boardId?, type, ttlDays)
- **AuditEvent** (id, boardId?, workspaceId?, runId?, type, payload Json)
- **BoardDrawing** (boardId PK, snapshot Json, rev Int)
- **File** (id, boardId, filename, originalName, mimeType, size Int, path)

### Key Indexes
- Run: [nodeId, status, startedAt]
- CommentThread: [boardId, resolved]
- CommentMessage: [threadId, createdAt]
- AuditEvent: [boardId, createdAt], [workspaceId, createdAt], [runId, createdAt]
