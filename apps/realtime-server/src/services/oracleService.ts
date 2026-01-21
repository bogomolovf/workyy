import { PrismaClient } from '@prisma/client';
import oracledb, { Pool, Connection, Result } from 'oracledb';

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type OracleQueryResult = {
  rows: Record<string, unknown>[];
  metaData: oracledb.Metadata<unknown>[];
};

export class OracleService {
  private pools = new Map<string, Pool>();

  // Thin mode is used by default (no Oracle Client needed)
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

    // Build connect string in Easy Connect format: host:port/service_name
    const connectString = `${connection.host}:${connection.port}/${connection.database}`;

    const pool = await oracledb.createPool({
      user: connection.username,
      password: connection.secret.value,
      connectString,
      poolMin: 1,
      poolMax: 5,
      poolTimeout: 30,
      poolIncrement: 1,
      queueTimeout: 10000,
    });

    this.pools.set(connectionId, pool);

    return pool;
  }

  async executeQuery(
    connectionId: string,
    query: string,
    params?: unknown[],
  ): Promise<OracleQueryResult> {
    // Enforce SELECT-only for security
    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const pool = await this.getPool(connectionId);
    let conn: Connection | null = null;

    try {
      conn = await pool.getConnection();

      // Add timeout and row limit
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Query timeout after 30 seconds'));
        }, 30000);
      });

      const queryPromise = conn
        .execute<Record<string, unknown>>(query, params || [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          maxRows: 10000,
        })
        .then((result: Result<Record<string, unknown>>) => {
          const rows = result.rows || [];
          // Limit rows to 10,000 (should already be limited by maxRows, but double-check)
          const limitedRows = rows.length > 10000 ? rows.slice(0, 10000) : rows;
          return {
            rows: limitedRows,
            metaData: result.metaData || [],
          };
        });

      return await Promise.race([queryPromise, timeoutPromise]);
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    let conn: Connection | null = null;
    try {
      // Build connect string in Easy Connect format
      const connectString = `${config.host}:${config.port}/${config.database}`;

      conn = await oracledb.getConnection({
        user: config.username,
        password: config.password,
        connectString,
      });

      const result = await Promise.race([
        conn.execute<{ TEST: number }>('SELECT 1 as TEST FROM DUAL', [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        }),
      ]);

      if (result.rows && result.rows.length === 1 && result.rows[0].TEST === 1) {
        return { success: true };
      }
      return { success: false, message: 'Unexpected test result' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    } finally {
      if (conn) {
        try {
          await conn.close();
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
        await pool.close(0); // Force close with no drain time
      } catch {
        // Ignore close errors
      }
      this.pools.delete(connectionId);
    }
  }

  async closeAllPools(): Promise<void> {
    const promises = Array.from(this.pools.entries()).map(async ([id, pool]) => {
      try {
        await pool.close(0);
      } catch {
        // Ignore close errors
      }
      this.pools.delete(id);
    });
    await Promise.all(promises);
  }
}
