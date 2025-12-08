# Develop Feature

Разработка новой функциональности с изучением существующих паттернов, созданием компонентов, написанием тестов и обновлением документации.

## Prompt

Разработай новую функциональность на основе предоставленных требований.

**КРИТИЧЕСКИ ВАЖНО:**

- Сохрани ВСЕ детали задачи пользователя - не теряй контекст
- Работай автономно до полного завершения разработки
- Используй codebase_search для изучения существующих паттернов
- Планируй сложные задачи через todo_write (для задач с 3+ шагами)
- Параллелизуй независимые операции (читай файлы одновременно, делай множественные поиски)

## Контекст проекта (кратко)

**Workyy** — браузерная платформа аналитики на бесконечном холсте с SQL/Python узлами и реалтайм коллаборацией.

**Архитектура:**

- `apps/web` - Next.js 14+ (App Router), React, ReactFlow, Zustand
- `apps/realtime-server` - Fastify, y-websocket, Prisma, PostgreSQL
- `packages/core-domain` - Доменные схемы
- `packages/dag-executor` - Исполнитель DAG

**Ключевые особенности:**

- Реалтайм синхронизация через Yjs (автоматическая)
- Выполнение узлов: SQL (DuckDB-WASM), Python (Pyodide) в браузере
- Execution Store (Zustand) для результатов выполнения узлов
- DAG (Directed Acyclic Graph) для зависимостей узлов

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

**Используй codebase_search для изучения:**

1. **Похожие компоненты/сервисы:**

   ```
   codebase_search: "How are similar features implemented?"
   codebase_search: "Where is [похожая функциональность] implemented?"
   ```

2. **Паттерны проекта:**

   ```
   codebase_search: "What patterns are used for [тип компонента]?"
   codebase_search: "How is [технология] used in this project?"
   ```

3. **Существующие пакеты:**
   - Проверь `packages/` перед созданием дубликатов
   - Используй `@workyy/core-domain` для типов
   - Используй `@workyy/dag-executor` для работы с DAG

4. **Документация:**
   - Паттерны из `.cursor/knowledge/patterns.md`
   - ADR из `docs/architecture/adr/`
   - API контракты в `docs/api/openapi.yaml`

**Выполняй множественные поиски параллельно** для максимальной эффективности.

**Примеры хороших поисков:**

```
codebase_search: "How are API endpoints created with authentication and authorization?"
codebase_search: "How are React components created for nodes on the canvas?"
codebase_search: "How does executionStore work for storing node execution results?"
codebase_search: "Where is authorizationService used for checking board access?"
```

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
// 1. Создай роут в apps/realtime-server/src/routes/
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
      // 2. Проверка прав доступа
      await ensureBoardAccess({
        userId: request.user!.userId,
        boardId: request.params.boardId,
        requiredRoles: ['owner'],
      });

      // 3. Бизнес-логика
      await prisma.board.delete({ where: { id: request.params.boardId } });

      // 4. Аудит событие
      await auditService.record({ type: 'board.deleted', boardId }, tx);

      // 5. Возврат результата
      return reply.code(204).send();
    },
  );
}
```

**Чеклист для API endpoint:**

- [ ] Валидация параметров/тела через Zod схемы
- [ ] Аутентификация (`preHandler: [fastify.authenticate]`)
- [ ] Авторизация через `ensureBoardAccess()` или `ensureWorkspaceAccess()`
- [ ] Обработка ошибок (404, 403, 500)
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

// Сохранение кода узла
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

1. **Добавь в core-domain:**

   ```typescript
   // packages/core-domain/src/schemas/node.ts
   export enum NodeType {
     // ... существующие
     CSV = 'csv',
   }
   ```

2. **Создай компонент:**

   ```typescript
   // apps/web/src/components/flowNodes/CsvNode.tsx
   export function CsvNode({ data, selected }: NodeProps) {
     // UI компонент узла
   }
   ```

3. **Добавь обработку выполнения:**
   ```typescript
   // В handleRunNode
   if (node.type === 'csv') {
     // обработка выполнения
   }
   ```

**Чеклист для нового типа узла:**

- [ ] Добавлен тип в `packages/core-domain`
- [ ] Создан UI компонент в `apps/web/src/components/flowNodes/`
- [ ] Добавлена обработка выполнения в `handleRunNode`
- [ ] Добавлен в executionStore если нужно
- [ ] Обновлены тесты

#### Общие принципы:

- Используй правильные типы TypeScript (strict mode)
- Используй алиасы импортов `@workyy/<package>`
- Обрабатывай ошибки правильно (показывай пользователю понятные сообщения)
- Валидируй входные данные (Zod схемы на backend)
- Проверяй права доступа если нужно
- Пиши тесты для нового кода
- Документируй сложную бизнес-логику (JSDoc)
- Используй существующие пакеты из `packages/` если возможно

### Шаг 5: Тестирование

**Напиши тесты:**

**Для backend (API endpoints):**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { build } from '../src/server';

describe('DELETE /boards/:boardId', () => {
  it('should delete board with owner role', async () => {
    const app = await build();
    // ... setup
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

  it('should return 404 if board not found', async () => {
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

**Чеклист тестирования:**

- [ ] Юнит-тесты для функций и компонентов (Vitest)
- [ ] Интеграционные тесты для API если нужно
- [ ] Покрытие критичной логики минимум 80%
- [ ] Тесты для успешных сценариев
- [ ] Тесты для ошибок (404, 403, validation errors)
- [ ] Тесты независимые и детерминированные

### Шаг 6: Обновление документации

**Обнови документацию:**

**Чеклист документации:**

- [ ] API документация (`docs/api/openapi.yaml`) если новый endpoint
- [ ] ADR (`docs/architecture/adr/NNNN-feature-name.md`) если архитектурные изменения
- [ ] JSDoc комментарии для публичных функций
- [ ] README если новая функциональность или package
- [ ] Комментарии в коде для сложной логики

**Пример обновления OpenAPI:**

```yaml
/boards/{boardId}:
  delete:
    summary: Delete board
    description: Deletes a board. Requires owner role.
    parameters:
      - name: boardId
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '204':
        description: Board deleted successfully
      '403':
        description: Forbidden - insufficient permissions
      '404':
        description: Board not found
