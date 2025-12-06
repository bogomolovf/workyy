import type { SqlResult } from '../../state/executionStore';
import type { PlotConfig, AggregationType, ChartType } from './chartTypes';
import {
  createBins,
  calculateBoxplotStats,
  partitionByFacet,
  calculateFacetGrid,
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

// ECharts option type - using a simplified version for now
type EChartsOption = {
  title?: {
    text?: string;
    left?: string | number;
    top?: string | number;
    textStyle?: {
      fontSize?: number;
      fontWeight?: string;
      color?: string;
    };
  };
  tooltip?: {
    trigger?: string;
    axisPointer?: {
      type?: string;
    };
    formatter?: string;
  };
  legend?: {
    show?: boolean;
    orient?: string;
    left?: string | number;
    top?: string | number;
  };
  grid?: {
    show?: boolean;
    left?: string | number;
    right?: string | number;
    bottom?: string | number;
    top?: string | number;
  };
  color?: string[];
  xAxis?: {
    type?: string;
    data?: string[];
    name?: string;
    axisLabel?: {
      rotate?: number;
    };
  };
  yAxis?: {
    type?: string;
    name?: string;
  };
  series?: Array<{
    name?: string;
    type?: string;
    data?: unknown[] | number[][];
    smooth?: boolean;
    radius?: string | string[];
    center?: string[];
    areaStyle?: Record<string, unknown>;
    emphasis?: {
      itemStyle?: {
        shadowBlur?: number;
        shadowOffsetX?: number;
        shadowColor?: string;
      };
    };
  }>;
  dataZoom?: Array<{
    type: string;
    show?: boolean;
  }>;
};

/**
 * Apply filters to data rows
 */
function applyFilters(data: SqlResult, filters: PlotConfig['filters']): SqlResult {
  if (!filters || filters.length === 0) {
    return data;
  }

  const filteredRows: SqlResult['rows'] = [];

  for (const row of data.rows) {
    let passes = true;

    for (const filter of filters) {
      const colIndex = data.columns.indexOf(filter.field);
      if (colIndex < 0) {
        passes = false;
        break;
      }

      const cellValue = row[colIndex];
      const filterValue = filter.value;

      switch (filter.operator) {
        case 'eq':
          passes = String(cellValue) === String(filterValue);
          break;
        case 'ne':
          passes = String(cellValue) !== String(filterValue);
          break;
        case 'gt':
          passes = Number(cellValue) > Number(filterValue);
          break;
        case 'gte':
          passes = Number(cellValue) >= Number(filterValue);
          break;
        case 'lt':
          passes = Number(cellValue) < Number(filterValue);
          break;
        case 'lte':
          passes = Number(cellValue) <= Number(filterValue);
          break;
        case 'in':
          const inArray = Array.isArray(filterValue) ? filterValue : [filterValue];
          passes = inArray.some((v) => String(cellValue) === String(v));
          break;
        case 'contains':
          passes = String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
          break;
        default:
          passes = true;
      }

      if (!passes) break;
    }

    if (passes) {
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

  // Extract data arrays
  const xIndex = xField ? transformedData.columns.indexOf(xField) : -1;
  const yIndices = yField
    ? Array.isArray(yField)
      ? yField.map((f) => transformedData.columns.indexOf(f)).filter((i) => i >= 0)
      : [transformedData.columns.indexOf(yField)].filter((i) => i >= 0)
    : [];
  const colorIndex = colorField ? transformedData.columns.indexOf(colorField) : -1;

  // Build data points
  const dataPoints: Array<Record<string, unknown>> = [];
  for (const row of transformedData.rows) {
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

  // Build series based on chart type
  switch (config.chartType) {
    case 'bar': {
      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const seriesData =
        yIndices.length > 0
          ? yIndices.map((yIdx, seriesIdx) => ({
              name: Array.isArray(yField) ? yField[seriesIdx] : yField,
              type: 'bar',
              data: transformedData.rows.map((row) => row[yIdx]),
            }))
          : [];

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: { rotate: xAxisData.length > 10 ? 45 : 0 },
        },
        yAxis: {
          type: 'value',
        },
        series: seriesData,
      };

      // Add zoom/pan if enabled
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
              data: transformedData.rows.map((row) => row[yIdx]),
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
      const seriesData =
        yIndices.length > 0
          ? yIndices.map((yIdx, seriesIdx) => ({
              name: Array.isArray(yField) ? yField[seriesIdx] : yField,
              type: 'line',
              data: transformedData.rows.map((row) => row[yIdx]),
              smooth: true,
            }))
          : [];

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
        },
        yAxis: {
          type: 'value',
        },
        series: seriesData,
      };

      // Add zoom/pan if enabled
      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'area': {
      const xAxisData = dataPoints.map((p) => String(p.x ?? ''));
      const seriesData =
        yIndices.length > 0
          ? yIndices.map((yIdx, seriesIdx) => ({
              name: Array.isArray(yField) ? yField[seriesIdx] : yField,
              type: 'line',
              areaStyle: {},
              data: transformedData.rows.map((row) => row[yIdx]),
              smooth: true,
            }))
          : [];

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
        },
        yAxis: {
          type: 'value',
        },
        series: seriesData,
      };

      // Add zoom/pan if enabled
      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'scatter': {
      const seriesData =
        yIndices.length > 0
          ? yIndices.map((yIdx, seriesIdx) => {
              const scatterData = transformedData.rows.map((row) => [row[xIndex], row[yIdx]]);
              return {
                name: Array.isArray(yField) ? yField[seriesIdx] : yField,
                type: 'scatter',
                data: scatterData,
              };
            })
          : [];

      const option: EChartsOption = {
        ...baseOption,
        xAxis: {
          type: 'value',
          name: xField,
        },
        yAxis: {
          type: 'value',
          name: Array.isArray(yField) ? yField[0] : yField,
        },
        series: seriesData,
      };

      // Add zoom/pan if enabled
      if (config.styling.enableZoomPan) {
        (option as any).dataZoom = [{ type: 'inside' }, { type: 'slider', show: true }];
      }

      return option;
    }

    case 'pie':
    case 'doughnut': {
      // For pie charts, use first categorical as label, first numeric as value
      const labelField = xField || transformedData.columns[0];
      const valueField = Array.isArray(yField)
        ? yField[0]
        : yField ||
          transformedData.columns.find((c) => c !== labelField) ||
          transformedData.columns[1];

      const labelIndex = transformedData.columns.indexOf(labelField);
      const valueIndex = valueField ? transformedData.columns.indexOf(valueField) : -1;

      if (labelIndex < 0 || valueIndex < 0) {
        return {
          ...baseOption,
          title: { text: 'Invalid configuration for pie chart', left: 'center', top: 'middle' },
        };
      }

      const pieData = transformedData.rows.map((row) => ({
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
        const idx = transformedData.columns.indexOf(fieldName);
        if (idx < 0) return false;
        // Check first few rows to see if values are numeric
        const sampleSize = Math.min(10, transformedData.rows.length);
        for (let i = 0; i < sampleSize; i++) {
          const val = transformedData.rows[i]?.[idx];
          if (val === null || val === undefined) continue;
          if (typeof val === 'number') return true;
          if (typeof val === 'string') {
            const parsed = parseFloat(val);
            if (!Number.isNaN(parsed) && isFinite(parsed)) return true;
          }
        }
        return false;
      };

      const numericField =
        xField && isNumericField(xField)
          ? xField
          : yField && isNumericField(yField)
            ? yField
            : transformedData.columns.find((c) => isNumericField(c));

      if (!numericField) {
        return {
          ...baseOption,
          title: { text: 'Histogram requires a numeric field', left: 'center', top: 'middle' },
        };
      }

      const fieldIndex = transformedData.columns.indexOf(numericField);
      const values = transformedData.rows
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

      const xIndex = transformedData.columns.indexOf(xField);
      const yIndex = transformedData.columns.indexOf(Array.isArray(yField) ? yField[0] : yField);
      const valueField = transformedData.columns.find((c) => {
        const idx = transformedData.columns.indexOf(c);
        return (
          idx !== xIndex &&
          idx !== yIndex &&
          transformedData.rows[0] &&
          typeof transformedData.rows[0][idx] === 'number'
        );
      });

      // Group by (x, y) and aggregate
      const cellMap = new Map<string, number[]>();
      const xValues = new Set<string>();
      const yValues = new Set<string>();

      for (const row of transformedData.rows) {
        const xVal = String(row[xIndex] ?? '');
        const yVal = String(row[yIndex] ?? '');
        const key = `${xVal}|${yVal}`;
        xValues.add(xVal);
        yValues.add(yVal);

        if (!cellMap.has(key)) {
          cellMap.set(key, []);
        }

        if (valueField) {
          const valIdx = transformedData.columns.indexOf(valueField);
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
      for (const [key, vals] of cellMap.entries()) {
        const [xVal, yVal] = key.split('|');
        const sum = vals.reduce((a, b) => a + b, 0);
        heatmapData.push([
          xValues.size - Array.from(xValues).indexOf(xVal) - 1,
          Array.from(yValues).indexOf(yVal),
          sum,
        ]);
      }

      return {
        ...baseOption,
        tooltip: {
          position: 'top',
          formatter: (params: any) => {
            const xIdx = Math.floor(params.value[0]);
            const yIdx = Math.floor(params.value[1]);
            const xVal = Array.from(xValues)[xValues.size - 1 - xIdx];
            const yVal = Array.from(yValues)[yIdx];
            return `${xVal}<br/>${yVal}<br/>Value: ${params.value[2]}`;
          },
        },
        xAxis: {
          type: 'category',
          data: Array.from(xValues),
          splitArea: { show: true },
        },
        yAxis: {
          type: 'category',
          data: Array.from(yValues),
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
      for (const row of transformedData.rows) {
        const key = groupByFields
          .map((f) => {
            const idx = transformedData.columns.indexOf(f);
            return String(row[idx] ?? '');
          })
          .join('|');
        if (!groupMap.has(key)) {
          groupMap.set(key, { rows: [], key });
        }
        groupMap.get(key)!.rows.push(row);
      }

      const sizeIndex = transformedData.columns.indexOf(sizeField);
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

      const numericIndex = transformedData.columns.indexOf(numericField);
      const groupIndex = groupField ? transformedData.columns.indexOf(groupField) : -1;

      if (groupIndex >= 0) {
        // Grouped boxplot
        const groupMap = new Map<string, number[]>();
        for (const row of transformedData.rows) {
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
        const values = transformedData.rows
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
      const analyses = analyzeDataColumns(transformedData);
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
      const groupIndex = groupField ? transformedData.columns.indexOf(groupField) : -1;

      if (groupIndex >= 0) {
        // Group by field
        const groupMap = new Map<string, SqlResult['rows']>();
        for (const row of transformedData.rows) {
          const groupVal = String(row[groupIndex] ?? '');
          if (!groupMap.has(groupVal)) {
            groupMap.set(groupVal, []);
          }
          groupMap.get(groupVal)!.push(row);
        }

        const series: any[] = [];
        for (const [groupName, rows] of groupMap.entries()) {
          const values = metrics.map((metric) => {
            const idx = transformedData.columns.indexOf(metric);
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
        for (let i = 0; i < Math.min(transformedData.rows.length, 10); i++) {
          const row = transformedData.rows[i];
          const values = metrics.map((metric) => {
            const idx = transformedData.columns.indexOf(metric);
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

      const sourceIndex = transformedData.columns.indexOf(sourceField);
      const targetIndex = transformedData.columns.indexOf(targetField);
      const valueIndex = valueField ? transformedData.columns.indexOf(valueField) : -1;

      // Aggregate flows
      const flowMap = new Map<string, number>();
      const nodes = new Set<string>();

      for (const row of transformedData.rows) {
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

      const barIndex = transformedData.columns.indexOf(barField);
      const lineIndex = transformedData.columns.indexOf(lineField);

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
            data: transformedData.rows.map((row) => row[barIndex]),
            yAxisIndex: 0,
          },
          {
            name: lineField,
            type: 'line',
            data: transformedData.rows.map((row) => row[lineIndex]),
            yAxisIndex: 1,
            smooth: true,
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
