import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { boardsRoutes } from './boards';
import { connectionsRoutes } from './connections';
import { drawingRoutes } from './drawing';
import { runsRoutes } from './runs';
import { secretsRoutes } from './secrets';
import { databaseConnectionsRoutes } from './databaseConnections';
import { workspacesRoutes } from './workspaces';

export async function createServiceRouter(app: FastifyInstance) {
  app.get('/version', async () => ({
    name: 'workyy-realtime',
    version: '0.1.0',
  }));

  await app.register(authRoutes);
  await app.register(boardsRoutes);
  await app.register(runsRoutes);
  await app.register(connectionsRoutes);
  await app.register(secretsRoutes);
  await app.register(databaseConnectionsRoutes);
  await app.register(drawingRoutes);
  await app.register(workspacesRoutes);
}
