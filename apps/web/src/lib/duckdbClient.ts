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

/** Default number of rows to show in preview mode */
export const DEFAULT_PREVIEW_LIMIT = 10000;

/** Result type for preview-aware SQL execution */
export type PreviewSqlResult = SqlResult & {
  /** Total number of rows in the full result set */
  totalCount: number;
  /** Whether this result is a preview (limited) subset */
  isPreview: boolean;
};

export type ExecuteSqlOptions = {
  /** Maximum rows to return in preview mode (default: 1000) */
  previewLimit?: number;
  /** If true, load all data for visualization (e.g. plot). Use with fullLoadMaxRows to avoid overload. */
  fullLoad?: boolean;
  /** When fullLoad is true, cap at this many rows so the browser stays responsive (e.g. 100_000). */
  fullLoadMaxRows?: number;
};

/**
 * Execute SQL with optional preview mode.
 * When preview mode is active (default), large result sets are automatically
 * limited to previewLimit rows, with totalCount indicating the full size.
 */
export async function executeSqlWithPreview(
  query: string,
  options?: ExecuteSqlOptions,
): Promise<PreviewSqlResult> {
  const { previewLimit = DEFAULT_PREVIEW_LIMIT, fullLoad = false, fullLoadMaxRows } = options ?? {};
  const { connection } = await getDuckDbContext();

  // Normalize query - remove trailing semicolons and whitespace
  const normalizedQuery = query.replace(/;\s*$/, '').trim();

  // Get total row count first
  // We wrap the query as a subquery to handle complex queries with ORDER BY, etc.
  const countQuery = `SELECT COUNT(*) as cnt FROM (${normalizedQuery}) AS _count_subquery`;
  let totalCount: number;
  try {
    const countResult = await connection.query(countQuery);
    const countRows = countResult.toArray() as Array<{ cnt: bigint | number }>;
    totalCount = Number(countRows[0]?.cnt ?? 0);
  } catch {
    // If count query fails (e.g., for DDL statements), execute normally
    const table = await connection.query(query);
    const result = tableToSqlResult(table);
    return {
      ...result,
      totalCount: result.rows.length,
      isPreview: false,
    };
  }

  // Full load for plot: cap at fullLoadMaxRows to keep browser responsive
  if (fullLoad) {
    const limit = fullLoadMaxRows && totalCount > fullLoadMaxRows ? fullLoadMaxRows : totalCount;
    const fullQuery = limit < totalCount ? `${normalizedQuery} LIMIT ${limit}` : normalizedQuery;
    const table = await connection.query(fullQuery);
    const result = tableToSqlResult(table);
    return {
      ...result,
      totalCount,
      isPreview: limit < totalCount,
    };
  }

  // If data fits within preview limit, return all
  if (totalCount <= previewLimit) {
    const table = await connection.query(query);
    const result = tableToSqlResult(table);
    return {
      ...result,
      totalCount,
      isPreview: false,
    };
  }

  // Apply preview limit
  const previewQuery = `${normalizedQuery} LIMIT ${previewLimit}`;
  const table = await connection.query(previewQuery);
  const result = tableToSqlResult(table);

  return {
    ...result,
    totalCount,
    isPreview: true,
  };
}

/**
 * Execute SQL with pagination support.
 * Used for loading specific pages of large result sets.
 */
export async function executeSqlPaginated(
  query: string,
  options: { pageSize: number; offset: number },
): Promise<SqlResult> {
  const { pageSize, offset } = options;
  const { connection } = await getDuckDbContext();

  // Normalize query - remove trailing semicolons
  const normalizedQuery = query.replace(/;\s*$/, '').trim();

  const paginatedQuery = `${normalizedQuery} LIMIT ${pageSize} OFFSET ${offset}`;
  const table = await connection.query(paginatedQuery);
  return tableToSqlResult(table);
}

/**
 * Get the total row count for a query without fetching data.
 */
