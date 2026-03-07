'use client';

import { useMemo, useState, useEffect } from 'react';
import type {
  PlotNodePayload,
  ChartType,
  AggregationType,
} from '../../lib/visualization/chartTypes';
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
import { X, Plus, Trash } from '@phosphor-icons/react';

type PlotNodeConfigPanelProps = {
  nodeId: string;
  payload: PlotNodePayload;
  data: SqlResult | undefined;
  onChange: (nodeId: string, payload: Partial<PlotNodePayload>) => void;
};

// Локализация панели настроек графика (русский)
const T = {
  sectionDataSource: 'Источник данных',
  rowsColumns: (rows: number, cols: number) => `${rows} строк × ${cols} столбцов`,
  more: (n: number) => `+${n} ещё`,
  suggestedConfigTitle: 'Применена предложенная конфигурация',
  suggestedConfigDesc:
    'Тип графика и сопоставление полей настроены автоматически по вашим данным. Вы можете изменить их ниже.',
  chartType: 'Тип графика',
  recommended: 'Рекомендуемые',
  fieldMapping: 'Сопоставление полей',
  xAxis: 'Ось X',
  selectXAxis: 'Выберите ось X',
  yAxis: 'Ось Y',
  selectYAxis: 'Выберите ось Y',
  colorOptional: 'Цвет (необязательно)',
  none: 'Нет',
  yFieldsRequired: 'Поля Y (нужно минимум 2)',
  selectYField: 'Выберите поле Y',
  addYField: 'Добавить поле Y',
  facetByOptional: 'Группировка (необязательно)',
  facetHint: 'Будут созданы малые кратные по значению категории. Не более 12 категорий.',
  transformations: 'Преобразования',
  aggregateData: 'Агрегировать данные',
  aggregationType: 'Тип агрегации',
  groupBy: 'Группировка',
  filters: 'Фильтры',
  addFilter: 'Добавить фильтр',
  value: 'Значение',
  addSort: 'Добавить сортировку',
  sort: 'Сортировка',
  ascending: 'По возрастанию',
  descending: 'По убыванию',
  stylingInteractivity: 'Оформление и интерактивность',
  title: 'Заголовок',
  chartTitlePlaceholder: 'Название графика',
  theme: 'Тема',
  light: 'Светлая',
  dark: 'Тёмная',
  showLegend: 'Показать легенду',
  legendPosition: 'Положение легенды',
  top: 'Сверху',
  bottom: 'Снизу',
  left: 'Слева',
  right: 'Справа',
  showGrid: 'Показать сетку',
  enableZoomPan: 'Масштаб и панорама',
  enableTooltips: 'Всплывающие подсказки',
  columnType: {
    numeric: 'числовой',
    categorical: 'категориальный',
    temporal: 'временной',
    unknown: 'неизвестный',
  },
} as const;

const CHART_TYPES: Array<{ value: ChartType; label: string; icon?: string; description?: string }> =
  [
    { value: 'bar', label: 'Гистограмма', icon: '📊', description: 'Вертикальные столбцы' },
    {
      value: 'bar-horizontal',
      label: 'Горизонтальная гистограмма',
      icon: '📊',
      description: 'Горизонтальные столбцы',
    },
    { value: 'line', label: 'Линейный', icon: '📈', description: 'Линейный график' },
    { value: 'area', label: 'Областной', icon: '📈', description: 'График с заливкой' },
    { value: 'scatter', label: 'Точечный', icon: '⚫', description: 'Точечная диаграмма' },
    { value: 'pie', label: 'Круговая', icon: '🥧', description: 'Круговая диаграмма' },
    { value: 'doughnut', label: 'Кольцевая', icon: '🍩', description: 'Кольцевая диаграмма' },
    {
      value: 'histogram',
      label: 'Гистограмма распределения',
      icon: '📊',
      description: 'Распределение числовых значений',
    },
    { value: 'heatmap', label: 'Тепловая карта', icon: '🔥', description: 'Интенсивность по 2 измерениям' },
    { value: 'treemap', label: 'Древовидная карта', icon: '🌳', description: 'Иерархия по размеру' },
    { value: 'boxplot', label: 'Ящик с усами', icon: '📦', description: 'Статистика распределения' },
    { value: 'radar', label: 'Радар', icon: '🕸️', description: 'Сравнение метрик' },
    { value: 'sankey', label: 'Санки', icon: '🌊', description: 'Диаграмма потоков' },
    {
      value: 'combo-bar-line',
      label: 'Комбинированный (гистограмма + линия)',
      icon: '📊',
      description: 'Гистограмма и линейный график',
    },
  ];

