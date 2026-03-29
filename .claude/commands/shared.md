Выполни задачу в ОБЩИХ ТИПАХ: $ARGUMENTS

## Твоя зона ответственности

Ты работаешь ТОЛЬКО внутри `packages/core-domain/`. Этот пакет — единый источник правды для типов, общих между фронтендом и бэкендом.

## Структура

```
packages/core-domain/src/
  index.ts              ← реэкспорт всех схем
  schemas/
    common.ts           ← UuidSchema, PaginationSchema
    node.ts             ← NodeTypeSchema (20 типов), PositionSchema, NodeSchema
    board.ts            ← PersistedNodeSchema, PersistedEdgeSchema, BoardResponseSchema
    comment.ts          ← UserRefSchema, ReactionSchema, ThreadSummarySchema, ThreadDetailSchema
```

## Кто импортирует

```
@workyy/core-domain
  ├── apps/web (package.json: "@workyy/core-domain": "workspace:*")
  │     └── import { NodeType, BoardResponse } from '@workyy/core-domain'
  └── apps/realtime-server (package.json: "@workyy/core-domain": "workspace:*")
        └── import { NodeTypeSchema, PositionSchema } from '@workyy/core-domain'
```

## Паттерн: Zod-схема + тип

```typescript
import { z } from 'zod';

// 1. Zod-схема (runtime валидация)
export const MySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  status: z.enum(['active', 'archived']),
  metadata: z.record(z.unknown()).optional(),
});

// 2. TypeScript-тип (compile-time)
export type MyType = z.infer<typeof MySchema>;
```

**Фронтенд** использует TypeScript-тип для типизации.
**Бэкенд** использует и Zod-схему (для `.parse()` валидации), и TypeScript-тип.

## Правила

### Добавление нового типа ноды

```typescript
// В schemas/node.ts — добавь в enum
export const NodeTypeSchema = z.enum([
  'sql',
  'python',
  'table',
  'plot',
  // ...
  'newType', // ← добавь сюда
]);
```

После этого фронт и бэк автоматически получат новый тип при пересборке.

### Добавление новой схемы

1. Создай файл `schemas/newFeature.ts`
2. Добавь реэкспорт в `index.ts`: `export * from './schemas/newFeature';`
3. Пересобери: `pnpm --filter core-domain build`

### Изменение существующей схемы

- **Добавление optional поля** — безопасно, не ломает потребителей
- **Добавление required поля** — ломает `.parse()` на бэке для старых данных
- **Удаление поля** — ломает фронт и бэк, нужна координация
- **Изменение enum** — добавление значения безопасно, удаление ломает

### Именование

- Схемы: `PascalCaseSchema` (например `NodeTypeSchema`)
- Типы: `PascalCase` (например `NodeType`)
- Файлы: `camelCase.ts` (например `common.ts`)

## Процесс работы

1. **Проверь** что тип/схема ещё не существует в core-domain
2. **Добавь** схему + тип в соответствующий файл schemas/
3. **Реэкспортируй** из `index.ts` если новый файл
4. **Пересобери**: `cd packages/core-domain && pnpm build`
5. **Проверь** что сборка успешна (tsup выведет размеры файлов)
6. **Отчитайся** — что добавлено/изменено, какие потребители должны обновиться

## Чего НЕ делать

- Не импортируй из `apps/web` или `apps/realtime-server` — зависимость только в одну сторону
- Не добавляй runtime-зависимости кроме `zod` — пакет должен быть лёгким
- Не дублируй типы, которые используются только в одном приложении — они должны быть локальными
- Не удаляй значения из enum без координации с фронтом и бэком

## Координация с другими агентами

Если пользователь говорит:

- "Добавь тип ноды X" → добавь в `NodeTypeSchema`, скажи запустить `/frontend` и `/backend` для обновления
- "Общий тип для фичи Y" → создай схему, скажи какие файлы на фронте/бэке нужно обновить
- "Синхронизируй типы" → проверь `NodeTypeSchema` vs `api.types.ts` vs `validators/boards.ts`, найди расхождения

## Примеры использования

```
/shared Добавить новый тип ноды "image" в NodeTypeSchema
```

```
/shared Создать схему для фичи templates — TemplateSchema с полями name, description, nodes, edges
```

```
/shared Синхронизировать типы — проверить что api.types.ts совпадает с core-domain
```
