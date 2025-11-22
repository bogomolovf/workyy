import type { SqlResult } from "../../state/executionStore";
import type { PlotNodePayload } from "./chartTypes";
import { analyzeDataColumns, recommendChartTypes } from "./dataAnalyzer";
import { suggestXField, suggestYField, suggestColorField } from "./fieldMapper";

/**
 * Auto-configure a Plot node based on data analysis
 */
export function autoConfigurePlotConfig(
  data: SqlResult,
  currentPayload?: PlotNodePayload
): Partial<PlotNodePayload> {
  // Don't auto-configure if already configured by user
  if (currentPayload?.autoConfigured === true) {
    return {};
  }

  // Don't auto-configure if user has already set mappings
  if (currentPayload?.mapping?.x || currentPayload?.mapping?.y) {
    return {};
  }

  const analyses = analyzeDataColumns(data);
  if (analyses.length === 0) {
    return {};
  }

  const recommendations = recommendChartTypes(data);
  const recommendedChartType = recommendations[0] || "bar";

  const xField = suggestXField(recommendedChartType, analyses);
  const yField = suggestYField(recommendedChartType, analyses, xField);
  const colorField = suggestColorField(analyses, xField, yField);

  return {
    chartType: recommendedChartType,
    mapping: {
      x: xField,
      y: yField,
      ...(colorField ? { color: colorField } : {}),
    },
    styling: {
      ...(currentPayload?.styling || {}),
      title: currentPayload?.styling?.title || "New Chart",
      theme: currentPayload?.styling?.theme || "light",
      showLegend: currentPayload?.styling?.showLegend !== undefined ? currentPayload.styling.showLegend : true,
      legendPosition: currentPayload?.styling?.legendPosition || "top",
      showGrid: currentPayload?.styling?.showGrid !== undefined ? currentPayload.styling.showGrid : true,
      enableTooltips: currentPayload?.styling?.enableTooltips !== undefined ? currentPayload.styling.enableTooltips : true,
    },
    autoConfigured: true,
    version: currentPayload?.version || "1",
  };
}

