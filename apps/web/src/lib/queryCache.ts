/**
 * Query Cache using IndexedDB (via Dexie)
 *
 * Caches SQL query results for faster repeated access.
 * Uses TTL-based expiration and LRU eviction.
 */

import Dexie, { type Table } from 'dexie';
import type { SqlResult } from '../state/executionStore';

/** Default time-to-live for cached results (5 minutes) */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Maximum number of cached queries per board */
export const MAX_CACHED_QUERIES = 50;

/** Maximum size of a single cached result (10MB of JSON) */
export const MAX_CACHE_ENTRY_SIZE = 10 * 1024 * 1024;

/** Cached query result entry */
export interface CachedQueryResult {
  /** SHA-256 hash of the query */
  queryHash: string;
  /** Board ID for this cache entry */
  boardId: string;
  /** Original query text */
  query: string;
  /** Column names */
  columns: string[];
  /** Row data */
  rows: SqlResult['rows'];
  /** Total count (may be larger than rows.length for preview results) */
  totalCount: number;
  /** Whether this is a preview result */
  isPreview: boolean;
  /** Timestamp when cached */
  createdAt: number;
  /** Timestamp when cache expires */
  expiresAt: number;
  /** Last accessed timestamp (for LRU) */
  lastAccessedAt: number;
  /** Size estimate in bytes */
  sizeBytes: number;
}

/** Cache statistics */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
}

// In-memory stats (reset on page reload)
let cacheStats: CacheStats = {
  totalEntries: 0,
  totalSizeBytes: 0,
  hitCount: 0,
  missCount: 0,
  evictionCount: 0,
};

/**
 * Dexie database for query cache
 */
class QueryCacheDB extends Dexie {
  queryResults!: Table<CachedQueryResult>;

  constructor() {
    super('WorkyyQueryCache');
    this.version(1).stores({
      queryResults: 'queryHash, boardId, expiresAt, lastAccessedAt',
    });
  }
}

// Singleton database instance
let db: QueryCacheDB | null = null;

/**
 * Get the database instance (lazy initialization)
 */
function getDb(): QueryCacheDB {
  if (!db) {
    db = new QueryCacheDB();
  }
  return db;
}

/**
 * Generate a SHA-256 hash of the query text.
 * Uses Web Crypto API for consistent hashing.
 */
