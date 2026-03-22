'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import type {
  PlotNodePayload,
  ChartType,
  AggregationType,
} from '../../lib/visualization/chartTypes';
import { isGLChartType } from '../../lib/visualization/chartTypes';
import {
  analyzeDataColumns,
  recommendChartTypes,
  validatePlotConfig,
  type ColumnAnalysis,
} from '../../lib/visualization/dataAnalyzer';
import {
  suggestXField,
  suggestYField,
  suggestColorField,
} from '../../lib/visualization/fieldMapper';
import { autoConfigurePlotConfig } from '../../lib/visualization/autoConfig';
import type { SqlResult } from '../../state/executionStore';
import { X, Plus, Trash, CaretDown, CaretRight, MagicWand, SpinnerGap } from '@phosphor-icons/react';
import { useAiChartGeneration } from '../../hooks/useAiChartGeneration';

type PlotNodeConfigPanelProps = {
  nodeId: string;
  payload: PlotNodePayload;
  data: SqlResult | undefined;
  onChange: (nodeId: string, payload: Partial<PlotNodePayload>) => void;
};

/* ── i18n ─────────────────────────────────────────────────── */
const T = {
  dataSource: 'Источник данных',
  rowsCols: (r: number, c: number) => `${r} строк × ${c} столбцов`,
  more: (n: number) => `+${n} ещё`,
  autoConfigTitle: 'Автонастройка применена',
  autoConfigDesc: 'Тип графика и поля настроены автоматически. Вы можете изменить их.',
  chartType: 'Тип графика',
  fields: 'Поля данных',
  xAxis: 'Ось X',
  yAxis: 'Ось Y',
  zAxis: 'Ось Z',
  color: 'Цвет / Группировка',
  title: 'Заголовок',
  titlePlaceholder: 'Название графика',
  advanced: 'Расширенные настройки',
  aggregation: 'Агрегация',
  aggType: 'Функция',
  groupBy: 'Группировать по',
  filters: 'Фильтры',
  addFilter: 'Добавить',
  sort: 'Сортировка',
  addSort: 'Добавить',
  asc: 'По возрастанию',
  desc: 'По убыванию',
  value: 'Значение',
  style: 'Оформление',
  theme: 'Тема',
  light: 'Светлая',
  dark: 'Тёмная',
  legend: 'Легенда',
  zoomPan: 'Масштаб и панорама',
  select: '— Выберите —',
  none: 'Нет',
  recommended: 'Рекомендуемые',
  colType: { numeric: 'числ.', categorical: 'кат.', temporal: 'время', unknown: '?' } as Record<string, string>,
  // Specialized fields
  ohlc: 'Поля OHLC',
  open: 'Открытие',
  high: 'Максимум',
  low: 'Минимум',
  close: 'Закрытие',
  source: 'Источник',
  target: 'Цель',
  weight: 'Вес',
  valueField: 'Поле значения',
  min: 'Минимум',
  max: 'Максимум',
  shape: 'Форма',
  yFields: 'Поля Y (мин. 2)',
  addY: 'Добавить Y',
} as const;

/* ── Chart type catalog ───────────────────────────────────── */
type ChartMeta = { value: ChartType; label: string; icon: string };

const POPULAR_CHARTS: ChartMeta[] = [
  { value: 'bar', label: 'Столбчатый', icon: '📊' },
  { value: 'line', label: 'Линейный', icon: '📈' },
  { value: 'area', label: 'Областной', icon: '📈' },
  { value: 'scatter', label: 'Точечный', icon: '⚫' },
  { value: 'pie', label: 'Круговая', icon: '🥧' },
  { value: 'histogram', label: 'Гистограмма', icon: '📊' },
];

