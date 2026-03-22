import type { SqlResult } from '../../state/executionStore';
import type { PlotConfig, AggregationType, ChartType } from './chartTypes';
import {
  createBins,
  calculateBoxplotStats,
  partitionByFacet,
  calculateFacetGrid,
  sampleRowsForDisplay,
} from './chartTransforms';
import { analyzeDataColumns } from './dataAnalyzer';

// Transformed data structure for chart rendering
type TransformedSeriesData = {
  xValues: unknown[];
  yValues: unknown[][];
  seriesNames: string[];
  colorValues?: unknown[];
  rawRows: Array<Record<string, unknown>>;
};

// ECharts option type - permissive to support all chart types including 3D, extensions, etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EChartsOption = Record<string, any>;

/** Find column index by name (case-insensitive) */
function findColumnIndex(columns: string[], field: string): number {
  if (!field) return -1;
  const lower = field.toLowerCase();
  const idx = columns.findIndex((c) => c.toLowerCase() === lower);
  return idx >= 0 ? idx : columns.indexOf(field);
}

/** Coerce a cell value to a number. Returns NaN if not convertible. */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return isFinite(n) ? n : NaN;
}

/** Coerce a cell value to number, defaulting to 0 if NaN */
function toNum0(v: unknown): number {
  const n = toNum(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Sort X-axis values smartly: numeric/temporal values get sorted numerically,
 * strings alphabetically. This prevents zigzag lines when data isn't pre-sorted.
 */
function sortXValues(values: string[]): string[] {
  // Check if most values look numeric/temporal (years, numbers)
  const numericCount = values.filter((v) => !isNaN(Number(v)) && v.trim() !== '').length;
  if (numericCount > values.length * 0.7) {
    // Sort numerically
    return [...values].sort((a, b) => Number(a) - Number(b));
  }
  // Check if values look like dates (ISO format, etc.)
  const dateCount = values.filter((v) => !isNaN(Date.parse(v)) && v.length > 4).length;
  if (dateCount > values.length * 0.5) {
    return [...values].sort((a, b) => Date.parse(a) - Date.parse(b));
  }
  // Keep original order for categorical data
  return values;
}

/**
 * Split data rows into multiple series grouped by a categorical "color" column.
 * Returns an array of { name, rows } where each entry is one series.
 */
function splitByColor(
  rows: SqlResult['rows'],
  colorIdx: number,
): { name: string; rows: SqlResult['rows'] }[] {
  if (colorIdx < 0) return [{ name: '', rows }];
  const map = new Map<string, SqlResult['rows']>();
  for (const row of rows) {
    const key = String(row[colorIdx] ?? '');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries()).map(([name, rows]) => ({ name, rows }));
}

type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

/**
 * Evaluate a single filter condition for a cell value.
 * Returns true if the row passes this filter.
 */
function passesFilter(cellValue: unknown, filterValue: unknown, operator: FilterOperator): boolean {
  switch (operator) {
    case 'eq':
      return String(cellValue ?? '') === String(filterValue ?? '');
    case 'ne':
      return String(cellValue ?? '') !== String(filterValue ?? '');
    case 'gt':
      return Number(cellValue) > Number(filterValue);
    case 'gte':
      return Number(cellValue) >= Number(filterValue);
    case 'lt':
      return Number(cellValue) < Number(filterValue);
    case 'lte':
      return Number(cellValue) <= Number(filterValue);
    case 'in': {
      const inArray = Array.isArray(filterValue) ? filterValue : [filterValue];
      return inArray.some((v) => String(cellValue ?? '') === String(v ?? ''));
    }
    case 'contains':
      return String(cellValue ?? '')
        .toLowerCase()
        .includes(String(filterValue ?? '').toLowerCase());
    default:
      return true;
  }
}

/**
 * Apply filters to data rows.
 * - Filters with empty value are skipped (not applied).
 * - Column lookup is case-insensitive so "continent" matches "CONTINENT".
 * - Multiple conditions on the SAME field are combined with OR (e.g. continent=Oceania OR continent=Asia).
 * - Conditions on DIFFERENT fields are combined with AND.
 */
function applyFilters(data: SqlResult, filters: PlotConfig['filters']): SqlResult {
  if (!filters || filters.length === 0) {
    return data;
  }

  const withValue = filters.filter(
    (f) => f.value !== undefined && f.value !== null && String(f.value).trim() !== '',
  );
  if (withValue.length === 0) {
    return data;
  }

  // Group filters by field (case-insensitive) so we can OR conditions on the same field
  const byField = new Map<string, typeof withValue>();
  for (const f of withValue) {
    const key = (f.field || '').toLowerCase();
    if (!key) continue;
    if (!byField.has(key)) byField.set(key, []);
    byField.get(key)!.push(f);
  }

  const filteredRows: SqlResult['rows'] = [];

  for (const row of data.rows) {
    let rowPasses = true;

    for (const [, fieldFilters] of byField) {
      const colIndex = findColumnIndex(data.columns, fieldFilters[0].field);
      if (colIndex < 0) {
        rowPasses = false;
        break;
      }

      const cellValue = row[colIndex];
      const passesThisField = fieldFilters.some((filter) =>
        passesFilter(cellValue, filter.value, filter.operator),
      );
      if (!passesThisField) {
        rowPasses = false;
        break;
      }
    }

    if (rowPasses) {
      filteredRows.push(row);
    }
  }

  return {
    ...data,
    rows: filteredRows,
  };
}

/**
 * Apply aggregation to data
 */
function applyAggregation(
  data: SqlResult,
  aggregation: PlotConfig['aggregation'],
  yField: string | string[],
): SqlResult {
  if (!aggregation || !aggregation.type) {
    return data;
  }

  const groupByFields = aggregation.groupBy || [];
  const yFields = Array.isArray(yField) ? yField : [yField].filter(Boolean);

  if (groupByFields.length === 0) {
    // No grouping, aggregate entire dataset into a single row
    const aggregatedRow: SqlResult['rows'][0] = [];

    // Aggregate Y fields
    for (const y of yFields) {
      const yIndex = data.columns.indexOf(y);
      if (yIndex < 0) {
        aggregatedRow.push(null);
        continue;
      }

      const values = data.rows
        .map((row) => row[yIndex])
        .filter((v) => v !== null && v !== undefined)
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0));

      let aggregated: number;
      switch (aggregation.type) {
        case 'sum':
          aggregated = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregated = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'count':
          aggregated = values.length;
          break;
        case 'min':
          aggregated = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          aggregated = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'median':
          const sorted = [...values].sort((a, b) => a - b);
          aggregated =
            sorted.length > 0
              ? sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)]
              : 0;
          break;
        default:
          aggregated = 0;
      }

      aggregatedRow.push(aggregated);
    }

    // For no-grouping aggregation, we create a single row with just the aggregated values
    // The columns will be the Y fields
    return {
      columns: yFields.length > 0 ? yFields : data.columns,
      rows: [aggregatedRow],
    };
  }

  // Group by fields
  const groupMap = new Map<string, SqlResult['rows']>();

  for (const row of data.rows) {
    const groupKey = groupByFields
      .map((field) => {
        const idx = data.columns.indexOf(field);
        return idx >= 0 ? String(row[idx] ?? '') : '';
      })
      .join('|');

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(row);
  }

  const aggregatedRows: SqlResult['rows'] = [];

  for (const [groupKey, groupRows] of groupMap.entries()) {
    const groupValues = groupKey.split('|');
    const aggregatedRow: SqlResult['rows'][0] = [];

    // Add groupBy column values
    for (const val of groupValues) {
      aggregatedRow.push(val);
    }

    // Aggregate Y fields
    for (const y of yFields) {
      const yIndex = data.columns.indexOf(y);
      if (yIndex < 0) {
        aggregatedRow.push(null);
        continue;
      }

      const values = groupRows
        .map((row) => row[yIndex])
        .filter((v) => v !== null && v !== undefined)
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0));

      let aggregated: number;
      switch (aggregation.type) {
        case 'sum':
          aggregated = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggregated = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'count':
          aggregated = values.length;
          break;
        case 'min':
          aggregated = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          aggregated = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'median':
          const sorted = [...values].sort((a, b) => a - b);
          aggregated =
            sorted.length > 0
              ? sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)]
              : 0;
          break;
        default:
          aggregated = 0;
      }

      aggregatedRow.push(aggregated);
    }
    aggregatedRows.push(aggregatedRow);
  }

  // Return aggregated data with groupBy columns + aggregated Y columns
  return {
    columns: [...groupByFields, ...yFields],
    rows: aggregatedRows,
  };
}

