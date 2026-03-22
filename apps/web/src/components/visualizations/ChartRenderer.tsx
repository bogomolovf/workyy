'use client';

import { useMemo, useEffect, useRef } from 'react';
import type { SqlResult } from '../../state/executionStore';
import type { ChartType, PlotConfig } from '../../lib/visualization/chartTypes';
import { buildEChartsConfig } from '../../lib/visualization/chartBuilder';
import { EChartsRenderer } from './echarts/EChartsRenderer';
import { validatePlotConfig } from '../../lib/visualization/dataAnalyzer';

type ChartRendererProps = {
  chartType: ChartType;
  config: PlotConfig;
  data: SqlResult | undefined;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  refreshToken?: number; // Token to force refresh without remounting
  onError?: (error: Error) => void;
  onEChartsInstance?: (instance: any | null) => void;
};

export function ChartRenderer({
  chartType,
  config,
  data,
  width = 400,
  height = 300,
  theme = 'light',
  refreshToken = 0,
  onError,
  onEChartsInstance,
}: ChartRendererProps) {
  // IMPORTANT: All hooks must be called before any conditional returns
  // Memoize config key to avoid unnecessary recalculations when config object reference changes but content is the same
  const configKey = useMemo(() => {
    try {
      return JSON.stringify({
        chartType: config.chartType,
        mapping: config.mapping,
        aggregation: config.aggregation,
        filters: config.filters,
        sort: config.sort,
        styling: config.styling,
      });
    } catch {
      // Fallback if JSON.stringify fails
      return `${config.chartType}-${JSON.stringify(config.mapping)}`;
    }
  }, [config]);

  // Build ECharts configuration - memoize to prevent unnecessary re-renders
  // Use configKey instead of config object to avoid unnecessary recalculations
  const buildResult = useMemo(() => {
    if (!data) return { option: null, error: null };
    try {
      const option = buildEChartsConfig(data, config);
      return { option, error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { option: null, error };
    }
    // Use configKey for stable comparison, but still need config for the actual build
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, configKey]);

  // Handle errors separately to avoid dependency issues
  const errorHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (buildResult.error) {
      const errorKey = `${buildResult.error.message}-${data?.rows?.length || 0}`;
      if (errorHandledRef.current !== errorKey) {
        errorHandledRef.current = errorKey;
        onError?.(buildResult.error);
      }
    }
  }, [buildResult.error, onError, data?.rows?.length]);

  const echartsOption = buildResult.option;

  // Now we can do conditional returns after all hooks
  if (!data) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-slate-500"
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="mb-1 font-medium">No data available</p>
          <p className="text-xs">Connect a SQL, Python, or CSV node to see data.</p>
        </div>
      </div>
    );
  }

  // Validate configuration
  const validation = validatePlotConfig(data, config);
  if (!validation.valid) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-rose-500"
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="mb-1 font-medium">Invalid configuration</p>
          <p className="text-xs">{validation.message}</p>
        </div>
      </div>
    );
  }

  if (echartsOption === null) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-rose-500"
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="mb-1 font-medium">Failed to render chart</p>
        </div>
      </div>
    );
  }

  // Render using ECharts
  // Pass refreshToken to EChartsRenderer so it can force update without remounting
  return (
    <EChartsRenderer
      option={echartsOption}
      width={width}
      height={height}
      theme={theme || config.styling.theme || 'light'}
      echartsTheme={config.styling.echartsTheme}
      chartType={config.chartType}
      refreshToken={refreshToken}
      onError={onError}
      onInstance={onEChartsInstance}
    />
  );
}
