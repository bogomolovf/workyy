import * as duckdb from '@duckdb/duckdb-wasm';
import type { Table } from 'apache-arrow';
import { tableToIPC } from 'apache-arrow/ipc/serialization';
import type { SqlResult } from '../state/executionStore';

type DuckDbContext = {
  db: duckdb.AsyncDuckDB;
  connection: duckdb.AsyncDuckDBConnection;
};

let contextPromise: Promise<DuckDbContext> | null = null;
let testContextOverride: DuckDbContext | null = null;
let demoBoardIdOverride: string | null = null;

const DEMO_TABLE_NAME = 'demo_data';
const SAMPLE_ROWS = [
  { id: 1, region: 'North', revenue: 120.5, year: 2023 },
  { id: 2, region: 'North', revenue: 132.8, year: 2024 },
  { id: 3, region: 'West', revenue: 98.1, year: 2023 },
  { id: 4, region: 'West', revenue: 110.3, year: 2024 },
  { id: 5, region: 'South', revenue: 87.9, year: 2023 },
  { id: 6, region: 'South', revenue: 99.6, year: 2024 },
];

const envDemoBoardId =
  typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_DEMO_BOARD_ID ?? null) : null;
let cachedDemoBoardId = envDemoBoardId;

async function bootstrapDuckDb(): Promise<DuckDbContext> {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker) {
    throw new Error('DuckDB bundle does not provide a worker URL');
  }

  const response = await fetch(bundle.mainWorker);
  if (!response.ok) {
    throw new Error(`Failed to fetch DuckDB worker from ${bundle.mainWorker}`);
  }
  const blob = await response.blob();
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);

  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  const connection = await db.connect();

  return { db, connection };
}

export function __setDuckDbContextTestOverride(context: DuckDbContext | null) {
  testContextOverride = context;
  if (!context) {
    contextPromise = null;
  }
}

async function ensureContext(): Promise<DuckDbContext> {
  if (testContextOverride) {
    return testContextOverride;
  }
  if (!contextPromise) {
    contextPromise = bootstrapDuckDb();
  }
  return contextPromise;
}

export async function getDuckDbContext(): Promise<DuckDbContext> {
  return ensureContext();
}

export function __setDemoBoardIdForTests(boardId: string | null) {
  demoBoardIdOverride = boardId;
}

function getDemoBoardId(): string | null {
  if (demoBoardIdOverride !== null) return demoBoardIdOverride;
  return cachedDemoBoardId;
}

function normalizeCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? Number(value.toString()) : asNumber;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

function tableToSqlResult(table: Table): SqlResult {
  const columns = table.schema.fields.map((field) => field.name);
  const rows: SqlResult['rows'] = [];
  const iterable = table.toArray() as Array<Record<string, unknown>>;
  for (const record of iterable) {
    rows.push(columns.map((column) => normalizeCell((record as Record<string, unknown>)[column])));
  }
  const arrow = tableToIPC(table);
  return { columns, rows, arrow };
}

function sanitizeIdentifier(identifier: string) {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '_');
}

function quotedIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function inferTableName(file: File, fallback: string) {
  const base = file.name.split('.')[0] || fallback;
  return sanitizeIdentifier(base.toLowerCase());
}

function inferFormat(file: File) {
  if (file.name.endsWith('.parquet')) {
    return 'parquet' as const;
  }
  return 'csv' as const;
}

export async function executeSql(query: string): Promise<SqlResult> {
  const { connection } = await getDuckDbContext();
  const table = await connection.query(query);
  return tableToSqlResult(table);
}

export type DuckDbLoadOptions = {
  tableName?: string;
  format?: 'auto' | 'csv' | 'parquet';
  boardId?: string;
  persist?: boolean;
};

