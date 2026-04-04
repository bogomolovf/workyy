# Сводка проекта Workyy для промпта «BPMN и UML элементы на доске»

Этот документ нужен, чтобы ты (ChatGPT) сформировал **один итоговый промпт** для Cursor AI (агента в IDE), который реализует возможность **создания и редактирования BPMN и UML элементов на доске** в проекте Workyy. Ниже — контекст проекта и текущая реализация канвы и фигур.

---

## 1. Что за проект

**Workyy** — веб-платформа аналитики на бесконечном холсте (канва с узлами SQL/Python, досками, реалтайм-коллаборацией).

- **Монорепо**: `apps/web` (Next.js), `apps/realtime-server` (Fastify + y-websocket), `apps/landing`, `packages/*`.
- **Стек**: TypeScript (strict), React, **React Flow** (канва), Prisma, PostgreSQL, JWT в cookies, WebSocket (y-websocket) для синхронизации состояния канвы.
- **Правила**: Conventional Commits, ESLint/Prettier, `pnpm`, импорты через `@workyy/<package>`. Описание в корне: `.cursorrules`.

---

## 2. Канва и узлы — как устроено сейчас

### 2.1 Технология канвы

- Канва доски — **React Flow** (`reactflow`), не tldraw.
- Узлы и рёбра хранятся в **Yjs** (Y.Doc), синхронизация через `y-websocket` с `realtime-server`.
- Конвертация: `canvasNodeToReactFlowNode` / `reactFlowNodeToCanvasNode` в `apps/web/src/lib/yjs/adapters.ts`. У узла есть канонический `type` (например `'sql'`, `'shape'`) и при рендере он мапится в тип компонента React Flow (например `'sqlNode'`, `'shapeNode'`) через `CELL_TYPE_MAP` в `BoardCanvas.tsx`.

### 2.2 Типы узлов (канонические)

Сейчас на доске поддерживаются:

- **Данные/код**: `sql`, `python`, `database`, `plot`, `csv`, `notebook`, `pythonCell`, `markdownCell`, `sqlCell`, `notebookFrame`
- **Контент**: `note`, `text`, `shape`, `image`, `video`, `document`, `voice`, `pen`

Типы объявлены в `apps/web/src/state/useAddNode.ts` (тип `NodeKind`) и в `apps/web/src/lib/yjs/adapters.ts` (маппинг display → canonical).

### 2.3 Как добавляются узлы

- **useAddNode** (`apps/web/src/state/useAddNode.ts`): фабрики вида `createSqlNode(position)`, `createShapeNode(position, width?, height?, payload?)` и т.д. Возвращают объект `{ id, type, position, payload }`.
- Добавление на канву идёт через **yjsOnNodesChange([{ type: 'add', item: reactFlowNode }])** в `BoardCanvas.tsx` (и в коллаборационном хуке). То есть новый узел конвертируется в React Flow-формат и попадает в Yjs.

### 2.4 Фигуры (shapes) — текущая модель

- Отдельный тип узла: **`shape`**. В `CELL_TYPE_MAP` и для отображения используется **`shapeNode`** → компонент **ShapeNode** (`apps/web/src/components/flowNodes/ShapeNode.tsx`).
- **Shape Engine** (`apps/web/src/components/shape/`):
  - **shapeEngine.ts**: тип `ShapeType` (union строк: `'rectangle'`, `'circle'`, `'diamond'`, `'arrow'`, …), `SHAPE_DEFAULTS`, `getShapeDefinition(shapeType)`, `resolveShapeStyle`, `generateShapePath` и т.д.
  - **shapes/types.ts**: интерфейс **ShapeDefinition** — `type`, `label`, `category` (`'basic' | 'flowchart' | 'line'`), опционально `clipPath`, `points(w,h)`, `render(props)` для кастомного SVG.
  - **shapes/index.ts**: регистрация фигур в `SHAPE_REGISTRY` и `SHAPE_LIST`. Каждая фигура — отдельный файл в `shapes/*.ts` (например `rectangle.ts`, `diamond.ts`, `arrow.ts`).
- Добавление фигуры на канву:
  - **ShapePalette** (в **BoardCommandBar**): выбор типа фигуры.
  - **ShapeDragOverlay**: при выбранном инструменте «shape» и выбранной фигуре — drag на канве создаёт прямоугольник/линию и по отпусканию вызывается `onAddShapeNode` с `{ id, type: 'shape', position, width, height, payload }`. Payload содержит `shapeType` и стили (fill, stroke, strokeWidth, opacity, cornerRadius, arrowHead, start/end для линий).
