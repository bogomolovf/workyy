import { FastifyInstance } from 'fastify';
import { createServiceRouter } from './routes';
import { setupCollaborationWS } from './services/collaborationService';

export async function createServer(app: FastifyInstance) {
  app.register(createServiceRouter, { prefix: '/api' });

  app.get('/health', async () => ({ status: 'ok' }));

  // WebSocket route with boardId parameter in path
  // WebsocketProvider adds roomName (boardId) to URL as path: /collab/${boardId}
  app.get('/collab/:boardId', { websocket: true }, async (connection, request) => {
    try {
      await setupCollaborationWS(connection.socket, request, app);
    } catch (error) {
      app.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          url: request.url,
          params: request.params,
        },
        'WebSocket route handler error'
      );
      // Don't close connection here - setupCollaborationWS handles it
    }
  });

  app.addHook('onReady', async () => {
    const address = app.server.address();
    app.log.info({ address }, 'Realtime server ready');
  });
}
