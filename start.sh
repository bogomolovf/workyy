#!/bin/bash
set -e

echo "🚀 Запуск Workyy..."
echo ""

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    pnpm install
fi

# Проверка Prisma клиента
if [ ! -d "apps/realtime-server/node_modules/.prisma" ]; then
    echo "🔧 Генерация Prisma клиента..."
    cd apps/realtime-server
    pnpm prisma:generate
    cd ../..
fi

# Проверка базы данных
echo "🔍 Проверка базы данных..."
if ! docker ps | grep -q postgres; then
    echo "⚠️  PostgreSQL не запущен. Запуск через docker-compose..."
    docker compose up -d postgres
    echo "⏳ Ожидание запуска PostgreSQL..."
    sleep 5
fi

# Проверка .env файлов
if [ ! -f "apps/realtime-server/.env" ]; then
    echo "⚠️  Отсутствует apps/realtime-server/.env"
    echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5433/workyy" > apps/realtime-server/.env
fi

if [ ! -f "apps/web/.env.local" ]; then
    echo "⚠️  Отсутствует apps/web/.env.local"
    cat > apps/web/.env.local << 'ENVEOF'
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_DEFAULT_WORKSPACE_ID=90bcfc0f-049f-42f4-8398-fc1c52c399a8
NEXT_PUBLIC_DEMO_BOARD_ID=bc9dba15-8125-42c4-b6e3-05097e005fd8
ENVEOF
fi

echo "✅ Все готово к запуску!"
echo ""
echo "Запуск фронтенда и бэкенда..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:4000"
echo ""

pnpm dev
