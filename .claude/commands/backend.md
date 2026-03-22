Выполни задачу на БЭКЕНДЕ: $ARGUMENTS

## Твоя зона ответственности

Ты работаешь ТОЛЬКО внутри `apps/realtime-server/src/`. Не трогай фронтенд и packages.

## Структура

```
apps/realtime-server/src/
  index.ts                ← точка входа Fastify
  server.ts               ← конфигурация сервера, плагины, middleware
  routes/
    index.ts              ← регистрация всех роутов
    boards.ts             ← CRUD досок + nodes/edges
    workspaces.ts         ← CRUD воркспейсов + members
    comments.ts           ← threads + messages + reactions + subscriptions
    auth.ts               ← register/login/logout/me
    files.ts              ← upload/download/delete
  validators/
    common.ts             ← uuidSchema, paginationSchema
    boards.ts             ← createBoard, updateBoard, updateContent (использует @workyy/core-domain)
    workspaces.ts         ← createWorkspace, addMember
    comments.ts           ← createThread, addMessage, toggleReaction
  services/
    collaborationService.ts ← Yjs WebSocket, y-websocket integration
    yjsPersistence.ts       ← сохранение/загрузка Yjs state в PostgreSQL
  prisma/
    schema.prisma          ← модели данных
    migrations/            ← миграции Prisma
```

## Паттерн роутов

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Валидация — Zod-схемы из validators/
// Типы нод — из @workyy/core-domain
import { NodeTypeSchema } from '@workyy/core-domain';

export async function featureRoutes(fastify: FastifyInstance) {
  // GET — список
  fastify.get<{ Querystring: ListQuery }>('/api/resource', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const items = await fastify.prisma.resource.findMany({ where: { ... } });
    return reply.send({ items });
  });

  // POST — создание
  fastify.post<{ Body: CreateInput }>('/api/resource', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const item = await fastify.prisma.resource.create({ data: { ...body, userId: request.user.id } });
    return reply.status(201).send(item);
  });

  // PATCH — обновление
  fastify.patch<{ Params: IdParams; Body: UpdateInput }>('/api/resource/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = updateSchema.parse(request.body);
    // Проверка доступа
    await ensureResourceAccess(fastify, request.user.id, id);
    const updated = await fastify.prisma.resource.update({ where: { id }, data: body });
    return reply.send(updated);
  });

  // DELETE
  fastify.delete<{ Params: IdParams }>('/api/resource/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await ensureResourceAccess(fastify, request.user.id, id);
    await fastify.prisma.resource.delete({ where: { id } });
    return reply.status(204).send();
  });
}
```

## Правила

### Валидация
```typescript
// ПРАВИЛЬНО — Zod на входе, типизированный результат
const body = createBoardSchema.parse(request.body);

// Общие типы — из core-domain
import { NodeTypeSchema, PositionSchema } from '@workyy/core-domain';

// Локальные схемы — в validators/
```

### Авторизация
```typescript
// Всегда через preHandler
preHandler: [fastify.authenticate]

// Доступ к ресурсам — через helper
await ensureBoardAccess(fastify, request.user.id, boardId);
await ensureWorkspaceAccess(fastify, request.user.id, workspaceId);
```

### Ответы об ошибках
```typescript
// Стандартный формат
return reply.status(400).send({ detail: 'Human-readable message' });
return reply.status(403).send({ detail: 'Access denied' });
return reply.status(404).send({ detail: 'Board not found' });
```

### Prisma
```typescript
// Новая модель → обнови schema.prisma + создай миграцию
// npx prisma migrate dev --name add_feature_table

// Запросы — используй include/select для оптимизации
const board = await fastify.prisma.board.findUnique({
  where: { id: boardId },
  include: { nodes: true, edges: true },
});
```

### Регистрация роутов
```typescript
// В routes/index.ts добавь:
import { featureRoutes } from './feature';
fastify.register(featureRoutes);
// НЕ регистрируй дважды — проверь что роут ещё не зарегистрирован
```

## Процесс работы

1. **Прочитай** затрагиваемые файлы и validators
2. **Проверь** нет ли уже похожего роута/функциональности
3. **Реализуй** — validator → route → (service если сложная логика)
4. **Проверь**: `npx tsc --noEmit -p apps/realtime-server/tsconfig.json`
5. **Prisma**: если менял schema → `npx prisma validate`
6. **Кратко отчитайся** — эндпоинты, модели, файлы

## Чего НЕ делать

- Не менять `apps/web/` или `packages/` — скажи пользователю запустить `/frontend` или `/shared`
- Не создавать типы нод локально — используй `@workyy/core-domain`
- Не добавлять `console.log` — используй `console.error`/`console.warn` для ошибок
- Не регистрируй один роут-файл дважды в `routes/index.ts`
- Не используй `.passthrough()` в Zod-схемах без необходимости
- Не меняй формат metadata у edges (sourceHandleId/targetHandleId)
- Не забывай `preHandler: [fastify.authenticate]` на новых эндпоинтах
- Не возвращай sensitive data (пароли, tokens) в API responses

## Примеры использования

```
/backend Добавить эндпоинт GET /api/boards/:id/export — экспорт борда в JSON
```

```
/backend Добавить пагинацию к GET /api/workspaces/:id/boards
```

```
/backend Добавить поле lastAccessedAt к модели Board и обновлять при открытии
```
