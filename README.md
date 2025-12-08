# Workyy

Workyy — браузерная платформа аналитики на бесконечном холсте. Проект реализует совместное создание пайплайнов из SQL и Python узлов, визуализацию данных и воспроизводимость исследовательских цепочек.

## Быстрый старт

```bash
# Установка зависимостей
pnpm install

# Запуск всех приложений (web + backend + landing)
pnpm dev

# Или только продукт (web + backend)
pnpm --filter web dev
pnpm --filter realtime-server dev
```

Подробные инструкции по запуску см. в [QUICK_START.md](./QUICK_START.md).

## Архитектура

- `apps/web` — Next.js приложение с канвой tldraw, узлами SQL/Python и визуализациями
- `apps/realtime-server` — Fastify/y-websocket сервер для синхронизации и API
- `apps/landing` — Landing page (Vite + React) для маркетинга и онбординга (опционально)
- `packages/*` — Общие доменные и инфраструктурные пакеты
- `infra/` — Terraform и Docker конфигурации окружений
- `docs/` — Решения, диаграммы, схемы данных и контрактов

## Запуск отдельных приложений

```bash
# Только продукт (web + backend)
pnpm --filter web dev
pnpm --filter realtime-server dev

# Только лендинг
pnpm --filter landing dev

# Всё вместе
pnpm dev
```

## 🤖 Cursor AI

Проект настроен для работы с Cursor AI:

- ✅ Правила проекта (`.cursorrules`)
- ✅ База знаний (`.cursor/knowledge/`)
- ✅ Структура для команд и промптов (`.cursor/commands/`, `.cursor/prompts/`)

Добавляйте свои команды и промпты в соответствующие директории. Подробнее см. [.cursor/README.md](./.cursor/README.md).

## Документация

- [QUICK_START.md](./QUICK_START.md) - Подробная инструкция по запуску
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Руководство для разработчиков
- [docs/](./docs/) - Архитектурная документация

## Лицензия

Проект распространяется по лицензии MIT, см. `LICENSE`.