- В **BoardCanvas** при drop/клике создаётся узел через `createShapeNode` из `useAddNode` и передаётся в `yjsOnNodesChange([{ type: 'add', item: reactFlowNode }])`.

### 2.5 Рендер узла-фигуры

- **ShapeNode** читает из `data` (payload): `shapeType`, размеры, стили, текст и т.д. Использует `getShapeDefinition(shapeType)`, `resolveShapeStyle`, `generateShapePath` / `getShapePoints` / кастомный `render` из определения фигуры. Поддерживается изменение размера (NodeResizer), стилей и текста через тулбар.

### 2.6 Панель инструментов

- **BoardCommandBar** (`apps/web/src/components/BoardCommandBar.tsx`): инструменты `hand` | `select` | `note` | `pen` | `text` | `shape` | `eraser` | `voice`, кнопки добавления узлов (SQL, Python, Database, Plot, Voice, ячейки, загрузка CSV/Notebook). Для инструмента `shape` открывается **ShapePalette** с текущим набором фигур.

---

## 3. Что нужно реализовать: BPMN и UML элементы

Нужно расширить доску **элементами диаграмм BPMN и UML**, чтобы пользователь мог:

- Выбирать тип элемента (BPMN или UML) из палитры/подменю.
- Создавать элементы на канве (аналогично текущим фигурам: drag или click).
- Редактировать подпись, при необходимости — стили.
- Синхронизировать новые узлы через существующий Yjs-слой (без изменения формата хранения, если возможно — те же узлы `type: 'shape'` с отдельным подтипом, или новые канонические типы вроде `bpmn` / `uml` по решению агента).

### 3.1 BPMN (минимальный набор)

- **События**: старт (Start Event), конец (End Event), промежуточное (Intermediate Event) — хотя бы круг с иконкой/типом.
- **Активности**: задача (Task) — скруглённый прямоугольник, подпроцесс (Subprocess) — прямоугольник с «+».
- **Шлюзы**: исключающее ИЛИ (XOR), параллельное (AND), ориентировочно — ромб с символом внутри.
- **Поток управления**: sequence flow — стрелка (соединение между элементами через рёбра React Flow или отдельный тип «стрелка»).

При необходимости можно ограничиться подмножеством (например только события + задача + стрелки).

### 3.2 UML (минимальный набор)

- **Диаграмма классов**:
  - Класс — прямоугольник с секциями: имя класса, поля, методы (достаточно 1–3 строк в каждой секции или заглушки).
  - Интерфейс — прямоугольник с «interface» и именем.
  - Связи: ассоциация, наследование, реализация — стрелки между блоками (рёбра или отдельные узлы-стрелки).
- **Диаграмма вариантов использования (Use Case)**:
  - Актор — человечек (стикмен) или прямоугольник с подписью.
  - Вариант использования — овал.
  - Связь (include/extend) — стрелки.

Можно начать с классов + интерфейсов + стрелок ассоциация/наследование; use case по желанию.

### 3.3 Общие требования к элементам

- Визуально узнаваемые формы и, где принято, иконки/символы (BPMN/UML стандарт).
- Подпись (label) у элемента — редактируемая.
- Сохранение и загрузка в рамках текущей модели данных (Yjs nodes/edges).
- Не ломать существующие узлы и фигуры; при необходимости ввести новые канонические типы (`bpmn`, `uml`) или подтипы в payload (например `shapeType: 'bpmn-start'`, `shapeType: 'uml-class'`).

---

## 4. Технические точки для промпта Cursor

Чтобы Cursor мог реализовать BPMN/UML без лишних вопросов, в промпте стоит явно перечислить:

1. **Модель данных**
   - Решить: новые узлы как подтипы `shape` (новые значения `shapeType` в payload) или отдельные канонические типы `bpmn` / `uml` с отдельными компонентами (например `bpmnNode`, `umlNode`). Учесть маппинг в `adapters.ts` и `CELL_TYPE_MAP` в `BoardCanvas.tsx`.