async function hashQuery(query: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(query.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Estimate the size of a result in bytes.
 */
function estimateSize(result: { columns: string[]; rows: SqlResult['rows'] }): number {
  // Rough estimate: JSON string length as bytes
  try {
    return JSON.stringify(result).length;
  } catch {
    // If stringify fails (e.g., circular reference), return max size
    return MAX_CACHE_ENTRY_SIZE + 1;
  }
}

/**
 * Get a cached query result.
 * Returns null if not cached or expired.
 */
export async function getCachedResult(
  query: string,
  boardId: string,
): Promise<(SqlResult & { totalCount: number; isPreview: boolean }) | null> {
  try {
    const queryHash = await hashQuery(query);
    const database = getDb();
    const cached = await database.queryResults.get(queryHash);

    if (!cached) {
      cacheStats.missCount++;
      return null;
    }

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      // Delete expired entry
      await database.queryResults.delete(queryHash);
      cacheStats.missCount++;
      return null;
    }

    // Check board ID matches
    if (cached.boardId !== boardId) {
      cacheStats.missCount++;
      return null;
    }

    // Update last accessed time
    await database.queryResults.update(queryHash, {
      lastAccessedAt: Date.now(),
    });

    cacheStats.hitCount++;

    return {
      columns: cached.columns,
      rows: cached.rows,
      totalCount: cached.totalCount,
      isPreview: cached.isPreview,
    };
  } catch (error) {
    console.error('Query cache get error:', error);
    cacheStats.missCount++;
    return null;
  }
}

/**
 * Store a query result in the cache.
 */
export async function setCachedResult(
  query: string,
  boardId: string,
  result: SqlResult & { totalCount?: number; isPreview?: boolean },
  options?: { ttlMs?: number },
): Promise<void> {
  try {
    const queryHash = await hashQuery(query);
    const database = getDb();

    // Estimate size
    const sizeBytes = estimateSize(result);

    // Skip if too large
    if (sizeBytes > MAX_CACHE_ENTRY_SIZE) {
      console.warn(`Query result too large to cache (${sizeBytes} bytes)`);
      return;
    }

    const now = Date.now();
    const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;

    const entry: CachedQueryResult = {
      queryHash,
      boardId,
      query: query.trim(),
      columns: result.columns,
      rows: result.rows,
      totalCount: result.totalCount ?? result.rows.length,
      isPreview: result.isPreview ?? false,
      createdAt: now,
      expiresAt: now + ttlMs,
      lastAccessedAt: now,
      sizeBytes,
    };

    // Store in database
    await database.queryResults.put(entry);

    // Run eviction if needed
    await evictIfNeeded(boardId);

    // Update stats
    cacheStats.totalEntries++;
    cacheStats.totalSizeBytes += sizeBytes;
  } catch (error) {
    console.error('Query cache set error:', error);
  }
}

/**
 * Invalidate (delete) a cached query result.
 */
export async function invalidateCachedResult(query: string): Promise<void> {
  try {
    const queryHash = await hashQuery(query);
    const database = getDb();
    await database.queryResults.delete(queryHash);
  } catch (error) {
    console.error('Query cache invalidate error:', error);
  }
}

/**
 * Invalidate all cached results for a board.
 * Useful when data sources change (e.g., CSV upload).
 */
export async function invalidateBoardCache(boardId: string): Promise<void> {
  try {
    const database = getDb();
    await database.queryResults.where('boardId').equals(boardId).delete();
  } catch (error) {
    console.error('Query cache invalidate board error:', error);
  }
}

/**
 * Invalidate all cached results for queries referencing a specific table.
 */
export async function invalidateTableCache(boardId: string, tableName: string): Promise<void> {
  try {
    const database = getDb();
    const entries = await database.queryResults.where('boardId').equals(boardId).toArray();

    // Find entries that reference the table
    const toDelete: string[] = [];
    const tablePattern = new RegExp(`\\b${tableName}\\b`, 'i');

    for (const entry of entries) {
      if (tablePattern.test(entry.query)) {
        toDelete.push(entry.queryHash);
      }
    }

    // Delete matching entries
    if (toDelete.length > 0) {
      await database.queryResults.bulkDelete(toDelete);
    }
  } catch (error) {
    console.error('Query cache invalidate table error:', error);
  }
}

/**
 * Evict old entries if cache is too large.
 * Uses LRU (least recently used) strategy.
 */
async function evictIfNeeded(boardId: string): Promise<void> {
  try {
    const database = getDb();
    const entries = await database.queryResults.where('boardId').equals(boardId).toArray();

    if (entries.length <= MAX_CACHED_QUERIES) {
      return;
    }

    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    // Evict oldest entries until under limit
    const toEvict = entries.slice(0, entries.length - MAX_CACHED_QUERIES);
    const toEvictHashes = toEvict.map((e) => e.queryHash);

    await database.queryResults.bulkDelete(toEvictHashes);
    cacheStats.evictionCount += toEvict.length;
  } catch (error) {
    console.error('Query cache eviction error:', error);
  }
}

/**
 * Clean up expired entries.
 * Call this periodically or on app startup.
 */
export async function cleanExpiredEntries(): Promise<number> {
  try {
    const database = getDb();
    const now = Date.now();

    // Find and delete expired entries
    const deleted = await database.queryResults.where('expiresAt').below(now).delete();

    return deleted;
  } catch (error) {
    console.error('Query cache cleanup error:', error);
    return 0;
  }
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): CacheStats {
  return { ...cacheStats };
}

/**
 * Reset cache statistics.
 */
export function resetCacheStats(): void {
  cacheStats = {
    totalEntries: 0,
    totalSizeBytes: 0,
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
  };
}

/**
 * Clear entire cache.
 */
export async function clearCache(): Promise<void> {
  try {
    const database = getDb();
    await database.queryResults.clear();
    resetCacheStats();
  } catch (error) {
    console.error('Query cache clear error:', error);
  }
}

/**
 * Get cache entry count for a board.
 */
export async function getCacheEntryCount(boardId: string): Promise<number> {
  try {
    const database = getDb();
    return await database.queryResults.where('boardId').equals(boardId).count();
  } catch (error) {
    console.error('Query cache count error:', error);
    return 0;
  }
}

/**
 * Check if a query is cached and not expired.
 */
export async function isCached(query: string, boardId: string): Promise<boolean> {
  try {
    const queryHash = await hashQuery(query);
    const database = getDb();
    const cached = await database.queryResults.get(queryHash);

    if (!cached) return false;
    if (cached.boardId !== boardId) return false;
    if (cached.expiresAt < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

// Auto-cleanup on module load (non-blocking)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    void cleanExpiredEntries();
  }, 5000);
}