const MORE_CHARTS: { label: string; types: ChartMeta[] }[] = [
  {
    label: 'Статистика',
    types: [
      { value: 'bar-horizontal', label: 'Горизонтальный', icon: '📊' },
      { value: 'heatmap', label: 'Тепловая карта', icon: '🔥' },
      { value: 'boxplot', label: 'Ящик с усами', icon: '📦' },
      { value: 'radar', label: 'Радар', icon: '🕸️' },
    ],
  },
  {
    label: 'Иерархии и потоки',
    types: [
      { value: 'treemap', label: 'Древовидная', icon: '🌳' },
      { value: 'sunburst', label: 'Солнечная', icon: '☀️' },
      { value: 'sankey', label: 'Санки', icon: '🌊' },
      { value: 'funnel', label: 'Воронка', icon: '🔻' },
    ],
  },
  {
    label: 'Финансовые / Индикаторы',
    types: [
      { value: 'candlestick', label: 'Свечной', icon: '🕯️' },
      { value: 'waterfall', label: 'Каскадная', icon: '📉' },
      { value: 'gauge', label: 'Индикатор', icon: '🎯' },
      { value: 'combo-bar-line', label: 'Комбо', icon: '📊' },
    ],
  },
  {
    label: '3D',
    types: [
      { value: 'scatter3d', label: '3D Точечный', icon: '🔮' },
      { value: 'bar3d', label: '3D Столбцы', icon: '🏗️' },
      { value: 'surface3d', label: '3D Поверхность', icon: '🏔️' },
    ],
  },
  {
    label: 'Специальные',
    types: [
      { value: 'wordcloud', label: 'Облако слов', icon: '☁️' },
      { value: 'doughnut', label: 'Кольцевая', icon: '🍩' },
      { value: 'graph', label: 'Граф связей', icon: '🔗' },
      { value: 'parallel', label: 'Параллельные', icon: '📐' },
      { value: 'liquidfill', label: 'Жидкостный', icon: '💧' },
    ],
  },
];

const ALL_CHARTS: ChartMeta[] = [
  ...POPULAR_CHARTS,
  ...MORE_CHARTS.flatMap((g) => g.types),
];

const AGG_TYPES: { value: AggregationType; label: string }[] = [
  { value: 'sum', label: 'Сумма' },
  { value: 'avg', label: 'Среднее' },
  { value: 'count', label: 'Кол-во' },
  { value: 'min', label: 'Мин' },
  { value: 'max', label: 'Макс' },
  { value: 'median', label: 'Медиана' },
];

const FILTER_OPS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'содержит' },
  { value: 'in', label: 'в списке' },
] as const;

/* ── Helpers ──────────────────────────────────────────────── */
function colIcon(type: string) {
  return type === 'numeric' ? '#' : type === 'categorical' ? '🏷' : type === 'temporal' ? '🕒' : '?';
}

/** Which fields are needed for each chart type */
function fieldsFor(ct: ChartType): { x?: boolean; y?: boolean; z?: boolean; color?: boolean; ohlc?: boolean; srcTgt?: boolean; weight?: boolean; multiY?: boolean } {
  switch (ct) {
    case 'pie': case 'doughnut': case 'gauge': case 'liquidfill': case 'wordcloud':
      return { y: true, weight: ct === 'wordcloud' };
    case 'histogram': case 'boxplot':
      return { y: true };
    case 'radar': case 'parallel':
      return {};
    case 'candlestick':
      return { x: true, ohlc: true };
    case 'graph':
      return { srcTgt: true, weight: true };
    case 'combo-bar-line':
      return { x: true, multiY: true };
    case 'scatter3d': case 'bar3d': case 'surface3d': case 'line3d':
      return { x: true, y: true, z: true };
    case 'sankey':
      return { x: true, y: true };
    default:
      return { x: true, y: true, color: true };
  }
}

