import type { SqlResult } from '../../state/executionStore';

/**
 * Create bins for histogram
 */
export function createBins(
  values: number[],
  binCount: number = 20,
): Array<{ start: number; end: number; count: number }> {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;

  const bins: Array<{ start: number; end: number; count: number }> = [];
  for (let i = 0; i < binCount; i++) {
    bins.push({
      start: min + i * binWidth,
      end: min + (i + 1) * binWidth,
      count: 0,
    });
  }

  // Count values in each bin
  for (const value of values) {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
    bins[binIndex].count++;
  }

  return bins;
}

/**
 * Calculate boxplot statistics (min, Q1, median, Q3, max)
 */
export function calculateBoxplotStats(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
} {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const min = sorted[0];
  const max = sorted[n - 1];

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const q1Index = Math.floor(n * 0.25);
  const q1 = n % 4 === 0 ? (sorted[q1Index - 1] + sorted[q1Index]) / 2 : sorted[q1Index];

  const q3Index = Math.floor(n * 0.75);
  const q3 = n % 4 === 0 ? (sorted[q3Index - 1] + sorted[q3Index]) / 2 : sorted[q3Index];

  return { min, q1, median, q3, max };
}

/**
 * Group data by facet column and return partitioned datasets
 */
export function partitionByFacet(data: SqlResult, facetColumn: string): Map<string, SqlResult> {
  const facetIndex = data.columns.indexOf(facetColumn);
  if (facetIndex < 0) {
    return new Map();
  }

  const partitions = new Map<string, SqlResult['rows']>();

  for (const row of data.rows) {
    const facetValue = String(row[facetIndex] ?? '');
    if (!partitions.has(facetValue)) {
      partitions.set(facetValue, []);
    }
    partitions.get(facetValue)!.push(row);
  }

  const result = new Map<string, SqlResult>();
  for (const [facetValue, rows] of partitions.entries()) {
    result.set(facetValue, {
      columns: data.columns,
      rows,
    });
  }

  return result;
}

/**
 * Calculate optimal grid layout for faceting
 */
export function calculateFacetGrid(facetCount: number): {
  rows: number;
  cols: number;
} {
  if (facetCount <= 0) return { rows: 1, cols: 1 };
  if (facetCount === 1) return { rows: 1, cols: 1 };
  if (facetCount <= 3) return { rows: 1, cols: facetCount };
  if (facetCount <= 6) return { rows: 2, cols: 3 };
  if (facetCount <= 9) return { rows: 3, cols: 3 };
  if (facetCount <= 12) return { rows: 3, cols: 4 };
  // Default: try to make it roughly square
  const cols = Math.ceil(Math.sqrt(facetCount));
  const rows = Math.ceil(facetCount / cols);
  return { rows, cols };
}