type PersistedDataset = {
  tableName: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

const DATASET_KEY_PREFIX = 'workyy_board_datasets_v2:';

function getDatasetsKey(boardId: string) {
  return `${DATASET_KEY_PREFIX}${boardId}`;
}

function saveDatasetMeta(boardId: string | undefined, dataset: PersistedDataset) {
  if (typeof window === 'undefined' || !boardId) return;
  try {
    const key = getDatasetsKey(boardId);
    const existing: PersistedDataset[] = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    const filtered = existing.filter((item) => item.tableName !== dataset.tableName);
    filtered.push(dataset);
    window.localStorage.setItem(key, JSON.stringify(filtered));
  } catch {
    // ignore persistence errors
  }
}

export async function loadFileIntoDuckDb(
  file: File,
  options?: DuckDbLoadOptions,
): Promise<{ tableName: string; rows: number }> {
  const { db, connection } = await getDuckDbContext();
  const inferredFormat =
    options?.format && options.format !== 'auto' ? options.format : inferFormat(file);
  const tableName = sanitizeIdentifier(options?.tableName ?? inferTableName(file, 'dataset'));
  const virtualPath = `uploads/${Date.now()}-${tableName}.${inferredFormat === 'parquet' ? 'parquet' : 'csv'}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  await db.registerFileBuffer(virtualPath, buffer);

  const sourceExpression =
    inferredFormat === 'parquet'
      ? `read_parquet('${virtualPath}')`
      : `read_csv_auto('${virtualPath}', AUTO_DETECT=TRUE, SAMPLE_SIZE=20000)`;

  await connection.query(`
    CREATE OR REPLACE TABLE ${quotedIdentifier(tableName)} AS SELECT * FROM ${sourceExpression};
  `);

  const stats = await connection.query(
    `SELECT count(*) as row_count FROM ${quotedIdentifier(tableName)}`,
  );
  const result = tableToSqlResult(stats);
  const rowCount = Number(result.rows[0]?.[0] ?? 0);

  if (options?.persist && options.boardId) {
    // сохраняем полный снепшот таблицы (как текстовые значения),
    // чтобы можно было восстановить её после перезагрузки без доступа к исходному файлу
    const fullTable = await connection.query(`SELECT * FROM ${quotedIdentifier(tableName)}`);
    const snapshot = tableToSqlResult(fullTable);
    const dataset: PersistedDataset = {
      tableName,
      columns: snapshot.columns,
      rows: snapshot.rows,
    };
    saveDatasetMeta(options.boardId, dataset);
  }

  return { tableName, rows: rowCount };
}

export async function listTables(
  connectionOverride?: duckdb.AsyncDuckDBConnection,
): Promise<string[]> {
  const connection = connectionOverride ?? (await getDuckDbContext()).connection;
  const result = await connection.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main'
    ORDER BY table_name
  `);
  const rows = result.toArray() as Array<{ table_name: string }>;
  return rows.map((row) => String(row.table_name));
}

export async function resetUserTables(
  connectionOverride?: duckdb.AsyncDuckDBConnection,
): Promise<void> {
  const connection = connectionOverride ?? (await getDuckDbContext()).connection;
  const tableNames = await listTables(connection);
  for (const name of tableNames) {
    await connection.query(`DROP TABLE IF EXISTS ${quotedIdentifier(name)};`);
  }
}

