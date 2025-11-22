# Workyy Runbook (Draft)

- Dev environment: `docker compose up`.
- Realtime server: http://localhost:4000/health
- Web app: http://localhost:3000

> Полная версия будет доработана на Stage 6–7.

## База данных (Stage 1–2)

- Применение миграций: `pnpm --filter realtime-server prisma:migrate deploy`.
- Генерация новой миграции в dev (при изменениях схемы): `pnpm --filter realtime-server prisma:migrate -- --name <change-name>`.
- Генерация клиента: `pnpm --filter realtime-server prisma:generate`.
- Начальное наполнение: `pnpm --filter realtime-server db:seed`.

Локальная БД в docker-compose проброшена на порт `5433`: `postgresql://postgres:postgres@localhost:5433/workyy`.

> Убедитесь, что `apps/realtime-server/.env` содержит `DATABASE_URL`, иначе сервис не сможет обращаться к Prisma.

## Frontend (Stage 4)

- Укажите ID демо-борда в `apps/web/.env.local`:
  ```
  NEXT_PUBLIC_DEMO_BOARD_ID=<uuid>
  NEXT_PUBLIC_WS_URL=http://localhost:4000
  ```
- ID можно получить SQL-запросом:  
  `docker exec -it workyy-postgres-1 psql -U postgres -d workyy -c 'select id, title from "Board";'`
- Запуск веб-приложения: `pnpm --filter web dev` (Next.js на порту 3000/3001). React Flow показывает read-only превью узлов/рёбер, API берётся из realtime-сервиса.
- Для быстрого теста можно добавить UUID в URL: `/board/demo?boardId=<uuid>`, input на странице обновляет query-param.

