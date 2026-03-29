'use client';

import { useEffect, useRef, useState } from 'react';
import { isGLChartType } from '../../../lib/visualization/chartTypes';
import type { ChartType } from '../../../lib/visualization/chartTypes';

// Simplified ECharts option type
type EChartsOption = Record<string, unknown>;

type EChartsRendererProps = {
  option: EChartsOption;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  echartsTheme?: string; // Named ECharts theme (vintage, macarons, etc.)
  chartType?: ChartType; // For lazy-loading GL/extensions
  refreshToken?: number; // Token to force refresh without remounting
  onError?: (error: Error) => void;
  onInstance?: (instance: any | null) => void;
};

// Track loaded extensions to avoid re-importing
const loadedExtensions = new Set<string>();

/** Load ECharts built-in themes */
async function loadEChartsTheme(themeName: string, echartsModule: any): Promise<void> {
  if (!themeName || loadedExtensions.has(`theme:${themeName}`)) return;

  try {
    // ECharts themes are registered globally. We fetch them from the CDN as JSON.
    // For bundled approach, we define the most popular themes inline.
    const themes: Record<string, Record<string, unknown>> = {
      vintage: {
        color: [
          '#d87c7c',
          '#919e8b',
          '#d7ab82',
          '#6e7074',
          '#61a0a8',
          '#efa18d',
          '#787464',
          '#cc7e63',
          '#724e58',
          '#4b565b',
        ],
        backgroundColor: '#fef8ef',
      },
      macarons: {
        color: [
          '#2ec7c9',
          '#b6a2de',
          '#5ab1ef',
          '#ffb980',
          '#d87a80',
          '#8d98b3',
          '#e5cf0d',
          '#97b552',
          '#95706d',
          '#dc69aa',
        ],
      },
      walden: {
        color: ['#3fb1e3', '#6be6c1', '#626c91', '#a0a7e6', '#c4ebad', '#96dee8'],
      },
      westeros: {
        color: ['#516b91', '#59c4e6', '#edafda', '#93b7e3', '#a5e7f0', '#cbb0e3'],
      },
      chalk: {
        color: [
          '#fc97af',
          '#87f7cf',
          '#f7f494',
          '#72ccff',
          '#f7c5a0',
          '#87c4ff',
          '#7eb0f8',
          '#c0d8f0',
        ],
        backgroundColor: '#293441',
      },
      essos: {
        color: ['#893448', '#d95850', '#eb8146', '#ffb248', '#f2d643', '#ebdba4'],
      },
      roma: {
        color: [
          '#E01F54',
          '#001852',
          '#f5e8c8',
          '#b8d2c7',
          '#c6b38e',
          '#a4d8c2',
          '#f3d999',
          '#d3758f',
          '#dcc392',
          '#2e4783',
        ],
      },
      shine: {
        color: [
          '#c12e34',
          '#e6b600',
          '#0098d9',
          '#2b821d',
          '#005eaa',
          '#339ca8',
          '#cda819',
          '#32a487',
        ],
      },
      infographic: {
        color: [
          '#C1232B',
          '#27727B',
          '#FCCE10',
          '#E87C25',
          '#B5C334',
          '#FE8463',
          '#9BCA63',
          '#FAD860',
          '#F3A43B',
          '#60C0DD',
        ],
      },
      wonderland: {
        color: ['#4ea397', '#22c3aa', '#7bd9a5', '#d0648a', '#f58db2', '#f2b3c9'],
      },
    };

    const themeData = themes[themeName];
    if (themeData) {
      echartsModule.registerTheme(themeName, themeData);
      loadedExtensions.add(`theme:${themeName}`);
    }
  } catch {
    // Theme loading failure is non-critical
  }
}

