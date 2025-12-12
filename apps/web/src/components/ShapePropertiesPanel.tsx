'use client';

import { memo, useCallback } from 'react';
import type { ShapeNodeData, ShapeType } from './flowNodes/ShapeNode';

type ShapePropertiesPanelProps = {
  nodeId: string;
  data: ShapeNodeData;
  onPropertyChange: (nodeId: string, property: keyof ShapeNodeData, value: unknown) => void;
};

export const ShapePropertiesPanel = memo(function ShapePropertiesPanel({
  nodeId,
  data,
  onPropertyChange,
}: ShapePropertiesPanelProps) {
  const handleColorChange = useCallback(
    (color: string) => {
      onPropertyChange(nodeId, 'shapeColor', color);
    },
    [nodeId, onPropertyChange],
  );

  const handleStrokeChange = useCallback(
    (stroke: string) => {
      onPropertyChange(nodeId, 'stroke', stroke);
    },
    [nodeId, onPropertyChange],
  );

  const handleStrokeWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPropertyChange(nodeId, 'strokeWidth', parseFloat(e.target.value) || 2);
    },
    [nodeId, onPropertyChange],
  );

  const handleStrokeStyleChange = useCallback(
    (style: 'solid' | 'dashed' | 'dotted') => {
      onPropertyChange(nodeId, 'strokeStyle', style);
    },
    [nodeId, onPropertyChange],
  );

  const handleRotationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPropertyChange(nodeId, 'rotation', parseFloat(e.target.value) || 0);
    },
    [nodeId, onPropertyChange],
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPropertyChange(nodeId, 'opacity', parseFloat(e.target.value) || 1);
    },
    [nodeId, onPropertyChange],
  );

  const handleShapeTypeChange = useCallback(
    (shapeType: ShapeType) => {
      onPropertyChange(nodeId, 'shapeType', shapeType);
    },
    [nodeId, onPropertyChange],
  );

  const presetColors = [
    '#BFDBFE', // Blue
    '#FDE68A', // Yellow
    '#FECACA', // Red
    '#BBF7D0', // Green
    '#E9D5FF', // Purple
    '#FED7AA', // Orange
    '#DDD6FE', // Indigo
    '#F3F4F6', // Gray
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Shape Properties</h3>

        {/* Fill Color */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">Fill Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.shapeColor ?? '#BFDBFE'}
              onChange={(e) => handleColorChange(e.target.value)}
              className="h-8 w-16 cursor-pointer rounded border border-slate-300"
            />
            <div className="flex flex-wrap gap-1">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(color)}
                  className={`h-6 w-6 rounded border-2 transition-all ${
                    data.shapeColor === color ? 'border-slate-900 scale-110' : 'border-slate-300 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stroke Color */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">Stroke Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.stroke ?? '#64748b'}
              onChange={(e) => handleStrokeChange(e.target.value)}
              className="h-8 w-16 cursor-pointer rounded border border-slate-300"
            />
            <input
              type="text"
              value={data.stroke ?? '#64748b'}
              onChange={(e) => handleStrokeChange(e.target.value)}
              className="h-8 flex-1 rounded border border-slate-300 px-2 text-sm"
              placeholder="#64748b"
            />
          </div>
        </div>

        {/* Stroke Width */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">
            Stroke Width: {data.strokeWidth ?? 2}px
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={data.strokeWidth ?? 2}
            onChange={handleStrokeWidthChange}
            className="w-full"
          />
        </div>

        {/* Stroke Style */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">Stroke Style</label>
          <div className="flex gap-2">
            {(['solid', 'dashed', 'dotted'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => handleStrokeStyleChange(style)}
                className={`flex-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                  (data.strokeStyle ?? 'solid') === style
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">
            Rotation: {data.rotation ?? 0}°
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={data.rotation ?? 0}
              onChange={handleRotationChange}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="360"
              step="1"
              value={data.rotation ?? 0}
              onChange={handleRotationChange}
              className="h-8 w-16 rounded border border-slate-300 px-2 text-sm text-center"
            />
          </div>
        </div>

        {/* Opacity */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">
            Opacity: {Math.round((data.opacity ?? 1) * 100)}%
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={data.opacity ?? 1}
              onChange={handleOpacityChange}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={data.opacity ?? 1}
              onChange={handleOpacityChange}
              className="h-8 w-16 rounded border border-slate-300 px-2 text-sm text-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

