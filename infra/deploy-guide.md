# Workyy Deployment Guide

Этот документ описывает процесс деплоя Workyy на сервер.

## Предварительные требования

- Сервер с Ubuntu/Debian
- Доступ по SSH
- Минимум 2GB RAM, 20GB диска

## Шаг 1: Подготовка сервера

### Вариант A: Автоматическая подготовка

1. Скопируйте скрипт на сервер:
```bash
scp infra/prepare-server.sh workyy@192.168.1.24:~/prepare-server.sh
```

2. Подключитесь к серверу и запустите:
```bash
ssh workyy@192.168.1.24
chmod +x ~/prepare-server.sh
~/prepare-server.sh
```

### Вариант B: Ручная подготовка

Выполните на сервере:

```bash
# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка pnpm
npm install -g pnpm@8.15.7

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Выйдите и войдите снова для применения группы docker

# Установка Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Установка Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx

# Создание директорий
mkdir -p ~/workyy/{product,landing,logs,backups}
sudo mkdir -p /var/www/workyy-landing
sudo chown -R $USER:$USER /var/www/workyy-landing
```

## Шаг 2: Загрузка проектов на сервер

### Способ 1: Git (рекомендуется)

```bash
# На сервере
cd ~/workyy/product
git clone <your-repo-url> workyy-4.0-stable
cd workyy-4.0-stable

cd ~/workyy/landing
git clone <your-landing-repo-url> workyy-landing
cd workyy-landing
```

### Способ 2: SCP

```bash
# С локальной машины
# Продукт
cd /home/fedorbogomolov/workyy-4.0-stable
tar -czf /tmp/workyy-product.tar.gz --exclude='node_modules' --exclude='.next' --exclude='dist' .
scp /tmp/workyy-product.tar.gz workyy@192.168.1.24:~/workyy/product/

# Лендинг
cd /home/fedorbogomolov/workyy-landing
tar -czf /tmp/workyy-landing.tar.gz --exclude='node_modules' --exclude='dist' .
scp /tmp/workyy-landing.tar.gz workyy@192.168.1.24:~/workyy/landing/

# На сервере
cd ~/workyy/product && tar -xzf workyy-product.tar.gz && rm workyy-product.tar.gz
cd ~/workyy/landing && tar -xzf workyy-landing.tar.gz && rm workyy-landing.tar.gz
```

## Шаг 3: Установка зависимостей

```bash
# На сервере
cd ~/workyy/product/workyy-4.0-stable
pnpm install

cd ~/workyy/landing/workyy-landing
pnpm install
```

## Шаг 4: Настройка Environment Variables

### Продукт (workyy-4.0-stable)

Создайте `apps/web/.env.local`:
```bash
NEXT_PUBLIC_APP_URL=https://workyy.example.com/app
NEXT_PUBLIC_WS_URL=wss://workyy.example.com
NEXT_PUBLIC_LANDING_URL=https://workyy.example.com
NEXT_PUBLIC_API_URL=https://workyy.example.com
```

Создайте `apps/realtime-server/.env`:
```bash
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/workyy
REDIS_URL=redis://redis:6379
JWT_SECRET=<generate-strong-secret-here>
AUTH_COOKIE_NAME=auth_token
AUTH_COOKIE_SECURE=true
AUTH_TOKEN_EXPIRES_IN=3600
BCRYPT_ROUNDS=11
LANDING_ORIGIN=https://workyy.example.com
APP_ORIGIN=https://workyy.example.com/app
```

### Лендинг (workyy-landing)

Создайте `.env`:
```bash
VITE_PRODUCT_APP_URL=https://workyy.example.com/app
VITE_API_URL=https://workyy.example.com
```

## Шаг 5: Генерация JWT Secret

```bash
# На сервере
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Скопируйте результат в JWT_SECRET
```

## Шаг 6: Сборка приложений

```bash
# На сервере

# Сборка лендинга
cd ~/workyy/landing/workyy-landing
pnpm build
# Копируем билд в /var/www/workyy-landing
sudo cp -r dist/* /var/www/workyy-landing/
sudo chown -R $USER:$USER /var/www/workyy-landing

# Сборка продукта
cd ~/workyy/product/workyy-4.0-stable
pnpm --filter web build
```

## Шаг 7: Настройка базы данных

```bash
# На сервере
cd ~/workyy/product/workyy-4.0-stable/apps/realtime-server

# Применяем миграции
pnpm prisma migrate deploy

# Опционально: заполняем тестовыми данными
pnpm db:seed
```

## Шаг 8: Настройка Nginx

Создайте `/etc/nginx/sites-available/workyy`:

```nginx
server {
    listen 80;
    server_name workyy.example.com;  # Замените на ваш домен

    # Redirect HTTP to HTTPS (после настройки SSL)
    # return 301 https://$server_name$request_uri;

    # Статика лендинга
    location / {
        root /var/www/workyy-landing;
        try_files $uri /index.html;
    }

    # Продукт (Next.js) - через подпрефикс /app
    location /app {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API realtime-server
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket для /collab
    location /collab {
        proxy_pass http://localhost:4000/collab;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Активируйте конфигурацию:
```bash
sudo ln -s /etc/nginx/sites-available/workyy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 9: Настройка Docker Compose для production

Обновите `docker-compose.yml` для production или создайте `docker-compose.prod.yml`.

## Шаг 10: Запуск сервисов

```bash
cd ~/workyy/product/workyy-4.0-stable

# Запуск через Docker Compose
docker compose -f docker-compose.prod.yml up -d

# Или запуск вручную:
# Backend
cd apps/realtime-server
pnpm start &

# Frontend
cd apps/web
pnpm start &
```

## Шаг 11: Настройка SSL (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d workyy.example.com
```

## Шаг 12: Настройка автозапуска (systemd)

Создайте systemd сервисы для автозапуска при перезагрузке сервера.

## Мониторинг и логи

```bash
# Логи Docker
docker compose logs -f

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Логи приложений
tail -f ~/workyy/logs/*.log
```

## Резервное копирование

```bash
# Backup базы данных
docker exec postgres pg_dump -U postgres workyy > ~/workyy/backups/workyy-$(date +%Y%m%d).sql
```

## Troubleshooting

- Проверьте, что все порты открыты: `sudo netstat -tlnp`
- Проверьте логи: `docker compose logs`
- Проверьте статус сервисов: `docker compose ps`
- Проверьте Nginx: `sudo nginx -t && sudo systemctl status nginx`

