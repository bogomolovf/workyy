# Быстрый старт для разработки

## Первый запуск

1. **Клонируйте репозиторий:**
   ```bash
   git clone git@github.com:bogomolovf/workyy-fullproject-stable.git
   cd workyy-fullproject-stable
   ```

2. **Запустите проект:**
   ```bash
   ./start.sh
   ```

   Скрипт автоматически:
   - Установит зависимости
   - Сгенерирует Prisma клиент
   - Запустит PostgreSQL и Redis через Docker
   - Применит миграции базы данных
   - Создаст необходимые `.env` файлы
   - Запустит frontend и backend

3. **Откройте в браузере:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000

## Регистрация и вход

После запуска проекта:

1. Перейдите на http://localhost:3000
2. Нажмите "Sign up" или перейдите на http://localhost:3000/signup
3. Заполните форму регистрации:
   - Email (обязательно)
   - Password (минимум 8 символов)
   - Name (опционально)
4. После регистрации вы автоматически войдете в систему
5. Будет создан ваш личный workspace
6. Вы сможете создавать доски и работать с ними

## Решение проблем

### Регистрация не работает

1. **Проверьте, что backend запущен:**
   ```bash
   curl http://localhost:4000/health
   ```
   Должен вернуть: `{"status":"ok"}`

2. **Проверьте, что база данных запущена:**
   ```bash
   docker ps | grep postgres
   ```

3. **Проверьте миграции:**
   ```bash
   cd apps/realtime-server
   pnpm prisma migrate status
   ```

4. **Примените миграции вручную:**
   ```bash
   cd apps/realtime-server
   pnpm prisma migrate deploy
   ```

5. **Проверьте логи backend:**
   - В терминале, где запущен `pnpm dev`, должны быть логи от realtime-server
   - Ищите ошибки подключения к базе данных

### База данных не запускается

```bash
# Остановите все контейнеры
docker compose down

# Запустите заново
docker compose up -d postgres redis

# Проверьте логи
docker compose logs postgres
```

### Порт уже занят

```bash
# Проверьте, что порты свободны
lsof -i :3000
lsof -i :4000
lsof -i :5433

# Если заняты, остановите процессы или измените порты в docker-compose.yml
```

## Структура проекта

- `apps/web/` - Next.js frontend
- `apps/realtime-server/` - Fastify backend API
- `apps/landing/` - Landing page (опционально)
- `packages/` - Общие пакеты

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
