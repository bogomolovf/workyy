import { PrismaClient } from '@prisma/client';
import mysql, { Pool, PoolOptions, RowDataPacket, FieldPacket } from 'mysql2/promise';

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type MysqlQueryResult = {
  rows: Record<string, unknown>[];
  fields: FieldPacket[];
};

export class MysqlService {
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

    const config: PoolOptions = {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.secret.value,
      ssl: connection.ssl
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 10000,
    };

    const pool = mysql.createPool(config);
    this.pools.set(connectionId, pool);

    return pool;
  }

  async executeQuery(
    connectionId: string,
    query: string,
    params?: unknown[],
  ): Promise<MysqlQueryResult> {
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

    const queryPromise = pool.query<RowDataPacket[]>(query, params).then(([rows, fields]) => {
      // Limit rows to 10,000
      const limitedRows = rows.length > 10000 ? rows.slice(0, 10000) : rows;
      return {
        rows: limitedRows as Record<string, unknown>[],
        fields,
      };
    });

    return Promise.race([queryPromise, timeoutPromise]);
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    let pool: Pool | null = null;
    try {
      const poolConfig: PoolOptions = {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl
          ? {
              rejectUnauthorized: false,
            }
          : undefined,
        connectionLimit: 1,
        waitForConnections: true,
        connectTimeout: 5000,
      };

      pool = mysql.createPool(poolConfig);
      const [rows] = await Promise.race([
        pool.query<RowDataPacket[]>('SELECT 1 as test'),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        }),
      ]);

      if (rows.length === 1 && rows[0].test === 1) {
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
