# Сводка проекта Workyy для промпта «Разделение пользователей на команды»

Этот документ нужен, чтобы ты (ChatGPT) сформировал **один итоговый промпт** для Cursor AI (агента в IDE), который реализует функционал **разделения пользователей на команды** в проекте Workyy. Ниже — всё необходимое о проекте и текущей модели.

---

## 1. Что за проект

**Workyy** — веб-платформа аналитики на бесконечном холсте (канва с узлами SQL/Python, досками, реалтайм-коллаборацией).

- **Монорепо**: `apps/web` (Next.js), `apps/realtime-server` (Fastify + y-websocket), `apps/landing`, `packages/*`.
- **Стек**: TypeScript (strict), React, tldraw, Prisma, PostgreSQL, JWT в cookies, WebSocket для синхронизации канвы.
- **Правила**: Conventional Commits, ESLint/Prettier, `pnpm`, импорты через `@workyy/<package>`. Описание в корне: `.cursorrules`.

---

## 2. Текущая модель пользователей и «пространств»

Сейчас есть **Workspace** (рабочее пространство), но в интерфейсе нет явного выбора «текущей команды/воркспейса» — доски показываются со всех воркспейсов пользователя, а создание доски и «Участники» завязаны на **первый** воркспейс пользователя.

### База данных (Prisma, `apps/realtime-server/prisma/schema.prisma`)

- **User**  
  `id`, `email`, `name`, `avatarUrl`, `createdAt`, `passwordHash`.  
  Связи: `roles` (UserWorkspaceRole), `boards` (Board как owner), comments, snapshots.

- **Workspace**  
  `id`, `name`, `createdAt`.  
  Связи: `boards`, `members` (UserWorkspaceRole), secrets, databaseConnections, retentionPolicies, auditEvents.

- **UserWorkspaceRole**  
  Составной ключ `(userId, workspaceId)`, поле `role` (enum: `owner` | `editor` | `viewer`), `addedAt`.  
  Связь User ↔ Workspace многие-ко-многим с ролью.

- **Board**  
  `id`, `workspaceId`, `ownerId` (User, опционально), `title`, `description`, и т.д.  
  Доска принадлежит одному Workspace; владелец — один User.

При регистрации пользователю создаётся **дефолтный workspace** с ролью `owner` (`userService.createUserWithPassword`).

### Бэкенд (realtime-server)

- **Авторизация**: JWT в HTTP-only cookie, `app.authenticate` для защищённых маршрутов.  
  `request.user` содержит `userId`, `email`.

- **Проверка доступа**:
  - `ensureBoardAccess(userId, boardId, requiredRoles?)` — доступ к доске через членство в workspace доски.
  - `ensureWorkspaceAccess(userId, workspaceId, requiredRoles?)` — доступ к workspace по UserWorkspaceRole.

- **Маршруты**:
  - **Boards** (`/api/boards`): список досок — по всем workspace пользователя (или фильтр `?workspaceId=...`), создание доски в указанном `workspaceId`, CRUD доски с проверкой через workspace.
  - **Workspaces** (`/api/workspaces/:workspaceId/members`):  
     GET — список участников,  
     POST — добавить по email + role,  
     DELETE — удалить участника,  
     PATCH — изменить роль.  
    Доступ только у пользователей с ролью owner/editor (для добавления/удаления/смены роли — только owner для смены роли).

- **Auth**:  
  `POST /api/auth/register`, `login`, `logout`, `GET /api/auth/me`.  
  В ответе `me` приходят `id`, `email`, `name`, `workspaces: [{ id, name, role }]`.

### Фронтенд (apps/web)

- **Состояние**: `authStore` (Zustand) — `user` с полем `workspaces: { id, name, role }[]`.
- **API** (`lib/api.ts`):  
  `fetchBoards(workspaceId?)`, `fetchBoard`, `createBoard`, CRUD доски;  
  `fetchWorkspaceMembers(workspaceId)`, `addWorkspaceMember`, `removeWorkspaceMember`, `updateWorkspaceMemberRole`.
- **Главная страница** (`app/page.tsx`):
  - Список досок: `fetchBoards()` без аргумента — все доски по всем воркспейсам пользователя.
  - Создание доски: `workspaceIdForCreation` = первый workspace из `user.workspaces` (или из env, или из первой доски).
  - Кнопка «Участники» открывает `WorkspaceMembers` с тем же `workspaceIdForCreation` (т.е. первый воркспейс).
- **Нет**: переключателя «текущий workspace/команда», отдельного списка воркспейсов, фильтра досок по воркспейсу в UI.

### Реалтайм и коллаборация

- WebSocket (y-websocket): подключение к документу доски по `boardId`.  
  Доступ к доске проверяется через `ensureBoardAccess` (т.е. через членство в workspace доски).
- Присутствие на доске (presence) и т.п. привязаны к доске, не к «команде».

---

## 3. Что нужно уточнить для «команд»