/**
 * Apply sorting to data
 */
function applySort(data: SqlResult, sort: PlotConfig['sort']): SqlResult {
  if (!sort || sort.length === 0) {
    return data;
  }

  const sortedRows = [...data.rows].sort((a, b) => {
    for (const sortRule of sort) {
      const colIndex = data.columns.indexOf(sortRule.field);
      if (colIndex < 0) continue;

      const aVal = a[colIndex];
      const bVal = b[colIndex];

      let comparison = 0;
      if (aVal === null || aVal === undefined) {
        comparison = 1;
      } else if (bVal === null || bVal === undefined) {
        comparison = -1;
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      if (comparison !== 0) {
        return sortRule.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });

  return {
    ...data,
    rows: sortedRows,
  };
}

/**
 * Transform data by applying filters, aggregation, and sorting
 */
function transformData(data: SqlResult, config: PlotConfig): SqlResult {
  let transformed = data;

  // Apply transformations in order: filters -> aggregation -> sort
  if (config.filters && config.filters.length > 0) {
    transformed = applyFilters(transformed, config.filters);
  }

  if (config.aggregation && config.aggregation.type) {
    transformed = applyAggregation(transformed, config.aggregation, config.mapping.y || '');
  }

  if (config.sort && config.sort.length > 0) {
    transformed = applySort(transformed, config.sort);
  }

  return transformed;
}

/**
 * Build faceted chart configuration (small multiples)
 */
function buildFacetedChart(
  data: SqlResult,
  config: PlotConfig,
  facetColumn: string,
): EChartsOption {
  const partitions = partitionByFacet(data, facetColumn);
  const facetValues = Array.from(partitions.keys());

  if (facetValues.length === 0) {
    return {
      title: { text: 'No facet values found', left: 'center', top: 'middle' },
    };
  }

  if (facetValues.length > 12) {
    return {
      title: {
        text: `Too many facets (${facetValues.length}). Please filter to 12 or fewer.`,
        left: 'center',
        top: 'middle',
      },
    };
  }

  const { rows, cols } = calculateFacetGrid(facetValues.length);
  const gridWidth = 100 / cols;
  const gridHeight = 100 / rows;

  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];

  let gridIndex = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (gridIndex >= facetValues.length) break;

      const facetValue = facetValues[gridIndex];
      const facetData = partitions.get(facetValue)!;
      const transformedFacetData = transformData(facetData, {
        ...config,
        mapping: { ...config.mapping, facet: undefined },
      });

      // Create grid for this facet
      grids.push({
        left: `${col * gridWidth}%`,
        top: `${row * gridHeight + 10}%`,
        width: `${gridWidth}%`,
        height: `${gridHeight}%`,
      });

      // Create axes for this facet
      xAxes.push({
        type: 'category',
        gridIndex,
        data: transformedFacetData.rows.map((r) => {
          const xIdx = config.mapping.x
            ? transformedFacetData.columns.indexOf(config.mapping.x)
            : -1;
          return xIdx >= 0 ? String(r[xIdx] ?? '') : '';
        }),
      });

      yAxes.push({
        type: 'value',
        gridIndex,
      });

      // Create series for this facet
      const yField = Array.isArray(config.mapping.y) ? config.mapping.y[0] : config.mapping.y;
      if (yField) {
        const yIdx = transformedFacetData.columns.indexOf(yField);
        series.push({
          name: facetValue,
          type: config.chartType === 'line' ? 'line' : config.chartType === 'area' ? 'line' : 'bar',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          data: transformedFacetData.rows.map((r) => r[yIdx]),
          areaStyle: config.chartType === 'area' ? {} : undefined,
        });
      }

      gridIndex++;
    }
  }

  return {
    title: {
      text: config.styling.title || 'Faceted Chart',
      left: 'center',
      top: 5,
    },
    tooltip: { trigger: 'axis' },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series,
  };
}