const AGGREGATION_TYPES: Array<{ value: AggregationType; label: string }> = [
  { value: 'sum', label: 'Сумма' },
  { value: 'avg', label: 'Среднее' },
  { value: 'count', label: 'Количество' },
  { value: 'min', label: 'Минимум' },
  { value: 'max', label: 'Максимум' },
  { value: 'median', label: 'Медиана' },
];

const FILTER_OPERATORS: Array<{
  value: PlotNodePayload['filters'][0]['operator'];
  label: string;
}> = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'содержит' },
  { value: 'in', label: 'в списке' },
];

function getColumnIcon(analysis: ColumnAnalysis): string {
  switch (analysis.type) {
    case 'numeric':
      return '#';
    case 'categorical':
      return '🏷';
    case 'temporal':
      return '🕒';
    default:
      return '?';
  }
}

function getColumnTypeLabel(type: ColumnAnalysis['type']): string {
  return T.columnType[type] ?? type;
}

/** Переводит сообщения валидации с английского на русский */
function translateValidationMessage(en: string): string {
  const map: Record<string, string> = {
    'No data available': 'Нет данных',
    'No columns available in data': 'В данных нет столбцов',
    'X axis is required for this chart type': 'Для этого типа графика нужна ось X',
    'Y axis is required for this chart type': 'Для этого типа графика нужна ось Y',
    'X axis must be numeric for scatter plots': 'Для точечного графика ось X должна быть числовой',
    'X field is required for heatmap': 'Для тепловой карты нужно поле X',
    'Combo chart requires at least 2 Y fields': 'Комбинированному графику нужно минимум 2 поля Y',
    'Histogram requires at least one numeric or temporal field':
      'Для гистограммы нужно хотя бы одно числовое или временное поле',
    'Heatmap requires both X and Y fields': 'Тепловой карте нужны поля X и Y',
    'Treemap requires groupBy fields or X field': 'Древовидной карте нужна группировка или поле X',
    'Treemap requires a numeric size field (Y)': 'Древовидной карте нужно числовое поле размера (Y)',
    'Boxplot requires at least one numeric field': 'Ящику с усами нужно хотя бы одно числовое поле',
    'Sankey requires source (X) and target (Y) fields': 'Диаграмме Санки нужны поля источника (X) и цели (Y)',
    'Radar chart requires numeric metric columns': 'Радарному графику нужны числовые метрики',
    'Color field should be categorical for this chart type':
      'Поле цвета для этого типа графика должно быть категориальным',
  };
  if (map[en]) return map[en];
  const notFoundX = /^X field "([^"]+)" not found in data$/;
  const notFoundY = /^Y field "([^"]+)" not found in data$/;
  const yMustBeNumeric = /^Y field "([^"]+)" must be numeric for this chart type$/;
  const yMustBeNumericTemporal = /^Y field "([^"]+)" must be numeric or temporal for histogram$/;
  const xMustBeNumericTemporal = /^X field "([^"]+)" must be numeric or temporal for histogram$/;
  const yMustBeNumericTemporal2 = /^Y field "([^"]+)" must be numeric or temporal for histogram$/;
  const tooManyFacet = /^Too many facet values \((\d+)\)\. Please filter to 12 or fewer\.$/;
  let m = en.match(notFoundX);
  if (m) return `Поле X «${m[1]}» не найдено в данных`;
  m = en.match(notFoundY);
  if (m) return `Поле Y «${m[1]}» не найдено в данных`;
  m = en.match(yMustBeNumeric);
  if (m) return `Поле Y «${m[1]}» должно быть числовым для этого типа графика`;
  m = en.match(yMustBeNumericTemporal) ?? en.match(yMustBeNumericTemporal2);
  if (m) return `Поле Y «${m[1]}» должно быть числовым или временным для гистограммы`;
  m = en.match(xMustBeNumericTemporal);
  if (m) return `Поле X «${m[1]}» должно быть числовым или временным для гистограммы`;
  m = en.match(tooManyFacet);
  if (m) return `Слишком много значений группировки (${m[1]}). Оставьте 12 или меньше.`;
  return en;
}

