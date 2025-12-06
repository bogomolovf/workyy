# Workyy Landing Page

Landing page для веб-платформы Workyy — аналитических досок с SQL/Python-узлами и совместной работой.

## Технологии

- React 18
- TypeScript
- Tailwind CSS
- Vite
- React Router DOM

## Установка

В монорепо зависимости устанавливаются из корня:

```bash
# Из корня монорепо
pnpm install
```

## Запуск

### Из корня монорепо

```bash
# Только лендинг
pnpm --filter landing dev

# Всё вместе (landing + web + backend)
pnpm dev
```

### Из директории landing

```bash
cd apps/landing
pnpm dev
```

Лендинг будет доступен на `http://localhost:5173`

## Сборка

```bash
# Из корня
pnpm --filter landing build

# Из директории
cd apps/landing
pnpm build
```

Билд будет в `apps/landing/dist/`

## Environment Variables

Создайте `.env` файл в `apps/landing/`:

```bash
# URL продукта (Next.js)
VITE_PRODUCT_APP_URL=http://localhost:3000

# URL backend API
VITE_API_URL=http://localhost:4000
```

## Интеграция с продуктом

Лендинг интегрирован с основным продуктом:

- Кнопки "Log in" и "Sign up" ведут на страницы продукта
- Отображает информацию о текущем пользователе (если авторизован)
- Позволяет выйти из аккаунта

См. `INTEGRATION.md` для подробностей.

## Структура

- `src/pages/HomePage.tsx` - главная страница со всеми секциями
- `src/components/Header.tsx` - шапка с навигацией
- `src/components/Footer.tsx` - подвал
- `src/config/appConfig.ts` - конфигурация URL продукта
- `src/lib/apiClient.ts` - API клиент для backend

## Примечание

Лендинг является **опциональным** компонентом монорепо. Продукт (`apps/web` и `apps/realtime-server`) может работать полностью автономно без лендинга.
