# Принятые решения (Architecture Decision Records)

Этот файл содержит важные архитектурные решения, принятые в проекте Workyy.

## Решения

### ADR 0001: Bootstrap Stack

**Дата:** 2025-11-08  
**Статус:** Принято

**Решение:** Выбор технологического стека для MVP

- Next.js 14 для фронтенда
- Fastify + y-websocket для realtime API
- pnpm монорепо с Turbo
- Prisma + PostgreSQL для серверных метаданных
- Redis для rate limiting и presence

Подробнее: [docs/architecture/adr/0001-bootstrap.md](../../docs/architecture/adr/0001-bootstrap.md)

---

Добавляйте сюда краткие заметки о важных решениях. Полные ADR хранятся в `docs/architecture/adr/`.
