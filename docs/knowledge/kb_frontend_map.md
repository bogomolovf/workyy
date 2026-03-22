---
name: Frontend File Map
description: Complete map of frontend components, hooks, stores, libs — use when navigating apps/web for bugfix or feature dev
type: reference
---

# Frontend File Map (apps/web/src/)

## App Routes (app/)
- `/` → page.tsx — Home (board list)
- `/board/[boardId]` → page.tsx — Main board canvas (largest file ~60KB)
- `/login` → Login page
- `/signup` → Signup page
- `/user-profile` → User profile

## Flow Nodes (components/flowNodes/)

### Execution nodes
- `SqlNode.tsx` — SQL query editor + execution
- `PythonNode.tsx` — Python code editor + execution
- `CsvNode.tsx` — CSV file upload & DuckDB table creation
- `DatabaseNode.tsx` — External DB connection config

### Notebook system
- `NotebookNode.tsx` (36KB) — Main notebook container, manages cells
- `NotebookFrame.tsx` — Notebook frame wrapper
- `SqlCellNode.tsx` — SQL cell (read-only in notebook)
- `PythonCellNode.tsx` — Python cell (read-only in notebook)
- `MarkdownCellNode.tsx` — Markdown cell
- `CellShell.tsx` — Cell container with run button

### Visualization
- `PlotNode.tsx` — Chart visualization (reads upstream data)
- `PlotNodeConfigPanel.tsx` (58KB) — Chart config (all chart types)
- `PlotlyPreview.tsx` — Plotly fallback preview

### Media
- `VideoNode.tsx` — Video player
- `ImageNode.tsx` — Image display
- `DocumentNode.tsx` (13KB) — PDF viewer (react-pdf)
- `VoiceNode.tsx` (16KB) — Voice node with WebRTC audio call

### Drawing
- `ShapeNode.tsx` (13KB) — Drawing shapes on canvas
- `GenericNode.tsx` — Base/fallback node

## Key Components (components/)
- `BoardCanvas.tsx` — Main ReactFlow canvas, registers nodeTypes/edgeTypes
- `BoardCommandBar.tsx` — Command palette / toolbar
- `CollaborativeCursors.tsx` — Render other users' cursors
- `InteractiveResultTable.tsx` — Data result table (TanStack Virtual)
- `UserPresenceIndicator.tsx` — User avatars sidebar
- `BoardMenu/BoardMenuButton.tsx` — Board dropdown menu (Radix)
- `board/InnerBoardCanvas.tsx` — Inner canvas wrapper
- `board/SqlNodeComponent.tsx`, `PythonNodeComponent.tsx` — Board-level node wrappers

### Subdirectories
- `comments/` — CommentLayer, CommentThreadCard, CommentAnchor, CommentEditor
- `pen/` — FreehandOverlay, EraserOverlay, path utilities
- `shape/` — ShapeDragOverlay, shapeEngine
- `visualizations/` — ChartRenderer, echarts/EChartsRenderer
- `presentation/` — Presentation mode components
- `settings/` — Settings panels
- `flowEdges/` — Custom edge rendering

## Hooks (hooks/)

### Collaboration
- `useBoardCollaboration.ts` — Yjs doc init, provider lifecycle
- `useNodesStateSynced.ts` — Sync nodes via Y.Map ↔ ReactFlow
- `useEdgesStateSynced.ts` — Sync edges via Y.Map ↔ ReactFlow
- `useCursorStateSynced.ts` — Real-time cursor tracking (~60ms throttle)
- `useBoardPresence.ts` — Board user presence
- `useEditingPresence.ts` — Which user edits which node

### Data
- `usePlotData.ts` — Format data for chart rendering
- `useFullCsvDataForPlot.ts` — Full CSV data for PlotNode
- `useFullSqlDataForPlot.ts` — Full SQL result for PlotNode
- `usePlotSnapshot.ts` — Snapshot plot to image

### Undo/Redo
- `useYjsUndoManager.ts` — Yjs-based undo/redo

### Other
- `useAudioCall.ts` — Audio call management
- `useTranslation.ts` — i18n
- `useRaf.ts` — requestAnimationFrame helper

## State Stores (state/) — Zustand

### Core
- `executionStore.ts` — Node execution results (SQL output, Python output, plot data)
- `chainStore.ts` — DAG execution chain state
- `canvasHistoryStore.ts` — Undo/redo stack
- `boardCanvasApiStore.ts` — ReactFlow instance ref

### Auth & Settings
- `authStore.ts` — Current user, JWT
- `boardSettingsStore.ts` — Board UI prefs (grid, cursors, comments visibility)
- `settingsStore.ts` — Global app settings
- `localeStore.ts` — Language
- `penSettingsStore.ts` — Pen tool config
- `cursorSettingsStore.ts` — Cursor appearance

### UI
- `notificationsStore.ts` — System notifications
- `toastStore.ts` — Toast messages
- `undoRedoStore.ts` — Undo/redo UI state
- `audioCallStore.ts` — Audio call state
- `commentStore.ts` — Comment threads cache
- `useAddNode.ts` — Add node workflow (toolbar → canvas)

## Lib (lib/)

### API
- `api.ts` — High-level REST (boards, structures, metadata)
- `apiClient.ts` — Low-level fetch wrapper, API_URL
- `api.types.ts` — API response types
- `commentApi.ts` — Comment CRUD

### Execution
- `duckdbClient.ts` — DuckDB WASM bootstrap + query
- `pythonExecutor.ts` — Python via Worker pool
- `chainExecutor.ts` — DAG execution orchestration
- `notebookExecutor.ts` — Notebook cell execution

### Visualization
- `visualization/chartBuilder.ts` (72KB) — ECharts option generation (biggest viz file)
- `visualization/chartTransforms.ts` — Binning, aggregation, faceting
- `visualization/chartTypes.ts` — Chart type enum & metadata
- `visualization/dataAnalyzer.ts` — Auto column type detection
- `visualization/autoConfig.ts` — Auto-suggest chart config

### Data
- `spreadsheetParser.ts` — CSV parsing (Papa Parse)
- `paginatedQuery.ts` — Pagination helpers
- `queryCache.ts` — TanStack Query cache config

### Yjs
- `yjs/adapters.ts` — CanvasNode ↔ ReactFlow conversion
- `yjs/boardYdoc.ts` — Y.Doc + WebSocket provider lifecycle
- `yjs/utils.ts` — Yjs utility functions

### Other
- `databaseNodeTypes.ts` — DB connection types (pg, mysql, oracle, sqlserver, clickhouse)
- `postgresClient.ts` — PostgreSQL API wrapper
- `presentationBroadcast.ts` — Presentation mode logic
- `webrtcConfig.ts` — WebRTC config
- `voiceAudioCache.ts` — Audio caching
- `migrations/migrateLegacyNodes.ts` — Legacy data migration

## Workers (workers/)
- `python.worker.ts` (15KB) — Pyodide worker (loads numpy, pandas, matplotlib, seaborn, plotly)
- `pythonClient.ts` — Worker pool client

## Context (context/)
- `EditingPresenceContext.tsx` — Track node editing by user

## Styles
- `app/globals.css` — Global CSS
- `styles/canvas.css` — Canvas-specific styles
