import { createClient, ClickHouseClient } from '@clickhouse/client';
import { PrismaClient } from '@prisma/client';

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type ClickhouseQueryResult = {
  rows: Record<string, unknown>[];
  columns: string[];
};

export class ClickhouseService {
  private clients = new Map<string, ClickHouseClient>();

  constructor(private prisma: PrismaClient) {}

  async getClient(connectionId: string): Promise<ClickHouseClient> {
    const existingClient = this.clients.get(connectionId);
    if (existingClient) {
      return existingClient;
    }

    // Fetch connection config from database
    const connection = await this.prisma.databaseConnection.findUnique({
      where: { id: connectionId },
      include: { secret: true },
    });

    if (!connection) {
      throw new Error(`Database connection ${connectionId} not found`);
    }

    if (!connection.secret) {
      throw new Error(`Password secret for connection ${connectionId} not found`);
    }

    const protocol = connection.ssl ? 'https' : 'http';
    const client = createClient({
      url: `${protocol}://${connection.host}:${connection.port}`,
      username: connection.username,
      password: connection.secret.value,
      database: connection.database,
      request_timeout: 30000,
      clickhouse_settings: {
        max_result_rows: '10000',
      },
    });

    this.clients.set(connectionId, client);

    return client;
  }

  async executeQuery(
    connectionId: string,
    query: string,
  ): Promise<ClickhouseQueryResult> {
    // Enforce SELECT-only for security
    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const client = await this.getClient(connectionId);

    // Add timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Query timeout after 30 seconds'));
      }, 30000);
    });

    const queryPromise = (async () => {
      const resultSet = await client.query({
        query,
        format: 'JSONEachRow',
      });

      const data = await resultSet.json<Record<string, unknown>>();
      // Ensure rows is always a flat array
      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [data];

      // Get column names from first row or empty array
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Limit rows to 10,000
      const limitedRows = rows.length > 10000 ? rows.slice(0, 10000) : rows;

      return {
        rows: limitedRows,
        columns,
      };
    })();

    return Promise.race([queryPromise, timeoutPromise]);
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    let client: ClickHouseClient | null = null;
    try {
      const protocol = config.ssl ? 'https' : 'http';
      client = createClient({
        url: `${protocol}://${config.host}:${config.port}`,
        username: config.username,
        password: config.password,
        database: config.database,
        request_timeout: 5000,
      });

      const result = await Promise.race([
        client.query({
          query: 'SELECT 1 as test',
          format: 'JSONEachRow',
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        }),
      ]);

      const data = await result.json<{ test: number }>();
      const rows: { test: number }[] = Array.isArray(data) ? data : [data];

      if (rows.length === 1 && rows[0]?.test === 1) {
        return { success: true };
      }
      return { success: false, message: 'Unexpected test result' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

  async closePool(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
    }
  }

  async closeAllPools(): Promise<void> {
    const promises = Array.from(this.clients.entries()).map(async ([id, client]) => {
      await client.close();
      this.clients.delete(id);
    });
    await Promise.all(promises);
  }
}