function ColumnChip({
  analysis,
  onClick,
  selected,
}: {
  analysis: ColumnAnalysis;
  onClick: () => void;
  selected?: boolean;
}) {
  const icon = getColumnIcon(analysis);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
        selected
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span>{icon}</span>
      <span>{analysis.name}</span>
      {analysis.type !== 'unknown' && (
        <span className="text-[10px] text-slate-400">({getColumnTypeLabel(analysis.type)})</span>
      )}
    </button>
  );
}

export function PlotNodeConfigPanel({ nodeId, payload, data, onChange }: PlotNodeConfigPanelProps) {
  const [showFieldMenu, setShowFieldMenu] = useState<string | null>(null);

  // Auto-configure when data first arrives and config is empty
  useEffect(() => {
    if (!data || !data.rows || data.rows.length === 0) return;
    if (payload.autoConfigured === true) return;
    if (payload.mapping?.x || payload.mapping?.y) return; // User has already configured

    const autoConfig = autoConfigurePlotConfig(data, payload);
    if (Object.keys(autoConfig).length > 0) {
      onChange(nodeId, autoConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.rows?.length, payload.autoConfigured, payload.mapping?.x, payload.mapping?.y]);

  const columns = useMemo(() => {
    if (!data || !data.columns) return [];
    return data.columns;
  }, [data]);

  const columnAnalyses = useMemo(() => {
    if (!data) return [];
    return analyzeDataColumns(data);
  }, [data]);

  const recommendations = useMemo(() => {
    if (!data) return [];
    return recommendChartTypes(data);
  }, [data]);

  const validation = useMemo(() => {
    return validatePlotConfig(data, payload);
  }, [data, payload]);

  const handleChartTypeChange = (chartType: ChartType) => {
    onChange(nodeId, { ...payload, chartType });
  };

  const handleMappingChange = (
    field: 'x' | 'y' | 'color' | 'size' | 'facet',
    value: string | string[] | undefined,
  ) => {
    onChange(nodeId, {
      ...payload,
      mapping: {
        ...payload.mapping,
        [field]: value || undefined,
      },
    });
  };

  const handleTitleChange = (title: string) => {
    onChange(nodeId, {
      ...payload,
      styling: {
        ...payload.styling,
        title,
      },
    });
  };

  const handleAggregationToggle = (enabled: boolean) => {
    if (enabled) {
      onChange(nodeId, {
        ...payload,
        aggregation: {
          type: 'sum',
          groupBy: [],
        },
      });
    } else {
      const { aggregation, ...rest } = payload;
      onChange(nodeId, rest);
    }
  };

  const handleAggregationTypeChange = (type: AggregationType) => {
    onChange(nodeId, {
      ...payload,
      aggregation: {
        ...(payload.aggregation || { type: 'sum', groupBy: [] }),
        type,
      },
    });
  };

  const handleGroupByChange = (field: string, add: boolean) => {
    const currentGroupBy = payload.aggregation?.groupBy || [];
    const newGroupBy = add ? [...currentGroupBy, field] : currentGroupBy.filter((f) => f !== field);
    onChange(nodeId, {
      ...payload,
      aggregation: {
        ...(payload.aggregation || { type: 'sum', groupBy: [] }),
        groupBy: newGroupBy,
      },
    });
  };

  const handleAddFilter = () => {
    const newFilters = [
      ...(payload.filters || []),
      { field: columns[0] || '', operator: 'eq' as const, value: '' },
    ];
    onChange(nodeId, {
      ...payload,
      filters: newFilters,
    });
  };

  const handleFilterChange = (index: number, updates: Partial<PlotNodePayload['filters'][0]>) => {
    const newFilters = [...(payload.filters || [])];
    newFilters[index] = { ...newFilters[index], ...updates };
    onChange(nodeId, {
      ...payload,
      filters: newFilters,
    });
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = (payload.filters || []).filter((_, i) => i !== index);
    onChange(nodeId, {
      ...payload,
      filters: newFilters.length > 0 ? newFilters : undefined,
    });
  };

  const handleAddSort = () => {
    const newSort = [
      ...(payload.sort || []),
      { field: columns[0] || '', direction: 'asc' as const },
    ];
    onChange(nodeId, {
      ...payload,
      sort: newSort,
    });
  };

  const handleSortChange = (index: number, updates: Partial<PlotNodePayload['sort'][0]>) => {
    const newSort = [...(payload.sort || [])];
    newSort[index] = { ...newSort[index], ...updates };
    onChange(nodeId, {
      ...payload,
      sort: newSort,
    });
  };

  const handleRemoveSort = (index: number) => {
    const newSort = (payload.sort || []).filter((_, i) => i !== index);
    onChange(nodeId, {
      ...payload,
      sort: newSort.length > 0 ? newSort : undefined,
    });
  };

  const handleStylingChange = (updates: Partial<PlotNodePayload['styling']>) => {
    onChange(nodeId, {
      ...payload,
      styling: {
        ...payload.styling,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Data Source Preview */}
      {data && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {T.sectionDataSource}
            </h3>
            <span className="text-xs text-slate-600">
              {T.rowsColumns(data.rows.length, data.columns.length)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {columnAnalyses.slice(0, 8).map((analysis) => (
              <ColumnChip key={analysis.name} analysis={analysis} onClick={() => {}} />
            ))}
            {columnAnalyses.length > 8 && (
              <span className="text-xs text-slate-400">{T.more(columnAnalyses.length - 8)}</span>
            )}
          </div>
        </div>
      )}

      {/* Auto-configuration indicator */}
      {payload.autoConfigured && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          <span className="font-medium">✨ {T.suggestedConfigTitle}</span>
          <p className="mt-1 text-indigo-600">{T.suggestedConfigDesc}</p>
        </div>
      )}

      {/* Chart Type & Recommendations */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {T.chartType}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CHART_TYPES.map((type) => {
            const isRecommended = recommendations.includes(type.value);
            const isSelected = payload.chartType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleChartTypeChange(type.value)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>{type.icon}</span>
                <span className="flex-1 text-left">{type.label}</span>
                {isRecommended && !isSelected && (
                  <span className="text-[10px] text-indigo-500">★</span>
                )}
              </button>
            );
          })}
        </div>
        {recommendations.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {T.recommended}:{' '}
            {recommendations
              .slice(0, 3)
              .map((r) => CHART_TYPES.find((t) => t.value === r)?.label || r)
              .join(', ')}
          </p>
        )}
      </div>

      {/* Field Mapping */}
      {columns.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {T.fieldMapping}
          </label>
          <div className="space-y-3">
            {/* X Axis */}
            {payload.chartType !== 'pie' && payload.chartType !== 'doughnut' && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.xAxis}</label>
                <div className="flex items-center gap-2">
                  <select
                    value={payload.mapping.x || ''}
                    onChange={(e) => handleMappingChange('x', e.target.value)}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">-- {T.selectXAxis} --</option>
                    {columns.map((col) => {
                      const analysis = columnAnalyses.find((a) => a.name === col);
                      return (
                        <option key={col} value={col}>
                          {col} {analysis ? `(${getColumnTypeLabel(analysis.type)})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {payload.mapping.x && (
                    <button
                      type="button"
                      onClick={() => handleMappingChange('x', '')}
                      className="rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Y Axis */}
            {payload.chartType !== 'pie' && payload.chartType !== 'doughnut' && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.yAxis}</label>
                <div className="flex items-center gap-2">
                  <select
                    value={
                      Array.isArray(payload.mapping.y)
                        ? payload.mapping.y[0]
                        : payload.mapping.y || ''
                    }
                    onChange={(e) => handleMappingChange('y', e.target.value)}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">-- {T.selectYAxis} --</option>
                    {columns.map((col) => {
                      const analysis = columnAnalyses.find((a) => a.name === col);
                      return (
                        <option key={col} value={col}>
                          {col} {analysis ? `(${getColumnTypeLabel(analysis.type)})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {payload.mapping.y && (
                    <button
                      type="button"
                      onClick={() => handleMappingChange('y', '')}
                      className="rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Color (for scatter and other charts) */}
            {(payload.chartType === 'scatter' ||
              payload.chartType === 'bar' ||
              payload.chartType === 'line') && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.colorOptional}</label>
                <div className="flex items-center gap-2">
                  <select
                    value={payload.mapping.color || ''}
                    onChange={(e) => handleMappingChange('color', e.target.value)}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">-- {T.none} --</option>
                    {columns.map((col) => {
                      const analysis = columnAnalyses.find((a) => a.name === col);
                      return (
                        <option key={col} value={col}>
                          {col} {analysis ? `(${getColumnTypeLabel(analysis.type)})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {payload.mapping.color && (
                    <button
                      type="button"
                      onClick={() => handleMappingChange('color', '')}
                      className="rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Multiple Y fields for combo charts */}
            {payload.chartType === 'combo-bar-line' && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.yFieldsRequired}</label>
                <div className="space-y-2">
                  {(Array.isArray(payload.mapping.y)
                    ? payload.mapping.y
                    : payload.mapping.y
                      ? [payload.mapping.y]
                      : []
                  ).map((yField, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={yField}
                        onChange={(e) => {
                          const currentY = Array.isArray(payload.mapping.y)
                            ? payload.mapping.y
                            : payload.mapping.y
                              ? [payload.mapping.y]
                              : [];
                          const newY = [...currentY];
                          newY[idx] = e.target.value;
                          handleMappingChange('y', newY);
                        }}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="">-- {T.selectYField} --</option>
                        {columns.map((col) => {
                          const analysis = columnAnalyses.find((a) => a.name === col);
                          return (
                            <option key={col} value={col}>
                              {col} {analysis ? `(${getColumnTypeLabel(analysis.type)})` : ''}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const currentY = Array.isArray(payload.mapping.y)
                            ? payload.mapping.y
                            : payload.mapping.y
                              ? [payload.mapping.y]
                              : [];
                          const newY = currentY.filter((_, i) => i !== idx);
                          handleMappingChange('y', newY.length > 0 ? newY : undefined);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const currentY = Array.isArray(payload.mapping.y)
                        ? payload.mapping.y
                        : payload.mapping.y
                          ? [payload.mapping.y]
                          : [];
                      handleMappingChange('y', [...currentY, '']);
                    }}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={14} />
                    {T.addYField}
                  </button>
                </div>
              </div>
            )}

            {/* Facet (for small multiples) */}
            {['bar', 'bar-horizontal', 'line', 'area', 'scatter'].includes(payload.chartType) && (
              <div>
                <label className="mb-1 block text-xs text-slate-600">{T.facetByOptional}</label>
                <div className="flex items-center gap-2">
                  <select
                    value={payload.mapping.facet || ''}
                    onChange={(e) => handleMappingChange('facet', e.target.value || undefined)}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">-- {T.none} --</option>
                    {columns.map((col) => {
                      const analysis = columnAnalyses.find((a) => a.name === col);
                      return (
                        <option key={col} value={col}>
                          {col} {analysis ? `(${getColumnTypeLabel(analysis.type)})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {payload.mapping.facet && (
                    <button
                      type="button"
                      onClick={() => handleMappingChange('facet', undefined)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {payload.mapping.facet && (
                  <p className="mt-1 text-xs text-slate-500">{T.facetHint}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Transformations */}
      {columns.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {T.transformations}
          </h3>

          {/* Aggregation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-600">{T.aggregateData}</label>
              <input
                type="checkbox"
                checked={!!payload.aggregation}
                onChange={(e) => handleAggregationToggle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
            {payload.aggregation && (
              <div className="ml-4 space-y-2 rounded-md border border-slate-200 bg-white p-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">{T.aggregationType}</label>
                  <select
                    value={payload.aggregation.type}
                    onChange={(e) => handleAggregationTypeChange(e.target.value as AggregationType)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    {AGGREGATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">{T.groupBy}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {columns.map((col) => {
                      const isSelected = payload.aggregation?.groupBy?.includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => handleGroupByChange(col, !isSelected)}
                          className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-600">{T.filters}</label>
              <button
                type="button"
                onClick={handleAddFilter}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
              >
                <Plus size={12} />
                {T.addFilter}
              </button>
            </div>
            {payload.filters && payload.filters.length > 0 && (
              <div className="space-y-2">
                {payload.filters.map((filter, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 min-w-0"
                  >
                    <select
                      value={filter.field}
                      onChange={(e) => handleFilterChange(index, { field: e.target.value })}
                      className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
                    >
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(e) =>
                        handleFilterChange(index, {
                          operator: e.target.value as typeof filter.operator,
                        })
                      }
                      className="flex-shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
                    >
                      {FILTER_OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={String(filter.value ?? '')}
                      onChange={(e) => handleFilterChange(index, { value: e.target.value })}
                      placeholder={T.value}
                      className="flex-1 min-w-0 max-w-[120px] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFilter(index)}
                      className="flex-shrink-0 rounded p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-600">{T.sort}</label>
              <button
                type="button"
                onClick={handleAddSort}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
              >
                <Plus size={12} />
                {T.addSort}
              </button>
            </div>
            {payload.sort && payload.sort.length > 0 && (
              <div className="space-y-2">
                {payload.sort.map((sortRule, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2"
                  >
                    <select
                      value={sortRule.field}
                      onChange={(e) => handleSortChange(index, { field: e.target.value })}
                      className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
                    >
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sortRule.direction}
                      onChange={(e) =>
                        handleSortChange(index, { direction: e.target.value as 'asc' | 'desc' })
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
                    >
                      <option value="asc">{T.ascending}</option>
                      <option value="desc">{T.descending}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveSort(index)}
                      className="rounded p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Styling & Interactivity */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {T.stylingInteractivity}
        </h3>

        <div>
          <label className="mb-1 block text-xs text-slate-600">{T.title}</label>
          <input
            type="text"
            value={payload.styling.title || ''}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={T.chartTitlePlaceholder}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">{T.theme}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleStylingChange({ theme: 'light' })}
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  payload.styling.theme === 'light' || !payload.styling.theme
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {T.light}
              </button>
              <button
                type="button"
                onClick={() => handleStylingChange({ theme: 'dark' })}
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  payload.styling.theme === 'dark'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {T.dark}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">{T.showLegend}</label>
            <input
              type="checkbox"
              checked={payload.styling.showLegend !== false}
              onChange={(e) => handleStylingChange({ showLegend: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          {payload.styling.showLegend !== false && (
            <div>
              <label className="mb-1 block text-xs text-slate-600">{T.legendPosition}</label>
              <select
                value={payload.styling.legendPosition || 'top'}
                onChange={(e) =>
                  handleStylingChange({
                    legendPosition: e.target.value as 'top' | 'bottom' | 'left' | 'right',
                  })
                }
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
              >
                <option value="top">{T.top}</option>
                <option value="bottom">{T.bottom}</option>
                <option value="left">{T.left}</option>
                <option value="right">{T.right}</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">{T.showGrid}</label>
            <input
              type="checkbox"
              checked={payload.styling.showGrid !== false}
              onChange={(e) => handleStylingChange({ showGrid: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">{T.enableZoomPan}</label>
            <input
              type="checkbox"
              checked={payload.styling.enableZoomPan === true}
              onChange={(e) => handleStylingChange({ enableZoomPan: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600">{T.enableTooltips}</label>
            <input
              type="checkbox"
              checked={payload.styling.enableTooltips !== false}
              onChange={(e) => handleStylingChange({ enableTooltips: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Validation Message */}
      {!validation.valid && validation.message && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {translateValidationMessage(validation.message)}
        </div>
      )}
    </div>
  );
}
