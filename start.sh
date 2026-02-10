#!/bin/bash
set -e

echo "🚀 Запуск Workyy..."
echo ""

# Проверка и запуск Docker/Colima
echo "🐳 Проверка Docker..."
ensure_docker() {
    if docker info > /dev/null 2>&1; then
        return 0
    fi
    # Пробуем запустить Docker Desktop (macOS)
    if [[ "$(uname)" == "Darwin" ]] && [ -d "/Applications/Docker.app" ]; then
        echo "⚠️  Docker не запущен. Запускаю Docker Desktop..."
        open -a Docker
        echo "⏳ Ожидание запуска Docker Desktop (до 30 сек)..."
        for i in {1..30}; do
            sleep 1
            if docker info > /dev/null 2>&1; then
                echo "✅ Docker Desktop запущен"
                return 0
            fi
        done
    fi
    # Пробуем Colima (ему нужен Docker CLI: brew install docker)
    if command -v colima > /dev/null 2>&1; then
        if ! command -v docker > /dev/null 2>&1; then
            echo "⚠️  Colima требует Docker CLI. Установка: brew install docker..."
            command -v brew > /dev/null 2>&1 && brew install docker
        fi
        if ! colima status > /dev/null 2>&1; then
            echo "🚀 Запуск Colima..."
            colima start
            echo "✅ Colima запущен"
        else
            echo "✅ Colima уже запущен"
        fi
        sleep 3
        docker info > /dev/null 2>&1 && return 0
    else
        echo "⚠️  Colima не установлен. Установка через Homebrew..."
        if command -v brew > /dev/null 2>&1; then
            brew install colima
            if ! command -v docker > /dev/null 2>&1; then
                echo "⚠️  Установка Docker CLI для Colima: brew install docker..."
                brew install docker
            fi
            echo "🚀 Запуск Colima..."
            colima start
            sleep 3
            docker info > /dev/null 2>&1 && return 0
        fi
    fi
    return 1
}

if ! ensure_docker; then
    echo "❌ Ошибка: не удалось запустить Docker."
    echo "   Варианты:"
    echo "   1. Установите Docker Desktop: https://www.docker.com/products/docker-desktop/"
    echo "   2. Или Colima + Docker CLI: brew install docker colima && colima start"
    echo "   После запуска Docker снова выполните: ./start.sh"
    exit 1
fi

# Команда для docker-compose (standalone "docker-compose" или V2 "docker compose")
if command -v docker-compose > /dev/null 2>&1 && docker-compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Ошибка: не найден docker-compose. Установите: brew install docker-compose"
    exit 1
fi

# Подтягиваем PATH для Homebrew (чтобы node/pnpm были видны после установки)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Проверка Node.js (нужен для pnpm и сборки)
if ! command -v node > /dev/null 2>&1; then
    echo "⚠️  Node.js не найден. Установка..."
    if command -v brew > /dev/null 2>&1; then
        if brew install node; then
            export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
            echo "✅ Node.js установлен через Homebrew"
        else
            echo "❌ Не удалось установить Node через Homebrew. Установите вручную:"
            echo "   https://nodejs.org/ или выполните: brew install node"
            exit 1
        fi
    else
        echo "❌ Ошибка: Node.js не найден. Установите с https://nodejs.org/ или: brew install node"
        exit 1
    fi
fi
if ! command -v node > /dev/null 2>&1; then
    echo "❌ Node.js по-прежнему не найден. Добавьте в PATH: export PATH=\"/opt/homebrew/bin:\$PATH\""
    exit 1
fi

# Проверка pnpm
if ! command -v pnpm > /dev/null 2>&1; then
    echo "⚠️  pnpm не найден. Установка..."
    if command -v corepack > /dev/null 2>&1; then
        corepack enable
        corepack prepare pnpm@8 --activate
        echo "✅ pnpm установлен через corepack"
    elif command -v npm > /dev/null 2>&1; then
        npm install -g pnpm
        echo "✅ pnpm установлен через npm"
    elif command -v brew > /dev/null 2>&1; then
        brew install pnpm
        echo "✅ pnpm установлен через Homebrew"
    else
        echo "❌ Ошибка: pnpm не найден. Установите Node.js (nodejs.org) или pnpm: npm install -g pnpm"
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
    $DOCKER_COMPOSE up -d postgres redis
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