2. **Shape Engine и палитра**
   - Если через shape: добавить в `ShapeType` и в `shapes/` новые определения (по одному файлу на тип или группу), с правильными `clipPath`/`points`/`render` и категорией (можно ввести `'bpmn'` | `'uml'` в дополнение к `basic` | `flowchart` | `line`).
   - Если отдельные типы узлов: новые React Flow-компоненты (например `BpmnNode`, `UmlNode`) и регистрация в `nodeTypes` в `BoardCanvas.tsx`, фабрики в `useAddNode.ts`.

3. **Палитра в UI**
   - Где выбирать BPMN/UML: отдельная вкладка/секция в палитре фигур, подменю «BPMN» / «UML», или отдельная кнопка на **BoardCommandBar** с выпадающей палитрой. Указать в промпте желаемый вариант.

4. **Создание на канве**
   - Использовать тот же механизм, что и для обычных фигур: **ShapeDragOverlay** (расширить под новые типы) или создание по клику с дефолтными размерами. Учесть вызов `createShapeNode` / новых фабрик и `yjsOnNodesChange([{ type: 'add', item }])`.

5. **Редактирование**
   - Подпись: по аналогии с текущими фигурами (inline или тулбар). Для UML-класса — секции «поля»/«методы» можно сделать многострочным текстом в payload (например одна строка с разделителями) или простой вложенной структурой в payload.

6. **Рёбра (связи)**
   - BPMN sequence flow и UML-связи: использовать стандартные **React Flow edges** между узлами. При необходимости разные маркеры/стили для «наследование» / «реализация» / «ассоциация» (тип ребра в `data` или `metadata`).

7. **Yjs и бэкенд**
   - Новые узлы должны сериализоваться в существующем формате CanvasNode (id, type, position, payload). Никаких изменений на realtime-server не требуется, если не вводится новый API.

8. **Локализация**
   - В проекте есть переводы (`apps/web/src/lib/translations.ts`). Добавить ключи для «BPMN», «UML», названий элементов (Start Event, Task, Class, Interface и т.д.), если они отображаются в UI.

9. **Стиль и соглашения**
   - Conventional Commits, только TypeScript без `any`, следовать существующим паттернам (например, добавление фигуры по образцу `shapes/diamond.ts`, `shapes/arrow.ts`).

---

## 5. Структура репозитория (для ориентира)

```
apps/web/
  src/
    components/
      BoardCanvas.tsx          # CELL_TYPE_MAP, nodeTypes, обработка добавления узлов
      BoardCommandBar.tsx      # инструменты, ShapePalette, кнопки добавления узлов
      shape/
        shapeEngine.ts         # ShapeType, SHAPE_DEFAULTS, getShapeDefinition, resolveShapeStyle
        ShapeDragOverlay.tsx   # drag-to-create фигуры, onAddShapeNode
        ShapePalette.tsx       # выбор типа фигуры
        shapes/
          types.ts             # ShapeDefinition
          index.ts             # SHAPE_REGISTRY, SHAPE_LIST
          rectangle.ts         # пример определения фигуры
          diamond.ts
          arrow.ts
          ...
        ...
      flowNodes/
        ShapeNode.tsx          # рендер узла type shape
    state/
      useAddNode.ts            # createSqlNode, createShapeNode, ...
    lib/
      yjs/
        adapters.ts            # canvasNodeToReactFlowNode, reactFlowNodeToCanvasNode, DISPLAY_TO_CANONICAL
```

---

## 6. Что попросить у ChatGPT

Скопируй этот бриф в ChatGPT и попроси:

1. Уточнить при необходимости объём первой итерации (например только BPMN или только UML; только фигуры без связей или сразу со связями).
2. Составить **один готовый промпт на русском или английском** для Cursor AI (Agent), который:
   - кратко повторяет цель: добавление BPMN и UML элементов на доску;
   - явно указывает выбранный вариант модели данных (новые shapeType vs отдельные типы узлов bpmn/uml);
   - по пунктам перечисляет задачи: расширение Shape Engine / новые компоненты узлов, палитра (где и как выбирать BPMN/UML), создание на канве (ShapeDragOverlay или аналог), редактирование подписей и при необходимости секций класса, рёбра для связей, Yjs-совместимость, локализация;
   - ссылается на существующие файлы (BoardCanvas, useAddNode, shapeEngine, ShapeDragOverlay, adapters.ts) и напоминает про Conventional Commits и стиль кода проекта.

После этого готовый промпт можно вставить в чат Cursor (Agent) и выполнить реализацию в репозитории Workyy.
