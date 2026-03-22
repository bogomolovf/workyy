Напиши тесты для: $ARGUMENTS

## Контекст проекта

**Workyy** — монорепо с Vitest для тестов. Тесты co-located: `*.test.ts` рядом с исходным файлом.

**Стек тестирования:**
- **Runner:** Vitest
- **Assertions:** Vitest built-in (expect, describe, it)
- **React:** @testing-library/react (если нужно тестировать компоненты)
- **Mocks:** vi.mock, vi.fn, vi.spyOn

## Алгоритм

### 1. Определить что тестировать

Извлеки из запроса:
- **Файл/модуль** — что тестируем
- **Тип тестов** — unit / integration / e2e
- **Фокус** — конкретные функции или весь модуль

Если не указано — прочитай файл и определи что имеет смысл покрыть.

### 2. Изучить код

1. **Прочитай файл** целиком — пойми интерфейс, зависимости, edge cases
2. **Найди существующие тесты** — `Glob: **/*.test.ts` рядом с файлом
3. **Определи зависимости** для мокирования (API, stores, Yjs, DuckDB)

### 3. Написать тесты

**Структура теста:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('functionName', () => {
    it('should handle normal case', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle edge case: empty input', () => {
      // ...
    });

    it('should handle error case', () => {
      // ...
    });
  });
});
```

**Что тестировать (приоритет):**
1. **Бизнес-логика** — трансформации данных, валидация, вычисления
2. **Edge cases** — null, undefined, пустые массивы, большие данные
3. **Error paths** — некорректный input, сетевые ошибки, таймауты
4. **Integration points** — API вызовы, store updates

**Что НЕ тестировать:**
- Внутреннюю реализацию (тестируй поведение, не детали)
- Простые getters/setters
- Стили и layout
- Сторонние библиотеки

### 4. Мокирование

**Zustand stores:**
```typescript
vi.mock('../../state/executionStore', () => ({
  useExecutionStore: {
    getState: () => ({
      setCode: vi.fn(),
      setStatus: vi.fn(),
      setSuccess: vi.fn(),
    }),
  },
}));
```

**API (apiFetch):**
```typescript
vi.mock('../../lib/apiClient', () => ({
  apiFetch: vi.fn(),
  API_URL: 'http://localhost:4000',
}));
```

**Prisma (backend):**
```typescript
const mockPrisma = {
  board: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  // ...
};
```

### 5. Запустить и проверить

```bash
# Конкретный файл
pnpm vitest run path/to/file.test.ts

# Все тесты в app
pnpm --filter web test
pnpm --filter realtime-server test

# Watch mode (для разработки)
pnpm vitest path/to/file.test.ts
```

### 6. Отчёт

```
## Тесты: [что покрыто]

### Файл
`path/to/file.test.ts`

### Покрытие
- [x] Normal cases (N тестов)
- [x] Edge cases (N тестов)
- [x] Error cases (N тестов)

### Результат
PASS / FAIL (если FAIL — что нужно починить в коде)
```

## Примеры использования

```
/test apps/web/src/lib/spreadsheetParser.ts
```

```
/test Zustand store executionStore — проверить setCode, setStatus, setSuccess, setError
```

```
/test apps/realtime-server/src/routes/boards.ts — unit тесты для CRUD эндпоинтов
```

```
/test apps/web/src/lib/visualization/chartBuilder.ts — edge cases с пустыми данными
```
