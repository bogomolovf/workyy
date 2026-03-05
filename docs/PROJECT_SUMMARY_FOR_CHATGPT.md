# Краткая сводка по проекту Workyy (для ChatGPT)

Универсальный контекст для вставки в ChatGPT при работе над задачами по проекту.

---

## Что такое Workyy

**Workyy** — браузерная платформа аналитики на бесконечном холсте (canvas). Объединяет SQL- и Python-узлы, визуализации данных и коллаборацию на одной доске. Не классический BI и не просто ноутбук: no-code и pro-code в одном месте, реал-тайм совместная работа (курсоры, комментарии). Целевая аудитория: аналитики, продакты, инженеры аналитики, малые команды и стартапы.

---

## Структура (pnpm-монорепо)

| Часть                    | Стек                        | Назначение                                                                     |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------ |
| **apps/web**             | Next.js, tldraw, React Flow | Основное приложение: доски, канва, узлы SQL/Python, визуализации, коллаборация |
| **apps/realtime-server** | Fastify, y-websocket        | Синхронизация (Yjs), API, аутентификация                                       |
| **apps/landing**         | Vite, React, Tailwind       | Маркетинговый лендинг, онбординг (EN/RU)                                       |
| **packages/**            | TypeScript                  | core-domain, dag-executor, ui-kit, wasm-bridge — общие схемы и компоненты      |

Бэкенд: Prisma + PostgreSQL (метаданные), Redis (rate limiting, presence). Контракты API: `docs/api/openapi.yaml`. Архитектурные решения: `docs/architecture/adr/`.

---

## Запуск

```bash
pnpm install
pnpm dev                    # все приложения
pnpm --filter web dev       # только веб-продукт
pnpm --filter realtime-server dev
pnpm --filter landing dev   # только лендинг
```

Линт: `pnpm run lint`. Тесты: `pnpm run test`. Форматирование: `pnpm run format:fix`. Коммиты — Conventional Commits (`feat:`, `fix:`, `chore:` и т.д.).

---

## Важные пути в репозитории

- Правила и стиль кода: `.cursorrules`
- Контент лендинга (EN/RU): `apps/landing/src/data/content.ts`
- Канва и доски: `apps/web/src/app/board/`, `apps/web/src/components/BoardCanvas.tsx`
- Узлы (SQL, Python, фигуры, документы): `apps/web/src/components/flowNodes/`, `apps/web/src/state/useAddNode.ts`
- Realtime-сервер: `apps/realtime-server/src/server.ts`, маршруты в `src/routes/`

---

## Ограничения при подсказках

- Строгий TypeScript, без `any`; алиасы импортов `@workyy/<package>`
- Не коммитить секреты; конфигурация через переменные окружения
- Использовать существующие пакеты из `packages/` вместо дублирования логики
- Лендинг: без тяжёлых зависимостей продукта (Yjs, perfect-freehand и т.п.); учитывать `prefers-reduced-motion` и двуязычность (EN/RU)

---

_Краткая сводка по проекту Workyy. Используй этот текст как контекст в ChatGPT при формулировании задач или промптов для разработки._
