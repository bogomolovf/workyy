import { Pool, QueryResult, PoolConfig } from 'pg';
import { PrismaClient } from '@prisma/client';

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export class PostgresService {
  private pools = new Map<string, Pool>();

  constructor(private prisma: PrismaClient) {}

  async getPool(connectionId: string): Promise<Pool> {
    const existingPool = this.pools.get(connectionId);
    if (existingPool) {
      return existingPool;
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

    const config: PoolConfig = {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.secret.value,
      ssl: connection.ssl
        ? {
            rejectUnauthorized: false,
          }
        : false,
      max: 5, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    const pool = new Pool(config);
    this.pools.set(connectionId, pool);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      // Remove the pool from cache on error
      this.pools.delete(connectionId);
    });

    return pool;
  }

  async executeQuery(
    connectionId: string,
    query: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    // Enforce SELECT-only for security
    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const pool = await this.getPool(connectionId);

    // Add timeout and row limit
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Query timeout after 30 seconds'));
      }, 30000);
    });

    const queryPromise = pool.query(query, params).then((result) => {
      // Limit rows to 10,000
      if (result.rows.length > 10000) {
        return {
          ...result,
          rows: result.rows.slice(0, 10000),
          rowCount: 10000,
        };
      }
      return result;
    });

    return Promise.race([queryPromise, timeoutPromise]);
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    let pool: Pool | null = null;
    try {
      const poolConfig: PoolConfig = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl
          ? {
              rejectUnauthorized: false,
            }
          : false,
        max: 1,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000,
      };

      pool = new Pool(poolConfig);
      const result = await Promise.race([
        pool.query('SELECT 1 as test'),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        }),
      ]);

      if (result.rows.length === 1 && result.rows[0].test === 1) {
        return { success: true };
      }
      return { success: false, message: 'Unexpected test result' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  }

  async closePool(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      await pool.end();
      this.pools.delete(connectionId);
    }
  }

  async closeAllPools(): Promise<void> {
    const promises = Array.from(this.pools.entries()).map(async ([id, pool]) => {
      await pool.end();
      this.pools.delete(id);
    });
    await Promise.all(promises);
  }
}
