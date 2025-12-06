import type { SqlResult } from '../state/executionStore';

const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ?? 'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ?? 'http://localhost:4000');

export type ConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
};

export type DatabaseConnection = {
  id: string;
  connectionId: string;
  connectionName: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  status?: string;
  createdAt: string;
  updatedAt?: string;
};

export async function executePostgresSql(connectionId: string, query: string): Promise<SqlResult> {
  const res = await fetch(`${API_URL}/api/database-connections/${connectionId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || 'PostgreSQL query failed');
  }

  const data = await res.json();
  return {
    columns: data.columns,
    rows: data.rows,
  };
}

export async function testDatabaseConnection(
  config: ConnectionConfig,
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_URL}/api/database-connections/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    return {
      success: false,
      message: error.detail || error.message || 'Connection test failed',
    };
  }

  return res.json();
}

export async function createDatabaseConnection(body: {
  workspaceId: string;
  connectionName: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}): Promise<{ id: string; connectionId: string; secretId: string }> {
  const res = await fetch(`${API_URL}/api/database-connections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || 'Failed to create database connection');
  }

  return res.json();
}

export async function updateDatabaseConnection(
  id: string,
  body: Partial<{
    connectionName: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  }>,
): Promise<DatabaseConnection> {
  const res = await fetch(`${API_URL}/api/database-connections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || 'Failed to update database connection');
  }

  return res.json();
}

export async function getDatabaseConnection(id: string): Promise<DatabaseConnection> {
  const res = await fetch(`${API_URL}/api/database-connections/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || 'Failed to get database connection');
  }

  return res.json();
}