export function EChartsRenderer({
  option,
  width = 400,
  height = 300,
  theme = 'light',
  echartsTheme,
  chartType,
  refreshToken = 0,
  onError,
  onInstance,
}: EChartsRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [echarts, setEcharts] = useState<any>(null);
  const [chartInstance, setChartInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [extensionsLoaded, setExtensionsLoaded] = useState(false);

  // Stable onError ref
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Lazy load echarts + required extensions
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const loadEcharts = async () => {
      try {
        // Dynamic import that Next.js webpack can handle
        const echartsModule = await import(/* webpackChunkName: "echarts" */ 'echarts');

        // Load GL extension if needed (with retry)
        if (chartType && isGLChartType(chartType) && !loadedExtensions.has('echarts-gl')) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              await import(/* webpackChunkName: "echarts-gl" */ 'echarts-gl');
              loadedExtensions.add('echarts-gl');
              break;
            } catch (err) {
              if (attempt === 1) {
                if (!cancelled) {
                  setError(new Error('3D charts require echarts-gl which failed to load'));
                  setLoading(false);
                  return;
                }
              }
              // Brief pause before retry
              await new Promise((r) => setTimeout(r, 300));
            }
          }
        }

        // Load wordcloud extension if needed
        if (chartType === 'wordcloud' && !loadedExtensions.has('echarts-wordcloud')) {
          try {
            await import(/* webpackChunkName: "echarts-wordcloud" */ 'echarts-wordcloud');
            loadedExtensions.add('echarts-wordcloud');
          } catch (err) {
            console.warn('echarts-wordcloud not available:', err);
          }
        }

        // Load liquidfill extension if needed
        if (chartType === 'liquidfill' && !loadedExtensions.has('echarts-liquidfill')) {
          try {
            await import(/* webpackChunkName: "echarts-liquidfill" */ 'echarts-liquidfill');
            loadedExtensions.add('echarts-liquidfill');
          } catch (err) {
            console.warn('echarts-liquidfill not available:', err);
          }
        }

        // Load named theme if specified
        if (echartsTheme) {
          await loadEChartsTheme(echartsTheme, echartsModule);
        }

        if (!cancelled) {
          setEcharts(echartsModule);
          setExtensionsLoaded(true);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj);
          setLoading(false);
          onErrorRef.current?.(errorObj);
        }
      }
    };

    loadEcharts();

    return () => {
      cancelled = true;
    };
  }, [chartType, echartsTheme]);

  // Determine the theme to use for init
  const resolvedTheme = echartsTheme || (theme === 'dark' ? 'dark' : undefined);

  // Initialize chart instance
  useEffect(() => {
    if (!echarts || !containerRef.current || !extensionsLoaded) return;
    if (typeof window === 'undefined') return;

    let instance: any = null;
    try {
      instance = echarts.init(containerRef.current, resolvedTheme);
      setChartInstance(instance);
      onInstance?.(instance);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      onErrorRef.current?.(errorObj);
      onInstance?.(null);
    }

    return () => {
      if (instance) {
        try {
          instance.dispose();
        } catch {
          // Ignore disposal errors
        }
      }
      setChartInstance(null);
      onInstance?.(null);
    };
  }, [echarts, resolvedTheme, extensionsLoaded, onInstance]);

  // Update chart option - use ref to track previous option and avoid unnecessary updates
  const prevOptionRef = useRef<string | null>(null);
  const prevRefreshTokenRef = useRef<number>(0);

  useEffect(() => {
    if (!chartInstance || !option) return;

    // Force update if refreshToken changed
    const shouldForceUpdate = refreshToken !== prevRefreshTokenRef.current;
    prevRefreshTokenRef.current = refreshToken;

    // Serialize option to string for comparison to avoid unnecessary updates
    let optionString: string;
    try {
      optionString = JSON.stringify(option, (_, value) => {
        // Handle function values (e.g. wordcloud color function) - skip comparison
        if (typeof value === 'function') return '__fn__';
        return value;
      });
    } catch {
      optionString = String(Date.now()); // Force update if serialization fails
    }

    if (!shouldForceUpdate && prevOptionRef.current === optionString) {
      return; // Option hasn't actually changed
    }

    try {
      chartInstance.setOption(option, true);
      prevOptionRef.current = optionString;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      onErrorRef.current?.(errorObj);
    }
  }, [chartInstance, option, refreshToken]);

  // Handle resize - use ref to track container size and only resize when actually needed
  const containerSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!chartInstance || !containerRef.current) return;

    // Store initial size
    const rect = containerRef.current.getBoundingClientRect();
    containerSizeRef.current = { width: rect.width, height: rect.height };

    const handleResize = () => {
      if (!containerRef.current || !chartInstance) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newSize = { width: rect.width, height: rect.height };

      // Only resize if size actually changed
      if (
        !containerSizeRef.current ||
        containerSizeRef.current.width !== newSize.width ||
        containerSizeRef.current.height !== newSize.height
      ) {
        containerSizeRef.current = newSize;
        chartInstance.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chartInstance]);

  // Also handle size changes from props
  useEffect(() => {
    if (!chartInstance || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newSize = { width: rect.width, height: rect.height };

    if (
      !containerSizeRef.current ||
      containerSizeRef.current.width !== newSize.width ||
      containerSizeRef.current.height !== newSize.height
    ) {
      containerSizeRef.current = newSize;
      chartInstance.resize();
    }
  }, [chartInstance, width, height]);

  if (loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-slate-400"
        style={{ width, height }}
      >
        Loading chart...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-rose-500"
        style={{ width, height }}
      >
        Failed to load chart: {error.message}
      </div>
    );
  }

  return <div ref={containerRef} style={{ width, height, minHeight: height }} />;
}
