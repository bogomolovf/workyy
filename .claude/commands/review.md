Проведи code review для: $ARGUMENTS

## Контекст проекта

**Workyy** — монорепо: Next.js 14 (App Router) + ReactFlow + Zustand + Yjs + Pyodide + DuckDB WASM + Fastify + Prisma.

## Алгоритм review

### 1. Определить scope

**Если указан PR/ветка:**

- `git diff main...HEAD` — все изменения
- `git log --oneline main..HEAD` — коммиты

**Если указан файл/компонент:**

- Прочитай файл целиком
- Найди связанные файлы (Grep по импортам/экспортам)

**Если указан последний коммит:**

- `git diff HEAD~1` — изменения в последнем коммите

### 2. Что проверить

#### Корректность

- [ ] TypeScript типизация — нет `any`, пропущенных типов, неверных cast
- [ ] React хуки — правильный порядок, зависимости в useEffect/useMemo/useCallback
- [ ] Zustand store — иммутабельные обновления, нет мутаций state напрямую
- [ ] ReactFlow — корректная работа с нодами/эджами, handles, metadata
- [ ] Yjs — нет дублирующейся sync логики, корректное использование ydoc
- [ ] Zod — валидация на границах (API input), типы выводятся корректно
- [ ] Prisma — корректные запросы, нет N+1, правильный include/select
- [ ] Error handling — ошибки обрабатываются, пользователь видит сообщение

#### Производительность

- [ ] Лишние ре-рендеры (missing memo, нестабильные селекторы Zustand)
- [ ] Тяжёлые вычисления без useMemo в render path
- [ ] Большие объекты в зависимостях useEffect
- [ ] N+1 запросы или лишние API вызовы
- [ ] Данные копируются без необходимости (structuredClone, spread)

#### Безопасность

- [ ] XSS через dangerouslySetInnerHTML или неэкранированный user input
- [ ] Утечка sensitive data в console.log / client bundle
- [ ] SQL injection в DuckDB запросах (user input в строку запроса)
- [ ] Missing auth checks (preHandler: [fastify.authenticate])
- [ ] Missing access control (ensureBoardAccess / ensureWorkspaceAccess)

#### Архитектура

- [ ] Нарушение зон ответственности (бизнес-логика в компонентах вместо хуков/stores)
- [ ] Дублирование кода, которое стоит вынести
- [ ] Правильное использование Yjs для collaborative state
- [ ] Типы в правильном месте (shared → core-domain, local → app)
- [ ] API через `apiFetch`, не голый fetch

#### Edge cases

- [ ] Пустые данные, null, undefined — обработаны
- [ ] Большие датасеты (>10k строк) — не вызовут зависание
- [ ] Concurrent editing (Yjs конфликты) — учтены
- [ ] Offline/reconnect — graceful degradation

### 3. Формат замечаний

Для каждого замечания:

```
### [severity] файл:строка — краткое описание

**Проблема:** что не так и почему это плохо
**Решение:** конкретное изменение (с примером кода если нужно)
```

**Severity levels:**

- **CRITICAL** — баг, уязвимость, потеря данных, crash. Блокирует merge.
- **WARNING** — потенциальная проблема, плохой паттерн, деградация производительности. Желательно исправить.
- **SUGGESTION** — улучшение, не обязательное. Можно отложить.
- **NITPICK** — стиль, naming, minor inconsistency. На усмотрение автора.

### 4. Вердикт

```
## Code Review: [scope]

### Замечания
[список замечаний по severity: critical → warning → suggestion → nitpick]

### Что хорошо
- [отметь хорошие решения — это важно для мотивации]

### Вердикт: APPROVE / CHANGES REQUESTED

### Блокеры (если CHANGES REQUESTED):
1. [что обязательно исправить]
```

## Примеры использования

```
/review последний коммит
```

```
/review apps/web/src/components/flowNodes/PlotNodeConfigPanel.tsx
```

```
/review все изменения в текущей ветке
```

```
/review hooks/useNodesStateSynced.ts — подозреваю проблемы с производительностью
```
