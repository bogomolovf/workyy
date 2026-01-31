import sql, { ConnectionPool, config as SqlConfig, IResult, IColumnMetadata } from 'mssql';
import { PrismaClient } from '@prisma/client';

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type SqlServerQueryResult = {
  rows: Record<string, unknown>[];
  columns: IColumnMetadata | undefined;
};

export class SqlServerService {
  private pools = new Map<string, ConnectionPool>();

  constructor(private prisma: PrismaClient) {}

  async getPool(connectionId: string): Promise<ConnectionPool> {
    const existingPool = this.pools.get(connectionId);
    if (existingPool && existingPool.connected) {
      return existingPool;
    }

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

    const config: SqlConfig = {
      server: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.secret.value,
      pool: {
        max: 5,
        min: 1,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: connection.ssl,
        trustServerCertificate: !connection.ssl,
        connectTimeout: 10000,
        requestTimeout: 30000,
      },
    };

    const pool = new ConnectionPool(config);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle SQL Server client', err);
      this.pools.delete(connectionId);
    });

    await pool.connect();
    this.pools.set(connectionId, pool);

    return pool;
  }

  async executeQuery(
    connectionId: string,
    query: string,
    params?: unknown[],
  ): Promise<SqlServerQueryResult> {
    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const pool = await this.getPool(connectionId);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Query timeout after 30 seconds'));
      }, 30000);
    });

    const queryPromise = (async () => {
      const request = pool.request();

      if (params && params.length > 0) {
        params.forEach((param, index) => {
          request.input(`param${index}`, param);
        });
      }

      const result: IResult<Record<string, unknown>> = await request.query(query);

      const rows =
        result.recordset.length > 10000 ? result.recordset.slice(0, 10000) : result.recordset;

      return {
        rows,
        columns: result.columns,
      };
    })();

    return Promise.race([queryPromise, timeoutPromise]);
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    let pool: ConnectionPool | null = null;
    try {
      const sqlConfig: SqlConfig = {
        server: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        pool: {
          max: 1,
          min: 0,
          idleTimeoutMillis: 5000,
        },
        options: {
          encrypt: config.ssl,
          trustServerCertificate: !config.ssl,
          connectTimeout: 5000,
          requestTimeout: 5000,
        },
      };

      pool = new ConnectionPool(sqlConfig);
      await pool.connect();

      const result = await Promise.race([
        pool.request().query('SELECT 1 as test'),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        }),
      ]);

      if (result.recordset.length === 1 && result.recordset[0].test === 1) {
        return { success: true };
      }
      return { success: false, message: 'Unexpected test result' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  async closePool(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      try {
        await pool.close();
      } catch {
        // Ignore close errors
      }
      this.pools.delete(connectionId);
    }
  }

  async closeAllPools(): Promise<void> {
    const promises = Array.from(this.pools.entries()).map(async ([id, pool]) => {
      try {
        await pool.close();
      } catch {
        // Ignore close errors
      }
      this.pools.delete(id);
    });
    await Promise.all(promises);
  }
}
