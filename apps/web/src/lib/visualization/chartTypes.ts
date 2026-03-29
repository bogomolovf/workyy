export type ChartType =
  | 'bar'
  | 'bar-horizontal'
  | 'line'
  | 'area'
  | 'scatter'
  | 'pie'
  | 'doughnut'
  | 'histogram'
  | 'heatmap'
  | 'treemap'
  | 'boxplot'
  | 'sankey'
  | 'radar'
  | 'combo-bar-line'
  // Phase 1: New 2D charts
  | 'funnel'
  | 'gauge'
  | 'sunburst'
  | 'candlestick'
  | 'graph'
  | 'parallel'
  | 'tree'
  | 'themeRiver'
  | 'waterfall'
  // Phase 2: 3D charts (echarts-gl)
  | 'scatter3d'
  | 'bar3d'
  | 'surface3d'
  | 'line3d'
  // Phase 3: Extensions
  | 'wordcloud'
  | 'liquidfill';

export type AxisType = 'x' | 'y' | 'z' | 'color' | 'size' | 'facet';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';

/** Chart types that require echarts-gl (lazy-loaded) */
export const GL_CHART_TYPES: ChartType[] = ['scatter3d', 'bar3d', 'surface3d', 'line3d'];

/** Chart types that require external extensions (lazy-loaded) */
export const EXTENSION_CHART_TYPES: ChartType[] = ['wordcloud', 'liquidfill'];

/** Chart types with internal roam/drag that capture pointer events (GL + interactive 2D) */
export const INTERACTIVE_CHART_TYPES: ChartType[] = [
  ...GL_CHART_TYPES,
  'graph', // force layout with roam
  'tree', // expandAndCollapse with roam-like behavior
  'sankey', // draggable nodes
];

/** Check if a chart type has internal pointer-event-capturing interaction */
export function isInteractiveChartType(chartType: ChartType): boolean {
  return INTERACTIVE_CHART_TYPES.includes(chartType);
}

/** Check if a chart type needs echarts-gl */
export function isGLChartType(chartType: ChartType): boolean {
  return GL_CHART_TYPES.includes(chartType);
}

/** Check if a chart type needs an extension */
export function isExtensionChartType(chartType: ChartType): boolean {
  return EXTENSION_CHART_TYPES.includes(chartType);
}

export type PlotConfig = {
  chartType: ChartType;
  mapping: {
    x?: string;
    y?: string | string[];
    z?: string; // For 3D charts
    color?: string;
    size?: string;
    facet?: string;
    open?: string; // For candlestick (OHLC)
    close?: string;
    high?: string;
    low?: string;
    source?: string; // For graph (edges)
    target?: string;
    weight?: string; // For graph/wordcloud
  };
  aggregation?: {
    type: AggregationType;
    groupBy?: string[];
  };
  filters?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
    value: unknown;
  }>;
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  styling: {
    title?: string;
    theme?: 'light' | 'dark';
    echartsTheme?: string; // Named ECharts theme (vintage, macarons, dark, etc.)
    colors?: string[];
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    showGrid?: boolean;
    enableZoomPan?: boolean;
    enableTooltips?: boolean;
    universalTransition?: boolean;
  };
  // Gauge-specific config
  gaugeConfig?: {
    min?: number;
    max?: number;
    valueField?: string;
  };
  // Liquidfill-specific config
  liquidfillConfig?: {
    shape?: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond';
  };
};

export type PlotNodePayload = PlotConfig & {
  version?: string;
  autoConfigured?: boolean; // Flag to prevent re-auto-configuring after user changes
};
