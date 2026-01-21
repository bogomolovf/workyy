#!/bin/bash
set -e

echo "🚀 Запуск Workyy..."
echo ""

# Проверка и запуск Docker/Colima
echo "🐳 Проверка Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker не запущен. Проверяю Colima..."
    if command -v colima > /dev/null 2>&1; then
        if ! colima status > /dev/null 2>&1; then
            echo "🚀 Запуск Colima..."
            colima start
            echo "✅ Colima запущен"
        else
            echo "✅ Colima уже запущен"
        fi
        # Даем время на инициализацию Docker
        sleep 2
    else
        echo "❌ Ошибка: Docker не запущен и Colima не установлен"
        echo "   Установите Colima: brew install colima"
        echo "   Или запустите Docker Desktop вручную"
        exit 1
    fi
fi

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    pnpm install
fi

# Проверка базы данных
echo "🔍 Проверка базы данных..."
if ! docker ps | grep -q postgres; then
    echo "⚠️  PostgreSQL не запущен. Запуск через docker-compose..."
    docker compose up -d postgres redis
    echo "⏳ Ожидание запуска PostgreSQL..."
    sleep 5
fi

# Проверка подключения к базе данных
echo "🔍 Проверка подключения к базе данных..."
until docker exec $(docker ps -q -f name=postgres) pg_isready -U postgres > /dev/null 2>&1; do
    echo "⏳ Ожидание готовности PostgreSQL..."
    sleep 1
done
echo "✅ PostgreSQL готов"

# Проверка .env файлов (ВАЖНО: создаем ДО генерации Prisma клиента)
if [ ! -f "apps/realtime-server/.env" ]; then
    echo "⚠️  Отсутствует apps/realtime-server/.env, создаю..."
    cat > apps/realtime-server/.env << 'ENVEOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/workyy
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
AUTH_COOKIE_NAME=auth_token
AUTH_COOKIE_DOMAIN=localhost
AUTH_COOKIE_SECURE=false
AUTH_TOKEN_EXPIRES_IN=3600
BCRYPT_ROUNDS=10
PORT=4000
LANDING_ORIGIN=http://localhost:5173
APP_ORIGIN=http://localhost:3000
ENVEOF
    echo "✅ apps/realtime-server/.env создан"
fi

# Проверка Prisma клиента (после создания .env файла)
if [ ! -d "apps/realtime-server/node_modules/.prisma" ]; then
    echo "🔧 Генерация Prisma клиента..."
    cd apps/realtime-server
    pnpm prisma:generate
    cd ../..
fi

# Убеждаемся, что Prisma клиент актуален
echo "🔧 Проверка актуальности Prisma клиента..."
cd apps/realtime-server
pnpm prisma:generate
cd ../..

# Применение миграций
echo "🔧 Применение миграций базы данных..."
cd apps/realtime-server
# Проверяем, есть ли уже миграции
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "📦 Применение существующих миграций..."
    # Пробуем migrate deploy (для production-like окружения)
    if pnpm prisma migrate deploy 2>/dev/null; then
        echo "✅ Миграции применены через migrate deploy"
    else
        echo "⚠️  migrate deploy не удался, пробуем migrate dev..."
        # Используем migrate dev для разработки (создаст миграции если нужно)
        pnpm prisma migrate dev --name sync --create-only || pnpm prisma migrate dev --name sync
    fi
else
    echo "📦 Инициализация миграций..."
    pnpm prisma migrate dev --name init
fi
cd ../..
echo "✅ Миграции применены"

if [ ! -f "apps/web/.env.local" ]; then
    echo "⚠️  Отсутствует apps/web/.env.local, создаю..."
    cat > apps/web/.env.local << 'ENVEOF'
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_LANDING_URL=http://localhost:5173
NEXT_PUBLIC_DEFAULT_WORKSPACE_ID=90bcfc0f-049f-42f4-8398-fc1c52c399a8
NEXT_PUBLIC_DEMO_BOARD_ID=bc9dba15-8125-42c4-b6e3-05097e005fd8
ENVEOF
    echo "✅ apps/web/.env.local создан"
fi

echo "✅ Все готово к запуску!"
echo ""
echo "Запуск фронтенда и бэкенда..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:4000"
echo ""

pnpm dev
