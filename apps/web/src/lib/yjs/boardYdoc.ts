import { WebsocketProvider } from 'y-websocket';
import { Doc } from 'yjs';

// Store Yjs documents and providers per board
const boardDocs = new Map<string, Doc>();
const boardProviders = new Map<string, WebsocketProvider>();
// Track sync status per board
const boardSyncStatus = new Map<string, boolean>();
// Track usage count per board to prevent premature cleanup
const boardUsageCount = new Map<string, number>();
// Store pending cleanup timers — allows cancellation if a component re-mounts
// before the timer fires (critical for React Strict Mode)
const boardCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Delay before actually destroying provider/doc (ms).
// Must be long enough to survive React Strict Mode unmount→remount cycle.
const CLEANUP_DELAY_MS = 1500;

/**
 * Get WebSocket URL for collaboration
 */
function getWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:4000/collab';
  }

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
  // Convert http/https to ws/wss
  const protocol = wsUrl.startsWith('https') ? 'wss' : 'ws';
  const host = wsUrl.replace(/^https?:\/\//, '');
  return `${protocol}://${host}/collab`;
}

/**
 * Get or create a Yjs document for a board
 */
export function getBoardYdoc(boardId: string): Doc {
  if (!boardDocs.has(boardId)) {
    const doc = new Doc();
    boardDocs.set(boardId, doc);
  }
  return boardDocs.get(boardId)!;
}

/**
 * Get or create a WebsocketProvider for a board.
 * NOTE: This does NOT increment the usage count.
 * Call `retainBoardYdoc` inside useEffect to manage the lifecycle.
 */
export function getBoardProvider(boardId: string): WebsocketProvider {
  if (!boardProviders.has(boardId)) {
    const doc = getBoardYdoc(boardId);
    const wsUrl = getWebSocketUrl();
    const provider = new WebsocketProvider(wsUrl, boardId, doc, { connect: true });

    // Track connection status
    provider.on('status', (event: { status: string }) => {
      if (event.status === 'disconnected') {
        console.warn(`[Yjs WebSocket] Board ${boardId} disconnected`);
      }
    });

    provider.on('sync', (isSynced: boolean) => {
      boardSyncStatus.set(boardId, isSynced);
    });

    provider.on('connection-error', (error: Error) => {
      console.error(`[Yjs WebSocket] Board ${boardId} connection error:`, error);
    });

    // Log document updates in development
    doc.on('update', (update: Uint8Array, origin: any) => {
      if (process.env.NODE_ENV === 'development') {
        const isFromServer = origin && origin !== provider && origin !== doc;
        console.log(`[Yjs] Board ${boardId} received update:`, {
          updateSize: update.length,
          isFromServer,
          originType: origin?.constructor?.name,
          isLocalChange: origin === null,
        });
      }
    });

    boardProviders.set(boardId, provider);
  }
  return boardProviders.get(boardId)!;
}

/**
 * Check if a board's Yjs provider has completed initial sync.
 */
export function isBoardSynced(boardId: string): boolean {
  return boardSyncStatus.get(boardId) ?? false;
}

/**
 * Increment usage count for a board.
 * Call this inside `useEffect` (mount) so the count is symmetric with cleanup.
 * Also cancels any pending delayed cleanup.
 */
export function retainBoardYdoc(boardId: string): void {
  // Cancel any pending delayed cleanup from a previous unmount
  const pendingTimer = boardCleanupTimers.get(boardId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    boardCleanupTimers.delete(boardId);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Yjs] Cancelled pending cleanup for board ${boardId} (component re-mounted)`);
    }
  }

  const count = (boardUsageCount.get(boardId) || 0) + 1;
  boardUsageCount.set(boardId, count);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Yjs] retainBoardYdoc ${boardId} — usage count: ${count}`);
  }
}

/**
 * Cleanup Yjs document and provider for a board.
 * Uses delayed cleanup to survive React Strict Mode's unmount→remount cycle.
 * If retainBoardYdoc is called before the timer fires, the cleanup is cancelled.
 */
export function cleanupBoardYdoc(boardId: string): void {
  // Decrement usage count
  const currentCount = boardUsageCount.get(boardId) || 0;
  const newCount = Math.max(0, currentCount - 1);
  boardUsageCount.set(boardId, newCount);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Yjs] cleanupBoardYdoc ${boardId} — usage count: ${currentCount} → ${newCount}`);
  }

  // Still in use — nothing to do
  if (newCount > 0) {
    return;
  }

  // Schedule delayed destruction.
  // If a component re-mounts within CLEANUP_DELAY_MS (React Strict Mode),
  // retainBoardYdoc will cancel this timer and the provider stays alive.
  const timer = setTimeout(() => {
    boardCleanupTimers.delete(boardId);

    // Re-check: someone may have called retainBoardYdoc since the timer was set
    const recheck = boardUsageCount.get(boardId) || 0;
    if (recheck > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Yjs] Delayed cleanup cancelled for board ${boardId} — re-acquired (count: ${recheck})`,
        );
      }
      return;
    }

    // Safe to destroy
    const provider = boardProviders.get(boardId);
    if (provider) {
      try {
        provider.destroy();
      } catch (error) {
        console.warn(`[Yjs] Error destroying provider for board ${boardId}:`, error);
      }
      boardProviders.delete(boardId);
    }

    const doc = boardDocs.get(boardId);
    if (doc) {
      try {
        doc.destroy();
      } catch (error) {
        console.warn(`[Yjs] Error destroying doc for board ${boardId}:`, error);
      }
      boardDocs.delete(boardId);
    }

    boardUsageCount.delete(boardId);
    boardSyncStatus.delete(boardId);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Yjs] Cleaned up board ${boardId} — provider and doc destroyed`);
    }
  }, CLEANUP_DELAY_MS);

  boardCleanupTimers.set(boardId, timer);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Yjs] Scheduled delayed cleanup for board ${boardId} in ${CLEANUP_DELAY_MS}ms`);
  }
}
