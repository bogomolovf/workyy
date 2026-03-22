import { useState, useCallback } from 'react';
import { generateChartConfig } from '../lib/aiApi';
import { analyzeDataColumns } from '../lib/visualization/dataAnalyzer';
import type { PlotConfig } from '../lib/visualization/chartTypes';
import type { SqlResult } from '../state/executionStore';

type AiChartState = {
  loading: boolean;
  error: string | null;
};

/**
 * Hook for AI-powered chart config generation.
 * Takes user prompt + data, calls backend DeepSeek proxy, returns PlotConfig.
 */
export function useAiChartGeneration() {
  const [state, setState] = useState<AiChartState>({ loading: false, error: null });

  const generate = useCallback(
    async (prompt: string, data: SqlResult): Promise<PlotConfig | null> => {
      if (!prompt.trim() || !data?.columns?.length || !data?.rows?.length) {
        setState({ loading: false, error: 'No data or prompt provided' });
        return null;
      }

      setState({ loading: true, error: null });

      try {
        const columns = analyzeDataColumns(data);
        const result = await generateChartConfig({
          prompt: prompt.trim(),
          columns,
          rowCount: data.rows.length,
        });

        const config = result.config as PlotConfig;

        // Basic sanity check
        if (!config.chartType || !config.mapping) {
          setState({ loading: false, error: 'AI returned invalid config' });
          return null;
        }

        // Ensure styling exists
        if (!config.styling) {
          config.styling = { enableTooltips: true };
        }

        setState({ loading: false, error: null });
        return config;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI generation failed';
        setState({ loading: false, error: message });
        return null;
      }
    },
    [],
  );

  return { ...state, generate };
}
