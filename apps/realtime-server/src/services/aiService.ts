/**
 * DeepSeek AI service — proxies chart config generation requests.
 * Uses OpenAI-compatible API at https://api.deepseek.com
 */

export type AiChartRequest = {
  prompt: string;
  columns: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'temporal' | 'unknown';
    distinctCount: number;
    sampleValues?: Array<string | number | null>;
  }>;
  rowCount: number;
};

export type AiChartResponse = {
  config: Record<string, unknown>;
  raw?: string;
};

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const CHART_TYPES = [
  'bar', 'bar-horizontal', 'line', 'area', 'scatter',
  'pie', 'doughnut', 'histogram', 'heatmap', 'treemap',
  'boxplot', 'sankey', 'radar', 'combo-bar-line',
  'funnel', 'gauge', 'sunburst', 'candlestick',
  'waterfall', 'wordcloud',
] as const;

const SYSTEM_PROMPT = `You are a data visualization assistant. Given a dataset schema and a user request, produce a PlotConfig JSON object.

AVAILABLE CHART TYPES:
${CHART_TYPES.join(' | ')}

AGGREGATION TYPES: sum | avg | count | min | max | median

OUTPUT FORMAT (strict JSON, no markdown, no explanation):
{
  "chartType": "<one of available types>",
  "mapping": {
    "x": "<column name or omit>",
    "y": "<column name or array of column names>",
    "color": "<column name for grouping or omit>",
    "size": "<column name or omit>"
  },
  "aggregation": {
    "type": "<aggregation type or omit entirely>",
    "groupBy": ["<columns>"]
  },
  "styling": {
    "title": "<descriptive chart title>",
    "showLegend": true,
    "enableTooltips": true
  }
}

RULES:
- Use ONLY column names from the provided schema
- For pie/doughnut: x = category field, y = value field
- For histogram: y = numeric field (x is auto-generated)
- For scatter: both x and y must be numeric
- For combo-bar-line: y must be an array of 2+ numeric columns
- Pick the most appropriate chart type for the user's intent
- If the user specifies a chart type, use it
- aggregation is optional — only add if user asks for totals/averages or if data needs grouping
- Respond with ONLY the JSON object, nothing else

EXAMPLES:

Schema: country(categorical,5), revenue(numeric,450), quarter(temporal,8)
User: "revenue by quarter for each country"
{"chartType":"line","mapping":{"x":"quarter","y":"revenue","color":"country"},"styling":{"title":"Revenue by Quarter per Country","showLegend":true,"enableTooltips":true}}

Schema: product(categorical,20), sales(numeric,1000), region(categorical,4)
User: "total sales by product as horizontal bars"
{"chartType":"bar-horizontal","mapping":{"x":"sales","y":"product"},"aggregation":{"type":"sum","groupBy":["product"]},"styling":{"title":"Total Sales by Product","showLegend":false,"enableTooltips":true}}

Schema: age(numeric,80), income(numeric,5000)
User: "scatter age vs income"
{"chartType":"scatter","mapping":{"x":"age","y":"income"},"styling":{"title":"Age vs Income","showLegend":false,"enableTooltips":true}}`;

function buildUserPrompt(req: AiChartRequest): string {
  const schemaLines = req.columns.map((col) => {
    const samples = col.sampleValues?.slice(0, 5).join(', ') ?? '';
    return `- "${col.name}" (${col.type}, ${col.distinctCount} distinct${samples ? `, samples: [${samples}]` : ''})`;
  });

  return `DATASET SCHEMA (${req.rowCount} rows):
${schemaLines.join('\n')}

USER REQUEST: "${req.prompt}"`;
}

export async function generateChartConfig(req: AiChartRequest): Promise<AiChartResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const userPrompt = buildUserPrompt(req);

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content: string = data?.choices?.[0]?.message?.content ?? '';

  if (!content) {
    throw new Error('DeepSeek returned empty response');
  }

  const config = JSON.parse(content) as Record<string, unknown>;

  return { config, raw: content };
}
