import type { SqlResult } from '../../state/executionStore';
import type { ChartType, PlotConfig } from './chartTypes';

export type ColumnKind = 'numeric' | 'categorical' | 'temporal' | 'unknown';

export type ColumnAnalysis = {
  name: string;
  type: ColumnKind;
  uniqueCount?: number;
  distinctCount: number; // Alias for uniqueCount for consistency
  sampleValues?: Array<string | number | null>;
};

export function analyzeDataColumns(result: SqlResult): ColumnAnalysis[] {
  if (!result.columns || result.columns.length === 0 || !result.rows || result.rows.length === 0) {
    return [];
  }

  const analyses: ColumnAnalysis[] = [];
  const sampleSize = Math.min(100, result.rows.length);

  for (let colIdx = 0; colIdx < result.columns.length; colIdx++) {
    const columnName = result.columns[colIdx];
    const values = result.rows.slice(0, sampleSize).map((row) => row[colIdx]);
    const nonNullValues = values.filter((v) => v !== null && v !== undefined);

    if (nonNullValues.length === 0) {
      analyses.push({
        name: columnName,
        type: 'unknown',
      });
      continue;
    }

    // Check if numeric
    const numericCount = nonNullValues.filter((v) => {
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        const parsed = parseFloat(v);
        return !Number.isNaN(parsed) && isFinite(parsed);
      }
      return false;
    }).length;

    const numericRatio = numericCount / nonNullValues.length;

    // Check if temporal (simple heuristics: ISO date strings, year-like numbers)
    // But be more strict - only consider temporal if it's clearly a date/time, not just a number in year range
    const temporalCount = nonNullValues.filter((v) => {
      if (typeof v === 'string') {
        // ISO date pattern (YYYY-MM-DD or similar)
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
        // Date-like strings that parse as valid dates
        const dateParsed = Date.parse(v);
        if (dateParsed && !Number.isNaN(dateParsed)) {
          // Additional check: if it parses as date but looks like a number, be more careful
          // Only consider it temporal if it has date-like separators or is a known date format
          if (/[-\/]/.test(v) || /T\d{2}:\d{2}/.test(v)) return true;
        }
      }
      // Don't consider numbers as temporal unless they're clearly timestamps (very large numbers)
      // Numbers in 1900-2100 range are likely years, but could also be scores, IDs, etc.
      // Only consider them temporal if they're integers AND the column name suggests a date
      if (typeof v === 'number') {
        // Only consider as temporal if it's a timestamp (milliseconds since epoch) or very large
        // For year-like numbers, require the column name to suggest it's a date
        const colNameLower = columnName.toLowerCase();
        const isDateLikeName = /date|time|year|month|day/.test(colNameLower);
        if (isDateLikeName && v >= 1900 && v <= 2100 && Number.isInteger(v)) {
          return true;
        }
        // Large numbers that could be timestamps
        if (v > 1000000000000) return true; // Timestamp in milliseconds
      }
      return false;
    }).length;

    const temporalRatio = temporalCount / nonNullValues.length;

    // Unique count
    const uniqueValues = new Set(nonNullValues.map(String));
    const uniqueRatio = uniqueValues.size / nonNullValues.length;

    let type: ColumnAnalysis['type'];
    // Prioritize numeric over temporal - if something is numeric, it's more likely to be numeric than temporal
    // Only consider temporal if it's clearly temporal AND not clearly numeric
    if (numericRatio > 0.8) {
      // If it's clearly numeric, prefer numeric over temporal
      // Only use temporal if temporal ratio is very high (>0.9) AND column name suggests date
      const colNameLower = columnName.toLowerCase();
      const isDateLikeName = /date|time|year|month|day/.test(colNameLower);
      if (temporalRatio > 0.9 && isDateLikeName) {
        type = 'temporal';
      } else {
        type = 'numeric';
      }
    } else if (temporalRatio > 0.5) {
      type = 'temporal';
    } else if (uniqueRatio < 0.5 && uniqueValues.size < 20) {
      type = 'categorical';
    } else {
      type = 'unknown';
    }

    analyses.push({
      name: columnName,
      type,
      uniqueCount: uniqueValues.size,
      distinctCount: uniqueValues.size,
      sampleValues: Array.from(uniqueValues)
        .slice(0, 5)
        .map((v) => {
          const num = parseFloat(String(v));
          return Number.isNaN(num) ? v : num;
        }),
    });
  }

  return analyses;
}

