# Presentation viewer and broadcast

## Overview

- **Viewer**: Click a presentation (document) node on the board to open a full-screen–capable viewer. Supports PDF; pages are treated as slides. Prev/Next, fullscreen, hotkeys (←/→, PageUp/PageDown, Space, Esc).
- **Broadcast**: One user can “Start broadcast” for a presentation. Only one broadcaster per presentation at a time (single presenter lock). Others see a “Подключиться к трансляции” button under the node and can follow the presenter’s slide in real time.
- **Private mode**: Any user can open the same presentation “for themselves” and navigate locally, even while a broadcast is active.

## Data model

- **Local (not synced)**: current slide index, fullscreen, viewer open/closed, follow-mode toggle.
- **Synced (Yjs)**: `presentationBroadcastsMap` (board-level). Key = presentation node id, value = `{ isActive, presenterUserId, presenterName, slideIndex, updatedAt }`.

## Single presenter lock

- “Start broadcast” sets `isActive = true` and `presenterUserId = current user` in Yjs.
- If another user already has an active broadcast for that node, starting fails with “трансляция уже идёт”.
- Only the current presenter can “End broadcast” (clears or sets `isActive = false`).

## Viewer behaviour

- **Private**: Navigation only updates local slide index.
- **Presenter**: Navigation updates both local index and `broadcast.slideIndex` in Yjs so viewers see the same slide.
- **Viewer (follow mode)**: Displayed slide = `broadcast.slideIndex`. Toggle “Follow presenter” on/off; when off, local navigation is allowed and “Вернуться к ведущему” can re-enable follow.

## UI

- **Presentation node**: Click node or “Open” → opens PresentationViewer.
- **Viewer toolbar**: Prev/Next, slide counter, fullscreen, “Start broadcast” / “End broadcast”, “Follow presenter” (when not presenter), status “You are presenting” / “&lt;name&gt; • Slide X/Y”.
- **Board**: When a broadcast is active for a node, a “Подключиться к трансляции” button is shown under that node; click opens the viewer in follow mode.

## Hotkeys

- ← / →, PageUp / PageDown, Space: previous / next slide.
- Esc: close viewer or exit fullscreen.

## Implementation notes

- Broadcast state lives in `ydoc.getMap('presentationBroadcasts')`; no extra WebSocket events for slide sync.
- `apps/web/src/lib/presentationBroadcast.ts`: types and helpers. `PresentationViewer.tsx`: viewer UI and broadcast actions. BoardCanvas wires viewer open/close and “Join broadcast” overlay.
