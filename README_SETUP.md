# Инструкция по запуску Workyy

## Быстрый старт

### 1. Установка зависимостей

```bash
cd ~/workyy
pnpm install
```

### 2. Настройка окружения

Файлы `.env` уже созданы:

- `apps/realtime-server/.env` - для backend сервера
- `apps/web/.env.local` - для frontend приложения

### 3. Генерация Prisma клиента

```bash
cd apps/realtime-server
pnpm prisma:generate
```

### 4. Проверка базы данных

Убедитесь, что PostgreSQL запущен на порту 5433:

```bash
# Проверка через Docker
docker ps | grep postgres

# Или запуск через docker-compose
cd ~/workyy
docker compose up -d postgres
```

### 5. Применение миграций (если необходимо)

```bash
cd apps/realtime-server
pnpm prisma:migrate
```

### 6. Запуск проекта

В корне проекта:

```bash
pnpm dev
```

Это запустит:

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

### Альтернативный запуск через Docker

```bash
docker compose up
```

## Структура проекта

- `apps/web/` - Next.js frontend приложение
- `apps/realtime-server/` - Fastify backend API
- `packages/` - Внутренние пакеты (core-domain, dag-executor, ui-kit, wasm-bridge)

## Решение проблем

### Backend не отвечает (404 ошибка)

1. Убедитесь, что backend запущен:

   ```bash
   curl http://localhost:4000/health
   ```

   Должен вернуть: `{"status":"ok"}`

2. Проверьте, что порт 4000 свободен:
   ```bash
   netstat -tlnp | grep :4000
   ```

### База данных не доступна

1. Проверьте, что PostgreSQL запущен:

   ```bash
   docker ps | grep postgres
   ```

2. Проверьте подключение:

   ```bash
   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d workyy -c "SELECT 1"
   ```

3. Если база не запущена, запустите через docker-compose:
   ```bash
   docker compose up -d postgres
   ```

### Frontend не может подключиться к backend

Проверьте переменные окружения в `apps/web/.env.local`:

- `NEXT_PUBLIC_WS_URL=http://localhost:4000` - должен указывать на backend
