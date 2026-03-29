Создай Prisma-миграцию: $ARGUMENTS

## Контекст

**Database:** PostgreSQL через Prisma ORM.
**Schema:** `apps/realtime-server/prisma/schema.prisma`
**Migrations:** `apps/realtime-server/prisma/migrations/`

## Алгоритм

### 1. Понять изменение

Извлеки из запроса:

- **Что меняется** — новая модель, новое поле, изменение связи, индекс
- **Зачем** — какая фича/фикс требует это изменение
- **Breaking change** — ломает ли существующие данные

### 2. Изучить текущую схему

1. Прочитай `apps/realtime-server/prisma/schema.prisma`
2. Проверь существующие модели и связи
3. Посмотри последние миграции: `ls apps/realtime-server/prisma/migrations/`

### 3. Внести изменения в schema.prisma

**Паттерны:**

```prisma
// Новая модель
model Template {
  id          String   @id @default(uuid())
  name        String
  description String?
  boardId     String
  board       Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([boardId])
}

// Новое optional поле (безопасно для существующих данных)
model Board {
  // ...existing fields...
  lastAccessedAt DateTime?
}

// Новое required поле (нужен default для существующих записей)
model Board {
  // ...existing fields...
  visibility String @default("private")
}
```

**Правила:**

- `@id @default(uuid())` для primary keys
- `@relation(onDelete: Cascade)` для зависимых сущностей
- `@@index` для полей, по которым часто фильтруют/сортируют
- Optional поля (`?`) для обратной совместимости
- `@default(now())` для createdAt, `@updatedAt` для updatedAt

### 4. Валидировать

```bash
cd apps/realtime-server && npx prisma validate
```

### 5. Создать миграцию

```bash
cd apps/realtime-server && npx prisma migrate dev --name описание_изменения
```

**Naming convention для миграций:** `snake_case`, описательное имя:

- `add_template_model`
- `add_last_accessed_at_to_board`
- `add_visibility_field`
- `add_index_on_board_workspace_id`

### 6. Проверить сгенерированный SQL

Прочитай файл миграции и убедись что:

- SQL корректный
- Нет DROP без необходимости
- DEFAULT значения разумные
- Индексы добавлены для FK и часто используемых полей

### 7. Обновить зависимый код

После миграции может потребоваться:

- Обновить Zod-валидаторы в `validators/`
- Добавить типы в `@workyy/core-domain` (если shared) — скажи пользователю запустить `/shared`
- Обновить API роуты — скажи пользователю запустить `/backend`

### 8. Отчёт

```
## Migration: [описание]

### Изменения в schema
- [что добавлено/изменено]

### SQL миграция
[путь к файлу миграции]

### Breaking changes
[Нет / описание]

### Что обновить
- [ ] Validators (если новые поля)
- [ ] API routes (если новая модель)
- [ ] core-domain types (если shared)
```

## Примеры использования

```
/migrate Добавить модель Template с полями name, description, nodesJson, edgesJson, связь с Board
```

```
/migrate Добавить поле lastAccessedAt к Board для сортировки по последнему доступу
```

```
/migrate Добавить индекс на Board.workspaceId для ускорения запросов
```
