# Онбординг новых разработчиков

## Первые шаги

### 1. Установка окружения

```bash
# Клонируй репозиторий
git clone <repo-url> workyy-fullproject-stable
cd workyy-fullproject-stable

# Установи зависимости
pnpm install

# Настрой переменные окружения
cp apps/realtime-server/.env.example apps/realtime-server/.env
cp apps/web/.env.local.example apps/web/.env.local

# Запусти базу данных
docker compose up -d postgres redis

# Примени миграции
cd apps/realtime-server
pnpm prisma:migrate
pnpm prisma:generate

# Запусти проект
cd ../..
pnpm dev
```

### 2. Изучение структуры проекта

1. Прочитай `README.md` в корне
2. Изучи `CONTRIBUTING.md` для процессов
3. Посмотри `docs/architecture/README.md`
4. Изучи `docs/api/openapi.yaml` для API

### 3. Настройка Cursor AI

1. Установи Cursor (последняя версия)
2. Открой проект в Cursor
3. Прочитай `.cursorrules` - это правила для ИИ
4. Изучи `.cursor/knowledge/` - база знаний проекта
5. Изучи команды из `.cursor/commands/README.md` (команды уже настроены)

### 4. Первая задача

1. Создай ветку: `git checkout -b feature/onboarding-task`
2. Используй Cursor Ask для изучения кода
3. Используй Cursor Agent для реализации
4. Напиши тесты
5. Создай PR с описанием

## Полезные команды

```bash
# Разработка
pnpm dev                    # Запустить все приложения
pnpm --filter web dev       # Только frontend
pnpm --filter realtime-server dev  # Только backend

# Тестирование
pnpm test                   # Все тесты
pnpm --filter web test      # Тесты frontend
pnpm run test:e2e          # E2E тесты

# Линтинг
pnpm lint                   # Проверка кода
pnpm run format:fix        # Автоисправление форматирования

# База данных
cd apps/realtime-server
pnpm prisma:studio         # GUI для БД
pnpm prisma:migrate        # Применить миграции
pnpm prisma:generate       # Генерировать клиент
```

## Работа с Cursor AI

### Режимы работы

1. **Ask** - для изучения кода:

   ```
   "Объясни как работает синхронизация канвы через WebSocket"
   ```

2. **Agent** (`Ctrl+I`) - для разработки:

   ```
   "Создай компонент для отображения списка досок"
   ```

3. **Manual** - для точного контроля

### Полезные промпты

- "Покажи пример создания нового API endpoint"
- "Как добавить новый тип узла?"
- "Где находится логика выполнения SQL узлов?"

### Пользовательские команды

Используй команды из `.cursor/commands/` (через префикс `/` в чате):

**Основные команды:**

- `/fix-bug` ⭐ - Исправление багов
- `/develop-feature` ⭐ - Разработка новых фич
- `/refactor` ⭐ - Рефакторинг кода
- `/code-review` ⭐ - Код-ревью

**Дополнительные команды:**

- `/review-pr` - проверка PR
- `/create-test` - создание тестов
- `/check-architecture` - проверка архитектуры
- `/check-security` - проверка безопасности
- И другие (14 команд всего)

**Агентские команды:**

- `/developer` ⭐ - Универсальный агент-разработчик
- `/code-reviewer` - Агент для код-ревью
- `/test-generator` - Агент для создания тестов
- `/migration-helper` - Агент для работы с миграциями

**Подробнее:** См. `.cursor/commands/README.md`

## Рабочий процесс

### Ежедневный workflow

1. **Утро**: Синхронизация с main

   ```bash
   git checkout main
   git pull
   pnpm install
   ```

2. **Работа над задачей**:
   - Создай ветку от main
   - Используй Cursor Agent для разработки
   - Регулярно коммить (Conventional Commits)
   - Запускай тесты локально

3. **Перед PR**:
   - Запусти `/review-pr` в Cursor
   - Исправь замечания
   - Убедись что все тесты проходят
   - Обнови документацию если нужно

4. **После мерджа**:
   - Удали локальную ветку
   - Обнови main
   - Экспортируй важные чаты в базу знаний

## Частые вопросы

### Как добавить новый API endpoint?

1. Создай роут в `apps/realtime-server/src/routes/`
2. Добавь валидацию в `apps/realtime-server/src/validators/`
3. Создай сервис если нужна бизнес-логика
4. Обнови `docs/api/openapi.yaml`
5. Напиши тесты

### Как добавить новый тип узла?

1. Обнови `packages/core-domain/src/schemas/node.ts`
2. Добавь обработку в `apps/realtime-server/src/services/runService.ts`
3. Создай UI компонент в `apps/web/src/components/`
4. Обнови тесты

### Как работает реалтайм синхронизация?

Используется y-websocket (Yjs) для CRDT синхронизации:

- Каждый клиент поддерживает локальную копию состояния
- Изменения синхронизируются через WebSocket
- Конфликты разрешаются автоматически через CRDT

## Полезные ссылки

- [Документация Cursor](https://docs.cursor.com)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Fastify](https://www.fastify.io/)
- [Prisma](https://www.prisma.io/docs)
- [Yjs](https://docs.yjs.dev/)

## Контакты команды

- Тимлид: [ваш контакт]
- Разработчики: [контакты команды]

## Чек-лист готовности

- [ ] Окружение установлено и работает
- [ ] Проект запускается локально
- [ ] Тесты проходят
- [ ] Cursor AI настроен
- [ ] Изучена структура проекта
- [ ] Выполнена первая задача
- [ ] Создан первый PR