Термин «команды» в продукте может означать разное. Нужно выбрать одну из моделей (или сформулировать гибрид) и в промпте для Cursor явно это описать.

**Вариант A — Команда = Workspace (переименование и доработка)**

- «Команда» в UI — это текущий Workspace.
- Нужно: переключатель «текущая команда», список досок только по выбранной команде, создание доски в выбранной команде, управление участниками именно этой команды.
- Модель БД можно не менять (Workspace = команда), только API/UI и, при желании, нейминг (например, «Команда» в интерфейсе).

**Вариант B — Команда как отдельная сущность между User и Workspace**

- Новая сущность **Team**: у команды есть участники (User), у команды — один или несколько Workspace.
- Иерархия: User → Team (роль в команде) → Workspace (как сейчас).
- Нужны миграции Prisma, новые роуты (команды, участники команды, привязка workspace к команде), обновление авторизации и UI.

**Вариант C — Команда как подгруппа внутри Workspace**

- Внутри одного Workspace есть **Team** (подгруппы пользователей).
- Доски могут быть привязаны к команде (опционально); видимость/права могут зависеть от команды.
- Нужны новая модель (например, Team + связь Board–Team), миграции, API и UI.

В промпте для Cursor нужно **однозначно** указать: какая из моделей (A/B/C или своя) требуется и что именно должно появиться в UI (переключатель команд, список участников команды, фильтр досок и т.д.).

---

## 4. Технические точки, которые должен затронуть промпт для Cursor

Чтобы Cursor мог реализовать «команды» без лишних вопросов, в промпте стоит явно перечислить:

1. **Схема данных**
   - Оставить только Workspace и доработать его как «команду», или ввести новую сущность Team и связи (User–Team, Team–Workspace или Board–Team).
   - Какие поля и связи добавить/изменить (названия, роли, индексы).

2. **Миграции**
   - Prisma: новая миграция в `apps/realtime-server/prisma/`, без поломки существующих данных (дефолтный workspace у существующих пользователей остаётся).

3. **Бэкенд**
   - Новые или изменённые маршруты (например, `GET /api/teams` или `GET /api/workspaces` с переименованием в «teams» в контракте).
   - Обновить `ensureBoardAccess` / `ensureWorkspaceAccess` или ввести `ensureTeamAccess`, если появится Team.
   - Ответ `GET /api/auth/me`: нужно ли возвращать команды/темы и в каком формате.
   - OpenAPI: обновить `docs/api/openapi.yaml` под новые/изменённые эндпоинты.

4. **Фронтенд**
   - Выбор «текущей команды/workspace» (селектор в шапке или сайдбаре), сохранение выбора (например, в `authStore` или отдельном store, при необходимости — в localStorage).
   - Список досок: фильтрация по выбранной команде/workspace.
   - Создание доски: в выбранную команду/workspace.
   - Экран/модалка «Участники» привязать к выбранной команде/workspace.
   - Типы и API-клиент в `lib/api.ts` обновить под новые ответы и запросы.

5. **Реалтайм**
   - Оставить проверку доступа к доске через текущую модель (workspace/team); при появлении Team — проверять доступ к доске с учётом команды, если доска привязана к команде.

6. **Локализация**
   - В проекте есть переводы (`lib/translations.ts`). Добавить ключи для «Команда», «Участники команды», «Текущая команда» и т.д., если в UI появятся такие подписи.

7. **Стиль и соглашения**
   - Conventional Commits (`feat:`, `fix:` и т.д.), только TypeScript без `any`, следовать существующим паттернам в `apps/web` и `apps/realtime-server`.

---

## 5. Структура репозитория (для ориентира)

```
apps/
  web/                    # Next.js
    src/
      app/page.tsx         # главная, список досок
      state/authStore.ts   # user, workspaces
      lib/api.ts           # fetchBoards, workspace members, auth
      components/WorkspaceMembers.tsx
  realtime-server/         # Fastify
    prisma/schema.prisma   # User, Workspace, UserWorkspaceRole, Board, ...
    src/
      routes/boards.ts
      routes/workspaces.ts
      routes/auth.ts
      services/authorizationService.ts
      services/userService.ts
docs/api/openapi.yaml
```

---

## 6. Что попросить у ChatGPT

Скопируй этот бриф в ChatGPT и попроси:

- Уточнить, если нужно, какой вариант «команд» (A, B, C или свой) тебе нужен.
- Составить **один готовый промпт на русском или английском** для Cursor AI (Agent), который:
  - кратко повторяет выбранную модель «команд» и цели (что видит пользователь в UI, что меняется в API и БД);
  - по пунктам перечисляет задачи: схема и миграции, бэкенд (маршруты, авторизация, openapi), фронтенд (выбор команды, доски, участники, API-клиент), при необходимости реалтайм и переводы;
  - напоминает про Conventional Commits и стиль кода проекта.

После этого готовый промпт можно вставить в чат Cursor (Agent) и выполнить реализацию в репозитории Workyy.