export function recommendChartTypes(result: SqlResult): ChartType[] {
  const analyses = analyzeDataColumns(result);
  const numericCols = analyses.filter((a) => a.type === 'numeric');
  const categoricalCols = analyses.filter((a) => a.type === 'categorical');
  const temporalCols = analyses.filter((a) => a.type === 'temporal');

  const recommendations: ChartType[] = [];

  // Temporal X + numeric Y → line, area, bar
  if (temporalCols.length > 0 && numericCols.length > 0) {
    recommendations.push('line');
    recommendations.push('area');
    recommendations.push('bar');
  }

  // Categorical X + numeric Y → bar, bar-horizontal, pie
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    recommendations.push('bar');
    recommendations.push('bar-horizontal');
    // Only recommend pie if categorical has few distinct values
    const lowCardinality = categoricalCols.some((c) => (c.distinctCount ?? 0) < 10);
    if (lowCardinality && categoricalCols.length === 1 && numericCols.length === 1) {
      recommendations.push('pie');
    }
  }

  // Two numeric → scatter
  if (numericCols.length >= 2) {
    recommendations.push('scatter');
  }

  // Single numeric → histogram (if we support it)
  if (numericCols.length === 1 && categoricalCols.length === 0 && temporalCols.length === 0) {
    recommendations.push('histogram');
  }

  // Default fallbacks
  if (recommendations.length === 0) {
    if (numericCols.length > 0) {
      recommendations.push('bar');
    } else {
      recommendations.push('bar');
    }
  }

  // Remove duplicates and return top 5
  return Array.from(new Set(recommendations)).slice(0, 5);
}

// Alias for backward compatibility
export function recommendChartType(result: SqlResult): ChartType[] {
  return recommendChartTypes(result);
}

export function validatePlotConfig(
  result: SqlResult | undefined,
  config: PlotConfig,
): { valid: boolean; message?: string } {
  if (!result) {
    return { valid: false, message: 'No data available' };
  }
  return validateFieldMapping(result, config);
}

