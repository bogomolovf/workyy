Выполни задачу на ФРОНТЕНДЕ: $ARGUMENTS

## Твоя зона ответственности

Ты работаешь ТОЛЬКО внутри `apps/web/src/`. Не трогай бэкенд и packages.

## Структура после рефакторинга

```
apps/web/src/
  lib/
    apiClient.ts          ← единый fetch-обёртка (apiFetch<T>)
    api.ts                ← функции API (борды, воркспейсы, файлы, авторизация)
    api.types.ts          ← типы ответов API
    commentApi.ts         ← функции API комментариев
    voiceAudioCache.ts    ← кэш аудио (sessionStorage)
    yjs/                  ← Yjs-адаптеры и утилиты
    visualization/        ← построение графиков (ECharts)
    duckdbClient.ts       ← DuckDB-WASM
    spreadsheetParser.ts  ← парсинг CSV/XLSX
  components/
    BoardCanvas.tsx       ← тонкая обёртка (184 строки), НЕ ПИШИ СЮДА ЛОГИКУ
    board/
      InnerBoardCanvas.tsx    ← основная логика канваса
      SqlNodeComponent.tsx    ← SQL нода с Monaco
      PythonNodeComponent.tsx ← Python нода с Monaco
      DataNodeHandles.tsx     ← хэндлы связей
      nodeUtils.tsx           ← StatusBadge, ErrorMessage, StdoutBlock
      ConnectionArrowsOverlay.tsx
      boardCanvas.types.ts    ← типы BoardCanvasProps, NodeData
    flowNodes/            ← отдельные компоненты нод (PlotNode, CsvNode, ShapeNode...)
    flowEdges/            ← кастомные рёбра
    comments/             ← CommentLayer, CommentThread, CommentAnchor
    pen/                  ← FreehandOverlay, EraserOverlay, PenNode
    shape/                ← ShapeDragOverlay, shapeEngine
    visualizations/       ← ChartRenderer, EChartsRenderer
  state/                  ← Zustand-сторы
    executionStore.ts     ← статусы и результаты нод
    canvasLayoutStore.ts  ← размеры нод, collapsed/expanded
    boardCanvasApiStore.ts ← API для авто-сохранения
    commentStore.ts       ← состояние комментариев
    authStore.ts          ← авторизация
    chainStore.ts         ← DAG-зависимости
  hooks/                  ← React-хуки
    useBoardCollaboration.ts  ← Yjs-коллаборация
    useCursorStateSynced.ts   ← синхронизация курсоров
    useNodesStateSynced.ts    ← синхронизация нод через Yjs
    useEdgesStateSynced.ts    ← синхронизация рёбер через Yjs
  context/                ← React-контексты
  workers/                ← Web Workers (python.worker.ts)
```

## Правила

### API-вызовы

```typescript
// ПРАВИЛЬНО — через общий клиент
import { apiFetch, API_URL } from '../lib/apiClient';
const data = await apiFetch<ResponseType>(`${API_URL}/api/endpoint`, {
  method: 'POST',
  body: payload,  // автоматически JSON.stringify
});

// НЕПРАВИЛЬНО — голый fetch
const res = await fetch(url, { ... });
```

### Новые компоненты

- Компоненты борда → `components/board/`
- Новые типы нод → `components/flowNodes/`
- UI-утилиты → `components/common/` (создай если нет)
- Типы, общие с бэкендом → **НЕ дублируй**, скажи пользователю запустить `/shared`

### Zustand-сторы

```typescript
// Следуй паттерну проекта
import { create } from 'zustand';
export const useMyStore = create<MyState>()((set, get) => ({
  // state + actions в одном объекте
}));

// Селекторы — атомарные, для оптимизации ре-рендеров
const value = useMyStore((s) => s.specificValue);
```

### Работа с нодами

```typescript
// Код ноды
executionStore.setCode(nodeId, code);

// Запуск
executionStore.setStatus(nodeId, 'running');

// Результат
executionStore.setSuccess(nodeId, { kind: 'sql', result, code });

// Ошибка
executionStore.setError(nodeId, errorMessage);
```

### Yjs — НЕ дублируй синхронизацию

- Yjs автоматически синхронизирует `ydoc` между клиентами
- Не добавляй свои WebSocket/polling для данных, которые уже в Yjs
- Изменения нод/рёбер → через `useNodesStateSynced` / `useEdgesStateSynced`
- Курсоры → через `useCursorStateSynced`

## Процесс работы

1. **Прочитай** затрагиваемые файлы (Read tool)
2. **Найди аналоги** — как подобное уже сделано в проекте (Grep/Glob)
3. **Реализуй** — следуя паттернам проекта
4. **Проверь типы**: `npx tsc --noEmit -p apps/web/tsconfig.json`
5. **Кратко отчитайся** — что сделано, какие файлы затронуты

## Чего НЕ делать

- Не менять `apps/realtime-server/` или `packages/` — скажи пользователю запустить `/backend` или `/shared`
- Не создавать новые fetch-обёртки — используй `apiFetch` из `apiClient.ts`
- Не добавлять `console.log` — ESLint предупредит
- Не дублировать типы, которые есть в `@workyy/core-domain`
- Не писать логику в `BoardCanvas.tsx` — пиши в `board/InnerBoardCanvas.tsx` или выноси в хуки
- Не дублировать Yjs sync — если данные уже в ydoc, не добавляй свой WebSocket/polling
- Не подписываться на весь Zustand store без селектора: `useStore()` → `useStore((s) => s.field)`

## Примеры использования

```
/frontend Добавить кнопку "Export CSV" в результаты SQL-ноды
```

```
/frontend Панель настроек графика в PlotNode — добавить выбор цветовой палитры
```

```
/frontend Виртуализация таблицы результатов для больших датасетов (10k+ строк)
```
