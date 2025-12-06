import { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import { createServiceRouter } from './routes';

export async function createServer(app: FastifyInstance) {
  app.register(createServiceRouter, { prefix: '/api' });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/collab', { websocket: true }, (connection, request) => {
    // TODO: attach Yjs awareness + persistence
    connection.socket.on('message', (message) => {
      app.log.info({ message: message.toString() }, 'received stub message');
    });
  });

  app.addHook('onReady', async () => {
    const address = app.server.address();
    app.log.info({ address }, 'Realtime server ready');
  });
}