async function ensureDemoDatasetForBoard(
  boardId: string,
  connection: duckdb.AsyncDuckDBConnection,
): Promise<void> {
  const demoBoardId = getDemoBoardId();
  if (!demoBoardId || boardId !== demoBoardId) return;
  const hasTableResult = await connection.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main' AND table_name = '${DEMO_TABLE_NAME}'
  `);
  if (hasTableResult.toArray().length > 0) {
    return;
  }
  const insertValues = SAMPLE_ROWS.map(
    (row) => `(${row.id}, '${row.region}', ${row.revenue}, ${row.year})`,
  ).join(',\n      ');
  await connection.query(`
    CREATE TABLE ${quotedIdentifier(DEMO_TABLE_NAME)} (
      id INTEGER,
      region VARCHAR,
      revenue DOUBLE,
      year INTEGER
    );
    INSERT INTO ${quotedIdentifier(DEMO_TABLE_NAME)} VALUES
    ${insertValues};
  `);
}

/**
 * Normalize column name for SQL compatibility:
 * - Replace spaces and special chars with underscores
 * - Convert to lowercase
 * - Remove leading/trailing underscores
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '_') // Replace special chars with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Register data from a CSV node directly into DuckDB as a table.
 * This allows SQL nodes to query the data using `SELECT * FROM tablename`.
 */
export async function registerDatasetFromCsvNode(
  filename: string,
  data: SqlResult,
  boardId?: string,
): Promise<{ tableName: string; rows: number; normalizedColumns: string[] }> {
  const { connection } = await getDuckDbContext();

  // Create table name from filename (without extension)
  const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  const tableName = sanitizeIdentifier(baseName.toLowerCase());

  // Normalize column names for SQL compatibility
  const normalizedColumns = data.columns.map(normalizeColumnName);

  // Handle duplicate column names after normalization
  const uniqueColumns: string[] = [];
  const columnCounts = new Map<string, number>();
  for (const col of normalizedColumns) {
    const count = columnCounts.get(col) || 0;
    if (count > 0) {
      uniqueColumns.push(`${col}_${count}`);
    } else {
      uniqueColumns.push(col);
    }
    columnCounts.set(col, count + 1);
  }

  // Drop existing table with same name
  await connection.query(`DROP TABLE IF EXISTS ${quotedIdentifier(tableName)};`);

  // Create table with appropriate column types
  const columnTypes = data.columns.map((col) => {
    // Sample first non-null value to infer type
    const sampleValue = data.rows.find((row) => {
      const idx = data.columns.indexOf(col);
      return row[idx] !== null && row[idx] !== undefined;
    })?.[data.columns.indexOf(col)];

    if (typeof sampleValue === 'number') {
      return Number.isInteger(sampleValue) ? 'BIGINT' : 'DOUBLE';
    }
    return 'TEXT';
  });

  const columnsDef = uniqueColumns
    .map((col, idx) => `${quotedIdentifier(col)} ${columnTypes[idx]}`)
    .join(', ');

  await connection.query(
    `CREATE TABLE ${quotedIdentifier(tableName)} (${columnsDef});`,
  );

  // Insert data in batches to avoid query size limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < data.rows.length; i += BATCH_SIZE) {
    const batch = data.rows.slice(i, i + BATCH_SIZE);
    const rowsSql = batch
      .map((row) => {
        const values = row
          .map((value, idx) => {
            if (value === null || value === undefined) return 'NULL';
            if (columnTypes[idx] === 'BIGINT' || columnTypes[idx] === 'DOUBLE') {
              return String(value);
            }
            const text = String(value).replace(/'/g, "''");
            return `'${text}'`;
          })
          .join(', ');
        return `(${values})`;
      })
      .join(', ');

    if (batch.length > 0) {
      await connection.query(
        `INSERT INTO ${quotedIdentifier(tableName)} VALUES ${rowsSql};`,
      );
    }
  }

  // Persist to localStorage for restore on page reload (with normalized columns)
  if (boardId) {
    const dataset: PersistedDataset = {
      tableName,
      columns: uniqueColumns,
      rows: data.rows,
    };
    saveDatasetMeta(boardId, dataset);
  }

  return { tableName, rows: data.rows.length, normalizedColumns: uniqueColumns };
}

/**
 * Remove a dataset from DuckDB when CSV node is deleted
 */
export async function unregisterDataset(tableName: string, boardId?: string): Promise<void> {
  try {
    const { connection } = await getDuckDbContext();
    await connection.query(`DROP TABLE IF EXISTS ${quotedIdentifier(tableName)};`);

    // Also remove from localStorage
    if (boardId && typeof window !== 'undefined') {
      const key = getDatasetsKey(boardId);
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const datasets: PersistedDataset[] = JSON.parse(raw);
        const filtered = datasets.filter((d) => d.tableName !== tableName);
        window.localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  } catch {
    // ignore errors
  }
}

export async function restoreDatasetsForBoard(boardId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { connection } = await getDuckDbContext();
    await resetUserTables(connection);
    await ensureDemoDatasetForBoard(boardId, connection);
    const key = getDatasetsKey(boardId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const datasets: PersistedDataset[] = JSON.parse(raw);
    if (!datasets.length) return;
    for (const dataset of datasets) {
      const columnsDef = dataset.columns
        .map((column) => `${quotedIdentifier(column)} TEXT`)
        .join(', ');
      await connection.query(`DROP TABLE IF EXISTS ${quotedIdentifier(dataset.tableName)};`);
      await connection.query(
        `CREATE TABLE ${quotedIdentifier(dataset.tableName)} (${columnsDef});`,
      );
      if (dataset.rows.length) {
        const rowsSql = dataset.rows
          .map((row) => {
            const values = row
              .map((value) => {
                if (value === null || value === undefined) return 'NULL';
                const text = String(value).replace(/'/g, "''");
                return `'${text}'`;
              })
              .join(', ');
            return `(${values})`;
          })
          .join(', ');
        await connection.query(
          `INSERT INTO ${quotedIdentifier(dataset.tableName)} VALUES ${rowsSql};`,
        );
      }
    }
  } catch {
    // if restore fails, we just start with an empty DuckDB context
  }
}
