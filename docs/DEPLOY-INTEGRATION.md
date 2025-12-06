# Workyy Integration Deployment Guide

This document describes how to deploy the integrated Workyy system with both the landing page and product application.

## Architecture Overview

The integrated system consists of:

1. **Landing Page** (Vite + React) - Marketing site
2. **Product Application** (Next.js) - Main analytics canvas app
3. **Backend API** (Fastify) - Realtime server with PostgreSQL
4. **Reverse Proxy** (Nginx) - Routes requests to appropriate services

## Routing Structure

In production with Nginx:

- `/` → Landing page (Vite build)
- `/app/*` → Next.js product application
- `/api/*` → Fastify backend API
- `/collab` → WebSocket endpoint for collaboration

## Environment Variables

### Landing Page (`workyy-landing`)

Create `.env` file in the landing project root:

```bash
# URL of the product application
VITE_PRODUCT_APP_URL=https://workyy.example.com/app

# URL of the backend API
VITE_API_URL=https://workyy.example.com
```

### Product Application (`apps/web`)

Create `.env.local` file:

```bash
# URL of the landing page
NEXT_PUBLIC_LANDING_URL=https://workyy.example.com

# URL of the backend API
NEXT_PUBLIC_WS_URL=https://workyy.example.com

# URL of this Next.js application
NEXT_PUBLIC_APP_URL=https://workyy.example.com/app

# Optional: Default workspace and demo board IDs
NEXT_PUBLIC_DEFAULT_WORKSPACE_ID=<uuid>
NEXT_PUBLIC_DEMO_BOARD_ID=<uuid>
```

### Backend API (`apps/realtime-server`)

Create `.env` file:

```bash
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/workyy
REDIS_URL=redis://redis:6379

# CORS origins
LANDING_ORIGIN=https://workyy.example.com
APP_ORIGIN=https://workyy.example.com/app

# Auth0 (when implemented)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.workyy.dev
AUTH0_CLIENT_ID=replace-me
AUTH0_CLIENT_SECRET=replace-me
```

## Build Process

### 1. Build Landing Page

```bash
cd /path/to/workyy-landing
pnpm install
pnpm build
```

The build output will be in `dist/` directory. Copy this to your server at `/var/www/workyy-landing/dist`.

### 2. Build Product Application

```bash
cd /path/to/workyy-4.0-stable
pnpm install
pnpm --filter web build
```

The build output will be in `apps/web/.next/`. This will be served by the Next.js server in Docker.

### 3. Build Backend (if needed)

```bash
cd /path/to/workyy-4.0-stable
pnpm --filter realtime-server build
```

## Docker Compose Setup

The `docker-compose.yml` should include:

- `web` - Next.js application
- `realtime-server` - Fastify backend
- `postgres` - PostgreSQL database
- `redis` - Redis cache
- `nginx` - Reverse proxy (optional, can run separately)

Example `docker-compose.yml`:

```yaml
services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NEXT_PUBLIC_LANDING_URL: https://workyy.example.com
      NEXT_PUBLIC_WS_URL: https://workyy.example.com
      NEXT_PUBLIC_APP_URL: https://workyy.example.com/app
    depends_on:
      - realtime-server

  realtime-server:
    build:
      context: .
      dockerfile: apps/realtime-server/Dockerfile
    environment:
      PORT: 4000
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/workyy
      LANDING_ORIGIN: https://workyy.example.com
      APP_ORIGIN: https://workyy.example.com/app
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: workyy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  nginx:
    image: nginx:alpine
    volumes:
      - ./infra/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /var/www/workyy-landing/dist:/var/www/workyy-landing/dist:ro
    ports:
      - '80:80'
      - '443:443'
    depends_on:
      - web
      - realtime-server
```

## Nginx Configuration

Copy `infra/nginx.conf` to your server and update:

1. `server_name` with your domain
2. Paths to landing page build (`/var/www/workyy-landing/dist`)
3. Docker service names if different
4. SSL certificates for HTTPS (uncomment HTTPS server block)

## Deployment Steps

1. **Prepare environment variables** in all three projects
2. **Build landing page** and copy `dist/` to server
3. **Build product and backend** (or use Docker)
4. **Start Docker services**: `docker compose up -d`
5. **Configure Nginx** and reload: `nginx -s reload`
6. **Run database migrations**: `pnpm --filter realtime-server prisma:migrate deploy`
7. **Seed database** (optional): `pnpm --filter realtime-server db:seed`

## Verification

After deployment, verify:

1. Landing page loads at `https://workyy.example.com`
2. "Log in" button redirects to `https://workyy.example.com/app/login`
3. "Sign up" button redirects to `https://workyy.example.com/app/signup`
4. Product app loads at `https://workyy.example.com/app`
5. "Back to website" link in product redirects to landing
6. API endpoints respond at `https://workyy.example.com/api/*`
7. WebSocket connects at `wss://workyy.example.com/collab`

## Troubleshooting

### CORS Errors

- Verify `LANDING_ORIGIN` and `APP_ORIGIN` in backend `.env`
- Check Nginx CORS headers if needed
- Ensure credentials are included in fetch requests

### 404 on /app routes

- Verify Next.js is running and accessible
- Check Nginx proxy_pass configuration
- Ensure `NEXT_PUBLIC_APP_URL` includes `/app` prefix

### Landing page not loading

- Verify Vite build output is in correct location
- Check Nginx root path configuration
- Ensure `try_files` includes `/index.html` for SPA routing

## Future Improvements

- Move landing page into monorepo as `apps/landing`
- Create shared UI components package
- Implement authentication (Auth0 or custom JWT)
- Add monitoring and logging
- Set up CI/CD pipeline
