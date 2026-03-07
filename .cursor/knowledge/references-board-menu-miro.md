# Референсы для: Верхнее левое меню доски в стиле Miro (Board / Edit / View / Preferences)

## Описание фичи

Меню в верхнем левом углу доски (рядом с названием доски): кнопка «гамбургер/…», по клику — выпадающее меню с 4 разделами первого уровня (Board, Edit, View, Preferences). Каждый раздел раскрывается во второй уровень справа («плавающий» сабменю). В подменю — пункты-действия и тумблеры (toggle). Требования: поведение как в Miro, клавиатура (Esc, стрелки, Enter), клик вне — закрытие, пункты с «>» открывают подменю по hover/клику, тумблеры меняют состояние мгновенно и сохраняют в сторе.

Контекст: apps/web — Next.js + tldraw + React Flow; строгий TypeScript; канва в `BoardCanvas.tsx`, header доски в `apps/web/src/app/board/[boardId]/page.tsx` (строки 1814–1855). В header слева: заголовок доски + UndoRedoControls; справа: UserPresenceIndicator + «Back to home». Кнопку меню встроить в левую часть header (перед или после заголовка). В проекте уже используются: createPortal (react-dom), @phosphor-icons/react, zustand; в ui-kit только Button — Popover/Modal нет. deleteBoard в `lib/api.ts`; Undo/Redo через useYjsUndoManager в board page.

---

## Референсы

### Библиотеки и инструменты

#### Radix UI Dropdown Menu

- **URL**: https://www.radix-ui.com/primitives/docs/components/dropdown-menu
- **Тип**: library
- **Описание**: Примитив выпадающего меню с подменю, чекбоксами, клавиатурой и порталом.
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `DropdownMenu.Root`, `Trigger`, `Content` (Portal по умолчанию в body), `Item`, `Separator`, `Group`, `Label`.
  - Подменю: `DropdownMenu.Sub`, `SubTrigger`, `SubContent` — сабменю открывается справа (side), collision handling встроен.
  - Чекбокс-пункты: `DropdownMenu.CheckboxItem` с `checked` и `onCheckedChange` — подходят для тумблеров.
  - Клавиатура: Space/Enter — активация, ArrowDown/Up — навигация, ArrowRight/Left — открытие/закрытие подменю, Esc — закрытие и возврат фокуса на trigger.
  - Установка: `npm i @radix-ui/react-dropdown-menu`. В проекте Radix пока не используется — добавить зависимость в apps/web.

#### Zag.js Nested Menu

- **URL**: https://zagjs.com/components/react/nested-menu
- **Тип**: library
- **Описание**: Доступное вложенное меню с отдельными машинами для каждого уровня.
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Связка родитель/потомок через `setChild()` / `setParent()` и `getTriggerItemProps(child)`.
  - Полная клавиатурная навигация, aria-activedescendant. Альтернатива Radix, но API сложнее для «одного большого меню» с 4 разделами.

#### React Aria (useMenu, MenuTrigger, SubmenuTrigger)

- **URL**: https://react-aria.adobe.com/Menu
- **Тип**: library
- **Описание**: Хуки и компоненты для доступного меню с подменю.
- **Релевантность**: средняя
- **Ключевые моменты**:
  - SubmenuTrigger оборачивает MenuItem и вложенное Menu. Стрелки, Home/End, typeahead. Требует react-aria-components — ещё одна зависимость; Radix проще интегрировать для одного компонента.

### Документация и практики

#### WAI-ARIA Menu Button / Keyboard

- **URL**: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role
- **Тип**: documentation
- **Релевантность**: высокая
- **Ключевые моменты**:
  - role="menu", role="menuitem", aria-haspopup, aria-expanded. Esc закрывает и возвращает фокус. При использовании Radix это уже реализовано.

#### Fullscreen API

- **URL**: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide
- **Тип**: documentation
- **Релевантность**: высокая
- **Ключевые моменты**:
  - `element.requestFullscreen()`, `document.exitFullscreen()`, `document.fullscreenElement`. Событие `fullscreenchange` на document для синхронизации UI. В React — useEffect с подпиской на fullscreenchange и состояние isFullscreen.

#### Miro-style reference (Mark Miro choice-component)

- **URL**: https://github.com/markmiro/choice-component (и демо)
- **Тип**: example
- **Релевантность**: средняя
- **Ключевые моменты**:
  - Референс визуала и поведения «подменю справа». В реализации можно использовать React Laag для позиционирования или положиться на Radix SubContent (side="right").

---

## Рекомендации

1. **Использовать Radix UI Dropdown Menu** в apps/web для корневого меню и всех подменю (Board, Edit, View, Preferences + Export, Grid, Mouse or trackpad и т.д.). Sub/SubTrigger/SubContent дают «сабменю справа» и клавиатуру из коробки. CheckboxItem — для всех тумблеров (showCollaboratorCursors, showComments и т.д.).
2. **Zustand-стор для настроек доски**: один store (например `boardSettingsStore.ts`) с полями: gridVisible, showCollaboratorCursors, showComments, showScrollbars, showObjectDimensions, showUndoRedoControls, alignObjects, followAllThreads, lockDefaultView. Persist в localStorage (как cursorSettingsStore) или без persist — по желанию продукта.
3. **Встраивание**: в [apps/web/src/app/board/[boardId]/page.tsx](apps/web/src/app/board/[boardId]/page.tsx) в блок `<div className="flex items-center gap-4">` (левая часть header) добавить компонент `BoardMenuButton` первым элементом (слева от заголовка). Иконка — DotsThree из @phosphor-icons/react (или List — «гамбургер»).
4. **Действия**: Undo/Redo — передать в меню handleUndo/handleRedo/canUndo/canRedo из useYjsUndoManager (уже доступны на странице). Full screen — вызывать requestFullscreen на main или section с канвой, exitFullscreen при повторном выборе. Delete — window.confirm (как на главной в page.tsx) + deleteBoard(boardId) из api + router.push('/'). Export и остальные пункты — stub (toast или console.log + TODO).
5. **Commands (Cmd+K) / Find (Cmd+F)**: в коде не найдена готовая командная палитра; оставить пункты с hotkey в подписи и onSelect — stub/TODO.
6. **Стили**: Tailwind (как в проекте). Меню — белый фон, тени, скругления, отступы; тумблеры — синий акцент при checked (как в Miro на скринах). Иконки — @phosphor-icons/react.

---

## Следующие шаги

1. Добавить зависимость `@radix-ui/react-dropdown-menu` в apps/web.
2. Создать `boardSettingsStore` (zustand) с полями тумблеров.
3. Реализовать компоненты: BoardMenuButton (trigger), BoardMenu (Root + Content + конфиг-драйвен рендер пунктов и подменю), при необходимости обёртки MenuItem / ToggleMenuItem на базе Radix Item / CheckboxItem.
4. Встроить BoardMenuButton в header доски, передать props (undo/redo, boardId, router).
5. Реализовать Full screen через Fullscreen API; Delete — confirm + api.deleteBoard + redirect.
6. Добавить минимальные тесты: конфиг меню (списки пунктов) + при наличии инфраструктуры — smoke-рендер BoardMenu.
