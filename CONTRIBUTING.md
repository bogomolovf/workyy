# Вклад в Workyy

Спасибо за интерес к проекту! Этот документ описывает как внести вклад в разработку Workyy.

## Требования к окружению

- Node.js 20.x
- pnpm 8.x
- Docker 24+

## Первые шаги

1. Клонируйте репозиторий
2. Установите зависимости: `pnpm install`
3. Запустите проект: `./start.sh` (см. [QUICK_START.md](./QUICK_START.md))
4. Убедитесь что всё работает: `pnpm run lint && pnpm run test`

## Git Workflow

### Ветвление

- Используйте trunk-based development
- Создавайте ветки вида: `feature/<slug>`, `fix/<slug>`, `chore/<slug>`
- Всегда создавайте ветку от актуального `main`

### Коммиты

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - новая функциональность
- `fix:` - исправление бага
- `chore:` - рутинные задачи (deps, config)
- `docs:` - документация
- `refactor:` - рефакторинг без изменения функциональности
- `test:` - добавление/изменение тестов
- `style:` - форматирование (не влияет на код)
- `perf:` - улучшение производительности

Пример: `feat(web): add SQL node execution`

### Pull Requests

- Обязательно включайте описание изменений
- Заполняйте чек-лист тестов
- Требуется минимум один апрув от другого разработчика
- Все CI проверки должны пройти

## Код-стайл

- **TypeScript**: Строгий режим обязателен, избегайте `any`
- **Импорты**: Используйте алиасы `@workyy/<package>`
- **Форматирование**: ESLint + Prettier (автоматически через pre-commit)
- **Линтинг**: Все файлы должны проходить `pnpm run lint` без ошибок

## Тестирование

### Типы тестов

- **Юнит-тесты**: Vitest (`pnpm run test`)
- **E2E тесты**: Playwright (`pnpm run test:e2e`) - когда будут добавлены
- **Контрактные тесты**: для API (`pnpm run test:contracts`)

### Требования

- Новый код должен иметь тесты
- Покрытие критичной логики минимум 80%
- Тесты должны быть независимыми и детерминированными

## Структура проекта

### Приложения

- `apps/web` - Next.js приложение с канвой tldraw
- `apps/realtime-server` - Fastify сервер для синхронизации и API
- `apps/landing` - Landing page (Vite + React)

### Пакеты

- `packages/core-domain` - Доменные схемы и типы
- `packages/dag-executor` - Исполнитель DAG
- `packages/ui-kit` - Общие UI компоненты
- `packages/wasm-bridge` - WASM мост для Python/SQL

### Документация

- `docs/` - Решения, диаграммы, схемы данных
- `.cursor/knowledge/` - База знаний для Cursor AI

## Полезные команды

```bash
# Установка зависимостей
pnpm install

# Запуск всех приложений
pnpm dev

# Линтинг
pnpm run lint

# Тесты
pnpm run test

# Форматирование
pnpm run format:fix

# Сборка
pnpm run build
```

## Дополнительные ресурсы

- [QUICK_START.md](./QUICK_START.md) - Подробная инструкция по запуску
- [docs/](./docs/) - Архитектурная документация
- [.cursor/knowledge/](./.cursor/knowledge/) - База знаний проекта
