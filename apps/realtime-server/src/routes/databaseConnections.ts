import { Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import {
  testConnectionBodySchema,
  createDatabaseConnectionBodySchema,
  updateDatabaseConnectionBodySchema,
  executeQueryBodySchema,
} from '../validators/databaseConnections';

export async function databaseConnectionsRoutes(app: FastifyInstance) {
  // Test connection
  app.post('/database-connections/test', async (request, reply) => {
    const parse = testConnectionBodySchema.safeParse(request.body);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }
    const config = parse.data;

    try {
      // Route to appropriate service based on dbType
      let result;
      if (config.dbType === 'mysql') {
        result = await container.mysqlService.testConnection(config);
      } else if (config.dbType === 'oracle') {
        result = await container.oracleService.testConnection(config);
      } else if (config.dbType === 'sqlserver') {
        result = await container.sqlserverService.testConnection(config);
      } else if (config.dbType === 'clickhouse') {
        result = await container.clickhouseService.testConnection(config);
      } else {
        result = await container.postgresService.testConnection(config);
      }
      return reply.send(result);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to test database connection');
      return sendProblem(reply, {
        title: 'Connection test failed',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create connection
  app.post('/database-connections', async (request, reply) => {
    const parse = createDatabaseConnectionBodySchema.safeParse(request.body);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }
    const body = parse.data;

    // Verify workspace exists
    const workspaceExists = await container.prisma.workspace.count({
      where: { id: body.workspaceId },
    });
    if (!workspaceExists) {
      return sendProblem(reply, {
        title: 'Workspace not found',
        status: 404,
        detail: `Workspace ${body.workspaceId} does not exist`,
      });
    }

    try {
      // Create secret for password
      const secretName = `db-connection-${Date.now()}`;
      const secret = await container.prisma.secret.create({
        data: {
          workspaceId: body.workspaceId,
          name: secretName,
          value: body.password,
        },
      });

      // Create database connection
      const connection = await container.prisma.databaseConnection.create({
        data: {
          workspaceId: body.workspaceId,
          connectionName: body.connectionName,
          dbType: body.dbType,
          host: body.host,
          port: body.port,
          database: body.database,
          username: body.username,
          ssl: body.ssl,
          secretId: secret.id,
        },
      });

      await container.auditService.record({
        type: 'database-connection.created',
        workspaceId: body.workspaceId,
        payload: {
          connectionId: connection.id,
          connectionName: connection.connectionName,
          dbType: connection.dbType,
        },
      });

      return reply.code(201).send({
        id: connection.id,
        connectionId: connection.id,
        secretId: secret.id,
        connectionName: connection.connectionName,
        dbType: connection.dbType,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        ssl: connection.ssl,
        createdAt: connection.createdAt,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return sendProblem(reply, {
          title: 'Connection name conflict',
          status: 409,
          detail: 'Connection name must be unique within the workspace',
        });
      }
      request.log.error({ err: error }, 'Failed to create database connection');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to create database connection',
      });
    }
  });

  // Get connection
  app.get('/database-connections/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const connectionId = params.id;

    const connection = await container.prisma.databaseConnection.findUnique({
      where: { id: connectionId },
      include: { secret: false }, // Never include password
    });

    if (!connection) {
      return sendProblem(reply, {
        title: 'Database connection not found',
        status: 404,
        detail: `Database connection ${connectionId} does not exist`,
      });
    }

    return reply.send({
      id: connection.id,
      connectionId: connection.id,
      connectionName: connection.connectionName,
      dbType: connection.dbType,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      ssl: connection.ssl,
      status: connection.status,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    });
  });

  // Update connection
  app.put('/database-connections/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const connectionId = params.id;
    const parse = updateDatabaseConnectionBodySchema.safeParse(request.body);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }
    const body = parse.data;

    const existing = await container.prisma.databaseConnection.findUnique({
      where: { id: connectionId },
      include: { secret: true },
    });

    if (!existing) {
      return sendProblem(reply, {
        title: 'Database connection not found',
        status: 404,
        detail: `Database connection ${connectionId} does not exist`,
      });
    }

    try {
      // Update password secret if provided
      if (body.password !== undefined && existing.secret) {
        await container.prisma.secret.update({
          where: { id: existing.secretId },
          data: { value: body.password },
        });
      }

      // Update connection
      const connection = await container.prisma.databaseConnection.update({
        where: { id: connectionId },
        data: {
          connectionName: body.connectionName,
          dbType: body.dbType,
          host: body.host,
          port: body.port,
          database: body.database,
          username: body.username,
          ssl: body.ssl,
        },
      });

      // Close and remove pool to force reconnection with new credentials
      if (
        body.host ||
        body.port ||
        body.database ||
        body.username ||
        body.password ||
        body.ssl !== undefined ||
        body.dbType
      ) {
        // Close pool from all services (only one will have the connection)
        await container.postgresService.closePool(connectionId);
        await container.mysqlService.closePool(connectionId);
        await container.oracleService.closePool(connectionId);
        await container.sqlserverService.closePool(connectionId);
        await container.clickhouseService.closePool(connectionId);
      }

      await container.auditService.record({
        type: 'database-connection.updated',
        workspaceId: connection.workspaceId,
        payload: { connectionId: connection.id },
      });

      return reply.send({
        id: connection.id,
        connectionId: connection.id,
        connectionName: connection.connectionName,
        dbType: connection.dbType,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        ssl: connection.ssl,
        status: connection.status,
        updatedAt: connection.updatedAt,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to update database connection');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to update database connection',
      });
    }
  });

  // Delete connection
  app.delete('/database-connections/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const connectionId = params.id;

    const existing = await container.prisma.databaseConnection.findUnique({
      where: { id: connectionId },
      include: { secret: true },
    });

    if (!existing) {
      return sendProblem(reply, {
        title: 'Database connection not found',
        status: 404,
        detail: `Database connection ${connectionId} does not exist`,
      });
    }

    try {
      // Close pool before deletion (from all services)
      await container.postgresService.closePool(connectionId);
      await container.mysqlService.closePool(connectionId);
      await container.oracleService.closePool(connectionId);
      await container.sqlserverService.closePool(connectionId);
      await container.clickhouseService.closePool(connectionId);

      // Delete connection (cascade will delete secret)
      await container.prisma.databaseConnection.delete({
        where: { id: connectionId },
      });

      // Also delete secret explicitly (though cascade should handle it)
      if (existing.secret) {
        await container.prisma.secret
          .delete({
            where: { id: existing.secretId },
          })
          .catch(() => {
            // Ignore if already deleted by cascade
          });
      }

      await container.auditService.record({
        type: 'database-connection.deleted',
        workspaceId: existing.workspaceId,
        payload: { connectionId: existing.id },
      });

      return reply.code(204).send();
    } catch (error) {
      request.log.error({ err: error }, 'Failed to delete database connection');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to delete database connection',
      });
    }
  });

  // Execute query
  app.post('/database-connections/:id/execute', async (request, reply) => {
    const params = request.params as { id: string };
    const connectionId = params.id;
    const parse = executeQueryBodySchema.safeParse(request.body);
    if (!parse.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parse.error.message,
        errors: parse.error.flatten(),
      });
    }
    const { query } = parse.data;

    const connection = await container.prisma.databaseConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return sendProblem(reply, {
        title: 'Database connection not found',
        status: 404,
        detail: `Database connection ${connectionId} does not exist`,
      });
    }

    try {
      // Helper function to normalize values for consistent output format
      const normalizeValue = (value: unknown): unknown => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (typeof value === 'bigint') {
          const asNumber = Number(value);
          return Number.isNaN(asNumber) ? Number(value.toString()) : asNumber;
        }
        if (value instanceof Date) return value.toISOString();
        return JSON.stringify(value);
      };

      let columns: string[];
      let rows: unknown[][];

      if (connection.dbType === 'mysql') {
        // Execute via MySQL
        const result = await container.mysqlService.executeQuery(connectionId, query);
        columns = result.fields.map((field) => field.name);
        rows = result.rows.map((row) => columns.map((col) => normalizeValue(row[col])));
      } else if (connection.dbType === 'oracle') {
        // Execute via Oracle
        const result = await container.oracleService.executeQuery(connectionId, query);
        columns = result.metaData.map((meta) => meta.name);
        rows = result.rows.map((row) => columns.map((col) => normalizeValue(row[col])));
      } else if (connection.dbType === 'sqlserver') {
        // Execute via SQL Server
        const result = await container.sqlserverService.executeQuery(connectionId, query);
        columns = result.columns ? Object.keys(result.columns) : [];
        rows = result.rows.map((row: Record<string, unknown>) =>
          columns.map((col) => normalizeValue(row[col])),
        );
      } else if (connection.dbType === 'clickhouse') {
        // Execute via ClickHouse
        const result = await container.clickhouseService.executeQuery(connectionId, query);
        columns = result.columns;
        rows = result.rows.map((row: Record<string, unknown>) =>
          columns.map((col) => normalizeValue(row[col])),
        );
      } else {
        // Execute via PostgreSQL (default)
        const result = await container.postgresService.executeQuery(connectionId, query);
        columns = result.fields.map((field) => field.name);
        rows = result.rows.map((row) => columns.map((col) => normalizeValue(row[col])));
      }

      return reply.send({
        columns,
        rows,
      });
    } catch (error) {
      const dbTypeMap: Record<string, string> = {
        mysql: 'MySQL',
        oracle: 'Oracle',
        postgresql: 'PostgreSQL',
        sqlserver: 'SQL Server',
        clickhouse: 'ClickHouse',
      };
      const dbType = dbTypeMap[connection.dbType] || 'PostgreSQL';
      request.log.error({ err: error }, `Failed to execute ${dbType} query`);
      return sendProblem(reply, {
        title: 'Query execution failed',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
