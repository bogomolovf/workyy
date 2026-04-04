# Описание бага: Maximum update depth exceeded

## Краткое резюме

При создании доски в новой команде и при открытии любой доски возникала ошибка «Maximum update depth exceeded» — бесконечный цикл ре-рендеров React из-за нестабильных зависимостей в `useEffect` и колбэках.

---

## Дефектное поведение

### Что происходит

**Сценарий 1 (создание доски в новой команде):**

- Пользователь создаёт новую команду, затем создаёт в ней доску
- При нажатии «Создать» или после успешного создания возникает ошибка «Maximum update depth exceeded»
- Приложение может зависнуть или аварийно размонтировать дерево компонентов

**Сценарий 2 (открытие доски):**

- Пользователь кликает по любой доске на главной странице
- Страница доски начинает загружаться, но сразу возникает «Maximum update depth exceeded»
- В логах: WebSocket подключается, затем закрывается с кодом 1005 (abnormal close) через 1–2 секунды
- Цикл: mount → connect WS → crash → unmount → WS close → повтор

### Ожидаемое поведение

- Создание доски завершается успешно, происходит переход на страницу новой доски
- Открытие доски загружает канву, WebSocket остаётся подключённым, коллаборация работает

### Фактическое поведение

- Бесконечный цикл вызовов `setState` / `useEffect` → React прерывает выполнение и показывает ошибку
- Страница доски не отображается, WebSocket быстро отключается

---

## Воспроизведение

### Шаги для воспроизведения

**Сценарий 1:**

1. Войти в приложение
2. Создать новую команду (TeamSelector → Create team)
3. Выбрать новую команду
4. Создать доску (ввести название, нажать Create)
5. Ошибка возникает при создании или при переходе на страницу доски

**Сценарий 2:**

1. Войти в приложение
2. На главной странице кликнуть по любой доске
3. Ошибка возникает при загрузке страницы доски

### Условия воспроизведения

- Окружение: dev (pnpm dev / ./start.sh)
- Браузер: любой (Chrome, Safari, Firefox)
- Предварительные условия: реализован Team-Based UX (teamStore, TeamSelector, AppSidebar)

---

## Анализ попыток исправления

### Попытка 1: Исправление создания доски (page.tsx)

**Что было сделано:**

- Устранено затенение переменной: в `mutationFn` использовалось `title: t`, что конфликтовало с объектом переводов `t`; параметр переименован в `input`
- Стабилизирована зависимость `useEffect` для `initCurrentTeam`: вместо `user?.workspaces` использован `JSON.stringify(user?.workspaces?.map((w) => w.id) ?? [])`, чтобы эффект не срабатывал при каждой смене ссылки на объект
- Заменён `router.push` на `window.location.href` в `createBoardMutation.onSuccess` для принудительной полной перезагрузки страницы при переходе на новую доску

**Файлы:** `apps/web/src/app/page.tsx`

**Результат:** Частично помогло — создание доски перестало вызывать цикл на главной, но при открытии доски ошибка сохранялась.

### Попытка 2: Исправление открытия доски (onBoardDeleted)

**Что было сделано:**

- Обнаружено: колбэк `() => router.push('/')` передавался в `useBoardCollaboration` как `onBoardDeleted` и создавал новую функцию на каждом рендере
- В `useBoardCollaboration.ts` (стр. 179–210) `onBoardDeleted` входит в массив зависимостей `useEffect`
- Эффект перезапускался на каждом рендере → вызывал `retainBoardYdoc`/`cleanupBoardYdoc` → менял состояние → новый рендер → цикл
- Решение: обернуть колбэк в `useCallback` как `handleBoardDeleted`

**Файлы:** `apps/web/src/app/board/[boardId]/page.tsx`, `apps/web/src/hooks/useBoardCollaboration.ts`

**Результат:** Исправление сработало — открытие доски больше не вызывает бесконечный цикл.

---

## Связанные файлы и элементы

### Прямо связанные

| Файл                                          | Связь                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/app/board/[boardId]/page.tsx`   | Страница доски: вызов `useBoardCollaboration` с `onBoardDeleted`, `handleBoardDeleted` через `useCallback`                     |
| `apps/web/src/hooks/useBoardCollaboration.ts` | Хук: `useEffect` (стр. 179–210) с зависимостью `onBoardDeleted`; `retainBoardYdoc`, `cleanupBoardYdoc`, подписка на `ws.close` |
| `apps/web/src/app/page.tsx`                   | Главная: мутации создания доски, `initCurrentTeam`, навигация после создания                                                   |

### Косвенно связанные

| Файл                                       | Связь                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/yjs/boardYdoc.ts`        | `retainBoardYdoc`, `cleanupBoardYdoc`, `getBoardProvider` — управление жизненным циклом Y.Doc |
| `apps/web/src/state/boardSettingsStore.ts` | `recordBoardVisit`, `lastVisitedAtByBoardId` — используются на странице доски и главной       |
| `apps/web/src/state/authStore.ts`          | `user.workspaces` — источник для `initCurrentTeam`                                            |
| `apps/web/src/state/teamStore.ts`          | `currentTeamId`, `initCurrentTeam` — контекст выбранной команды                               |

