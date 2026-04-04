# Промпт: полная реализация настроек доски (Board menu)

Реализуй все недостающие пункты меню настроек доски в Workyy так, чтобы они работали end-to-end. Контекст: `apps/web` (Next.js), меню задаётся в `apps/web/src/components/BoardMenu/boardMenuConfig.ts`, действия в `apps/web/src/features/boardMenu/boardMenuActions.ts`, контекст передаётся со страницы `apps/web/src/app/board/[boardId]/page.tsx`.

---

## 1. Полноэкранный режим (Fullscreen)

**Сейчас:** В `page.tsx` передаётся `fullscreenTarget={undefined}`. Действие `runFullscreen` есть и использует `document.documentElement`, если target не передан.

**Нужно:**

- В `page.tsx` передать в `BoardMenu` реальный ref на контейнер канвы (например, обёртку с канвой/ReactFlow), чтобы fullscreen разворачивал именно область доски, а не весь документ.
- Добавить ref на нужный DOM-элемент (секция с канвой), передать его как `fullscreenTarget={canvasContainerRef.current}`.
- В `getActionState` для `fullscreen` при необходимости отключать пункт, если Fullscreen API недоступен: `disabled: typeof document !== 'undefined' && !document.documentElement.requestFullscreen`.

---

## 2. Закрепить вид по умолчанию (Lock default view)

**Сейчас:** В `boardMenuConfig.ts` у пункта `lockDefaultView` стоит `disabled: true` с комментарием "not supported yet". В `boardSettingsStore` уже есть `lockDefaultView`, `setLockDefaultView`.

**Нужно:**

- Убрать `disabled: true` у пункта `lockDefaultView` в `boardMenuConfig.ts`.
- Реализовать поведение: при включении — сохранять текущий вид (viewport: x, y, zoom) в store (например, в `boardSettingsStore.startView` или отдельное поле) и при открытии доски применять этот вид по умолчанию.
- При открытии доски (`BoardCanvas` / страница доски) читать из store «закреплённый вид» и вызывать `fitView` с этими параметрами или `setViewport`, если API канвы это поддерживает.
- Убедиться, что значение персистится (store уже с `persist`).

---

## 3. Цвет фона (Background color)

**Сейчас:** Подменю с `children: []`. В `boardSettingsStore` есть `backgroundColor` и `setBackgroundColor`.

**Нужно:**

- В `boardMenuConfig.ts` в подменю `backgroundColor` добавить дочерние пункты: либо список цветов (например, 6–8 пресетов: белый, светло-серый, пастельные), либо один пункт «Выбрать цвет» с вызовом color picker.
- Реализовать действие/подменю так, чтобы при выборе вызывался `useBoardSettingsStore.getState().setBackgroundColor(color)`.
- Убедиться, что канва (контейнер или ReactFlow viewport) использует `backgroundColor` из store для фона (если ещё не используется — подвести стиль/переменную к нужному элементу).

---

## 4. Сетка (Grid)

**Сейчас:** Подменю «Grid» с пустыми `children: []`. В store есть `gridVisible`, `gridSize`, `snapToGrid`.

**Нужно:**

- В `boardMenuConfig.ts` в подменю `grid` добавить дочерние пункты, например:
  - Toggle «Показывать сетку» → `gridVisible`.
  - Варианты размера сетки (Small / Medium / Large) → `gridSize`.
  - Toggle «Привязка к сетке» → `snapToGrid`.
- Реализовать отображение сетки на канве в зависимости от `gridVisible` и `gridSize` (если ещё не заведено — добавить слой/паттерн на канве).
- Реализовать snap при перетаскивании узлов/фигур, если ещё нет (использовать `snapToGrid` и размер шага из `gridSize`).

---

## 5. Мышь или трекпад (Mouse or trackpad)

**Сейчас:** Подменю с `children: []`.

**Нужно:**

- Определить, какие опции сюда входят (например, чувствительность скролла/зума, включение жестов двумя пальцами, инвертирование скролла). Либо взять референс из Miro/Figma (см. `.cursor/knowledge/references-board-menu-miro.md`).
- Добавить в `boardMenuConfig` дочерние пункты (toggles или submenu с опциями).
- При необходимости расширить `boardSettingsStore` полями для этих настроек и применить их в компоненте канвы (zoom/pan sensitivity и т.д.).

