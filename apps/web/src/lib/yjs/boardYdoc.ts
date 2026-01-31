import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Store Yjs documents and providers per board
const boardDocs = new Map<string, Doc>();
const boardProviders = new Map<string, WebsocketProvider>();
// Track usage count per board to prevent premature cleanup
const boardUsageCount = new Map<string, number>();

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
 * Get or create a WebsocketProvider for a board
 */
export function getBoardProvider(boardId: string): WebsocketProvider {
  // Increment usage count
  boardUsageCount.set(boardId, (boardUsageCount.get(boardId) || 0) + 1);

  if (!boardProviders.has(boardId)) {
    const doc = getBoardYdoc(boardId);
    const wsUrl = getWebSocketUrl();
    // CRITICAL FIX: WebsocketProvider adds roomName to the URL as a path segment
    // Final URL format: ws://host/collab/${roomName}
    // We pass boardId as roomName, so URL becomes: ws://host/collab/${boardId}
    //
    // IMPORTANT: Do NOT use params option - it adds query parameters (?boardId=...)
    // which can cause WebSocket connection failures if server doesn't handle them properly.
    // The roomName (boardId) is already in the path, which the server extracts via route parameter.
    const provider = new WebsocketProvider(
      wsUrl, // Base URL: ws://host/collab
      boardId, // roomName - WebsocketProvider adds this to URL as path: /collab/${boardId}
      doc,
      {
        connect: true,
        // DO NOT add params here - it adds query parameters which can break WebSocket connection
        // Server extracts boardId from path parameter /collab/:boardId
      },
    );

    // Log connection status for debugging
    provider.on('status', (event: { status: string }) => {
      console.log(`[Yjs WebSocket] Board ${boardId} status:`, event.status);
      if (event.status === 'disconnected') {
        console.warn(`[Yjs WebSocket] Board ${boardId} disconnected`);
      }
      if (event.status === 'connected') {
        // Log the actual URL used for connection (should be ws://host/collab/${boardId} without query params)
        const actualUrl = provider.url;
        const hasQueryParams = actualUrl?.includes('?');
        console.log(`[Yjs WebSocket] Board ${boardId} connected successfully`, {
          url: actualUrl,
          hasQueryParams,
          roomName: (provider as any).roomName || boardId,
          wsconnected: provider.wsconnected,
          docClientID: doc.clientID.toString(),
          note: hasQueryParams
            ? 'WARNING: URL contains query params (should not)'
            : 'OK: URL format correct',
        });
      }
    });

    provider.on('sync', (isSynced: boolean) => {
      console.log(`[Yjs WebSocket] Board ${boardId} synced:`, isSynced);
      if (isSynced) {
        console.log(`[Yjs WebSocket] Board ${boardId} fully synchronized with server`, {
          docClientID: doc.clientID.toString(),
          cursorsMapSize: doc.getMap('cursors').size,
          nodesMapSize: doc.getMap('nodes').size,
          edgesMapSize: doc.getMap('edges').size,
        });
      }
    });

    provider.on('connection-error', (error: Error) => {
      console.error(`[Yjs WebSocket] Board ${boardId} connection error:`, error);
    });

    // Log when document updates are received from other clients
    // CRITICAL: This helps verify that updates from other clients are received
    doc.on('update', (update: Uint8Array, origin: any) => {
      if (process.env.NODE_ENV === 'development') {
        // origin is the WebsocketProvider if update came from server (synced from other clients)
        // origin is null if update came from local changes
        const isFromServer = origin && origin !== provider && origin !== doc;
        console.log(`[Yjs] Board ${boardId} received update:`, {
          updateSize: update.length,
          isFromServer,
          originType: origin?.constructor?.name,
          isLocalChange: origin === null,
        });

        // Also log cursorsMap size when update is received
        try {
          const cursorsMap = doc.getMap('cursors');
          console.log(`[Yjs] Board ${boardId} cursorsMap after update:`, {
            mapSize: cursorsMap.size,
            cursors: Array.from(cursorsMap.values()).map((c: any) => ({
              id: c.id,
              clientId: doc.clientID.toString(),
              isSelf: c.id === doc.clientID.toString(),
            })),
          });
        } catch (e) {
          // cursorsMap might not exist yet
        }
      }
    });

    boardProviders.set(boardId, provider);
  }
  return boardProviders.get(boardId)!;
}

/**
 * Cleanup Yjs document and provider for a board
 * CRITICAL: Use reference counting to prevent premature cleanup
 * In React Strict Mode, cleanup can be called during render, but we should only
 * cleanup when all references are released
 */
export function cleanupBoardYdoc(boardId: string): void {
  // Decrement usage count
  const currentCount = boardUsageCount.get(boardId) || 0;
  const newCount = Math.max(0, currentCount - 1);
  boardUsageCount.set(boardId, newCount);

  // Only cleanup if no one is using this board anymore
  if (newCount > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Yjs] Skipping cleanup for board ${boardId} - still in use (count: ${newCount})`,
      );
    }
    return;
  }

  // No one is using this board - safe to cleanup
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

  // Clean up usage count
  boardUsageCount.delete(boardId);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Yjs] Cleaned up board ${boardId} - provider and doc destroyed`);
  }
}