function translateValidation(en: string): string {
  const translations: Record<string, string> = {
    'No data available': 'Нет данных',
    'No columns available in data': 'В данных нет столбцов',
    'X axis is required for this chart type': 'Нужна ось X',
    'Y axis is required for this chart type': 'Нужна ось Y',
    'X axis must be numeric for scatter plots': 'Ось X должна быть числовой',
    'X field is required for heatmap': 'Нужно поле X для тепловой карты',
    'Combo chart requires at least 2 Y fields': 'Нужно минимум 2 поля Y',
    'Histogram requires at least one numeric or temporal field': 'Нужно числовое поле',
    'Heatmap requires both X and Y fields': 'Нужны поля X и Y',
    'Treemap requires groupBy fields or X field': 'Нужна группировка или поле X',
    'Treemap requires a numeric size field (Y)': 'Нужно числовое поле Y',
    'Boxplot requires at least one numeric field': 'Нужно числовое поле',
    'Sankey requires source (X) and target (Y) fields': 'Нужны поля источника (X) и цели (Y)',
    'Radar chart requires numeric metric columns': 'Нужны числовые метрики',
    'Candlestick requires Open, High, Low, Close fields': 'Нужны поля Open, High, Low, Close',
    'Graph requires Source and Target fields': 'Нужны поля Источник и Цель',
    'Parallel coordinates requires at least 2 numeric columns': 'Нужно мин. 2 числовых столбца',
    '3D charts require X, Y, and Z fields': 'Нужны поля X, Y и Z',
    'Funnel requires label (X) and value (Y) fields': 'Нужны поля метки (X) и значения (Y)',
    'Sunburst requires groupBy or X field for hierarchy': 'Нужна группировка или поле X',
    'Sunburst requires a numeric value field (Y)': 'Нужно числовое поле Y',
    'Tree requires groupBy fields for hierarchy': 'Нужны поля группировки',
  };
  if (translations[en]) return translations[en];
  // Dynamic patterns
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^X field "([^"]+)" not found/, (m) => `Поле X «${m[1]}» не найдено`],
    [/^Y field "([^"]+)" not found/, (m) => `Поле Y «${m[1]}» не найдено`],
    [/^Y field "([^"]+)" must be numeric/, (m) => `Поле Y «${m[1]}» должно быть числовым`],
    [/^Too many facet values \((\d+)\)/, (m) => `Слишком много значений (${m[1]}), макс. 12`],
  ];
  for (const [re, fn] of patterns) {
    const m = en.match(re);
    if (m) return fn(m);
  }
  return en;
}

/* ── Collapsible section ──────────────────────────────────── */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-2 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
      >
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

