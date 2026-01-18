# Develop Feature

Разработка новой функциональности с изучением существующих паттернов, созданием компонентов, написанием тестов и обновлением документации.

## Prompt

Разработай новую функциональность на основе предоставленных требований.

**КРИТИЧЕСКИ ВАЖНО:**

- Сохрани ВСЕ детали задачи пользователя - не теряй контекст
- Работай автономно до полного завершения разработки
- Используй SemanticSearch для изучения существующих паттернов
- Планируй сложные задачи через todo_write (для задач с 3+ шагами)
- Параллелизуй независимые операции (читай файлы одновременно, делай множественные поиски)

## Контекст проекта (кратко)

**Workyy** — браузерная платформа аналитики на бесконечном холсте с SQL/Python узлами и реалтайм коллаборацией.

**Архитектура:**

- `apps/web` - Next.js 14+ (App Router), React, ReactFlow, Zustand, ECharts
- `apps/realtime-server` - Fastify, y-websocket, Prisma, PostgreSQL
- `packages/core-domain` - Доменные схемы (типы: sql, python, table, plot)
- `packages/dag-executor` - Исполнитель DAG

**Ключевые файлы:**

- `apps/web/src/state/executionStore.ts` - результаты выполнения узлов
- `apps/web/src/components/flowNodes/` - компоненты узлов
- `apps/web/src/lib/visualization/` - построение графиков (ECharts)
- `apps/realtime-server/src/routes/` - API endpoints
- `apps/realtime-server/src/services/` - бизнес-логика

**Ключевые особенности:**

- Реалтайм синхронизация через Yjs (автоматическая)
- Выполнение узлов: SQL (DuckDB-WASM), Python (Pyodide) в браузере
- Execution Store (Zustand) для результатов выполнения узлов
- DAG (Directed Acyclic Graph) для зависимостей узлов
- Код узлов хранится через `setCode()`, НЕ в `node.payload`

**Подробнее:** См. `.cursor/commands/agents/developer-agent.md` для полного контекста.

## Процесс разработки фичи

### Шаг 1: Понимание задачи

**Сохрани ВСЕ детали от пользователя:**

- Название фичи и её цель
- Контекст задачи (что нужно сделать и зачем)
- Где должна быть реализована (frontend/backend/оба/package)
- Как связано с существующей функциональностью
- Какие пользовательские сценарии покрывает
- Все требования (конкретные и измеримые)
- Технические детали и ограничения
- Особые указания, приоритеты
- Ожидаемый результат и критерии успеха

**НЕ ТЕРЯЙ КОНТЕКСТ:** Все детали важны для правильной реализации.

**Уточни неясные моменты:** Если чего-то не хватает для начала работы, спроси у пользователя.

### Шаг 2: Изучение существующих паттернов

**Используй SemanticSearch для изучения:**

1. **Похожие компоненты/сервисы:**

   ```
   SemanticSearch: "How are similar features implemented?"
   SemanticSearch: "Where is [похожая функциональность] implemented?"
   ```

2. **Паттерны проекта:**

   ```
   SemanticSearch: "What patterns are used for [тип компонента]?"
   SemanticSearch: "How is [технология] used in this project?"
   ```

3. **Существующие пакеты:**
   - Проверь `packages/` перед созданием дубликатов
   - Используй `@workyy/core-domain` для типов
   - Используй `@workyy/dag-executor` для работы с DAG

4. **Документация:**
   - Паттерны из `.cursor/knowledge/patterns.md`
   - ADR из `docs/architecture/adr/`
   - API контракты в `docs/api/openapi.yaml`

5. **Референсы из search-web:**
   - Если пользователь предоставил референсы от команды `/search-web`, изучи их
   - Используй найденные библиотеки, примеры кода и best practices
   - Адаптируй опенсорс решения под архитектуру Workyy
   - Проверь совместимость с существующими зависимостями

**Выполняй множественные поиски параллельно** для максимальной эффективности.

### Шаг 3: Планирование

**Для сложных задач (3+ шага) используй todo_write:**

**Правила создания задач:**

- Атомарные задачи (≤14 слов, глагол-действие, четкий результат)
- Задачи высокоуровневые и значимые (≈20 минут работы)
- НЕ включай операционные действия (linting, testing, searching) в задачи
- Отмечай задачи как `completed` сразу после завершения
- Только ОДНА задача `in_progress` одновременно

