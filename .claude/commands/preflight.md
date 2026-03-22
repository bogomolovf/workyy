Запусти предполётные проверки перед коммитом/деплоем.

## Чеклист проверок

Выполни ВСЕ проверки ниже. Для каждой: **PASS** / **FAIL** + детали если FAIL.

### 1. TypeScript (параллельно)

Запусти одновременно:
```bash
cd apps/web && npx tsc --noEmit
cd apps/realtime-server && npx tsc --noEmit
cd packages/core-domain && pnpm build
```

### 2. ESLint (параллельно)

```bash
npx eslint apps/web/src --max-warnings 0
npx eslint apps/realtime-server/src --max-warnings 0
```

### 3. Кэш

```bash
rm -rf apps/web/.next
```

### 4. Build (после TypeScript и ESLint)

```bash
pnpm build
```

Если build не проходит — это blocker.

### 5. Prisma

```bash
cd apps/realtime-server && npx prisma validate
```

Проверь: нет ли drift между schema.prisma и миграциями.

### 6. Git

- [ ] Нет merge conflict маркеров (`<<<<<<<`, `=======`, `>>>>>>>`) — Grep по всем файлам
- [ ] Нет незакоммиченных изменений в tracked файлах (если должны быть закоммичены)
- [ ] Нет случайно добавленных файлов (.env, node_modules, .DS_Store)

### 7. Код

- [ ] Нет `console.log` для отладки (только `console.error`/`console.warn` допустимы)
- [ ] Нет `[DIAG:*]` диагностических логов
- [ ] Нет закомментированного кода
- [ ] Нет `TODO` без issue-ссылки
- [ ] Нет hardcoded credentials, tokens, URLs

### 8. Зависимости

- [ ] Нет новых зависимостей без необходимости (проверь diff в package.json)
- [ ] `pnpm install` — lockfile актуален

## Формат отчёта

```
## Preflight Report

| # | Проверка | Статус | Детали |
|---|----------|--------|--------|
| 1 | TypeScript (web) | PASS/FAIL | ... |
| 2 | TypeScript (server) | PASS/FAIL | ... |
| 3 | TypeScript (core-domain) | PASS/FAIL | ... |
| 4 | ESLint (web) | PASS/FAIL | ... |
| 5 | ESLint (server) | PASS/FAIL | ... |
| 6 | Build | PASS/FAIL | ... |
| 7 | Prisma | PASS/FAIL | ... |
| 8 | Git clean | PASS/FAIL | ... |
| 9 | No debug code | PASS/FAIL | ... |
| 10 | Dependencies | PASS/FAIL | ... |

### Вердикт: READY / NOT READY

### Что исправить (если NOT READY):
1. [конкретное действие]
2. [конкретное действие]
```

## Автофикс

Если обнаружены мелкие проблемы (забытый console.log, trailing whitespace), **исправь автоматически** и сообщи об этом в отчёте.

Для серьёзных проблем (ошибки типизации, сломанный build) — **не исправляй**, только сообщи.