### Связанные компоненты системы

- **React-хуки:** `useBoardCollaboration`, `useEffect`, `useCallback`, `useMemo`
- **Stores:** `authStore`, `teamStore`, `boardSettingsStore`
- **Yjs:** `getBoardYdoc`, `getBoardProvider`, y-websocket provider
- **Навигация:** `useRouter` (Next.js), `router.push`, `window.location.href`

---

## Корневая причина

### Гипотезы о корневой причине

1. **Нестабильная ссылка на колбэк** — `() => router.push('/')` создаётся заново на каждом рендере, что приводит к постоянному перезапуску `useEffect` в `useBoardCollaboration`. **Подтверждено.**

2. **Нестабильная зависимость `user?.workspaces`** — объект `user` и вложенный массив `workspaces` меняют ссылку при обновлении store, из-за чего `useEffect` для `initCurrentTeam` срабатывает слишком часто. **Подтверждено.**

3. **Client-side навигация с «грязным» состоянием** — при `router.push` состояние предыдущей страницы может влиять на монтирование страницы доски и её эффекты. **Частично подтверждено** — `window.location.href` обходит проблему.

### Наиболее вероятная причина

Основная причина — **нестабильная ссылка на функцию `onBoardDeleted`** в зависимостях `useEffect` в `useBoardCollaboration`. Каждый рендер создаёт новую функцию → эффект перезапускается → вызываются `retainBoardYdoc`/`cleanupBoardYdoc` и переподключение WebSocket → обновление состояния → новый рендер → бесконечный цикл.

---

## Специфика Workyy

Связано ли с:

- [x] **WebSocket соединением** — цикл приводит к частому connect/disconnect
- [x] **Yjs реалтайм синхронизацией** — `retainBoardYdoc`, `cleanupBoardYdoc`, provider
- [ ] Execution Store (Zustand) — код в payload вместо setCode
- [ ] DAG зависимостями узлов
- [ ] Выполнением узлов (SQL/Python)
- [ ] Prisma/PostgreSQL
- [x] **Next.js App Router** — client-side навигация
- [ ] ReactFlow адаптерами
- [x] **React hooks** — `useEffect`, `useCallback`, зависимости

---

## Дополнительный контекст

### Логи/ошибки

```
Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
```

В логах WebSocket:

- Подключение к доске
- Закрытие с `code: 1005` (No Status Received) через 1–2 секунды
- Повторные подключения при цикле

### Связанные исправления в других чатах

- **Transcript 3b5b1c12:** `usePaginatedSqlResult` — нестабильный объект `paginated`; `InteractiveResultTable` — скролл; `SqlCellNode` — `cellOutput` useMemo
- **Transcript 9df80637:** `useBoardSettingsStore` — селектор возвращал новый объект каждый рендер; решение — `useShallow`, `useBoardSettingsStore.getState()`

---

## Рекомендации для исправления

### Применённый подход

1. **`onBoardDeleted`** — обернуть в `useCallback`:

   ```typescript
   const handleBoardDeleted = useCallback(() => {
     router.push('/');
   }, [router]);
   ```

2. **`initCurrentTeam`** — стабилизировать зависимости:

   ```typescript
   const workspacesJson = JSON.stringify(user?.workspaces?.map((w) => w.id) ?? []);
   useEffect(() => {
     if (user?.workspaces) initCurrentTeam(user.workspaces);
   }, [workspacesJson]);
   ```

3. **Навигация после создания доски** — использовать `window.location.href` вместо `router.push` для полной перезагрузки.

### Важные замечания

- При передаче колбэков в хуки всегда проверять, что они в зависимостях `useEffect`/`useMemo` — при необходимости оборачивать в `useCallback`
- В `useBoardCollaboration` можно рассмотреть `useRef` для `onBoardDeleted`, если колбэк не должен влиять на перезапуск эффекта
- `provider.wsconnected` в зависимостях эффекта может меняться при подключении — при появлении новых циклов стоит проверить и эту зависимость

### Потенциальные побочные эффекты

- `window.location.href` — полная перезагрузка, теряется состояние React Query и других клиентских store; для создания доски это приемлемо
- `JSON.stringify` в зависимостях — дополнительная работа при каждом рендере, но список workspace обычно небольшой

---

## Формат использования

Для команды `/fix-bug`:

```
/fix-bug

[Вставь содержимое этого файла]
```

Или при похожих ошибках «Maximum update depth exceeded»:

1. Проверить колбэки в зависимостях `useEffect` — обернуть в `useCallback`
2. Проверить объекты/массивы в зависимостях — использовать примитивы или стабильные ссылки
3. Проверить селекторы Zustand — при необходимости `useShallow` или `getState()`