export async function getSqlRowCount(query: string): Promise<number> {
  const { connection } = await getDuckDbContext();
  const normalizedQuery = query.replace(/;\s*$/, '').trim();
  const countQuery = `SELECT COUNT(*) as cnt FROM (${normalizedQuery}) AS _count_subquery`;
  const countResult = await connection.query(countQuery);
  const countRows = countResult.toArray() as Array<{ cnt: bigint | number }>;
  return Number(countRows[0]?.cnt ?? 0);
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

export function getDatasetsKey(boardId: string) {
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
    const fullTable = await connection.query(`SELECT * FROM ${quotedIdentifier(tableName)}`);
    const snapshot = tableToSqlResult(fullTable);
    const dataset: PersistedDataset = {
      tableName,
      columns: snapshot.columns,
      rows: snapshot.rows,
    };
    saveDatasetMeta(options.boardId, dataset);
  }

  // Invalidate query cache: queries referencing this table may now return different data
  if (options?.boardId) {
    void import('./queryCache').then(({ invalidateTableCache }) =>
      invalidateTableCache(options.boardId!, tableName),
    );
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

export async function deleteTable(
  tableName: string,
  boardId: string,
  connectionOverride?: duckdb.AsyncDuckDBConnection,
): Promise<void> {
  const connection = connectionOverride ?? (await getDuckDbContext()).connection;

  await connection.query(`DROP TABLE IF EXISTS ${quotedIdentifier(tableName)};`);

  if (typeof window !== 'undefined') {
    try {
      const key = getDatasetsKey(boardId);
      const existing: PersistedDataset[] = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      const filtered = existing.filter((item) => item.tableName !== tableName);
      window.localStorage.setItem(key, JSON.stringify(filtered));
    } catch {
      // ignore persistence errors
    }
  }

  void import('./queryCache').then(({ invalidateTableCache }) =>
    invalidateTableCache(boardId, tableName),
  );
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
export function normalizeColumnName(name: string): string {
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

  await connection.query(`CREATE TABLE ${quotedIdentifier(tableName)} (${columnsDef});`);

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
      await connection.query(`INSERT INTO ${quotedIdentifier(tableName)} VALUES ${rowsSql};`);
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
    // Notify plot hooks so they can refetch after restore (e.g. post-reload when observer ran later)
    if (typeof window !== 'undefined' && datasets.length > 0) {
      window.dispatchEvent(new CustomEvent('workyy:datasetsRestored', { detail: { boardId } }));
    }
  } catch {
    // if restore fails, we just start with an empty DuckDB context
  }
}

/** Same shape as PersistedDataset for restoring from in-memory Yjs data (avoids localStorage quota) */
export type DatasetForRestore = {
  tableName: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

/**
 * Restore DuckDB tables from an in-memory datasets array.
 * Used by the board observer when Yjs has synced datasets; ensures tables exist
 * even if localStorage.setItem fails (quota) so the plot can refetch after reload.
 */
export async function restoreDatasetsFromBoardArray(
  boardId: string,
  datasets: DatasetForRestore[],
): Promise<void> {
  if (typeof window === 'undefined' || !datasets.length) return;
  try {
    const { connection } = await getDuckDbContext();
    await resetUserTables(connection);
    await ensureDemoDatasetForBoard(boardId, connection);
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
    window.dispatchEvent(new CustomEvent('workyy:datasetsRestored', { detail: { boardId } }));
  } catch (err) {
    console.error('restoreDatasetsFromBoardArray failed', err);
  }
}

/**
 * Query paginated data from a DuckDB table.
 * Used for lazy loading large CSV datasets.
 */
export async function queryTablePaginated(
  tableName: string,
  offset: number,
  limit: number,
): Promise<SqlResult> {
  const { connection } = await getDuckDbContext();
  const query = `SELECT * FROM ${quotedIdentifier(tableName)} LIMIT ${limit} OFFSET ${offset};`;
  const result = await connection.query(query);

  // Convert Arrow table to SqlResult format
  const columns = result.schema.fields.map((f) => f.name);
  const rows: Array<Array<string | number | null>> = [];

  for (let i = 0; i < result.numRows; i++) {
    const row: Array<string | number | null> = [];
    for (let j = 0; j < columns.length; j++) {
      const col = result.getChildAt(j);
      const value = col?.get(i);
      if (value === null || value === undefined) {
        row.push(null);
      } else if (typeof value === 'bigint') {
        row.push(Number(value));
      } else {
        row.push(value);
      }
    }
    rows.push(row);
  }

  return { columns, rows };
}

/**
 * Get total row count for a DuckDB table.
 */
export async function getTableRowCount(tableName: string): Promise<number> {
  const { connection } = await getDuckDbContext();
  const query = `SELECT COUNT(*) as count FROM ${quotedIdentifier(tableName)};`;
  const result = await connection.query(query);

  const countCol = result.getChildAt(0);
  const count = countCol?.get(0);
  return typeof count === 'bigint' ? Number(count) : (count ?? 0);
}

/** Max rows to fetch for plot visualizations when using limited mode (optional cap) */
export const PLOT_DATA_MAX_ROWS = 100_000;

/**
 * Fetch a limited dataset from a DuckDB table for plot visualization.
 * Used when Plot node is connected to CSV and a row cap is desired.
 */
export async function queryTableForPlot(
  tableName: string,
  maxRows: number = PLOT_DATA_MAX_ROWS,
): Promise<SqlResult> {
  const { connection } = await getDuckDbContext();
  const query = `SELECT * FROM ${quotedIdentifier(tableName)} LIMIT ${maxRows};`;
  const table = await connection.query(query);
  return tableToSqlResult(table);
}

/**
 * Fetch the full table from DuckDB for plot visualization (no row limit).
 * Used when Plot is connected to CSV — chart is built from the full dataset volume.
 */
export async function queryTableFullForPlot(tableName: string): Promise<SqlResult> {
  const { connection } = await getDuckDbContext();
  const query = `SELECT * FROM ${quotedIdentifier(tableName)};`;
  const table = await connection.query(query);
  return tableToSqlResult(table);
}

/**
 * @deprecated Use queryTableFullForPlot for full table, or queryTableForPlot for limited.
 */
export async function queryTableFull(tableName: string): Promise<SqlResult> {
  return queryTableFullForPlot(tableName);
}
