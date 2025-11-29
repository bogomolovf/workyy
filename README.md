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

> Подробнее о запуске конкретных пакетов см. в `CONTRIBUTING.md`.

### Demo board (Stage 4)

Для предпросмотра канвы укажите ID сидового борда в `apps/web/.env.local`:

```
NEXT_PUBLIC_DEMO_BOARD_ID=<uuid борда из seed, напр. bed1e621-749b-48a4-a104-8b7b49ff0291>
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

ID можно получить командой:

```bash
docker exec -it workyy-postgres-1 psql -U postgres -d workyy \
  -c 'select id, title from "Board";'
```

После этого `pnpm --filter web dev` отобразит ReactFlow-превью и чтение DAG.
Также можно передать UUID через query string: `http://localhost:3000/board/demo?boardId=<uuid>`.

## Архитектура

- `apps/web` — Next.js приложение с канвой tldraw, узлами SQL/Python и визуализациями.
- `apps/realtime-server` — Fastify/y-websocket сервер для синхронизации и API.
- `apps/landing` — Landing page (Vite + React) для маркетинга и онбординга (опционально).
- `packages/*` — Общие доменные и инфраструктурные пакеты.
- `infra/` — Terraform и Docker конфигурации окружений.
- `docs/` — Решения, диаграммы, схемы данных и контрактов.

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

## Лицензия

Проект распространяется по лицензии MIT, см. `LICENSE`.