**Пример планирования:**

```
todo_write:
1. "Create BoardList component with search and pagination" [in_progress]
2. "Add API endpoint GET /boards with search filters" [pending]
3. "Implement BoardList tests with Vitest" [pending]
4. "Integrate BoardList into workspace page" [pending]
5. "Update API documentation in openapi.yaml" [pending]
```

### Шаг 4: Реализация

**При реализации следуй паттернам проекта:**

#### Для API endpoints (Backend):

```typescript
// apps/realtime-server/src/routes/boards.ts
export async function boardsRoutes(fastify: FastifyInstance) {
  fastify.delete(
    '/boards/:boardId',
    {
      schema: {
        params: z.object({ boardId: z.string().uuid() }),
      },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // 1. Проверка прав доступа
      await ensureBoardAccess({
        userId: request.user!.userId,
        boardId: request.params.boardId,
        requiredRoles: ['owner'],
      });

      // 2. Бизнес-логика
      await prisma.board.delete({ where: { id: request.params.boardId } });

      // 3. Аудит событие
      await auditService.record({ type: 'board.deleted', boardId });

      // 4. Возврат результата
      return reply.code(204).send();
    },
  );
}
```

**Чеклист для API endpoint:**

- [ ] Валидация параметров/тела через Zod схемы
- [ ] Аутентификация (`preHandler: [fastify.authenticate]`)
- [ ] Авторизация через `ensureBoardAccess()` или `ensureWorkspaceAccess()`
- [ ] Обработка ошибок (404, 403, 500) через `sendProblem()`
- [ ] Аудит событие через `auditService.record()` (если нужно)
- [ ] Использование `select` в Prisma для оптимизации
- [ ] Обновление `docs/api/openapi.yaml`

#### Для React компонентов (Frontend):

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@workyy/ui-kit';

