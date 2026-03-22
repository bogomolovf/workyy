// file: apps/web/src/components/InteractiveResultTable.tsx
'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import {
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import type { SqlResult } from '../state/executionStore';

// Constants for virtualization
const ROW_HEIGHT = 32;
const OVERSCAN_COUNT = 5;
const COLUMN_MIN_WIDTH = 100;

// Optimized cell renderer - avoids creating new elements when possible
const CellValue = memo(function CellValue({ value }: { value: string | number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 text-xs">NULL</span>;
  }
  if (typeof value === 'number') {
    return <>{value.toLocaleString()}</>;
  }
  return <>{String(value)}</>;
});

// Optimized header cell with sorting
const HeaderCell = memo(function HeaderCell({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: string;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
  onSort: (column: string) => void;
}) {
  const isSorted = sortColumn === column;
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
      onClick={() => onSort(column)}
    >
      <span className="truncate">{column}</span>
      <span className="text-[10px] font-medium text-slate-400 flex-shrink-0">
        {isSorted && sortDirection === 'asc' && '▲'}
        {isSorted && sortDirection === 'desc' && '▼'}
      </span>
    </button>
  );
});

export type InteractiveResultTableProps = {
  result: SqlResult;
  compact?: boolean;
  totalCount?: number;
  isPreview?: boolean;
  onLoadAll?: () => void;
  maxHeight?: number;
};

function InteractiveResultTableInner({
  result,
  compact,
  totalCount,
  isPreview,
  onLoadAll,
  maxHeight,
}: InteractiveResultTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Use deferred value for heavy computations - allows UI to remain responsive
  const deferredRows = useDeferredValue(result.rows);
  const deferredColumns = useDeferredValue(result.columns);

  // Memoize column count for grid template
  const columnCount = deferredColumns.length;
  const gridTemplateColumns = useMemo(
    () => `repeat(${columnCount}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`,
    [columnCount],
  );

  // Optimized sorting - only sort when needed, use native sort for speed
  const sortedRowIndices = useMemo(() => {
    const indices = Array.from({ length: deferredRows.length }, (_, i) => i);

    if (!sortColumn || !sortDirection) {
      return indices;
    }

    const colIndex = deferredColumns.indexOf(sortColumn);
    if (colIndex === -1) return indices;

    // Sort indices based on values - avoids creating new row objects
    indices.sort((a, b) => {
      const valA = deferredRows[a][colIndex];
      const valB = deferredRows[b][colIndex];

      // Handle nulls
      if (valA === null && valB === null) return 0;
      if (valA === null) return sortDirection === 'asc' ? -1 : 1;
      if (valB === null) return sortDirection === 'asc' ? 1 : -1;

      // Compare values
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA);
      const strB = String(valB);
      const cmp = strA.localeCompare(strB);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return indices;
  }, [deferredRows, deferredColumns, sortColumn, sortDirection]);

  // Handle sort click with transition for smooth UI
  const handleSort = useCallback(
    (column: string) => {
      startTransition(() => {
        if (sortColumn === column) {
          if (sortDirection === 'asc') {
            setSortDirection('desc');
          } else if (sortDirection === 'desc') {
            setSortColumn(null);
            setSortDirection(null);
          }
        } else {
          setSortColumn(column);
          setSortDirection('asc');
        }
      });
    },
    [sortColumn, sortDirection],
  );

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: sortedRowIndices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Container height - use maxHeight if provided, otherwise use default based on compact
  const containerHeight = maxHeight ?? (compact ? 224 : 320);

  // Format large numbers
  const formatCount = useCallback((count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  }, []);

  const rowCount = deferredRows.length;
  const displayTotal = totalCount ?? rowCount;

  const heightStyle = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined;

  return (
    <div className="flex flex-col gap-2">
      {/* Row count indicator */}
      {rowCount > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-2">
            {isPreview ? (
              <>
                Showing {formatCount(rowCount)} of {formatCount(displayTotal)} rows
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  Preview
                </span>
              </>
            ) : (
              <>{formatCount(rowCount)} rows</>
            )}
            {isPending && <span className="text-slate-400">(sorting...)</span>}
          </span>
          {isPreview && onLoadAll && (
            <button
              type="button"
              onClick={onLoadAll}
              className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Load all
            </button>
          )}
        </div>
      )}

      {/* Table container */}
      <div
        ref={parentRef}
        className="overflow-auto rounded-lg border border-slate-200 bg-white"
        style={{
          maxHeight: containerHeight,
        }}
      >
        {/* Header - sticky */}
        <div
          className="grid bg-slate-50 sticky top-0 z-10 border-b border-slate-200"
          style={{
            gridTemplateColumns,
            willChange: 'transform', // GPU hint
          }}
        >
          {deferredColumns.map((column) => (
            <div key={column} className="px-3 py-2 min-w-0">
              <HeaderCell
                column={column}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            </div>
          ))}
        </div>

        {/* Virtual rows container */}
        <div
          style={{
            height: totalSize,
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const rowIndex = sortedRowIndices[virtualRow.index];
            const row = deferredRows[rowIndex];
            const isEven = virtualRow.index % 2 === 0;

            // Guard against undefined row (can happen with deferred values)
            if (!row) return null;

            return (
              <div
                key={virtualRow.index}
                className={isEven ? 'bg-white' : 'bg-slate-50/50'}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns,
                }}
              >
                {row.map((cellValue, colIndex) => (
                  <div
                    key={colIndex}
                    className="px-3 py-2 text-sm text-slate-700 truncate overflow-hidden"
                    style={{ minWidth: 0 }}
                  >
                    <CellValue value={cellValue} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {rowCount === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-500">No rows returned.</div>
        )}
      </div>
    </div>
  );
}

// Memoize with custom comparator for better performance
export const InteractiveResultTable = memo(InteractiveResultTableInner, (prev, next) => {
  // Only re-render if these specific props change
  return (
    prev.result === next.result &&
    prev.compact === next.compact &&
    prev.totalCount === next.totalCount &&
    prev.isPreview === next.isPreview &&
    prev.onLoadAll === next.onLoadAll &&
    prev.maxHeight === next.maxHeight
  );
});
