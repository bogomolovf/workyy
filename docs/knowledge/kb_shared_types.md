---
name: Shared Types & Schemas
description: core-domain package exports, Zod schemas, TypeScript types shared between frontend and backend
type: reference
---

# Shared Types (packages/core-domain/src/)

## Exports (index.ts)
- schemas/node.ts
- schemas/board.ts
- schemas/comment.ts
- schemas/common.ts

## Node Schema (schemas/node.ts)
- **NodeType enum** — 24 types: sql, python, table, plot, note, text, shape, image, video, document, draw, pen, database, csv, voice, notebook, pythonCell, markdownCell, sqlCell, notebookFrame
- **NodePayload** — JSON payload per node type
- **Position** — { x: number, y: number }
- **Node schema** — Zod: id, boardId, type, positionX, positionY, payload

## Board Schema (schemas/board.ts)
- **PersistedNode** — Node as saved to DB (id, type, position, payload)
- **PersistedEdge** — Edge as saved (id, sourceId, targetId, metadata)
- **EdgeHandleMetadata** — Edge connection metadata
- **BoardResponse** — API response shape

## Comment Schema (schemas/comment.ts)
- **UserRef** — { id, name, avatarUrl }
- **Reaction** — { emoji, count, userIds }
- **CommentMessage** — { id, authorId, body, createdAt, updatedAt, deletedAt, reactions }
- **ThreadSummary** — Thread list item (id, anchor, resolved, messageCount, lastMessage)
- **ThreadDetail** — Full thread with messages

## Common Schema (schemas/common.ts)
- **UUID** — Zod string().uuid()
- **Pagination** — { page, limit, offset }

## Database Types
DatabaseType enum (in Prisma): postgresql, mysql, oracle, sqlserver, clickhouse
Frontend mirrors this in `lib/databaseNodeTypes.ts`

## DAG Executor (packages/dag-executor/)
- `DagNode` type — { id, type, dependencies[] }
- `DagEdge` type — { sourceId, targetId }
- `getDownstreamNodeIds(nodeId, edges)` — BFS downstream
- `topologicalSort(nodes, edges)` — Execution order
