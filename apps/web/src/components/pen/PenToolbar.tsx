'use client';

import { usePenSettingsStore } from '../../state/penSettingsStore';

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#000000',
  '#78716c',
  '#ffffff',
];

type PenToolbarProps = {
  // Optional props for editing existing pen node
  editingNodeId?: string | null;
  onEditNodeColorChange?: (nodeId: string, color: string) => void;
  onEditNodeOpacityChange?: (nodeId: string, opacity: number) => void;
};

export function PenToolbar({
  editingNodeId,
  onEditNodeColorChange,
  onEditNodeOpacityChange,
}: PenToolbarProps = {}) {
  const { color, strokeWidth, opacity, setColor, setStrokeWidth, setOpacity } =
    usePenSettingsStore();

  const handleColorChange = (newColor: string) => {
    // Always save to store (for future drawings)
    setColor(newColor);
    // Also apply to editing node if any
    if (editingNodeId && onEditNodeColorChange) {
      onEditNodeColorChange(editingNodeId, newColor);
    }
  };

  const handleOpacityChange = (newOpacity: number) => {
    // Always save to store
    setOpacity(newOpacity);
    // Also apply to editing node if any
    if (editingNodeId && onEditNodeOpacityChange) {
      onEditNodeOpacityChange(editingNodeId, newOpacity);
    }
  };

  return (
    <div className="absolute left-4 top-4 z-[1000] pointer-events-auto" data-pen-toolbar="true">
      <div className="bg-white rounded-lg border border-slate-200 shadow-lg p-2.5 w-[200px]">
        {/* Color Palette */}
        <div className="mb-2.5">
          <div className="grid grid-cols-8 gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={`w-6 h-6 rounded border transition-all ${
                  color === c
                    ? 'border-indigo-600 ring-1 ring-indigo-200 scale-110'
                    : 'border-slate-200 hover:border-slate-300 hover:scale-105'
                }`}
                style={{
                  backgroundColor: c,
                  boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : undefined,
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-slate-600">Size</span>
            <span className="text-[10px] text-slate-500">{strokeWidth}px</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-slate-600">Opacity</span>
            <span className="text-[10px] text-slate-500">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => handleOpacityChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>
    </div>
  );
}
