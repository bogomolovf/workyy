'use client';

import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { ChartRenderer } from '../visualizations/ChartRenderer';
import { usePlotData } from '../../hooks/usePlotData';
import type { PlotNodePayload } from '../../lib/visualization/chartTypes';
import { validatePlotConfig } from '../../lib/visualization/dataAnalyzer';
import { DATA_NODE_HANDLE_CLASS } from '../BoardCanvas';
import { Download, CaretDown } from '@phosphor-icons/react';

type PlotNodeData = {
  nodeId: string;
  payload?: Record<string, unknown>;
  edges: Array<{ sourceId: string; targetId: string }>;
  width: number;
};

function PlotNodeComponent({ data, selected }: NodeProps<PlotNodeData>) {
  // IMPORTANT: All hooks must be called unconditionally at the top level
  // Memoize payload to ensure stable reference
  const payload = useMemo(() => {
    return (
      (data.payload as PlotNodePayload | undefined) ??
      ({
        chartType: 'bar',
        mapping: {},
        styling: {
          title: 'New Chart',
          theme: 'light',
          showLegend: true,
          legendPosition: 'top',
          showGrid: true,
          enableZoomPan: false,
          enableTooltips: true,
        },
        version: '1',
        autoConfigured: false,
      } satisfies PlotNodePayload)
    );
  }, [data.payload]);

  // Memoize edges to ensure stable reference for usePlotData
  // Only incoming edges matter for this node
  const incomingEdges = useMemo(
    () => data.edges.filter((e) => e.targetId === data.nodeId),
    [data.edges, data.nodeId],
  );

  // Use simplified usePlotData that reads from Zustand directly
  const plotData = usePlotData(data.nodeId, incomingEdges);
  const echartsInstanceRef = useRef<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Memoize status calculation to avoid unnecessary recalculations
  const { status, errorMessage } = useMemo(() => {
    let currentStatus: 'no-data' | 'config-needed' | 'ready' | 'error' = 'ready';
    let currentErrorMessage: string | undefined;

    if (!plotData) {
      // Check if there are incoming edges
      const hasIncomingEdges = incomingEdges.length > 0;
      if (hasIncomingEdges) {
        currentStatus = 'no-data';
        currentErrorMessage = 'Run upstream node to load data.';
      } else {
        currentStatus = 'no-data';
        currentErrorMessage = 'Connect a SQL or Python node to this chart.';
      }
    } else {
      const validation = validatePlotConfig(plotData, payload);
      if (!validation.valid) {
        currentStatus = 'config-needed';
        currentErrorMessage = validation.message;
      } else if (
        !payload.mapping.x ||
        (!payload.mapping.y && payload.chartType !== 'pie' && payload.chartType !== 'doughnut')
      ) {
        currentStatus = 'config-needed';
      } else {
        currentStatus = 'ready';
      }
    }

    return { status: currentStatus, errorMessage: currentErrorMessage };
  }, [plotData, payload, incomingEdges.length, data.nodeId]);

  const chartHeight = 360;
  const nodeWidth = data.width || 500;

  // Memoize callback to prevent unnecessary re-renders
  const handleEChartsInstance = useCallback((instance: any | null) => {
    echartsInstanceRef.current = instance;
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = () => setShowExportMenu(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportMenu]);

  const handleExport = async (format: 'png' | 'svg') => {
    if (!echartsInstanceRef.current) {
      return;
    }

    try {
      const dataUrl = echartsInstanceRef.current.getDataURL({
        type: format,
        pixelRatio: 2,
        backgroundColor: '#fff',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${payload.styling.title || 'chart'}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportMenu(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div
      className={`group rounded-md border bg-white shadow-lg transition-all ${
        selected ? 'ring-2 ring-indigo-400' : 'border-slate-200'
      }`}
      style={{ width: nodeWidth, minHeight: 400 }}
    >
      {/* Target handles on left for incoming data */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          left: -6,
          top: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          top: -6,
          left: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />

      {/* Source handles on right/bottom for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          right: -6,
          top: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={DATA_NODE_HANDLE_CLASS}
        style={{
          bottom: -6,
          left: '50%',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />

      <div className="px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Plot Node</span>
            <span className="text-xs font-semibold text-slate-900">{data.nodeId.slice(0, 6)}</span>
          </div>
          <div className="flex items-center gap-2">
            {status === 'no-data' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                No data
              </span>
            )}
            {status === 'config-needed' && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                Config needed
              </span>
            )}
            {/* Export button - always visible when status is ready, regardless of selection */}
            {status === 'ready' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!echartsInstanceRef.current) {
                      // If instance is not ready yet, try to wait a bit and retry
                      setTimeout(() => {
                        if (echartsInstanceRef.current) {
                          setShowExportMenu(!showExportMenu);
                        }
                      }, 100);
                      return;
                    }
                    setShowExportMenu(!showExportMenu);
                  }}
                  disabled={!echartsInstanceRef.current}
                  className={`flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs ${
                    echartsInstanceRef.current
                      ? 'text-slate-600 hover:bg-slate-50'
                      : 'text-slate-400 cursor-not-allowed opacity-50'
                  }`}
                  title={echartsInstanceRef.current ? 'Export chart' : 'Chart is loading...'}
                >
                  <Download size={14} />
                  <CaretDown size={12} />
                </button>
                {showExportMenu && echartsInstanceRef.current && (
                  <div className="absolute right-0 top-full z-10 mt-1 rounded border border-slate-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExport('png')}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Export as PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('svg')}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Export as SVG
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
          {/* Always render ChartRenderer to maintain hook order */}
          <ChartRenderer
            key={`chart-${data.nodeId}`}
            chartType={payload.chartType}
            config={payload}
            data={status === 'ready' ? plotData : undefined}
            width={nodeWidth - 32 - 16} // Account for padding and border
            height={chartHeight}
            theme={payload.styling.theme || 'light'}
            onEChartsInstance={handleEChartsInstance}
          />
        </div>
      </div>
    </div>
  );
}

// Memoize PlotNode to avoid unnecessary re-renders
// Only re-render when node-specific props change, not when entire board state changes
export const PlotNode = memo(PlotNodeComponent, (prevProps, nextProps) => {
  // Always re-render if node ID changes (different node)
  if (prevProps.data.nodeId !== nextProps.data.nodeId) return false;

  // Re-render if selection state changes (affects visual appearance)
  if (prevProps.selected !== nextProps.selected) return false;

  // Re-render if width changes
  if (prevProps.data.width !== nextProps.data.width) return false;

  // Deep compare payload
  const prevPayload = prevProps.data.payload;
  const nextPayload = nextProps.data.payload;
  if (prevPayload !== nextPayload) {
    try {
      const areEqual = JSON.stringify(prevPayload) === JSON.stringify(nextPayload);
      if (!areEqual) return false;
    } catch {
      return false; // If comparison fails, re-render to be safe
    }
  }

  // Compare edges (only incoming edges matter for this node)
  // Create stable keys for comparison
  const prevIncomingKey = prevProps.data.edges
    .filter((e) => e.targetId === prevProps.data.nodeId)
    .map((e) => e.sourceId)
    .sort()
    .join(',');
  const nextIncomingKey = nextProps.data.edges
    .filter((e) => e.targetId === nextProps.data.nodeId)
    .map((e) => e.sourceId)
    .sort()
    .join(',');
  if (prevIncomingKey !== nextIncomingKey) return false;

  return true; // Props are equal, skip re-render
});
