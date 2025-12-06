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
  | 'combo-bar-line';

export type AxisType = 'x' | 'y' | 'color' | 'size' | 'facet';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';

export type PlotConfig = {
  chartType: ChartType;
  mapping: {
    x?: string;
    y?: string | string[];
    color?: string;
    size?: string;
    facet?: string;
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
    colors?: string[];
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    showGrid?: boolean;
    enableZoomPan?: boolean;
    enableTooltips?: boolean;
  };
};

export type PlotNodePayload = PlotConfig & {
  version?: string;
  autoConfigured?: boolean; // Flag to prevent re-auto-configuring after user changes
};
