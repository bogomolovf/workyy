"use client";

import { useEffect, useRef, useState } from "react";

// Simplified ECharts option type
type EChartsOption = Record<string, unknown>;

type EChartsRendererProps = {
  option: EChartsOption;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  refreshToken?: number; // Token to force refresh without remounting
  onError?: (error: Error) => void;
  onInstance?: (instance: any | null) => void;
};

export function EChartsRenderer({ option, width = 400, height = 300, theme = "light", refreshToken = 0, onError, onInstance }: EChartsRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [echarts, setEcharts] = useState<any>(null);
  const [chartInstance, setChartInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Lazy load echarts - only on client side
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    let cancelled = false;
    // Use a function to ensure dynamic import is not analyzed at build time
    const loadEcharts = async () => {
      try {
        // Dynamic import that Next.js webpack can handle
        const echartsModule = await import(/* webpackChunkName: "echarts" */ "echarts");
        if (!cancelled) {
          setEcharts(echartsModule);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj);
          setLoading(false);
          onError?.(errorObj);
        }
      }
    };
    
    loadEcharts();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  // Initialize chart instance
  useEffect(() => {
    if (!echarts || !containerRef.current) return;
    if (typeof window === "undefined") return;

    let instance: any = null;
    try {
      instance = echarts.init(containerRef.current, theme);
      setChartInstance(instance);
      onInstance?.(instance);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      onError?.(errorObj);
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
  }, [echarts, theme, onError, onInstance]);

  // Update chart option - use ref to track previous option and avoid unnecessary updates
  const prevOptionRef = useRef<string | null>(null);
  const prevRefreshTokenRef = useRef<number>(0);
  
  useEffect(() => {
    if (!chartInstance || !option) return;
    
    // Force update if refreshToken changed
    const shouldForceUpdate = refreshToken !== prevRefreshTokenRef.current;
    prevRefreshTokenRef.current = refreshToken;
    
    // Serialize option to string for comparison to avoid unnecessary updates
    const optionString = JSON.stringify(option);
    if (!shouldForceUpdate && prevOptionRef.current === optionString) {
      return; // Option hasn't actually changed
    }
    
    try {
      chartInstance.setOption(option, true);
      prevOptionRef.current = optionString;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      onError?.(errorObj);
    }
  }, [chartInstance, option, refreshToken, onError]);

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
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-400" style={{ width, height }}>
        Loading chart...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-rose-500" style={{ width, height }}>
        Failed to load chart: {error.message}
      </div>
    );
  }

  return <div ref={containerRef} style={{ width, height, minHeight: height }} />;
}