---

## 6. Export — оставшиеся пункты

- **Export to spreadsheet (CSV):** Сейчас в `getActionState` всегда `disabled: true` с причиной "No tabular data to export". Нужно: определять, есть ли на доске узлы с табличными данными (например, Table node или результат SQL с таблицей из `executionStore`), включать пункт только при наличии таких данных; по нажатию — собирать данные из executionStore (или из узлов Table/SQL) и скачивать CSV.
- **Embed:** Сейчас disabled, "Embedding not enabled yet". Нужно: либо реализовать генерацию iframe/embed URL и модалку «Код для вставки», либо оставить disabled, но заменить причину на осмысленный tooltip (например, "Coming soon").
- **Save to Google Drive:** Сейчас disabled, "Google Drive integration not configured". Нужно: либо добавить OAuth и API загрузки в Google Drive и убирать disabled при настроенной интеграции, либо оставить disabled с понятным tooltip.

---

## 7. Move to (Переместить в)

**Сейчас:** Подменю с `children: []`, в `getActionState` для `moveTo` возвращается disabled с причиной "Workspace hierarchy not implemented".

**Нужно:**

- Реализовать иерархию воркспейсов (список воркспейсов/папок, API перемещения доски между воркспейсами).
- Добавить в подменю `moveTo` список воркспейсов (загрузка из API), по выбору — вызов API перемещения доски и обновление контекста/редирект при необходимости.
- После реализации убрать в `getActionState` принудительный disabled для `moveTo` и возвращать disabled только когда перемещение недоступно (например, один воркспейс).

---

## 8. Команды (Cmd+K) и Найти (Cmd+F)

**Сейчас:** Если в контексте не переданы `onOpenCommands` / `onOpenFind`, показывается toast "Command palette TODO" / "Find panel TODO".

**Нужно:**

- На странице доски передать в меню `onOpenCommands` и `onOpenFind`: открытие командной палитры (Cmd+K) и панели поиска (Cmd+F) по доске/узлам.
- Реализовать компонент командной палитры (например, модалка с поиском по действиям и узлам) и вешать вызов на `onOpenCommands`.
- Реализовать панель поиска (по тексту в узлах, по названиям узлов, по типам) и вешать открытие на `onOpenFind`.

---

## 9. Export PDF

**Сейчас:** `runExportPdf` показывает toast "Export PDF: use Export as image for now. Full PDF dialog TODO."

**Нужно:**

- Реализовать диалог экспорта в PDF: выбор области (текущий вид / вся доска), при необходимости рендер канвы в canvas/image (например, html2canvas или аналог) и сборка PDF (например, jspdf), скачивание файла.

---

## 10. Проверки и тесты

- Для каждого включённого пункта: убрать лишние `disabled` в конфиге и в `getActionState`, оставив disabled только там, где условие реально не выполняется.
- Пройти по всем пунктам меню в UI и убедиться, что не осталось заглушек (toast "TODO" без действия).
- Добавить/обновить тесты в `apps/web/src/components/BoardMenu/boardMenuConfig.test.ts` и при необходимости в `boardMenuActions` для новых веток в `getActionState`.
- Запустить `pnpm run lint` и `pnpm run test` в корне монорепо.

---

## Порядок реализации (рекомендуемый)

1. Fullscreen — быстрый win: ref + fullscreenTarget.
2. Lock default view — уже есть store, осталось убрать disabled и применить вид при загрузке.
3. Background color — уже есть store, добавить пункты подменю и привязать к канве.
4. Grid — добавить пункты подменю и отрисовку/привязку на канве.
5. Commands и Find — передать колбэки со страницы и реализовать палитру и панель поиска.
6. Export PDF — диалог и экспорт.
7. Export spreadsheet (CSV) — проверка табличных данных и выгрузка.
8. Move to — иерархия воркспейсов и API.
9. Mouse/trackpad и Embed / Google Drive — по приоритету продукта (можно оставить disabled с ясными tooltips).

Файлы для правок: `boardMenuConfig.ts`, `boardMenuActions.ts`, `BoardMenu.tsx`, `page.tsx` (board), `boardSettingsStore.ts`, компонент канвы (фоновый цвет, сетка, viewport для lock default view).
