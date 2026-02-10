# Быстрый старт для разработки

## Требования

- **Node.js** и **pnpm**
- **Docker** (или **Colima** на macOS) — для PostgreSQL и Redis

Скрипт `./start.sh` сам попытается:
- запустить **Docker Desktop**, если он установлен, но не запущен;
- или установить и запустить **Colima** через Homebrew (`brew install colima`), если Docker недоступен.

## Первый запуск

### 1. Клонируйте репозиторий

```bash
git clone <repository-url>
cd workyy-fullproject-stable
```

### 2. Запустите проект

```bash
./start.sh
```

Скрипт автоматически:

- Установит зависимости
- Сгенерирует Prisma клиент
- Запустит PostgreSQL и Redis через Docker
- Применит миграции базы данных
- Создаст необходимые `.env` файлы

### 3. Запустите приложения

```bash
# Все приложения одновременно
pnpm dev

# Или по отдельности:
pnpm --filter web dev          # Frontend (http://localhost:3000)
pnpm --filter realtime-server dev  # Backend (http://localhost:4000)
pnpm --filter landing dev      # Landing page (http://localhost:5173)
```

### 4. Откройте в браузере

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health check**: http://localhost:4000/health

## Регистрация и вход

1. Перейдите на http://localhost:3000
2. Нажмите "Sign up" или перейдите на http://localhost:3000/signup
3. Заполните форму регистрации:
   - Email (обязательно)
   - Password (минимум 8 символов)
   - Name (опционально)
4. После регистрации вы автоматически войдете в систему
5. Будет создан ваш личный workspace
6. Вы сможете создавать доски и работать с ними

## Полезные команды

```bash
# Только frontend
pnpm --filter web dev

# Только backend
pnpm --filter realtime-server dev

# Prisma Studio (GUI для базы данных)
cd apps/realtime-server
pnpm prisma:studio

# Просмотр логов Docker
docker compose logs -f

# Остановка всех сервисов
docker compose down
```

## Переменные окружения

Скрипт `start.sh` автоматически создает необходимые `.env` файлы:

- `apps/realtime-server/.env` - настройки backend
- `apps/web/.env.local` - настройки frontend

Если нужно изменить настройки, отредактируйте эти файлы.

## Решение проблем

### Docker не запущен / Colima не установлен

Скрипт `./start.sh` пытается автоматически:
1. Запустить **Docker Desktop**, если он установлен в `/Applications/Docker.app`.
2. Запустить **Colima**, если он уже установлен (`brew install colima`).
3. Установить Colima через Homebrew и запустить его.

Если ничего не сработало:
- Установите [Docker Desktop](https://www.docker.com/products/docker-desktop/) и запустите его вручную, затем снова выполните `./start.sh`.
- Или установите Colima и Docker CLI: `brew install docker colima && colima start`, затем `./start.sh`.

### Backend не отвечает

1. Проверьте, что backend запущен:

   ```bash
   curl http://localhost:4000/health
   ```

   Должен вернуть: `{"status":"ok"}`

2. Проверьте, что порт 4000 свободен:
   ```bash
   lsof -i :4000
   ```

### База данных не запускается

```bash
# Остановите все контейнеры
docker compose down

# Запустите заново
docker compose up -d postgres redis

# Проверьте логи
docker compose logs postgres
```

### Регистрация не работает

1. Проверьте, что backend запущен (см. выше)
2. Проверьте, что база данных запущена:
   ```bash
   docker ps | grep postgres
   ```
3. Проверьте миграции:
   ```bash
   cd apps/realtime-server
   pnpm prisma migrate status
   ```
4. Примените миграции вручную:
   ```bash
   cd apps/realtime-server
   pnpm prisma migrate deploy
   ```

### Порт уже занят

```bash
# Проверьте, что порты свободны
lsof -i :3000  # Frontend
lsof -i :4000  # Backend
lsof -i :5433  # PostgreSQL

# Если заняты, остановите процессы или измените порты в docker-compose.yml
```

## Структура проекта

- `apps/web/` - Next.js frontend приложение
- `apps/realtime-server/` - Fastify backend API
- `apps/landing/` - Landing page (опционально)
- `packages/` - Общие пакеты (core-domain, dag-executor, ui-kit, wasm-bridge)
- `docs/` - Документация (архитектура, API, операции)
