export type DatabaseType = 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'clickhouse';

export const DATABASE_TYPE_LABELS: Record<DatabaseType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  oracle: 'Oracle',
  sqlserver: 'SQL Server',
  clickhouse: 'ClickHouse',
};

export const DATABASE_DEFAULT_PORTS: Record<DatabaseType, number> = {
  postgresql: 5432,
  mysql: 3306,
  oracle: 1521,
  sqlserver: 1433,
  clickhouse: 8123,
};

export type DatabaseNodePayload = {
  connectionName: string;
  dbType: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string; // Only used while editing; not persisted in payload
  ssl: boolean;
  connectionId?: string; // ID of server-side connection record
  secretId?: string; // Secret ID holding the password
  status?: 'idle' | 'connected' | 'error';
  lastTestedAt?: string; // ISO timestamp
};
