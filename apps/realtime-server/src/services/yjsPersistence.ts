import * as Y from 'yjs';
import { prisma } from '../lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setPersistence } = require('y-websocket/bin/utils');

/**
 * Configure y-websocket server-side persistence.
 * When a Y.Doc is created on the server (first client connects),
 * bindState loads the stored binary state from PostgreSQL.
 * When the last client disconnects, writeState persists the document.
 *
 * This ensures board data survives server restarts and prevents
 * data loss when Yjs in-memory state is lost.
 */
export function setupYjsPersistence(): void {
  setPersistence({
    bindState: async (docName: string, ydoc: Y.Doc): Promise<void> => {
      try {
        const board = await prisma.board.findUnique({
          where: { id: docName },
          select: { yjsState: true },
        });

        if (board?.yjsState) {
          const state = new Uint8Array(board.yjsState);
          Y.applyUpdate(ydoc, state);
        } else {
        }
      } catch (error) {
        console.error(`[YjsPersistence] Failed to load state for board ${docName}:`, error);
        // Don't throw — let the document start empty rather than crash
      }
    },

    writeState: async (docName: string, ydoc: Y.Doc): Promise<void> => {
      try {
        const state = Y.encodeStateAsUpdate(ydoc);

        // Guard: never persist an empty document (would erase real data)
        // An empty Y.Doc produces ~2 bytes of state
        if (state.length <= 2) {
          console.warn(
            `[YjsPersistence] Refusing to persist empty state for board ${docName} (${state.length} bytes)`,
          );
          return;
        }

        // Additional guard: check that the document actually has nodes or edges
        const nodesMap = ydoc.getMap('nodes');
        const edgesMap = ydoc.getMap('edges');
        if (nodesMap.size === 0 && edgesMap.size === 0) {
          console.warn(
            `[YjsPersistence] Refusing to persist board ${docName} with 0 nodes and 0 edges`,
          );
          return;
        }

        await prisma.board.update({
          where: { id: docName },
          data: { yjsState: Buffer.from(state) },
        });

      } catch (error) {
        console.error(`[YjsPersistence] Failed to save state for board ${docName}:`, error);
        // Don't throw — log and continue, data is still in memory for connected clients
      }
    },
  });

}
