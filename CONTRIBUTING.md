# Вклад в Workyy

## Требования к окружению

- Node.js 20.x
- pnpm 8.x
- Docker 24+

Перед началом работы:

```bash
pnpm install
pnpm run lint
pnpm run test
```

## Git-flow и коммиты

- Trunk-based: ветки вида `feature/<slug>`, `fix/<slug>`.
- Коммиты по Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:` и т.д.).
- Pull Request должен включать чек-лист тестов и описание изменений.

## Код-стайл

- TypeScript strict mode.
- ESLint + Prettier (автоматически запускается через pre-commit).
- Импорты с алиасами `@workyy/<package>`.

## Тесты

- Юнит-тесты Vitest (`pnpm run test`).
- E2E тесты Playwright (`pnpm run test:e2e`).
- Контрактные тесты для API (`pnpm run test:contracts`).

## Поддержка окружений

- Dev: Docker Compose (`docker-compose.yml`).
- Staging/Prod: AWS ECS (Terraform в `infra/terraform`).

## Связанные документы

- `docs/architecture/adr/` — решения архитектуры.
- `docs/api/openapi.yaml` — контракты API.
- `docs/operations/runbook.md` — эксплуатация.
