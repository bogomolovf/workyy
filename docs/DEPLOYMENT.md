# Руководство по деплою Workyy

Этот документ описывает процесс деплоя Workyy в production окружение.

## Архитектура деплоя

Система состоит из:

1. **Landing Page** (Vite + React) - Маркетинговая страница
2. **Product Application** (Next.js) - Основное приложение
3. **Backend API** (Fastify) - Сервер с PostgreSQL
4. **Reverse Proxy** (Nginx) - Маршрутизация запросов

## Структура роутинга

В production с Nginx:

- `/` → Landing page (Vite build)
- `/app/*` → Next.js приложение
- `/api/*` → Fastify backend API
- `/collab` → WebSocket endpoint для коллаборации

## Переменные окружения

### Backend API (`apps/realtime-server`)

```bash
PORT=4000
DATABASE_URL=postgresql://user:password@postgres:5432/workyy
REDIS_URL=redis://redis:6379

# CORS origins
LANDING_ORIGIN=https://workyy.example.com
APP_ORIGIN=https://workyy.example.com/app

# Security
JWT_SECRET=<generate-strong-secret>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_DOMAIN=workyy.example.com
```

### Product Application (`apps/web`)

```bash
NEXT_PUBLIC_LANDING_URL=https://workyy.example.com
NEXT_PUBLIC_WS_URL=https://workyy.example.com
NEXT_PUBLIC_APP_URL=https://workyy.example.com/app
```

### Landing Page (`apps/landing`)

```bash
VITE_PRODUCT_APP_URL=https://workyy.example.com/app
VITE_API_URL=https://workyy.example.com
```

## Процесс деплоя

### 1. Подготовка

```bash
# Сборка всех приложений
pnpm install
pnpm run build
```

### 2. Docker Compose

```bash
docker compose up -d
```

### 3. База данных

```bash
# Применение миграций
cd apps/realtime-server
pnpm prisma migrate deploy

# Опционально: заполнение начальными данными
pnpm db:seed
```

### 4. Nginx

Настройте Nginx согласно `infra/nginx.conf`:

- Обновите `server_name` с вашим доменом
- Настройте SSL сертификаты (Let's Encrypt)
- Обновите пути к билдам

## Проверка после деплоя

1. Landing page загружается на `https://workyy.example.com`
2. "Log in" ведет на `https://workyy.example.com/app/login`
3. API отвечает на `https://workyy.example.com/api/health`
4. WebSocket подключается на `wss://workyy.example.com/collab`

## Мониторинг

- Health check: `https://workyy.example.com/health`
- Логи: `docker compose logs -f`
- База данных: проверка через Prisma Studio или прямые подключения

## Откат (Rollback)

```bash
# Остановить текущую версию
docker compose down

# Переключиться на предыдущую версию кода
git checkout <previous-tag>
pnpm install
pnpm run build
docker compose up -d
```

## Резервное копирование

Настройте автоматические бэкапы PostgreSQL:

```bash
# Пример cron задачи для ежедневных бэкапов
0 2 * * * docker exec workyy-postgres pg_dump -U postgres workyy > /backups/workyy-$(date +\%Y\%m\%d).sql
```
