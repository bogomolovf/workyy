import { apiFetch, API_URL } from './apiClient';
import type { ColumnAnalysis } from './visualization/dataAnalyzer';

export type GenerateChartConfigRequest = {
  prompt: string;
  columns: ColumnAnalysis[];
  rowCount: number;
};

export type GenerateChartConfigResponse = {
  config: Record<string, unknown>;
  raw?: string;
};

export async function generateChartConfig(
  req: GenerateChartConfigRequest,
): Promise<GenerateChartConfigResponse> {
  return apiFetch<GenerateChartConfigResponse>(`${API_URL}/api/ai/chart-config`, {
    method: 'POST',
    body: req,
  });
}