export function buildEChartsConfig(data: SqlResult, config: PlotConfig): EChartsOption {
  if (!data.columns || data.columns.length === 0 || !data.rows || data.rows.length === 0) {
    return {
      title: {
        text: 'No data available',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#94a3b8' },
      },
    };
  }

  // Check for faceting (only for certain chart types)
  const facetField = config.mapping.facet;
  const facetableTypes: ChartType[] = ['bar', 'bar-horizontal', 'line', 'area', 'scatter'];
  if (facetField && facetableTypes.includes(config.chartType)) {
    return buildFacetedChart(data, config, facetField);
  }

  // Apply data transformations
  const transformedData = transformData(data, config);

  if (transformedData.rows.length === 0) {
    return {
      title: {
        text: 'No data after filtering',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#94a3b8' },
      },
    };
  }

  const xField = config.mapping.x;
  const yField = config.mapping.y;
  const colorField = config.mapping.color;

  // Extract data arrays (from transformed data before sampling)
  const xIndex = xField ? transformedData.columns.indexOf(xField) : -1;
  const yIndices = yField
    ? Array.isArray(yField)
      ? yField.map((f) => transformedData.columns.indexOf(f)).filter((i) => i >= 0)
      : [transformedData.columns.indexOf(yField)].filter((i) => i >= 0)
    : [];
  const colorIndex = colorField ? transformedData.columns.indexOf(colorField) : -1;

  // Downsample for display when data is large (keeps browser responsive)
  const {
    data: dataForChart,
    totalRows: totalRowsBeforeSample,
    sampled: displaySampled,
  } = sampleRowsForDisplay(transformedData, config.chartType, xIndex, yIndices);

  // Build data points from (possibly sampled) data
  const dataPoints: Array<Record<string, unknown>> = [];
  for (const row of dataForChart.rows) {
    const point: Record<string, unknown> = {};
    if (xIndex >= 0) point.x = row[xIndex];
    if (yIndices.length > 0) {
      if (yIndices.length === 1) {
        point.y = row[yIndices[0]];
      } else {
        point.y = yIndices.map((idx) => row[idx]);
      }
    }
    if (colorIndex >= 0) point.color = row[colorIndex];
    dataPoints.push(point);
  }

  // Determine legend height based on position and orientation
  const hasLegend = config.styling.showLegend !== false;
  const legendTop = config.styling.legendPosition === 'top';
  const legendBottom = config.styling.legendPosition === 'bottom';
  const legendVertical =
    config.styling.legendPosition === 'left' || config.styling.legendPosition === 'right';

  // Calculate top offset for title and legend
  const titleTop = 10;
  const legendTopOffset = legendTop ? 35 : undefined;
  const legendBottomOffset = legendBottom ? 'bottom' : undefined;

  // Calculate grid top based on legend and title
  let gridTop: string | number = '15%';
  if (legendTop && hasLegend) {
    gridTop = '22%';
  } else if (config.styling.title) {
    gridTop = '18%';
  }

  const baseOption: EChartsOption = {
    title: {
      text: config.styling.title || 'Chart',
      left: 'center',
      top: titleTop,
      textStyle: {
        fontSize: 14,
        fontWeight: 'normal',
      },
      ...(displaySampled && {
        subtext: `Showing ${dataForChart.rows.length.toLocaleString()} of ${totalRowsBeforeSample.toLocaleString()} points`,
        subtextStyle: { fontSize: 11, color: '#64748b' },
      }),
    },
    tooltip:
      config.styling.enableTooltips !== false
        ? {
            trigger:
              config.chartType === 'pie' || config.chartType === 'doughnut' ? 'item' : 'axis',
            axisPointer: {
              type: 'shadow',
            },
            formatter:
              config.chartType === 'pie' || config.chartType === 'doughnut'
                ? '{a} <br/>{b}: {c} ({d}%)'
                : undefined,
          }
        : { show: false },
    legend: hasLegend
      ? {
          show: true,
          orient: legendVertical ? 'vertical' : 'horizontal',
          left:
            config.styling.legendPosition === 'left'
              ? 'left'
              : config.styling.legendPosition === 'right'
                ? 'right'
                : 'center',
          top: legendTopOffset || legendBottomOffset || 'auto',
          bottom: legendBottom ? 10 : undefined,
        }
      : { show: false },
    grid: {
      show: config.styling.showGrid !== false,
      left: legendVertical && config.styling.legendPosition === 'left' ? '20%' : '10%',
      right: legendVertical && config.styling.legendPosition === 'right' ? '20%' : '10%',
      bottom: legendBottom && hasLegend ? '20%' : '15%',
      top: gridTop,
    },
    color: config.styling.colors || [
      '#3b82f6',
      '#22c55e',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#ec4899',
    ],
  };

  // Universal transition for smooth chart type switching
  const useUniversalTransition = config.styling.universalTransition === true;

  // Build series based on chart type
  switch (config.chartType) {
    case 'bar': {
      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      let seriesData: any[];

      if (colorIndex >= 0 && yIndices.length === 1) {
        // Split by color field into multiple series
        const groups = splitByColor(dataForChart.rows, colorIndex);
        const allX = Array.from(new Set(xAxisData));
        seriesData = groups.map((g) => {
          const xToVal = new Map<string, number>();
          for (const row of g.rows) {
            const xKey = String(row[xIndex] ?? '');
            xToVal.set(xKey, toNum0(row[yIndices[0]]));
          }
          return {
            name: g.name,
            type: 'bar',
            data: allX.map((x) => xToVal.get(x) ?? 0),
          };
        });
      } else {
        seriesData =
          yIndices.length > 0
            ? yIndices.map((yIdx, seriesIdx) => ({
                name: Array.isArray(yField) ? yField[seriesIdx] : yField,
                type: 'bar',
                data: dataForChart.rows.map((row) => toNum0(row[yIdx])),
              }))
            : [];
      }

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: colorIndex >= 0 && yIndices.length === 1 ? Array.from(new Set(xAxisData)) : xAxisData,
          axisLabel: { rotate: xAxisData.length > 10 ? 45 : 0 },
        },
        yAxis: {
          type: 'value',
        },
        series: seriesData,
      };

      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'bar-horizontal': {
      const yAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const seriesData =
        yIndices.length > 0
          ? yIndices.map((yIdx, seriesIdx) => ({
              name: Array.isArray(yField) ? yField[seriesIdx] : yField,
              type: 'bar',
              data: dataForChart.rows.map((row) => toNum0(row[yIdx])),
            }))
          : [];

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'value',
        },
        yAxis: {
          type: 'category',
          data: yAxisData,
        },
        series: seriesData,
      };

      // Add zoom/pan if enabled
      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [
          { type: 'inside' },
          { type: 'slider', show: true, orient: 'vertical' },
        ];
      }

      return option;
    }

    case 'line': {
      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const useLargeMode = dataForChart.rows.length > 2000 || displaySampled;
      let seriesData: any[];
      let finalXAxisData: string[];

      if (colorIndex >= 0 && yIndices.length === 1) {
        const groups = splitByColor(dataForChart.rows, colorIndex);
        const allX = sortXValues(Array.from(new Set(xAxisData)));
        finalXAxisData = allX;
        seriesData = groups.map((g) => {
          const xToVal = new Map<string, number>();
          for (const row of g.rows) xToVal.set(String(row[xIndex] ?? ''), toNum0(row[yIndices[0]]));
          return {
            name: g.name, type: 'line', smooth: false,
            data: allX.map((x) => xToVal.get(x) ?? null),
            connectNulls: true,
            ...(useLargeMode && { sampling: 'lttb', large: true, largeThreshold: 2000 }),
          };
        });
      } else {
        // For non-color-split line charts, also sort when X looks temporal/numeric
        const uniqueX = Array.from(new Set(xAxisData));
        const sorted = sortXValues(uniqueX);
        const needsSort = sorted.some((v, i) => v !== uniqueX[i]);

        if (needsSort && yIndices.length > 0) {
          finalXAxisData = sorted;
          // Build x→y maps and re-order
          seriesData = yIndices.map((yIdx, seriesIdx) => {
            const xToVal = new Map<string, number>();
            for (const row of dataForChart.rows) xToVal.set(String(row[xIndex] ?? ''), toNum0(row[yIdx]));
            return {
              name: Array.isArray(yField) ? yField[seriesIdx] : yField,
              type: 'line',
              data: sorted.map((x) => xToVal.get(x) ?? null),
              smooth: false,
              connectNulls: true,
              ...(useLargeMode && { sampling: 'lttb', large: true, largeThreshold: 2000 }),
            };
          });
        } else {
          finalXAxisData = xAxisData;
          seriesData =
            yIndices.length > 0
              ? yIndices.map((yIdx, seriesIdx) => ({
                  name: Array.isArray(yField) ? yField[seriesIdx] : yField,
                  type: 'line',
                  data: dataForChart.rows.map((row) => toNum0(row[yIdx])),
                  smooth: false,
                  ...(useLargeMode && { sampling: 'lttb', large: true, largeThreshold: 2000 }),
                }))
              : [];
        }
      }

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: finalXAxisData,
        },
        yAxis: { type: 'value' },
        series: seriesData,
      };

      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'area': {
      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const useLargeModeArea = dataForChart.rows.length > 2000 || displaySampled;
      let seriesData: any[];
      let finalXAxisDataArea: string[];

      if (colorIndex >= 0 && yIndices.length === 1) {
        const groups = splitByColor(dataForChart.rows, colorIndex);
        const allX = sortXValues(Array.from(new Set(xAxisData)));
        finalXAxisDataArea = allX;
        seriesData = groups.map((g) => {
          const xToVal = new Map<string, number>();
          for (const row of g.rows) xToVal.set(String(row[xIndex] ?? ''), toNum0(row[yIndices[0]]));
          return {
            name: g.name, type: 'line', areaStyle: {}, smooth: false,
            data: allX.map((x) => xToVal.get(x) ?? null),
            connectNulls: true,
            ...(useLargeModeArea && { sampling: 'lttb', large: true, largeThreshold: 2000 }),
          };
        });
      } else {
        const uniqueX = Array.from(new Set(xAxisData));
        const sorted = sortXValues(uniqueX);
        const needsSort = sorted.some((v, i) => v !== uniqueX[i]);

        if (needsSort && yIndices.length > 0) {
          finalXAxisDataArea = sorted;
          seriesData = yIndices.map((yIdx, seriesIdx) => {
            const xToVal = new Map<string, number>();
            for (const row of dataForChart.rows) xToVal.set(String(row[xIndex] ?? ''), toNum0(row[yIdx]));
            return {
              name: Array.isArray(yField) ? yField[seriesIdx] : yField,
              type: 'line', areaStyle: {},
              data: sorted.map((x) => xToVal.get(x) ?? null),
              smooth: false, connectNulls: true,
              ...(useLargeModeArea && { sampling: 'lttb', large: true, largeThreshold: 2000 }),
            };
          });
        } else {
          finalXAxisDataArea = xAxisData;
          seriesData =
            yIndices.length > 0
              ? yIndices.map((yIdx, seriesIdx) => ({
                  name: Array.isArray(yField) ? yField[seriesIdx] : yField,
                  type: 'line', areaStyle: {},
                  data: dataForChart.rows.map((row) => toNum0(row[yIdx])),
                  smooth: false,
                  ...(useLargeModeArea && { sampling: 'lttb', large: true, largeThreshold: 2000 }),
                }))
              : [];
        }
      }

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: finalXAxisDataArea,
        },
        yAxis: { type: 'value' },
        series: seriesData,
      };

      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'scatter': {
      let seriesData: any[];

      if (colorIndex >= 0 && yIndices.length === 1) {
        const groups = splitByColor(dataForChart.rows, colorIndex);
        seriesData = groups.map((g) => ({
          name: g.name,
          type: 'scatter',
          data: g.rows.map((row) => [toNum0(row[xIndex]), toNum0(row[yIndices[0]])]),
        }));
      } else {
        seriesData =
          yIndices.length > 0
            ? yIndices.map((yIdx, seriesIdx) => ({
                name: Array.isArray(yField) ? yField[seriesIdx] : yField,
                type: 'scatter',
                data: dataForChart.rows.map((row) => [toNum0(row[xIndex]), toNum0(row[yIdx])]),
              }))
            : [];
      }

      const option: EChartsOption = {
        ...baseOption,
        xAxis: { type: 'value', name: xField },
        yAxis: { type: 'value', name: Array.isArray(yField) ? yField[0] : yField },
        series: seriesData,
      };

      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'pie':
    case 'doughnut': {
      // For pie charts, use first categorical as label, first numeric as value
      const labelField = xField || dataForChart.columns[0];
      const valueField = Array.isArray(yField)
        ? yField[0]
        : yField || dataForChart.columns.find((c) => c !== labelField) || dataForChart.columns[1];

      const labelIndex = dataForChart.columns.indexOf(labelField);
      const valueIndex = valueField ? dataForChart.columns.indexOf(valueField) : -1;

      if (labelIndex < 0 || valueIndex < 0) {
        return {
          ...baseOption,
          title: { text: 'Invalid configuration for pie chart', left: 'center', top: 'middle' },
        };
      }

      const pieData = dataForChart.rows.map((row) => ({
        name: String(row[labelIndex] ?? ''),
        value:
          typeof row[valueIndex] === 'number'
            ? row[valueIndex]
            : parseFloat(String(row[valueIndex] ?? 0)) || 0,
      }));

      // Adjust center and radius for pie/doughnut based on legend position
      let centerX = '50%';
      let centerY = '55%';
      let radius: string | string[] = config.chartType === 'doughnut' ? ['40%', '70%'] : '70%';

      if (hasLegend) {
        if (legendTop) {
          centerY = '60%';
          radius = config.chartType === 'doughnut' ? ['35%', '65%'] : '65%';
        } else if (legendBottom) {
          centerY = '50%';
          radius = config.chartType === 'doughnut' ? ['35%', '65%'] : '65%';
        } else if (legendVertical) {
          if (config.styling.legendPosition === 'left') {
            centerX = '60%';
          } else if (config.styling.legendPosition === 'right') {
            centerX = '40%';
          }
          radius = config.chartType === 'doughnut' ? ['35%', '65%'] : '65%';
        }
      }

      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)',
        },
        series: [
          {
            name: valueField,
            type: 'pie',
            radius: radius,
            center: [centerX, centerY],
            data: pieData,
            label: {
              show: true,
              position: 'outside',
            },
            labelLine: {
              show: true,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      };
    }

    case 'histogram': {
      // Use X or Y field (prefer numeric or temporal field that can be converted to numbers)
      // Helper function to check if a field contains numeric values
      const isNumericField = (fieldName: string): boolean => {
        const idx = dataForChart.columns.indexOf(fieldName);
        if (idx < 0) return false;
        // Check first few rows to see if values are numeric
        const sampleSize = Math.min(10, dataForChart.rows.length);
        for (let i = 0; i < sampleSize; i++) {
          const val = dataForChart.rows[i]?.[idx];
          if (val === null || val === undefined) continue;
          if (typeof val === 'number') return true;
          if (typeof val === 'string') {
            const parsed = parseFloat(val);
            if (!Number.isNaN(parsed) && isFinite(parsed)) return true;
          }
        }
        return false;
      };

      const yFieldStr = Array.isArray(yField) ? yField[0] : yField;
      const numericField =
        xField && isNumericField(xField)
          ? xField
          : yFieldStr && isNumericField(yFieldStr)
            ? yFieldStr
            : dataForChart.columns.find((c) => isNumericField(c));

      if (!numericField) {
        return {
          ...baseOption,
          title: { text: 'Histogram requires a numeric field', left: 'center', top: 'middle' },
        };
      }

      const fieldIndex = dataForChart.columns.indexOf(numericField as string);
      const values = dataForChart.rows
        .map((row) => row[fieldIndex])
        .filter((v) => v !== null && v !== undefined)
        .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
        .filter((v) => !Number.isNaN(v) && isFinite(v)) as number[];

      if (values.length === 0) {
        return {
          ...baseOption,
          title: { text: 'No valid numeric values for histogram', left: 'center', top: 'middle' },
        };
      }

      const bins = createBins(values, 20);
      const binLabels = bins.map((b) => `[${b.start.toFixed(1)}-${b.end.toFixed(1)})`);
      const binCounts = bins.map((b) => b.count);

      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: binLabels,
          axisLabel: { rotate: 45 },
        },
        yAxis: {
          type: 'value',
          name: 'Frequency',
        },
        series: [
          {
            name: numericField,
            type: 'bar',
            data: binCounts,
          },
        ],
      };
    }

    case 'heatmap': {
      if (!xField || !yField) {
        return {
          ...baseOption,
          title: { text: 'Heatmap requires X and Y fields', left: 'center', top: 'middle' },
        };
      }

      const xIndex = dataForChart.columns.indexOf(xField);
      const yIndex = dataForChart.columns.indexOf(Array.isArray(yField) ? yField[0] : yField);
      const valueField = dataForChart.columns.find((c) => {
        const idx = dataForChart.columns.indexOf(c);
        return (
          idx !== xIndex &&
          idx !== yIndex &&
          dataForChart.rows[0] &&
          typeof dataForChart.rows[0][idx] === 'number'
        );
      });

      // Group by (x, y) and aggregate
      const cellMap = new Map<string, number[]>();
      const xValues = new Set<string>();
      const yValues = new Set<string>();

      for (const row of dataForChart.rows) {
        const xVal = String(row[xIndex] ?? '');
        const yVal = String(row[yIndex] ?? '');
        const key = `${xVal}|${yVal}`;
        xValues.add(xVal);
        yValues.add(yVal);

        if (!cellMap.has(key)) {
          cellMap.set(key, []);
        }

        if (valueField) {
          const valIdx = dataForChart.columns.indexOf(valueField);
          const val = row[valIdx];
          if (val !== null && val !== undefined) {
            const numVal = typeof val === 'number' ? val : parseFloat(String(val));
            if (!Number.isNaN(numVal) && isFinite(numVal)) {
              cellMap.get(key)!.push(numVal);
            }
          }
        } else {
          cellMap.get(key)!.push(1); // Count
        }
      }

      // Aggregate (sum by default)
      const heatmapData: number[][] = [];
      const xArr = Array.from(xValues);
      const yArr = Array.from(yValues);
      for (const [key, vals] of cellMap.entries()) {
        const [xVal, yVal] = key.split('|');
        const sum = vals.reduce((a, b) => a + b, 0);
        heatmapData.push([
          xArr.indexOf(xVal),
          yArr.indexOf(yVal),
          sum,
        ]);
      }

      return {
        ...baseOption,
        tooltip: {
          position: 'top',
          formatter: (params: any) => {
            const xi = Math.floor(params.value[0]);
            const yi = Math.floor(params.value[1]);
            return `${xArr[xi] ?? ''}<br/>${yArr[yi] ?? ''}<br/>Value: ${params.value[2]}`;
          },
        },
        xAxis: {
          type: 'category',
          data: xArr,
          splitArea: { show: true },
        },
        yAxis: {
          type: 'category',
          data: yArr,
          splitArea: { show: true },
        },
        visualMap: {
          min: Math.min(...heatmapData.map((d) => d[2])),
          max: Math.max(...heatmapData.map((d) => d[2])),
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '5%',
          inRange: {
            color: [
              '#313695',
              '#4575b4',
              '#74add1',
              '#abd9e9',
              '#e0f3f8',
              '#ffffcc',
              '#fee090',
              '#fdae61',
              '#f46d43',
              '#d73027',
              '#a50026',
            ],
          },
        },
        series: [
          {
            name: 'Heatmap',
            type: 'heatmap',
            data: heatmapData,
            label: {
              show: false,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      };
    }

    case 'treemap': {
      // Use groupBy fields for hierarchy, numeric field for size
      const groupByFields = config.aggregation?.groupBy || (xField ? [xField] : []);
      const sizeField = Array.isArray(yField) ? yField[0] : yField;

      if (groupByFields.length === 0 || !sizeField) {
        return {
          ...baseOption,
          title: {
            text: 'Treemap requires groupBy fields and a numeric size field',
            left: 'center',
            top: 'middle',
          },
        };
      }

      // Build hierarchical data
      const treeData: any = {
        name: 'root',
        children: [] as any[],
      };

      const groupMap = new Map<string, { rows: SqlResult['rows']; key: string }>();
      for (const row of dataForChart.rows) {
        const key = groupByFields
          .map((f) => {
            const idx = dataForChart.columns.indexOf(f);
            return String(row[idx] ?? '');
          })
          .join('|');
        if (!groupMap.has(key)) {
          groupMap.set(key, { rows: [], key });
        }
        groupMap.get(key)!.rows.push(row);
      }

      const sizeIndex = dataForChart.columns.indexOf(sizeField);
      for (const [key, group] of groupMap.entries()) {
        const values = group.rows
          .map((row) => row[sizeIndex])
          .filter((v) => v !== null && v !== undefined)
          .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
          .filter((v) => !Number.isNaN(v) && isFinite(v)) as number[];
        const sum = values.reduce((a, b) => a + b, 0);
        if (sum > 0) {
          treeData.children.push({
            name: key.replace(/\|/g, ' / '),
            value: sum,
          });
        }
      }

      return {
        ...baseOption,
        series: [
          {
            type: 'treemap',
            data: treeData.children,
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter: '{b}\n{c}',
            },
            upperLabel: {
              show: true,
            },
            itemStyle: {
              borderColor: '#fff',
            },
          },
        ],
      };
    }

    case 'boxplot': {
      const numericField = Array.isArray(yField) ? yField[0] : yField;
      const groupField = config.mapping.facet || xField;

      if (!numericField) {
        return {
          ...baseOption,
          title: { text: 'Boxplot requires a numeric field', left: 'center', top: 'middle' },
        };
      }

      const numericIndex = dataForChart.columns.indexOf(numericField);
      const groupIndex = groupField ? dataForChart.columns.indexOf(groupField) : -1;

      if (groupIndex >= 0) {
        // Grouped boxplot
        const groupMap = new Map<string, number[]>();
        for (const row of dataForChart.rows) {
          const groupVal = String(row[groupIndex] ?? '');
          const numVal = row[numericIndex];
          if (numVal !== null && numVal !== undefined) {
            const num = typeof numVal === 'number' ? numVal : parseFloat(String(numVal));
            if (!Number.isNaN(num) && isFinite(num)) {
              if (!groupMap.has(groupVal)) {
                groupMap.set(groupVal, []);
              }
              groupMap.get(groupVal)!.push(num);
            }
          }
        }

        const categories: string[] = [];
        const boxplotData: number[][] = [];
        for (const [group, values] of groupMap.entries()) {
          if (values.length > 0) {
            categories.push(group);
            const stats = calculateBoxplotStats(values);
            boxplotData.push([stats.min, stats.q1, stats.median, stats.q3, stats.max]);
          }
        }

        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: categories,
          },
          yAxis: {
            type: 'value',
            name: numericField,
          },
          series: [
            {
              name: numericField,
              type: 'boxplot',
              data: boxplotData,
            },
          ],
        };
      } else {
        // Single boxplot
        const values = dataForChart.rows
          .map((row) => row[numericIndex])
          .filter((v) => v !== null && v !== undefined)
          .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
          .filter((v) => !Number.isNaN(v) && isFinite(v)) as number[];

        if (values.length === 0) {
          return {
            ...baseOption,
            title: { text: 'No valid numeric values for boxplot', left: 'center', top: 'middle' },
          };
        }

        const stats = calculateBoxplotStats(values);
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: [numericField],
          },
          yAxis: {
            type: 'value',
            name: numericField,
          },
          series: [
            {
              name: numericField,
              type: 'boxplot',
              data: [[stats.min, stats.q1, stats.median, stats.q3, stats.max]],
            },
          ],
        };
      }
    }

    case 'radar': {
      // For radar: use categorical columns as metrics, rows as series
      const analyses = analyzeDataColumns(dataForChart);
      const numericCols = analyses.filter((a) => a.type === 'numeric');
      const groupField = config.mapping.facet || xField;

      if (numericCols.length === 0) {
        return {
          ...baseOption,
          title: {
            text: 'Radar chart requires numeric metric columns',
            left: 'center',
            top: 'middle',
          },
        };
      }

      const metrics = numericCols.slice(0, 8).map((c) => c.name); // Limit to 8 metrics
      const groupIndex = groupField ? dataForChart.columns.indexOf(groupField) : -1;

      if (groupIndex >= 0) {
        // Group by field
        const groupMap = new Map<string, SqlResult['rows']>();
        for (const row of dataForChart.rows) {
          const groupVal = String(row[groupIndex] ?? '');
          if (!groupMap.has(groupVal)) {
            groupMap.set(groupVal, []);
          }
          groupMap.get(groupVal)!.push(row);
        }

        const series: any[] = [];
        for (const [groupName, rows] of groupMap.entries()) {
          const values = metrics.map((metric) => {
            const idx = dataForChart.columns.indexOf(metric);
            const metricValues = rows
              .map((row) => row[idx])
              .filter((v) => v !== null && v !== undefined)
              .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
              .filter((v) => !Number.isNaN(v) && isFinite(v)) as number[];
            return metricValues.length > 0
              ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length
              : 0;
          });
          series.push({
            name: groupName,
            value: values,
          });
        }

        return {
          ...baseOption,
          radar: {
            indicator: metrics.map((m) => ({
              name: m,
              max: Math.max(...series.flatMap((s) => s.value)),
            })),
          },
          series: [
            {
              type: 'radar',
              data: series,
            },
          ],
        };
      } else {
        // Each row is a series
        const series: any[] = [];
        for (let i = 0; i < Math.min(dataForChart.rows.length, 10); i++) {
          const row = dataForChart.rows[i];
          const values = metrics.map((metric) => {
            const idx = dataForChart.columns.indexOf(metric);
            const val = row[idx];
            return val !== null && val !== undefined
              ? typeof val === 'number'
                ? val
                : parseFloat(String(val)) || 0
              : 0;
          });
          series.push({
            name: `Series ${i + 1}`,
            value: values,
          });
        }

        const maxVal = Math.max(...series.flatMap((s) => s.value), 1);
        return {
          ...baseOption,
          radar: {
            indicator: metrics.map((m) => ({ name: m, max: maxVal })),
          },
          series: [
            {
              type: 'radar',
              data: series,
            },
          ],
        };
      }
    }

    case 'sankey': {
      // For sankey: x → source, y → target, size/color → value
      const sourceField = xField;
      const targetField = Array.isArray(yField) ? yField[0] : yField;
      const valueField = config.mapping.size || config.mapping.color;

      if (!sourceField || !targetField) {
        return {
          ...baseOption,
          title: {
            text: 'Sankey requires source (X) and target (Y) fields',
            left: 'center',
            top: 'middle',
          },
        };
      }

      const sourceIndex = dataForChart.columns.indexOf(sourceField);
      const targetIndex = dataForChart.columns.indexOf(targetField);
      const valueIndex = valueField ? dataForChart.columns.indexOf(valueField) : -1;

      // Aggregate flows
      const flowMap = new Map<string, number>();
      const nodes = new Set<string>();

      for (const row of dataForChart.rows) {
        const source = String(row[sourceIndex] ?? '');
        const target = String(row[targetIndex] ?? '');
        const value =
          valueIndex >= 0
            ? typeof row[valueIndex] === 'number'
              ? row[valueIndex]
              : parseFloat(String(row[valueIndex] ?? 0)) || 0
            : 1;

        nodes.add(source);
        nodes.add(target);
        const key = `${source}|${target}`;
        flowMap.set(key, (flowMap.get(key) || 0) + value);
      }

      const nodeList = Array.from(nodes);
      const links = Array.from(flowMap.entries()).map(([key, value]) => {
        const [source, target] = key.split('|');
        return {
          source: nodeList.indexOf(source),
          target: nodeList.indexOf(target),
          value,
        };
      });

      return {
        ...baseOption,
        series: [
          {
            type: 'sankey',
            data: nodeList.map((name) => ({ name })),
            links,
            emphasis: {
              focus: 'adjacency',
            },
            lineStyle: {
              color: 'gradient',
              curveness: 0.5,
            },
          },
        ],
      };
    }

    case 'combo-bar-line': {
      // Multiple Y fields: first is bar, second is line
      if (!xField || !yField || !Array.isArray(yField) || yField.length < 2) {
        return {
          ...baseOption,
          title: {
            text: 'Combo chart requires X field and at least 2 Y fields',
            left: 'center',
            top: 'middle',
          },
        };
      }

      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const barField = yField[0];
      const lineField = yField[1];

      const barIndex = dataForChart.columns.indexOf(barField);
      const lineIndex = dataForChart.columns.indexOf(lineField);

      if (barIndex < 0 || lineIndex < 0) {
        return {
          ...baseOption,
          title: { text: 'Invalid Y fields for combo chart', left: 'center', top: 'middle' },
        };
      }

      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: { rotate: xAxisData.length > 10 ? 45 : 0 },
        },
        yAxis: [
          {
            type: 'value',
            name: barField,
            position: 'left',
          },
          {
            type: 'value',
            name: lineField,
            position: 'right',
          },
        ],
        series: [
          {
            name: barField,
            type: 'bar',
            data: dataForChart.rows.map((row) => toNum0(row[barIndex])),
            yAxisIndex: 0,
          },
          {
            name: lineField,
            type: 'line',
            data: dataForChart.rows.map((row) => toNum0(row[lineIndex])),
            yAxisIndex: 1,
            smooth: true,
            ...((dataForChart.rows.length > 2000 || displaySampled) && {
              sampling: 'lttb',
              large: true,
              largeThreshold: 2000,
            }),
          },
        ],
      };
    }

    // ========== PHASE 1: New 2D chart types ==========

    case 'funnel': {
      // Funnel: uses X as label, Y as value (like pie)
      const labelField = xField || dataForChart.columns[0];
      const valueFieldName = Array.isArray(yField)
        ? yField[0]
        : yField || dataForChart.columns.find((c) => c !== labelField) || dataForChart.columns[1];

      const labelIdx = dataForChart.columns.indexOf(labelField);
      const valueIdx = valueFieldName ? dataForChart.columns.indexOf(valueFieldName) : -1;

      if (labelIdx < 0 || valueIdx < 0) {
        return {
          ...baseOption,
          title: { text: 'Invalid configuration for funnel', left: 'center', top: 'middle' },
        };
      }

      const funnelData = dataForChart.rows
        .map((row) => ({
          name: String(row[labelIdx] ?? ''),
          value:
            typeof row[valueIdx] === 'number'
              ? row[valueIdx]
              : parseFloat(String(row[valueIdx] ?? 0)) || 0,
        }))
        .sort((a, b) => (b.value as number) - (a.value as number));

      return {
        ...baseOption,
        tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c}' },
        series: [
          {
            name: valueFieldName,
            type: 'funnel',
            left: '10%',
            top: gridTop,
            bottom: '12%',
            width: '80%',
            sort: 'descending',
            gap: 2,
            label: { show: true, position: 'inside' },
            labelLine: { length: 10 },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            emphasis: { label: { fontSize: 16 } },
            data: funnelData,
          },
        ],
      };
    }

    case 'gauge': {
      const gaugeConfig = config.gaugeConfig || {};
      const valueFieldName = gaugeConfig.valueField || (Array.isArray(yField) ? yField[0] : yField) || dataForChart.columns[0];
      const valIdx = dataForChart.columns.indexOf(valueFieldName);

      let gaugeValue = 0;
      if (valIdx >= 0 && dataForChart.rows.length > 0) {
        const raw = dataForChart.rows[0][valIdx];
        gaugeValue = typeof raw === 'number' ? raw : parseFloat(String(raw ?? 0)) || 0;
      }

      const minVal = gaugeConfig.min ?? 0;
      const maxVal = gaugeConfig.max ?? 100;

      return {
        ...baseOption,
        series: [
          {
            type: 'gauge',
            min: minVal,
            max: maxVal,
            progress: { show: true, width: 18 },
            axisLine: { lineStyle: { width: 18 } },
            axisTick: { show: false },
            splitLine: { length: 12, lineStyle: { width: 2, color: '#999' } },
            axisLabel: { distance: 25, fontSize: 11 },
            anchor: { show: true, showAbove: true, size: 18, itemStyle: { borderWidth: 8 } },
            title: { show: true },
            detail: {
              valueAnimation: true,
              fontSize: 24,
              offsetCenter: [0, '70%'],
            },
            data: [{ value: gaugeValue, name: valueFieldName }],
          },
        ],
      };
    }

    case 'sunburst': {
      // Sunburst: hierarchical like treemap, uses groupBy for levels
      const groupByFields = config.aggregation?.groupBy || (xField ? [xField] : []);
      const sizeField = Array.isArray(yField) ? yField[0] : yField;

      if (groupByFields.length === 0 || !sizeField) {
        return {
          ...baseOption,
          title: {
            text: 'Sunburst requires groupBy and a numeric field (Y)',
            left: 'center',
            top: 'middle',
          },
        };
      }

      // Build hierarchical data (same logic as treemap but nested for multi-level)
      const sizeIdx = dataForChart.columns.indexOf(sizeField);
      const nodeMap = new Map<string, { name: string; value: number; children: Map<string, any> }>();

      for (const row of dataForChart.rows) {
        const val = row[sizeIdx];
        const numVal = typeof val === 'number' ? val : parseFloat(String(val ?? 0)) || 0;
        if (numVal <= 0) continue;

        // Use first groupBy field as top level
        const topIdx = dataForChart.columns.indexOf(groupByFields[0]);
        const topKey = String(row[topIdx] ?? '');

        if (!nodeMap.has(topKey)) {
          nodeMap.set(topKey, { name: topKey, value: 0, children: new Map() });
        }
        const topNode = nodeMap.get(topKey)!;
        topNode.value += numVal;

        // If there are more groupBy fields, create children
        if (groupByFields.length > 1) {
          const childIdx = dataForChart.columns.indexOf(groupByFields[1]);
          const childKey = String(row[childIdx] ?? '');
          if (!topNode.children.has(childKey)) {
            topNode.children.set(childKey, { name: childKey, value: 0 });
          }
          topNode.children.get(childKey)!.value += numVal;
        }
      }

      const sunburstData = Array.from(nodeMap.values()).map((node) => ({
        name: node.name,
        value: node.value,
        children:
          node.children.size > 0
            ? Array.from(node.children.values()).map((c) => ({ name: c.name, value: c.value }))
            : undefined,
      }));

      return {
        ...baseOption,
        series: [
          {
            type: 'sunburst',
            data: sunburstData,
            radius: [0, '90%'],
            label: { rotate: 'radial', fontSize: 10 },
            itemStyle: { borderRadius: 4, borderWidth: 2 },
            emphasis: { focus: 'ancestor' },
          },
        ],
      };
    }

    case 'candlestick': {
      // Candlestick: X = date/category, OHLC fields from mapping
      const dateField = xField || dataForChart.columns[0];
      const openField = config.mapping.open;
      const closeField = config.mapping.close;
      const highField = config.mapping.high;
      const lowField = config.mapping.low;

      if (!openField || !closeField || !highField || !lowField) {
        return {
          ...baseOption,
          title: {
            text: 'Candlestick requires Open, High, Low, Close fields',
            left: 'center',
            top: 'middle',
          },
        };
      }

      const dateIdx = dataForChart.columns.indexOf(dateField);
      const openIdx = dataForChart.columns.indexOf(openField);
      const closeIdx = dataForChart.columns.indexOf(closeField);
      const highIdx = dataForChart.columns.indexOf(highField);
      const lowIdx = dataForChart.columns.indexOf(lowField);

      if (openIdx < 0 || closeIdx < 0 || highIdx < 0 || lowIdx < 0) {
        return {
          ...baseOption,
          title: { text: 'OHLC fields not found in data', left: 'center', top: 'middle' },
        };
      }

      const xData = dataForChart.rows.map((row) => String(row[dateIdx] ?? ''));
      const ohlcData = dataForChart.rows.map((row) => [
        parseFloat(String(row[openIdx] ?? 0)) || 0,
        parseFloat(String(row[closeIdx] ?? 0)) || 0,
        parseFloat(String(row[lowIdx] ?? 0)) || 0,
        parseFloat(String(row[highIdx] ?? 0)) || 0,
      ]);

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xData,
          axisLabel: { rotate: xData.length > 20 ? 45 : 0 },
        },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'candlestick',
            data: ohlcData,
            itemStyle: {
              color: '#ec4899',
              color0: '#22c55e',
              borderColor: '#ec4899',
              borderColor0: '#22c55e',
            },
          },
        ],
      };

      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }
      return option;
    }

    case 'graph': {
      // Graph: source/target from mapping, weight optional
      const sourceField = config.mapping.source || xField;
      const targetFieldName = config.mapping.target || (Array.isArray(yField) ? yField[0] : yField);
      const weightField = config.mapping.weight || config.mapping.size;

      if (!sourceField || !targetFieldName) {
        return {
          ...baseOption,
          title: {
            text: 'Graph requires Source and Target fields',
            left: 'center',
            top: 'middle',
          },
        };
      }

      const srcIdx = dataForChart.columns.indexOf(sourceField);
      const tgtIdx = dataForChart.columns.indexOf(targetFieldName);
      const wIdx = weightField ? dataForChart.columns.indexOf(weightField) : -1;

      const nodeSet = new Set<string>();
      const links: Array<{ source: string; target: string; value?: number }> = [];

      for (const row of dataForChart.rows) {
        const src = String(row[srcIdx] ?? '');
        const tgt = String(row[tgtIdx] ?? '');
        nodeSet.add(src);
        nodeSet.add(tgt);
        const link: { source: string; target: string; value?: number } = { source: src, target: tgt };
        if (wIdx >= 0) {
          link.value = typeof row[wIdx] === 'number' ? row[wIdx] as number : parseFloat(String(row[wIdx] ?? 1)) || 1;
        }
        links.push(link);
      }

      // Calculate node degree for sizing
      const degreeMap = new Map<string, number>();
      for (const link of links) {
        degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
        degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
      }

      const maxDegree = Math.max(...degreeMap.values(), 1);
      const nodes = Array.from(nodeSet).map((name) => ({
        name,
        symbolSize: 10 + ((degreeMap.get(name) || 1) / maxDegree) * 40,
        label: { show: (degreeMap.get(name) || 0) > 1 },
      }));

      return {
        ...baseOption,
        tooltip: {},
        series: [
          {
            type: 'graph',
            layout: 'force',
            data: nodes,
            links,
            roam: true,
            label: { show: true, position: 'right', fontSize: 10 },
            force: {
              repulsion: 100,
              gravity: 0.1,
              edgeLength: [50, 200],
            },
            lineStyle: { color: 'source', curveness: 0.3 },
            emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
          },
        ],
      };
    }

    case 'parallel': {
      // Parallel coordinates: all numeric columns as dimensions
      const analyses = analyzeDataColumns(dataForChart);
      const numericCols = analyses.filter((a) => a.type === 'numeric');

      if (numericCols.length < 2) {
        return {
          ...baseOption,
          title: {
            text: 'Parallel coordinates requires at least 2 numeric columns',
            left: 'center',
            top: 'middle',
          },
        };
      }

      const dims = numericCols.slice(0, 10); // Limit to 10 axes
      const parallelAxis = dims.map((col, idx) => {
        const colIdx = dataForChart.columns.indexOf(col.name);
        const values = dataForChart.rows
          .map((row) => {
            const v = row[colIdx];
            return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0;
          });
        return {
          dim: idx,
          name: col.name,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      });

      const parallelData = dataForChart.rows.slice(0, 500).map((row) => {
        return dims.map((col) => {
          const idx = dataForChart.columns.indexOf(col.name);
          const v = row[idx];
          return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0;
        });
      });

      return {
        ...baseOption,
        parallelAxis,
        parallel: {
          left: '5%',
          right: '13%',
          bottom: '10%',
          top: gridTop,
        },
        series: [
          {
            type: 'parallel',
            lineStyle: { width: 1, opacity: 0.3 },
            data: parallelData,
          },
        ],
      };
    }

    case 'tree': {
      // Tree: hierarchical from groupBy fields
      const groupByFields = config.aggregation?.groupBy || (xField ? [xField] : []);
      const sizeField = Array.isArray(yField) ? yField[0] : yField;

      if (groupByFields.length === 0) {
        return {
          ...baseOption,
          title: {
            text: 'Tree requires groupBy fields for hierarchy',
            left: 'center',
            top: 'middle',
          },
        };
      }

      // Build tree from first groupBy field
      const sizeIdx = sizeField ? dataForChart.columns.indexOf(sizeField) : -1;
      const topIdx = dataForChart.columns.indexOf(groupByFields[0]);
      const childIdx = groupByFields.length > 1 ? dataForChart.columns.indexOf(groupByFields[1]) : -1;

      const treeMap = new Map<string, Map<string, number>>();
      for (const row of dataForChart.rows) {
        const topKey = String(row[topIdx] ?? '');
        if (!treeMap.has(topKey)) treeMap.set(topKey, new Map());

        if (childIdx >= 0) {
          const childKey = String(row[childIdx] ?? '');
          const val = sizeIdx >= 0 ? (typeof row[sizeIdx] === 'number' ? row[sizeIdx] as number : parseFloat(String(row[sizeIdx] ?? 1)) || 1) : 1;
          const childMap = treeMap.get(topKey)!;
          childMap.set(childKey, (childMap.get(childKey) || 0) + val);
        }
      }

      const treeData = {
        name: config.styling.title || 'Root',
        children: Array.from(treeMap.entries()).map(([key, children]) => ({
          name: key,
          children: children.size > 0
            ? Array.from(children.entries()).map(([name, value]) => ({ name, value }))
            : undefined,
        })),
      };

      return {
        ...baseOption,
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [
          {
            type: 'tree',
            data: [treeData],
            left: '5%',
            right: '20%',
            top: gridTop,
            bottom: '10%',
            symbol: 'emptyCircle',
            symbolSize: 8,
            orient: 'LR',
            expandAndCollapse: true,
            initialTreeDepth: 2,
            label: { position: 'left', verticalAlign: 'middle', fontSize: 10 },
            leaves: { label: { position: 'right', verticalAlign: 'middle' } },
            animationDurationUpdate: 750,
          },
        ],
      };
    }

    case 'themeRiver': {
      // ThemeRiver: X = date/time, Y = value, color = category
      const dateField2 = xField || dataForChart.columns[0];
      const valueField2 = Array.isArray(yField) ? yField[0] : yField;
      const categoryField = colorField || dataForChart.columns.find((c) => c !== dateField2 && c !== valueField2);

      if (!dateField2 || !valueField2) {
        return {
          ...baseOption,
          title: { text: 'ThemeRiver requires X (time) and Y (value)', left: 'center', top: 'middle' },
        };
      }

      const dateIdx2 = dataForChart.columns.indexOf(dateField2);
      const valIdx2 = dataForChart.columns.indexOf(valueField2);
      const catIdx2 = categoryField ? dataForChart.columns.indexOf(categoryField) : -1;

      const riverData: [string, number, string][] = [];
      for (const row of dataForChart.rows) {
        const date = String(row[dateIdx2] ?? '');
        const val = typeof row[valIdx2] === 'number' ? row[valIdx2] as number : parseFloat(String(row[valIdx2] ?? 0)) || 0;
        const cat = catIdx2 >= 0 ? String(row[catIdx2] ?? '') : valueField2;
        riverData.push([date, val, cat]);
      }

      return {
        ...baseOption,
        singleAxis: {
          top: gridTop,
          bottom: '15%',
          axisTick: {},
          axisLabel: {},
          type: 'time',
          axisPointer: { animation: true, label: { show: true } },
        },
        series: [
          {
            type: 'themeRiver',
            emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 0, 0, 0.3)' } },
            data: riverData,
          },
        ],
      };
    }

    case 'waterfall': {
      // Waterfall: built via custom bar series with stacking
      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const yIdx = yIndices[0];

      if (yIdx === undefined || yIdx < 0) {
        return {
          ...baseOption,
          title: { text: 'Waterfall requires X and Y fields', left: 'center', top: 'middle' },
        };
      }

      const values = dataForChart.rows.map((row) => {
        const v = row[yIdx];
        return typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0;
      });

      // Calculate running sum and create transparent + positive + negative stacks
      const transparentData: number[] = [];
      const positiveData: (number | '-')[] = [];
      const negativeData: (number | '-')[] = [];
      let runningSum = 0;

      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val >= 0) {
          transparentData.push(runningSum);
          positiveData.push(val);
          negativeData.push('-');
        } else {
          transparentData.push(runningSum + val);
          positiveData.push('-');
          negativeData.push(Math.abs(val));
        }
        runningSum += val;
      }

      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: { rotate: xAxisData.length > 10 ? 45 : 0 },
        },
        yAxis: { type: 'value' },
        series: [
          {
            name: 'Transparent',
            type: 'bar',
            stack: 'waterfall',
            itemStyle: { borderColor: 'transparent', color: 'transparent' },
            emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
            data: transparentData,
          },
          {
            name: 'Прирост',
            type: 'bar',
            stack: 'waterfall',
            itemStyle: { color: '#22c55e' },
            label: { show: true, position: 'top', fontSize: 10 },
            data: positiveData,
          },
          {
            name: 'Убыток',
            type: 'bar',
            stack: 'waterfall',
            itemStyle: { color: '#ef4444' },
            label: { show: true, position: 'bottom', fontSize: 10 },
            data: negativeData,
          },
        ],
      };
    }

    // ========== PHASE 2: 3D chart types (echarts-gl) ==========

    case 'scatter3d':
    case 'bar3d':
    case 'surface3d':
    case 'line3d': {
      const zField = config.mapping.z;
      const yFieldStr3d = Array.isArray(yField) ? yField[0] : yField;
      if (!xField || !yFieldStr3d || !zField) {
        return {
          ...baseOption,
          title: { text: '3D charts require X, Y, Z fields', left: 'center', top: 'middle', textStyle: { color: '#94a3b8' } },
        };
      }

      const zIdx = dataForChart.columns.indexOf(zField);
      if (xIndex < 0 || yIndices.length === 0 || zIdx < 0) {
        return {
          ...baseOption,
          title: { text: '3D fields not found in data', left: 'center', top: 'middle', textStyle: { color: '#94a3b8' } },
        };
      }

      // Common data extraction with proper numeric coercion
      const pts3d = dataForChart.rows.map((row) => [
        toNum0(row[xIndex]), toNum0(row[yIndices[0]]), toNum0(row[zIdx]),
      ]);

      if (config.chartType === 'scatter3d') {
        return {
          ...baseOption,
          grid3D: { viewControl: { autoRotate: false } },
          xAxis3D: { type: 'value', name: xField },
          yAxis3D: { type: 'value', name: yFieldStr3d },
          zAxis3D: { type: 'value', name: zField },
          series: [{
            type: 'scatter3D', data: pts3d, symbolSize: 5,
            itemStyle: { opacity: 0.8 },
            emphasis: { itemStyle: { color: '#f59e0b' } },
          }],
        };
      }

      if (config.chartType === 'bar3d') {
        const xCats = Array.from(new Set(dataForChart.rows.map((r) => String(r[xIndex] ?? ''))));
        const yCats = Array.from(new Set(dataForChart.rows.map((r) => String(r[yIndices[0]] ?? ''))));
        const bar3dData = dataForChart.rows.map((row) => [
          xCats.indexOf(String(row[xIndex] ?? '')),
          yCats.indexOf(String(row[yIndices[0]] ?? '')),
          toNum0(row[zIdx]),
        ]);
        const zMax = Math.max(...bar3dData.map((d) => d[2] as number), 1);
        return {
          ...baseOption,
          grid3D: { boxWidth: 100, boxDepth: 80, viewControl: { distance: 200, autoRotate: false } },
          xAxis3D: { type: 'category', data: xCats, name: xField },
          yAxis3D: { type: 'category', data: yCats, name: yFieldStr3d },
          zAxis3D: { type: 'value', name: zField },
          visualMap: { max: zMax, inRange: { color: ['#313695', '#4575b4', '#74add1', '#fee090', '#f46d43', '#d73027', '#a50026'] } },
          series: [{
            type: 'bar3D', data: bar3dData, shading: 'lambert',
            label: { show: false }, emphasis: { label: { show: true, fontSize: 12 } },
          }],
        };
      }

      if (config.chartType === 'surface3d') {
        // Surface needs sorted grid data for proper rendering
        // Sort by X then Y to create a proper grid
        const sortedPts = [...pts3d].sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
        const zNums = sortedPts.map((d) => d[2] as number);
        const zMin = zNums.length > 0 ? Math.min(...zNums) : 0;
        const zMax = zNums.length > 0 ? Math.max(...zNums) : 1;
        return {
          ...baseOption,
          grid3D: { viewControl: { autoRotate: false } },
          xAxis3D: { type: 'value', name: xField },
          yAxis3D: { type: 'value', name: yFieldStr3d },
          zAxis3D: { type: 'value', name: zField },
          visualMap: {
            show: true, dimension: 2, min: zMin, max: zMax,
            inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] },
          },
          series: [{ type: 'surface', wireframe: { show: true }, data: sortedPts }],
        };
      }

      // line3d
      return {
        ...baseOption,
        grid3D: { viewControl: { autoRotate: false } },
        xAxis3D: { type: 'value', name: xField },
        yAxis3D: { type: 'value', name: yFieldStr3d },
        zAxis3D: { type: 'value', name: zField },
        series: [{ type: 'line3D', data: pts3d, lineStyle: { width: 3 } }],
      };
    }

    // ========== PHASE 3: Extensions ==========

    case 'wordcloud': {
      // WordCloud: X = text/word, weight = size
      const textField = xField || dataForChart.columns[0];
      const weightFieldName = config.mapping.weight || (Array.isArray(yField) ? yField[0] : yField) || dataForChart.columns.find((c) => c !== textField);

      const textIdx = dataForChart.columns.indexOf(textField);
      const weightIdx = weightFieldName ? dataForChart.columns.indexOf(weightFieldName) : -1;

      if (textIdx < 0) {
        return {
          ...baseOption,
          title: { text: 'WordCloud requires a text field', left: 'center', top: 'middle' },
        };
      }

      const wordData = dataForChart.rows.map((row) => ({
        name: String(row[textIdx] ?? ''),
        value: weightIdx >= 0
          ? (typeof row[weightIdx] === 'number' ? row[weightIdx] as number : parseFloat(String(row[weightIdx] ?? 1)) || 1)
          : 1,
      }));

      // Sort by value desc for visual priority
      wordData.sort((a, b) => b.value - a.value);

      return {
        ...baseOption,
        tooltip: { show: true },
        series: [
          {
            type: 'wordCloud',
            shape: 'circle',
            sizeRange: [12, 60],
            rotationRange: [-45, 90],
            rotationStep: 45,
            gridSize: 8,
            drawOutOfBound: false,
            layoutAnimation: true,
            textStyle: {
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
            },
            emphasis: {
              textStyle: { color: '#1e293b', shadowBlur: 10, shadowColor: '#999' },
            },
            data: wordData.slice(0, 200), // Limit words for performance
          },
        ],
      };
    }

    case 'liquidfill': {
      // LiquidFill: single value as percentage
      const valueFieldName = (Array.isArray(yField) ? yField[0] : yField) || dataForChart.columns[0];
      const valIdx = dataForChart.columns.indexOf(valueFieldName);

      let fillValue = 0;
      if (valIdx >= 0 && dataForChart.rows.length > 0) {
        const raw = dataForChart.rows[0][valIdx];
        fillValue = typeof raw === 'number' ? raw : parseFloat(String(raw ?? 0)) || 0;
      }

      // Normalize to 0-1 range if value is > 1 (assume percentage)
      if (fillValue > 1) fillValue = fillValue / 100;
      fillValue = Math.max(0, Math.min(1, fillValue));

      const shape = config.liquidfillConfig?.shape || 'circle';

      return {
        ...baseOption,
        series: [
          {
            type: 'liquidFill',
            data: [fillValue, fillValue * 0.9, fillValue * 0.8],
            radius: '80%',
            shape,
            outline: { show: true },
            label: {
              show: true,
              fontSize: 28,
              fontWeight: 'bold',
            },
            backgroundStyle: { borderWidth: 1, borderColor: '#156ACF', color: 'rgb(244,244,244)' },
          },
        ],
      };
    }

    default:
      return {
        ...baseOption,
        title: {
          text: `Chart type "${config.chartType}" not yet implemented`,
          left: 'center',
          top: 'middle',
        },
      };
  }
}