/* ── Field dropdown ───────────────────────────────────────── */
function FieldSelect({
  label,
  value,
  columns,
  analyses,
  onChange,
  optional,
}: {
  label: string;
  value: string | undefined;
  columns: string[];
  analyses: ColumnAnalysis[];
  onChange: (v: string | undefined) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-600">{label}</label>
      <div className="flex items-center gap-1">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        >
          <option value="">{optional ? `-- ${T.none} --` : `-- ${T.select} --`}</option>
          {columns.map((col) => {
            const a = analyses.find((x) => x.name === col);
            return (
              <option key={col} value={col}>
                {col}{a ? ` (${T.colType[a.type] ?? a.type})` : ''}
              </option>
            );
          })}
        </select>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="rounded p-0.5 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export function PlotNodeConfigPanel({ nodeId, payload: rawPayload, data, onChange }: PlotNodeConfigPanelProps) {
  const payload = useMemo(() => ({
    ...rawPayload,
    mapping: rawPayload.mapping ?? {},
    styling: rawPayload.styling ?? {},
  }), [rawPayload]);

  const [showMoreCharts, setShowMoreCharts] = useState(false);

  // Local ref to prevent auto-config race condition: when user selects a chart type
  // (e.g. 3D), the Yjs-persisted autoConfigured flag may not have propagated yet,
  // so async data arrivals could trigger auto-config with stale payload.
  const userHasConfiguredRef = useRef(payload.autoConfigured === true || !!payload.mapping?.x || !!payload.mapping?.y);

  // Keep ref in sync with payload changes from Yjs
  useEffect(() => {
    if (payload.autoConfigured === true || payload.mapping?.x || payload.mapping?.y) {
      userHasConfiguredRef.current = true;
    }
  }, [payload.autoConfigured, payload.mapping?.x, payload.mapping?.y]);

  // Auto-configure on first data
  useEffect(() => {
    if (!data || !data.rows || data.rows.length === 0) return;
    if (userHasConfiguredRef.current) return;
    if (payload.autoConfigured === true) return;
    if (payload.mapping?.x || payload.mapping?.y) return;
    const autoConfig = autoConfigurePlotConfig(data, payload);
    if (Object.keys(autoConfig).length > 0) {
      userHasConfiguredRef.current = true;
      onChange(nodeId, autoConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.rows?.length, payload.autoConfigured, payload.mapping?.x, payload.mapping?.y]);

  const columns = useMemo(() => data?.columns ?? [], [data]);
  const analyses = useMemo(() => (data ? analyzeDataColumns(data) : []), [data]);
  const recommendations = useMemo(() => (data ? recommendChartTypes(data) : []), [data]);
  const validation = useMemo(() => validatePlotConfig(data, payload), [data, payload]);
  const fields = useMemo(() => fieldsFor(payload.chartType), [payload.chartType]);

  /* ── Dispatch helpers ───────────────────────────────────── */
  const setChart = (chartType: ChartType) => {
    userHasConfiguredRef.current = true;
    onChange(nodeId, { ...payload, chartType, autoConfigured: true });
  };
  const setMapping = (field: string, value: string | string[] | undefined) =>
    onChange(nodeId, { ...payload, mapping: { ...payload.mapping, [field]: value } });
  const setTitle = (title: string) =>
    onChange(nodeId, { ...payload, styling: { ...payload.styling, title } });
  const setStyling = (updates: Partial<PlotNodePayload['styling']>) =>
    onChange(nodeId, { ...payload, styling: { ...payload.styling, ...updates } });

  /* ── AI generation ───────────────────────────────────────── */
  const [aiPrompt, setAiPrompt] = useState('');
  const ai = useAiChartGeneration();

  const handleAiGenerate = async () => {
    if (!data || !aiPrompt.trim()) return;
    const config = await ai.generate(aiPrompt, data);
    if (config) {
      userHasConfiguredRef.current = true;
      onChange(nodeId, { ...config, autoConfigured: true });
      setAiPrompt('');
    }
  };

  /* ── Chart type button ──────────────────────────────────── */
  const ChartBtn = ({ meta }: { meta: ChartMeta }) => {
    const isRec = recommendations.includes(meta.value);
    const isSel = payload.chartType === meta.value;
    return (
      <button
        type="button"
        onClick={() => setChart(meta.value)}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
          isSel
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`}
      >
        <span className="text-sm">{meta.icon}</span>
        <span className="truncate">{meta.label}</span>
        {isRec && !isSel && <span className="text-[10px] text-indigo-500">★</span>}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Data Source ───────────────────────────────────── */}
      {data && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{T.dataSource}</span>
            <span className="text-[11px] text-slate-500">{T.rowsCols(data.rows.length, data.columns.length)}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analyses.slice(0, 10).map((a) => (
              <span key={a.name} className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                <span>{colIcon(a.type)}</span>
                <span className="max-w-[80px] truncate">{a.name}</span>
              </span>
            ))}
            {analyses.length > 10 && <span className="text-[10px] text-slate-400">{T.more(analyses.length - 10)}</span>}
          </div>
        </div>
      )}

      {/* ── AI Chart Generation ──────────────────────────── */}
      {data && data.rows.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2.5">
          <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-500">
            <MagicWand size={12} weight="bold" />
            AI-конфигурация
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !ai.loading) handleAiGenerate(); }}
              placeholder="Например: выручка по месяцам, bar chart"
              disabled={ai.loading}
              className="flex-1 rounded-md border border-violet-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={ai.loading || !aiPrompt.trim()}
              className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {ai.loading ? <SpinnerGap size={14} className="animate-spin" /> : <MagicWand size={14} />}
            </button>
          </div>
          {ai.error && (
            <p className="mt-1.5 text-[11px] text-rose-500">{ai.error}</p>
          )}
        </div>
      )}

      {/* ── Auto-config notice ────────────────────────────── */}
      {payload.autoConfigured && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] text-indigo-700">
          <span className="font-medium">{T.autoConfigTitle}</span>
          <span className="ml-1 text-indigo-500">{T.autoConfigDesc}</span>
        </div>
      )}

      {/* ── Chart Type ────────────────────────────────────── */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{T.chartType}</label>
        <div className="grid grid-cols-3 gap-1">
          {POPULAR_CHARTS.map((m) => <ChartBtn key={m.value} meta={m} />)}
        </div>
        {/* Check if current chart type is in "more" and not in popular — always show it */}
        {!POPULAR_CHARTS.some((p) => p.value === payload.chartType) && !showMoreCharts && (
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {ALL_CHARTS.filter((m) => m.value === payload.chartType).map((m) => (
              <ChartBtn key={m.value} meta={m} />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowMoreCharts(!showMoreCharts)}
          className="mt-1.5 flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700"
        >
          {showMoreCharts ? <CaretDown size={10} /> : <CaretRight size={10} />}
          {showMoreCharts ? 'Скрыть' : 'Ещё типы графиков'}
        </button>
        {showMoreCharts && (
          <div className="mt-1.5 space-y-2">
            {MORE_CHARTS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">{group.label}</p>
                <div className="grid grid-cols-3 gap-1">
                  {group.types.map((m) => <ChartBtn key={m.value} meta={m} />)}
                </div>
              </div>
            ))}
          </div>
        )}
        {recommendations.length > 0 && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            {T.recommended}: {recommendations.slice(0, 3).map((r) => ALL_CHARTS.find((c) => c.value === r)?.label ?? r).join(', ')}
          </p>
        )}
      </div>

      {/* ── Field Mapping ─────────────────────────────────── */}
      {columns.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{T.fields}</label>
          <div className="space-y-2">
            {/* Standard X/Y/Z/Color fields */}
            {fields.x && (
              <FieldSelect label={T.xAxis} value={payload.mapping.x} columns={columns} analyses={analyses} onChange={(v) => setMapping('x', v)} />
            )}
            {fields.y && !fields.multiY && (
              <FieldSelect
                label={T.yAxis}
                value={Array.isArray(payload.mapping.y) ? payload.mapping.y[0] : payload.mapping.y}
                columns={columns}
                analyses={analyses}
                onChange={(v) => setMapping('y', v)}
              />
            )}
            {fields.z && (
              <FieldSelect label={T.zAxis} value={payload.mapping.z} columns={columns} analyses={analyses} onChange={(v) => setMapping('z', v)} />
            )}
            {fields.color && (
              <FieldSelect label={T.color} value={payload.mapping.color} columns={columns} analyses={analyses} onChange={(v) => setMapping('color', v)} optional />
            )}

            {/* Multi-Y for combo charts */}
            {fields.multiY && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.yFields}</label>
                <div className="space-y-1.5">
                  {(Array.isArray(payload.mapping.y) ? payload.mapping.y : payload.mapping.y ? [payload.mapping.y] : []).map((yf, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <select
                        value={yf}
                        onChange={(e) => {
                          const cur = Array.isArray(payload.mapping.y) ? [...payload.mapping.y] : payload.mapping.y ? [payload.mapping.y] : [];
                          cur[idx] = e.target.value;
                          setMapping('y', cur);
                        }}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none"
                      >
                        <option value="">-- {T.select} --</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button type="button" onClick={() => {
                        const cur = Array.isArray(payload.mapping.y) ? [...payload.mapping.y] : payload.mapping.y ? [payload.mapping.y] : [];
                        setMapping('y', cur.filter((_, i) => i !== idx));
                      }} className="rounded p-0.5 text-slate-400 hover:text-rose-500"><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    const cur = Array.isArray(payload.mapping.y) ? [...payload.mapping.y] : payload.mapping.y ? [payload.mapping.y] : [];
                    setMapping('y', [...cur, '']);
                  }} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700">
                    <Plus size={12} /> {T.addY}
                  </button>
                </div>
              </div>
            )}

            {/* OHLC for candlestick */}
            {fields.ohlc && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{T.ohlc}</p>
                {(['open', 'high', 'low', 'close'] as const).map((f) => (
                  <FieldSelect
                    key={f}
                    label={f === 'open' ? T.open : f === 'high' ? T.high : f === 'low' ? T.low : T.close}
                    value={payload.mapping[f]}
                    columns={columns}
                    analyses={analyses}
                    onChange={(v) => setMapping(f, v)}
                  />
                ))}
              </div>
            )}

            {/* Source/Target for graph */}
            {fields.srcTgt && (
              <div className="space-y-1.5">
                <FieldSelect label={T.source} value={payload.mapping.source} columns={columns} analyses={analyses} onChange={(v) => setMapping('source', v)} />
                <FieldSelect label={T.target} value={payload.mapping.target} columns={columns} analyses={analyses} onChange={(v) => setMapping('target', v)} />
              </div>
            )}

            {/* Weight for wordcloud/graph */}
            {fields.weight && (
              <FieldSelect label={T.weight} value={payload.mapping.weight} columns={columns} analyses={analyses} onChange={(v) => setMapping('weight', v)} optional />
            )}

            {/* Gauge config */}
            {payload.chartType === 'gauge' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-600">{T.min}</label>
                  <input type="number" value={payload.gaugeConfig?.min ?? 0}
                    onChange={(e) => onChange(nodeId, { ...payload, gaugeConfig: { ...payload.gaugeConfig, min: parseFloat(e.target.value) || 0 } })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-600">{T.max}</label>
                  <input type="number" value={payload.gaugeConfig?.max ?? 100}
                    onChange={(e) => onChange(nodeId, { ...payload, gaugeConfig: { ...payload.gaugeConfig, max: parseFloat(e.target.value) || 100 } })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none" />
                </div>
              </div>
            )}

            {/* Liquidfill shape */}
            {payload.chartType === 'liquidfill' && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.shape}</label>
                <select value={payload.liquidfillConfig?.shape || 'circle'}
                  onChange={(e) => onChange(nodeId, { ...payload, liquidfillConfig: { shape: e.target.value as any } })}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none">
                  <option value="circle">Круг</option>
                  <option value="rect">Прямоугольник</option>
                  <option value="roundRect">Скруглённый</option>
                  <option value="triangle">Треугольник</option>
                  <option value="diamond">Ромб</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Title ─────────────────────────────────────────── */}
      <div>
        <label className="mb-1 block text-xs text-slate-600">{T.title}</label>
        <input
          type="text"
          value={payload.styling.title || ''}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={T.titlePlaceholder}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        />
      </div>

      {/* ── Style (compact) ───────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {(['light', 'dark'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setStyling({ theme: t })}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                (payload.styling.theme || 'light') === t
                  ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {t === 'light' ? T.light : T.dark}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={payload.styling.showLegend !== false}
            onChange={(e) => setStyling({ showLegend: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
          {T.legend}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={payload.styling.enableZoomPan === true}
            onChange={(e) => setStyling({ enableZoomPan: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
          {T.zoomPan}
        </label>
      </div>

      {/* ── Advanced (collapsed) ──────────────────────────── */}
      {columns.length > 0 && (
        <Section title={T.advanced}>
          <div className="space-y-3">
            {/* Aggregation */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{T.aggregation}</span>
                <input type="checkbox" checked={!!payload.aggregation}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange(nodeId, { ...payload, aggregation: { type: 'sum', groupBy: [] } });
                    } else {
                      const { aggregation, ...rest } = payload;
                      onChange(nodeId, rest);
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
              </div>
              {payload.aggregation && (
                <div className="mt-1.5 ml-2 space-y-1.5 rounded border border-slate-200 bg-white p-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] text-slate-500">{T.aggType}</label>
                    <select value={payload.aggregation.type}
                      onChange={(e) => onChange(nodeId, { ...payload, aggregation: { ...payload.aggregation!, type: e.target.value as AggregationType } })}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none">
                      {AGG_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] text-slate-500">{T.groupBy}</label>
                    <div className="flex flex-wrap gap-1">
                      {columns.map((col) => {
                        const sel = payload.aggregation?.groupBy?.includes(col);
                        return (
                          <button key={col} type="button"
                            onClick={() => {
                              const gb = payload.aggregation?.groupBy ?? [];
                              onChange(nodeId, {
                                ...payload,
                                aggregation: { ...payload.aggregation!, groupBy: sel ? gb.filter((f) => f !== col) : [...gb, col] },
                              });
                            }}
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
                              sel ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}>
                            {col}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filters */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{T.filters}</span>
                <button type="button" onClick={() => {
                  onChange(nodeId, { ...payload, filters: [...(payload.filters || []), { field: columns[0] || '', operator: 'eq' as const, value: '' }] });
                }} className="flex items-center gap-0.5 text-[11px] text-indigo-500 hover:text-indigo-700">
                  <Plus size={10} /> {T.addFilter}
                </button>
              </div>
              {payload.filters && payload.filters.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {payload.filters.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 rounded border border-slate-200 bg-white p-1.5">
                      <select value={f.field}
                        onChange={(e) => {
                          const nf = [...payload.filters!]; nf[i] = { ...nf[i], field: e.target.value };
                          onChange(nodeId, { ...payload, filters: nf });
                        }}
                        className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-0.5 text-[11px] focus:outline-none">
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={f.operator}
                        onChange={(e) => {
                          const nf = [...payload.filters!]; nf[i] = { ...nf[i], operator: e.target.value as typeof f.operator };
                          onChange(nodeId, { ...payload, filters: nf });
                        }}
                        className="flex-shrink-0 rounded border border-slate-200 px-1 py-0.5 text-[11px] focus:outline-none">
                        {FILTER_OPS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      <input type="text" value={String(f.value ?? '')}
                        onChange={(e) => {
                          const nf = [...payload.filters!]; nf[i] = { ...nf[i], value: e.target.value };
                          onChange(nodeId, { ...payload, filters: nf });
                        }}
                        placeholder={T.value}
                        className="min-w-0 max-w-[80px] flex-1 rounded border border-slate-200 px-1 py-0.5 text-[11px] focus:outline-none" />
                      <button type="button" onClick={() => {
                        const nf = payload.filters!.filter((_, j) => j !== i);
                        onChange(nodeId, { ...payload, filters: nf.length > 0 ? nf : undefined });
                      }} className="text-slate-400 hover:text-rose-500"><Trash size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{T.sort}</span>
                <button type="button" onClick={() => {
                  onChange(nodeId, { ...payload, sort: [...(payload.sort || []), { field: columns[0] || '', direction: 'asc' as const }] });
                }} className="flex items-center gap-0.5 text-[11px] text-indigo-500 hover:text-indigo-700">
                  <Plus size={10} /> {T.addSort}
                </button>
              </div>
              {payload.sort && payload.sort.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {payload.sort.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 rounded border border-slate-200 bg-white p-1.5">
                      <select value={s.field}
                        onChange={(e) => {
                          const ns = [...payload.sort!]; ns[i] = { ...ns[i], field: e.target.value };
                          onChange(nodeId, { ...payload, sort: ns });
                        }}
                        className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-0.5 text-[11px] focus:outline-none">
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={s.direction}
                        onChange={(e) => {
                          const ns = [...payload.sort!]; ns[i] = { ...ns[i], direction: e.target.value as 'asc' | 'desc' };
                          onChange(nodeId, { ...payload, sort: ns });
                        }}
                        className="rounded border border-slate-200 px-1 py-0.5 text-[11px] focus:outline-none">
                        <option value="asc">{T.asc}</option>
                        <option value="desc">{T.desc}</option>
                      </select>
                      <button type="button" onClick={() => {
                        const ns = payload.sort!.filter((_, j) => j !== i);
                        onChange(nodeId, { ...payload, sort: ns.length > 0 ? ns : undefined });
                      }} className="text-slate-400 hover:text-rose-500"><Trash size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Validation message ────────────────────────────── */}
      {!validation.valid && validation.message && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600">
          {translateValidation(validation.message)}
        </div>
      )}
    </div>
  );
}