export function validateFieldMapping(
  result: SqlResult,
  config: PlotConfig,
): { valid: boolean; message?: string } {
  if (!result.columns || result.columns.length === 0) {
    return { valid: false, message: 'No columns available in data' };
  }

  const analyses = analyzeDataColumns(result);
  const columnMap = new Map(analyses.map((a) => [a.name, a]));

  // X axis is required for most chart types
  const noXRequired = ['pie', 'doughnut', 'treemap', 'histogram'];
  if (!noXRequired.includes(config.chartType) && !config.mapping.x) {
    return { valid: false, message: 'X axis is required for this chart type' };
  }

  // Y axis is required for most chart types
  const noYRequired = ['pie', 'doughnut', 'treemap', 'histogram'];
  if (
    !noYRequired.includes(config.chartType) &&
    !config.mapping.y &&
    !Array.isArray(config.mapping.y)
  ) {
    return { valid: false, message: 'Y axis is required for this chart type' };
  }

  // Validate X field exists
  if (config.mapping.x && !columnMap.has(config.mapping.x)) {
    return { valid: false, message: `X field "${config.mapping.x}" not found in data` };
  }

  // Validate Y field(s) exist
  if (config.mapping.y) {
    const yFields = Array.isArray(config.mapping.y) ? config.mapping.y : [config.mapping.y];
    for (const yField of yFields) {
      if (!columnMap.has(yField)) {
        return { valid: false, message: `Y field "${yField}" not found in data` };
      }
    }
  }

  // Type-specific validations
  if (config.mapping.x) {
    const xCol = columnMap.get(config.mapping.x);
    if (config.chartType === 'scatter' && xCol && xCol.type !== 'numeric') {
      return { valid: false, message: 'X axis must be numeric for scatter plots' };
    }
    if (config.chartType === 'heatmap' && !xCol) {
      return { valid: false, message: 'X field is required for heatmap' };
    }
  }

  if (config.mapping.y) {
    const yFields = Array.isArray(config.mapping.y) ? config.mapping.y : [config.mapping.y];
    for (const yField of yFields) {
      const yCol = columnMap.get(yField);
      // For histogram, accept both numeric and temporal (temporal can be numeric values)
      const numericRequired = [
        'bar',
        'bar-horizontal',
        'line',
        'area',
        'scatter',
        'boxplot',
        'radar',
      ];
      if (yCol && numericRequired.includes(config.chartType) && yCol.type !== 'numeric') {
        return { valid: false, message: `Y field "${yField}" must be numeric for this chart type` };
      }
      // Histogram accepts numeric or temporal
      if (
        yCol &&
        config.chartType === 'histogram' &&
        yCol.type !== 'numeric' &&
        yCol.type !== 'temporal'
      ) {
        return {
          valid: false,
          message: `Y field "${yField}" must be numeric or temporal for histogram`,
        };
      }
    }

    // Combo chart requires at least 2 Y fields
    if (config.chartType === 'combo-bar-line') {
      if (!Array.isArray(config.mapping.y) || config.mapping.y.length < 2) {
        return { valid: false, message: 'Combo chart requires at least 2 Y fields' };
      }
    }
  }

  // Histogram validation
  if (config.chartType === 'histogram') {
    // For histogram, accept both numeric and temporal fields (temporal can be numeric values)
    // Check if we have a field that can be used for histogram
    const numericFields = analyses.filter((a) => a.type === 'numeric');
    const temporalFields = analyses.filter((a) => a.type === 'temporal');

    // Check if the selected field (X or Y) is numeric or temporal
    let hasValidField = false;
    if (config.mapping.x) {
      const xCol = columnMap.get(config.mapping.x);
      if (xCol && (xCol.type === 'numeric' || xCol.type === 'temporal')) {
        hasValidField = true;
      }
    }
    if (config.mapping.y) {
      const yCol = columnMap.get(config.mapping.y);
      if (yCol && (yCol.type === 'numeric' || yCol.type === 'temporal')) {
        hasValidField = true;
      }
    }

    // If no field is selected, check if we have any numeric or temporal fields available
    if (!hasValidField && numericFields.length === 0 && temporalFields.length === 0) {
      return { valid: false, message: 'Histogram requires at least one numeric or temporal field' };
    }

    // If a field is selected, validate it's numeric or temporal
    if (config.mapping.x) {
      const xCol = columnMap.get(config.mapping.x);
      if (xCol && xCol.type !== 'numeric' && xCol.type !== 'temporal') {
        return {
          valid: false,
          message: `X field "${config.mapping.x}" must be numeric or temporal for histogram`,
        };
      }
    }
    if (config.mapping.y) {
      const yCol = columnMap.get(config.mapping.y);
      if (yCol && yCol.type !== 'numeric' && yCol.type !== 'temporal') {
        return {
          valid: false,
          message: `Y field "${config.mapping.y}" must be numeric or temporal for histogram`,
        };
      }
    }
  }

  // Heatmap validation
  if (config.chartType === 'heatmap') {
    if (!config.mapping.x || !config.mapping.y) {
      return { valid: false, message: 'Heatmap requires both X and Y fields' };
    }
  }

  // Treemap validation
  if (config.chartType === 'treemap') {
    const hasGroupBy = config.aggregation?.groupBy && config.aggregation.groupBy.length > 0;
    const hasYField =
      config.mapping.y && (Array.isArray(config.mapping.y) ? config.mapping.y.length > 0 : true);
    if (!hasGroupBy && !config.mapping.x) {
      return { valid: false, message: 'Treemap requires groupBy fields or X field' };
    }
    if (!hasYField) {
      return { valid: false, message: 'Treemap requires a numeric size field (Y)' };
    }
  }

  // Boxplot validation
  if (config.chartType === 'boxplot') {
    const numericFields = analyses.filter((a) => a.type === 'numeric');
    if (numericFields.length === 0) {
      return { valid: false, message: 'Boxplot requires at least one numeric field' };
    }
  }

  // Sankey validation
  if (config.chartType === 'sankey') {
    if (!config.mapping.x || !config.mapping.y) {
      return { valid: false, message: 'Sankey requires source (X) and target (Y) fields' };
    }
  }

  // Radar validation
  if (config.chartType === 'radar') {
    const numericFields = analyses.filter((a) => a.type === 'numeric');
    if (numericFields.length === 0) {
      return { valid: false, message: 'Radar chart requires numeric metric columns' };
    }
  }

  if (config.mapping.color) {
    const colorCol = columnMap.get(config.mapping.color);
    if (
      colorCol &&
      colorCol.type !== 'categorical' &&
      config.chartType !== 'scatter' &&
      config.chartType !== 'heatmap'
    ) {
      // For scatter and heatmap, numeric color is OK
      return { valid: false, message: 'Color field should be categorical for this chart type' };
    }
  }

  // Facet validation
  if (config.mapping.facet) {
    const facetCol = columnMap.get(config.mapping.facet);
    if (facetCol) {
      const uniqueCount = facetCol.uniqueCount ?? 0;
      if (uniqueCount > 12) {
        return {
          valid: false,
          message: `Too many facet values (${uniqueCount}). Please filter to 12 or fewer.`,
        };
      }
    }
  }

  return { valid: true };
}
