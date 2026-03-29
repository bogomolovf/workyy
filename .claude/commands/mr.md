Подготовь Merge Request. Контекст: $ARGUMENTS

## Алгоритм

### 1. Анализ изменений

**Параллельно** выполни:

- `git diff main...HEAD` — все изменения с момента ответвления
- `git log --oneline main..HEAD` — история коммитов
- `git status` — есть ли незакоммиченные изменения

**Определи:**

- Тип изменений: feature / fix / refactor / chore
- Scope: какие пакеты/приложения затронуты
- Breaking changes: есть ли несовместимые изменения API/схемы

### 2. Проверки перед MR

Запусти `/preflight` проверки или выполни вручную:

- [ ] `npx tsc --noEmit` в apps/web — нет ошибок типизации
- [ ] `npx tsc --noEmit` в apps/realtime-server — нет ошибок типизации
- [ ] Нет `console.log` для отладки (Grep: `console\.log` в src/)
- [ ] Нет `[DIAG:*]` диагностических логов
- [ ] Нет закомментированного кода
- [ ] Нет `TODO` без issue-ссылки
- [ ] ESLint чистый: `npx eslint --max-warnings 0`
- [ ] Build проходит: `pnpm build`

### 3. Проверка конфликтов с main

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
```

Если main ушёл вперёд — **сообщи пользователю** что нужен rebase:

```bash
git rebase origin/main
```

### 4. Описание MR

Создай описание в формате:

```markdown
## Что сделано

- [краткий список изменений по bullet points — фокус на "что" и "зачем"]

## Тип изменений

- [ ] Feature
- [ ] Bugfix
- [ ] Refactor
- [ ] Chore

## Затронутые области

- [ ] Canvas (BoardCanvas, ноды, эджи)
- [ ] Realtime server (API, WebSocket, Prisma)
- [ ] State management (Zustand stores)
- [ ] Collaboration (Yjs)
- [ ] Data processing (Pyodide, DuckDB)
- [ ] Shared types (core-domain)
- [ ] UI/UX (стили, layout, анимации)

## Как тестировать

1. [шаги для ручной проверки — конкретные действия в браузере]

## Breaking changes

[Нет / описание несовместимых изменений]

## Скриншоты

[если UI изменения — опиши что приложить]
```

### 5. Создание PR

```bash
gh pr create --base main --title "тип: краткое описание" --body "..."
```

**Формат title:**

- `feat: описание` — новая функциональность
- `fix: описание` — исправление бага
- `refactor: описание` — рефакторинг без изменения поведения
- `chore: описание` — инфраструктура, зависимости, конфиги

**Выведи ссылку на PR** после создания.

## Примеры использования

```
/mr Система комментариев на канве с реалтайм синхронизацией
```

```
/mr Фикс PlotNode — данные не отображаются после выполнения SQL
```

```
/mr Рефакторинг InnerBoardCanvas — вынос логики в хуки
```
