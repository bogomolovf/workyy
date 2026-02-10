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

/** Max rows to use for chart display (keeps browser responsive) */
export const PLOT_DISPLAY_SAMPLE_THRESHOLD = 5000;
/** Target count after downsampling */
export const PLOT_DISPLAY_SAMPLE_MAX = 5000;
/** Max categories for bar charts (avoid overload) */
export const PLOT_DISPLAY_BAR_CATEGORIES_MAX = 2000;

/**
 * LTTB (Largest-Triangle-Three-Buckets) downsampling for line/area charts.
 * Preserves visual shape while reducing point count. Uses index as x for ordering.
 * Returns indices of rows to keep.
 */
export function downsampleLTTBIndices(
  rowCount: number,
  getY: (rowIndex: number) => number,
  targetCount: number,
): number[] {
  if (rowCount <= targetCount || targetCount < 3) {
    return Array.from({ length: rowCount }, (_, i) => i);
  }

  const indices: number[] = [];
  const bucketSize = (rowCount - 2) / (targetCount - 2);

  indices.push(0);

  for (let i = 0; i < targetCount - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize);
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize), rowCount);
    const nextBucketAvgIndex = Math.min(
      Math.floor((i + 2) * bucketSize) + Math.floor(bucketSize / 2),
      rowCount - 1,
    );
    const prevIndex = indices[indices.length - 1];
    const prevY = getY(prevIndex);
    const nextAvgY = getY(nextBucketAvgIndex);

    let maxArea = -1;
    let maxIndex = bucketStart;

    for (let j = bucketStart; j < bucketEnd; j++) {
      const currY = getY(j);
      const area =
        Math.abs(
          (prevIndex - nextBucketAvgIndex) * (currY - prevY) -
            (prevIndex - j) * (nextAvgY - prevY),
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    indices.push(maxIndex);
  }

  indices.push(rowCount - 1);
  return indices;
}

/**
 * Uniform sampling: take every Nth row to reach ~targetCount.
 * Good for scatter when order doesn't matter.
 */
export function sampleRowsUniform<T>(rows: T[], targetCount: number): T[] {
  if (rows.length <= targetCount) return rows;
  const step = rows.length / targetCount;
  const result: T[] = [];
  for (let i = 0; i < targetCount; i++) {
    const index = Math.min(Math.floor(i * step), rows.length - 1);
    result.push(rows[index]);
  }
  return result;
}

/**
 * Sample rows for display to avoid overloading the browser.
 * Line/area: LTTB by first Y field. Scatter: uniform. Bar: cap categories.
 */
export function sampleRowsForDisplay(
  data: SqlResult,
  chartType: string,
  _xIndex: number,
  yIndices: number[],
  options: {
    displayThreshold?: number;
    displayMax?: number;
    barCategoriesMax?: number;
  } = {},
): { data: SqlResult; totalRows: number; sampled: boolean } {
  const {
    displayThreshold = PLOT_DISPLAY_SAMPLE_THRESHOLD,
    displayMax = PLOT_DISPLAY_SAMPLE_MAX,
    barCategoriesMax = PLOT_DISPLAY_BAR_CATEGORIES_MAX,
  } = options;

  const totalRows = data.rows.length;
  if (totalRows <= displayThreshold) {
    return { data, totalRows, sampled: false };
  }

  const lineLike = chartType === 'line' || chartType === 'area';
  const scatterLike = chartType === 'scatter';
  const barLike = chartType === 'bar' || chartType === 'bar-horizontal';

  if (lineLike && yIndices.length > 0) {
    const yIdx = yIndices[0];
    const getY = (i: number) => {
      const v = data.rows[i][yIdx];
      return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0;
    };
    const indices = downsampleLTTBIndices(totalRows, getY, displayMax);
    const rows = indices.map((i) => data.rows[i]);
    return {
      data: { columns: data.columns, rows },
      totalRows,
      sampled: true,
    };
  }

  if (scatterLike) {
    const rows = sampleRowsUniform(data.rows, displayMax);
    return {
      data: { columns: data.columns, rows },
      totalRows,
      sampled: true,
    };
  }

  if (barLike) {
    const rows = data.rows.slice(0, barCategoriesMax);
    return {
      data: { columns: data.columns, rows },
      totalRows,
      sampled: totalRows > barCategoriesMax,
    };
  }

  // Default: uniform sampling for other types
  const rows = sampleRowsUniform(data.rows, displayMax);
  return {
    data: { columns: data.columns, rows },
    totalRows,
    sampled: true,
  };
}