```

### Шаг 7: Проверка и финализация

**Перед завершением:**

**Чеклист проверки:**

- [ ] Код проходит линтер: `pnpm run lint`
- [ ] Все тесты проходят: `pnpm run test`
- [ ] Код соответствует стандартам проекта
- [ ] ВСЕ требования пользователя выполнены
- [ ] Нет очевидных багов
- [ ] Обработаны все edge cases
- [ ] Производительность приемлема (нет лишних ре-рендеров, оптимизированы запросы)

**Финальный чеклист по типу фичи:**

**API Endpoint:**

- [ ] Валидация входных данных
- [ ] Аутентификация и авторизация
- [ ] Обработка ошибок
- [ ] Аудит события (если нужно)
- [ ] Тесты покрывают все сценарии
- [ ] OpenAPI документация обновлена

**UI Component:**

- [ ] Обработка состояний (loading, error, success)
- [ ] Понятные сообщения об ошибках
- [ ] Использованы компоненты из ui-kit
- [ ] Оптимизированы ре-рендеры
- [ ] Тесты написаны

**Работа с узлами:**

- [ ] Используется executionStore правильно
- [ ] Код хранится отдельно (не в payload)
- [ ] Обработка зависимостей через DAG
- [ ] Синхронизация через Yjs (автоматическая)

**Новый тип узла:**

- [ ] Тип добавлен в core-domain
- [ ] UI компонент создан
- [ ] Обработка выполнения добавлена
- [ ] Интеграция с executionStore
- [ ] Тесты написаны

## Формат использования

**Пользователь применяет команду и добавляет контекст:**

### Пример 1: API Endpoint

```
/develop-feature

Название фичи: Удаление доски

Контекст:
Нужно добавить возможность удалять доски через API. Пользователи должны иметь возможность удалять свои доски (owner role), а также админы должны иметь возможность удалять любые доски.

Требования:
1. Endpoint DELETE /boards/:boardId
2. Проверка прав доступа (только owner)
3. Каскадное удаление связанных узлов и соединений (Prisma onDelete: Cascade)
4. Аудит событие при удалении (type: 'board.deleted')
5. Возврат 404 если доска не найдена
6. Возврат 403 если нет прав доступа
7. Возврат 204 при успешном удалении

Технические детали:
- Используй authorizationService.ensureBoardAccess для проверки прав
- Используй auditService.record для логирования
- Следуй паттернам из apps/realtime-server/src/routes/boards.ts
- Используй валидацию Zod для параметров
- Используй select в Prisma запросах

Тесты:
- Успешное удаление с owner role
- Ошибка 403 без owner role
- Ошибка 404 если доска не найдена
- Аудит событие записывается

Документация:
- Обновить docs/api/openapi.yaml
```

### Пример 2: UI Component

```
/develop-feature

Название фичи: Список досок с поиском

Контекст:
Нужно создать компонент для отображения списка досок текущего workspace с возможностью поиска и фильтрации.

Требования:
1. Компонент BoardList отображает доски workspace
2. Поиск по названию (debounced, 300ms)
3. Фильтрация по дате создания (последние 7/30 дней / все)
4. Пагинация (10 досок на страницу)
5. Клик по доске открывает её на канве (router.push)
6. Отображение статуса загрузки и ошибок

Технические детали:
- Используй API endpoint GET /boards?workspaceId=...&search=...&filter=...
- Используй компоненты из @workyy/ui-kit
- Следуй паттернам из apps/web/src/components/BoardInspector.tsx
- Обрабатывай состояния через useState
- Используй useCallback для оптимизации

Расположение:
- apps/web/src/components/BoardList.tsx
- Использовать на странице workspace

Тесты:
- Отображение списка досок
- Работа поиска
- Работа фильтрации
- Обработка ошибок загрузки
```

### Пример 3: Новый тип узла

```
/develop-feature

Название фичи: CSV узел для загрузки данных

Контекст:
Нужно добавить новый тип узла CSV, который позволяет загружать CSV файлы и использовать их как источник данных в пайплайне.

Требования:
1. Новый тип узла 'csv' в core-domain
2. UI компонент CsvNode для отображения узла
3. Загрузка CSV файла через file input
4. Парсинг CSV в SqlResult формат
5. Результат доступен для downstream узлов (Python/SQL)
6. Отображение предпросмотра таблицы

Технические детали:
- Добавить NodeType.CSV в packages/core-domain
- Использовать библиотеку papaparse для парсинга CSV
- Результат в формате SqlResult (columns, rows)
- Использовать executionStore для хранения результата
- Добавить обработку в handleRunNode

Тесты:
- Парсинг CSV файла
- Обработка ошибок (неверный формат, пустой файл)
- Интеграция с downstream узлами
```

## Готов к работе

Разработай новую функциональность на основе предоставленных требований. Я:

1. Сохраню ВСЕ детали твоей задачи
2. Изучу существующие паттерны через codebase_search
3. Спланирую решение (используя todo_write для сложных задач)
4. Реализую с учетом всех требований и паттернов Workyy
5. Напишу тесты для критичной логики
6. Обновлю документацию
7. Проверю что все работает (lint, tests)
8. Завершу работу только когда фича полностью готова

**Начни с описания фичи, и я приступлю к разработке!**