export function BoardList({ workspaceId }: { workspaceId: string }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/boards?workspaceId=${workspaceId}`);
      setBoards(response.data);
    } catch (error) {
      toast.error('Не удалось загрузить доски');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // ...
}
```

**Чеклист для UI компонента:**

- [ ] Используй 'use client' для интерактивных компонентов
- [ ] Обрабатывай состояния loading, error, success
- [ ] Показывай понятные сообщения об ошибках пользователю
- [ ] Используй существующие компоненты из `@workyy/ui-kit`
- [ ] Оптимизируй ре-рендеры (useMemo, useCallback если нужно)
- [ ] Используй правильные типы из `@workyy/core-domain`

#### Для работы с узлами:

```typescript
import { useExecutionStore } from '../state/executionStore';

const { setCode, setStatus, setSuccess, setError, registerNode } = useExecutionStore.getState();

// Регистрация узла
registerNode({ id: nodeId, type: 'sql', payload: {} });

// Сохранение кода узла (НЕ в payload!)
setCode(nodeId, code);

// Выполнение узла
setStatus(nodeId, 'running');
try {
  if (nodeType === 'sql') {
    const result = await executeSql(code);
    setSuccess(nodeId, { kind: 'sql', result, code });
  } else if (nodeType === 'python') {
    const upstreamResult = entries[upstreamNodeId]?.output?.result;
    const pythonOutput = await runPython(code, { sqlResult: upstreamResult });
    setSuccess(nodeId, { kind: 'python', result: pythonOutput, code });
  }
} catch (error) {
  setError(nodeId, error.message);
}
```

**Чеклист для работы с узлами:**

- [ ] Код храни через `setCode()`, НЕ в `node.payload`
- [ ] Используй executionStore для статусов и результатов
- [ ] Обрабатывай зависимости через DAG (`getDownstreamNodeIds`)
- [ ] При изменении узлов они автоматически синхронизируются через Yjs
- [ ] Не создавай дополнительную логику синхронизации

#### Для нового типа узла:

1. **Добавь в core-domain (если доменный тип):**

   ```typescript
   // packages/core-domain/src/schemas/node.ts
   export const NodeTypeSchema = z.enum(['sql', 'python', 'table', 'plot', 'newtype']);
   ```

2. **Создай компонент:**

   ```typescript
   // apps/web/src/components/flowNodes/NewTypeNode.tsx
   export function NewTypeNode({ data, selected }: NodeProps) {
     // UI компонент узла
   }
   ```

3. **Добавь обработку выполнения (если выполняемый):**
   ```typescript
   // В handleRunNode
   if (node.type === 'newtype') {
     // обработка выполнения
   }
   ```

### Шаг 5: Тестирование

**Напиши тесты:**

**Для backend (API endpoints):**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { build } from '../src/server';

describe('DELETE /boards/:boardId', () => {
  it('should delete board with owner role', async () => {
    const app = await build();
    const response = await app.inject({
      method: 'DELETE',
      url: '/boards/board-id',
      cookies: { auth_token: token },
    });
    expect(response.statusCode).toBe(204);
  });

  it('should return 403 without owner role', async () => {
    // ...
  });
});
```

**Для frontend (компоненты):**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BoardList } from './BoardList';

describe('BoardList', () => {
  it('should display boards', async () => {
    vi.mock('../lib/api', () => ({
      api: { get: vi.fn().mockResolvedValue({ data: mockBoards }) },
    }));

    render(<BoardList workspaceId="ws-1" />);
    await waitFor(() => {
      expect(screen.getByText('My Board')).toBeInTheDocument();
    });
  });
});
```

### Шаг 6: Обновление документации

**Обнови документацию:**

- [ ] API документация (`docs/api/openapi.yaml`) если новый endpoint
- [ ] ADR (`docs/architecture/adr/NNNN-feature-name.md`) если архитектурные изменения
- [ ] JSDoc комментарии для публичных функций
- [ ] README если новая функциональность или package

### Шаг 7: Проверка и финализация

**Перед завершением:**

- [ ] Код проходит линтер: `pnpm run lint`
- [ ] Все тесты проходят: `pnpm run test`
- [ ] Код соответствует стандартам проекта
- [ ] ВСЕ требования пользователя выполнены
- [ ] Нет очевидных багов
- [ ] Обработаны edge cases

## Формат использования

**Пользователь применяет команду и добавляет контекст:**

### Пример 1: API Endpoint

```
/develop-feature

Название фичи: Удаление доски

Контекст:
Нужно добавить возможность удалять доски через API.

Требования:
1. Endpoint DELETE /boards/:boardId
2. Проверка прав доступа (только owner)
3. Каскадное удаление связанных узлов и соединений
4. Аудит событие при удалении
5. Возврат 404 если доска не найдена
6. Возврат 403 если нет прав доступа

Технические детали:
- Используй authorizationService.ensureBoardAccess
- Следуй паттернам из apps/realtime-server/src/routes/boards.ts
```

### Пример 2: UI Component

```
/develop-feature

Название фичи: Список досок с поиском

Контекст:
Нужно создать компонент для отображения списка досок с поиском.

Требования:
1. Компонент BoardList отображает доски workspace
2. Поиск по названию (debounced, 300ms)
3. Пагинация (10 досок на страницу)
4. Клик по доске открывает её на канве

Технические детали:
- Используй компоненты из @workyy/ui-kit
- Следуй паттернам из apps/web/src/components/BoardInspector.tsx
```

### Пример 3: Работа с узлами

```
/develop-feature

Название фичи: Автозапуск downstream узлов

Контекст:
При успешном выполнении SQL узла нужно автоматически запускать downstream узлы.

Требования:
1. После успешного выполнения SQL узла находить downstream узлы
2. Запускать их в правильном порядке (topological sort)
3. Обрабатывать ошибки - если один узел упал, остальные запускаются

Технические детали:
- Используй dependencyResolver.getDownstreamNodeIds()
- Используй executionStore для статусов
```

## Готов к работе

Разработай новую функциональность на основе предоставленных требований. Я:

1. Сохраню ВСЕ детали твоей задачи
2. Изучу существующие паттерны через SemanticSearch
3. Использую референсы из search-web (если предоставлены)
4. Спланирую решение (используя todo_write для сложных задач)
5. Реализую с учетом всех требований и паттернов Workyy
6. Напишу тесты для критичной логики
7. Обновлю документацию
8. Проверю что все работает (lint, tests)
9. Завершу работу только когда фича полностью готова

**Начни с описания фичи, и я приступлю к разработке!**
