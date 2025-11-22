import type { ColumnAnalysis } from "./dataAnalyzer";

export function getNumericColumns(analyses: ColumnAnalysis[]): ColumnAnalysis[] {
  return analyses.filter((a) => a.type === "numeric");
}

export function getCategoricalColumns(analyses: ColumnAnalysis[]): ColumnAnalysis[] {
  return analyses.filter((a) => a.type === "categorical");
}

export function getTemporalColumns(analyses: ColumnAnalysis[]): ColumnAnalysis[] {
  return analyses.filter((a) => a.type === "temporal");
}

/**
 * Suggest default X field based on chart type and available columns
 */
export function suggestXField(
  chartType: string,
  analyses: ColumnAnalysis[]
): string | undefined {
  const temporal = getTemporalColumns(analyses);
  const categorical = getCategoricalColumns(analyses);
  const numeric = getNumericColumns(analyses);

  // For line/area charts, prefer temporal
  if ((chartType === "line" || chartType === "area") && temporal.length > 0) {
    return temporal[0].name;
  }

  // For bar/pie charts, prefer categorical
  if (
    (chartType === "bar" ||
      chartType === "bar-horizontal" ||
      chartType === "pie" ||
      chartType === "doughnut") &&
    categorical.length > 0
  ) {
    // Prefer categorical with fewer distinct values
    const sorted = categorical.sort((a, b) => (a.uniqueCount ?? 0) - (b.uniqueCount ?? 0));
    return sorted[0].name;
  }

  // For scatter, prefer numeric
  if (chartType === "scatter" && numeric.length > 0) {
    return numeric[0].name;
  }

  // Fallback: first temporal, then categorical, then numeric
  if (temporal.length > 0) return temporal[0].name;
  if (categorical.length > 0) return categorical[0].name;
  if (numeric.length > 0) return numeric[0].name;

  return analyses[0]?.name;
}

/**
 * Suggest default Y field based on chart type and available columns
 */
export function suggestYField(
  chartType: string,
  analyses: ColumnAnalysis[],
  xField?: string
): string | undefined {
  const numeric = getNumericColumns(analyses);

  // For pie/doughnut, we don't need Y in the same way, but we need a numeric for value
  if (chartType === "pie" || chartType === "doughnut") {
    // Use first numeric that's not the X field
    const available = numeric.filter((a) => a.name !== xField);
    return available[0]?.name || numeric[0]?.name;
  }

  // For other charts, Y should be numeric
  if (numeric.length > 0) {
    // Prefer numeric that's not X
    const available = numeric.filter((a) => a.name !== xField);
    return available[0]?.name || numeric[0]?.name;
  }

  return undefined;
}

/**
 * Suggest default color field (categorical preferred)
 */
export function suggestColorField(
  analyses: ColumnAnalysis[],
  xField?: string,
  yField?: string
): string | undefined {
  const categorical = getCategoricalColumns(analyses);
  const available = categorical.filter(
    (a) => a.name !== xField && a.name !== yField && (a.uniqueCount ?? 0) < 20
  );
  return available[0]?.name || categorical[0]?.name;
}

