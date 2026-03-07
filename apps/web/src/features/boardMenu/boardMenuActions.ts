/**
 * Board menu actions layer. Each action receives context and performs the operation.
 * Used by BoardMenu to execute menu items; returns disabled/disabledReason for UX when action is not available.
 */

import {
  createBoard,
  type CreateBoardInput,
  type CreatedBoard,
  type PersistedEdge,
  type PersistedNode,
} from '../../lib/api';
import { useBoardCanvasApiStore } from '../../state/boardCanvasApiStore';
import { useBoardSettingsStore } from '../../state/boardSettingsStore';
import { useToastStore } from '../../state/toastStore';

export type BoardSnapshot = {
  nodes: PersistedNode[];
  edges: PersistedEdge[];
};

export type BoardMenuContext = {
  boardId: string;
  boardTitle: string | null | undefined;
  workspaceId: string;
  getSnapshot: () => BoardSnapshot;
  onCloseMenu: () => void;
  routerPush: (url: string) => void;
  onDeleteBoard: (boardId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fullscreenTarget: HTMLElement | null | undefined;
  /** Optional: open command palette (Cmd+K). If not provided, action shows disabled + tooltip. */
  onOpenCommands?: () => void;
  /** Optional: open find panel. If not provided, action shows disabled + tooltip. */
  onOpenFind?: () => void;
  /** Optional: open board details panel. If not provided, action opens minimal modal or disabled. */
  onOpenDetails?: () => void;
  /** Optional: open profile/settings page. If not provided, navigates to /user-profile. */
  onOpenProfile?: () => void;
};

function toast(): {
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
} {
  const s = useToastStore.getState();
  return {
    success: (m) => s.show(m, 'success'),
    error: (m) => s.show(m, 'error'),
    info: (m) => s.show(m, 'info'),
  };
}

/** Catch up: fit view to show all nodes + toast */
export function runCatchUp(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  const fitView = useBoardCanvasApiStore.getState().fitView;
  if (fitView) {
    fitView();
    toast().success('Caught up');
  } else {
    toast().info('Canvas not ready');
  }
}

/** + New board: create board and navigate */
export async function runNewBoard(ctx: BoardMenuContext): Promise<void> {
  ctx.onCloseMenu();
  const workspaceId = ctx.workspaceId;
  if (!workspaceId) {
    toast().error('No workspace. Set NEXT_PUBLIC_DEFAULT_WORKSPACE_ID.');
    return;
  }
  try {
    const board = await createBoard({
      workspaceId,
      title: 'Untitled board',
    } as CreateBoardInput);
    toast().success('Board created');
    ctx.routerPush(`/board/${board.id}`);
  } catch (e) {
    toast().error(e instanceof Error ? e.message : 'Failed to create board');
  }
}

/** Duplicate: create new board with "(copy)" and same content if possible */
export async function runDuplicate(ctx: BoardMenuContext): Promise<void> {
  ctx.onCloseMenu();
  const workspaceId = ctx.workspaceId;
  if (!workspaceId) {
    toast().error('No workspace.');
    return;
  }
  try {
    const snapshot = ctx.getSnapshot();
    const title = (ctx.boardTitle ?? 'Board').trim() + ' (copy)';
    const board = await createBoard({
      workspaceId,
      title,
    } as CreateBoardInput);
    // TODO: POST initial content to new board when API supports it (e.g. PUT /boards/:id/nodes with snapshot)
    toast().success('Board duplicated (content copy TODO)');
    ctx.routerPush(`/board/${board.id}`);
  } catch (e) {
    toast().error(e instanceof Error ? e.message : 'Failed to duplicate board');
  }
}

/** Export as PDF: client-side canvas to image then PDF (minimal: download as PNG first, PDF TODO) */
export function runExportPdf(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  // TODO: open dialog "Export PDF" (area: current view / entire board), then html2canvas or similar + jspdf
  toast().info('Export PDF: use Export as image for now. Full PDF dialog TODO.');
}

/** Export as image: snapshot canvas area and download PNG */
export function runExportImage(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  const viewport = document.querySelector('.react-flow__viewport');
  if (!viewport || !(viewport instanceof HTMLElement)) {
    toast().error('Canvas not found');
    return;
  }
  try {
    import('html2canvas')
      .then(({ default: html2canvas }) => {
        html2canvas(viewport, { useCORS: true, scale: 2 }).then((canvas) => {
          const link = document.createElement('a');
          link.download = `board-${ctx.boardId.slice(0, 8)}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          toast().success('Image downloaded');
        });
      })
      .catch(() => {
        toast().error('Export failed. Install html2canvas for image export.');
      });
  } catch {
    toast().error('Export failed');
  }
}

/** Save board as template: persist snapshot locally as template (no server templates yet) */
export function runSaveAsTemplate(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  const snapshot = ctx.getSnapshot();
  const templates = useBoardSettingsStore.getState().templates ?? [];
  const name = (ctx.boardTitle ?? 'Board').trim() + ' template';
  const next = [...templates, { id: `tpl-${Date.now()}`, name, snapshot, createdAt: Date.now() }];
  useBoardSettingsStore.setState({ templates: next });
  toast().success('Template saved locally');
}

/** Export to spreadsheet (CSV): if selected node has table data, export it */
export function runExportSpreadsheet(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  // TODO: get selected node from execution store; if it has table output, export as CSV
  toast().info(
    'Export CSV: select a node with table result, then use this. TODO: wire to execution store.',
  );
}

/** Download board backup: JSON of nodes + edges + meta */
export function runDownloadBackup(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  const snapshot = ctx.getSnapshot();
  const backup = {
    version: 1,
    boardId: ctx.boardId,
    boardTitle: ctx.boardTitle ?? null,
    exportedAt: new Date().toISOString(),
    nodes: snapshot.nodes,
    edges: snapshot.edges,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `board-backup-${ctx.boardId.slice(0, 8)}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  toast().success('Backup downloaded');
}

/** Embed: show modal with iframe code (read-only). Disabled if no public embed. */
export function runEmbed(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  // TODO: when public embed is enabled, open modal with iframe snippet
  toast().info('Embedding not enabled yet');
}

/** Save to Google Drive: disabled when no OAuth */
export function runSaveToGoogleDrive(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  toast().info('Google Drive integration not configured');
}

/** Move to: workspace/folder picker. Disabled when no hierarchies. */
export function runMoveTo(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  toast().info('Move to: workspace hierarchy not implemented yet');
}

/** Star / Unstar this board */
export function runStarBoard(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  useBoardSettingsStore.getState().toggleStarred(ctx.boardId);
  const isStarred = useBoardSettingsStore.getState().isStarred(ctx.boardId);
  toast().success(isStarred ? 'Board starred' : 'Board unstarred');
}

/** Delete: confirm then call onDeleteBoard (page handles confirm + API + redirect) */
export function runDelete(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  ctx.onDeleteBoard(ctx.boardId);
}

/** Start view: save current viewport as start view */
export function runStartView(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  const viewportEl = document.querySelector('.react-flow__viewport');
  if (!viewportEl) {
    toast().error('Canvas not found');
    return;
  }
  const transform = (viewportEl as HTMLElement).style.transform;
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s+scale\(([-\d.]+)\)/.exec(
    transform ?? '',
  );
  if (match) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const zoom = parseFloat(match[3]);
    useBoardSettingsStore.getState().setStartView({ x, y, zoom });
    toast().success('Start view saved');
  } else {
    toast().info('Start view saved (fallback)');
    useBoardSettingsStore.getState().setStartView({ x: 0, y: 0, zoom: 1 });
  }
}

/** History: open history panel. If no Yjs history UI, show toast. */
export function runHistory(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  // TODO: open drawer with undo stack or Yjs history when available
  toast().info('History panel TODO');
}

/** Details: open board details panel */
export function runDetails(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  if (ctx.onOpenDetails) {
    ctx.onOpenDetails();
  } else {
    const info = `Board: ${ctx.boardTitle ?? 'Untitled'}\nID: ${ctx.boardId}`;
    toast().info(info);
  }
}

/** Undo */
export function runUndo(ctx: BoardMenuContext): void {
  if (ctx.canUndo) {
    ctx.onCloseMenu();
    ctx.undo();
  }
}

/** Redo */
export function runRedo(ctx: BoardMenuContext): void {
  if (ctx.canRedo) {
    ctx.onCloseMenu();
    ctx.redo();
  }
}

/** Commands (Cmd+K) */
export function runCommands(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  if (ctx.onOpenCommands) {
    ctx.onOpenCommands();
  } else {
    toast().info('Command palette TODO');
  }
}

/** Find (Cmd+F) */
export function runFind(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  if (ctx.onOpenFind) {
    ctx.onOpenFind();
  } else {
    toast().info('Find panel TODO');
  }
}

/** Full screen */
export function runFullscreen(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  const target = ctx.fullscreenTarget ?? document.documentElement;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => toast().error('Could not exit fullscreen'));
  } else {
    target.requestFullscreen?.().catch(() => toast().error('Fullscreen not allowed'));
  }
}

/** Profile settings */
export function runProfileSettings(ctx: BoardMenuContext): void {
  ctx.onCloseMenu();
  if (ctx.onOpenProfile) {
    ctx.onOpenProfile();
  } else {
    ctx.routerPush('/user-profile');
  }
}

/** Get disabled state and tooltip for an action (for UX when action is not available) */
export function getActionState(
  actionId: string,
  ctx: BoardMenuContext,
): { disabled: boolean; disabledReason?: string } {
  switch (actionId) {
    case 'undo':
      return {
        disabled: !ctx.canUndo,
        disabledReason: ctx.canUndo ? undefined : 'Nothing to undo',
      };
    case 'redo':
      return {
        disabled: !ctx.canRedo,
        disabledReason: ctx.canRedo ? undefined : 'Nothing to redo',
      };
    case 'exportSpreadsheet':
      return { disabled: true, disabledReason: 'No tabular data to export' }; // TODO: check execution store
    case 'embed':
      return { disabled: true, disabledReason: 'Embedding not enabled yet' };
    case 'saveToGoogleDrive':
      return { disabled: true, disabledReason: 'Google Drive integration not configured' };
    case 'moveTo':
      return { disabled: true, disabledReason: 'Workspace hierarchy not implemented' };
    default:
      return { disabled: false };
  }
}
