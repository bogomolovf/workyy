# Паттерны кода Workyy

## Паттерны компонентов React

### Компоненты Next.js App Router

```typescript
// apps/web/src/app/board/[id]/page.tsx
export default async function BoardPage({ params }: { params: { id: string } }) {
  // Server component для получения данных
  const board = await getBoard(params.id);
  return <BoardClient board={board} />;
}
```

### Клиентские компоненты

```typescript
'use client';
import { useState, useEffect } from 'react';

export function BoardClient({ board }: { board: Board }) {
  // Client component для интерактивности
  const [state, setState] = useState();
  // ...
}
```

## Паттерны API (Fastify)

### Роуты

```typescript
// apps/realtime-server/src/routes/boards.ts
export async function boardsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/boards',
    {
      schema: {
        /* валидация */
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // обработка запроса
    },
  );
}
```

### Валидация

```typescript
// apps/realtime-server/src/validators/boards.ts
import { z } from 'zod';

export const createBoardSchema = z.object({
  title: z.string().min(1).max(255),
  workspaceId: z.string().uuid(),
});
```

### Сервисы

```typescript
// apps/realtime-server/src/services/boardService.ts
export class BoardService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateBoardInput) {
    // бизнес-логика
  }
}
```

## Паттерны работы с Prisma

### Запросы

```typescript
// Всегда используй select для оптимизации
const board = await prisma.board.findUnique({
  where: { id },
  select: {
    id: true,
    title: true,
    nodes: {
      select: { id: true, type: true },
    },
  },
});
```

### Транзакции

```typescript
await prisma.$transaction(async (tx) => {
  const board = await tx.board.create({ data });
  await tx.node.createMany({ data: nodes });
  return board;
});
```

## Паттерны обработки ошибок

### Backend

```typescript
import { FastifyError } from 'fastify';

if (!board) {
  throw fastify.httpErrors.notFound('Board not found');
}

try {
  // операция
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // обработка ошибок Prisma
  }
  throw fastify.httpErrors.internalServerError();
}
```

### Frontend

```typescript
try {
  const result = await api.post('/boards', data);
} catch (error) {
  if (error.response?.status === 404) {
    // обработка 404
  }
  // общая обработка
}
```

## Паттерны WebSocket

### Подключение

```typescript
const ws = new WebSocket('ws://localhost:4000/collab');
const ydoc = new Y.Doc();
const provider = new WebsocketProvider(ws, 'board-id', ydoc);
```

### Синхронизация состояния

```typescript
const ymap = ydoc.getMap('board-state');
ymap.observe((event) => {
  // обработка изменений
});
```

## Паттерны тестирования

### Юнит-тесты

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('BoardService', () => {
  it('should create board', async () => {
    const prisma = createMockPrisma();
    const service = new BoardService(prisma);
    const result = await service.create({ title: 'Test' });
    expect(result.title).toBe('Test');
  });
});
```

### Интеграционные тесты

```typescript
import { build } from '../src/server';

describe('POST /boards', () => {
  it('should create board', async () => {
    const app = await build();
    const response = await app.inject({
      method: 'POST',
      url: '/boards',
      payload: { title: 'Test' },
    });
    expect(response.statusCode).toBe(201);
  });
});
```

## Паттерны работы с типами

### Использование доменных типов

```typescript
import { NodeType } from '@workyy/core-domain';

function processNode(node: { type: NodeType }) {
  switch (node.type) {
    case NodeType.SQL:
      // обработка SQL узла
      break;
    case NodeType.PYTHON:
      // обработка Python узла
      break;
  }
}
```

### Типизация API ответов

```typescript
type BoardResponse = {
  id: string;
  title: string;
  nodes: Array<{ id: string; type: NodeType }>;
};

const board: BoardResponse = await api.get('/boards/123');
```

## Паттерны работы с состояниями

### React State

```typescript
const [board, setBoard] = useState<Board | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Zustand (если используется)

```typescript
import { create } from 'zustand';

interface BoardStore {
  board: Board | null;
  setBoard: (board: Board) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
  board: null,
  setBoard: (board) => set({ board }),
}));
```
