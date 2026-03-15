'use client';

import { NodeToolbar } from 'reactflow';
import type { ShapeType } from '../flowNodes/ShapeNode';

/* ── Fill colors (matching StickyToolbar pastel style + extras) ─────────── */
const fillColors = [
  'transparent',
  '#ffffff',
  '#FFB3BA', // pastel pink
  '#FFDFBA', // pastel peach
  '#FFFFBA', // pastel yellow
  '#BAFFC9', // pastel mint
  '#BAE1FF', // pastel blue
  '#E0BBE4', // pastel lavender
  '#f1f5f9', // slate-100
  '#cbd5e1', // slate-300
  '#ef4444', // red
  '#3b82f6', // blue
];

/* ── Stroke colors ──────────────────────────────────────────────────────── */
const strokeColors = [
  '#1f1f1f',
  '#475569',
  '#94a3b8',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
];

const strokeWidths = [1, 2, 3, 4, 6, 8];

type ShapeToolbarProps = {
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius?: number;
  arrowHead?: boolean;
  onChangeFill?: (fill: string) => void;
  onChangeStroke?: (stroke: string) => void;
  onChangeStrokeWidth?: (strokeWidth: number) => void;
  onChangeOpacity?: (opacity: number) => void;
  onChangeCornerRadius?: (cornerRadius: number) => void;
  onChangeArrowHead?: (arrowHead: boolean) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export function ShapeToolbar({
  shapeType,
  fill,
  stroke,
  strokeWidth,
  opacity,
  cornerRadius,
  arrowHead,
  onChangeFill = () => {},
  onChangeStroke = () => {},
  onChangeStrokeWidth = () => {},
  onChangeOpacity = () => {},
  onChangeCornerRadius = () => {},
  onChangeArrowHead = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
}: ShapeToolbarProps) {
  const isLineType = shapeType === 'line' || shapeType === 'arrow';
  const showCornerRadius =
    shapeType === 'rectangle' || shapeType === 'round-rectangle' || shapeType === 'speech-bubble';

  return (
    <NodeToolbar className="nodrag" offset={8}>
      <div
        className="flex flex-col gap-2 rounded-lg bg-white px-2 py-2 shadow-lg border border-slate-200"
        onMouseDownCapture={() => onInteractionStart()}
        onMouseEnter={() => onInteractionStart()}
      >
        {/* Row 1: Controls — stroke width, opacity, corner radius, arrow head */}
        <div className="flex items-center gap-1.5">
          {/* Stroke width */}
          <select
            value={strokeWidth}
            onChange={(e) => {
              onChangeStrokeWidth(Number(e.target.value));
              setTimeout(() => onInteractionEnd(), 100);
            }}
            onBlur={() => setTimeout(() => onInteractionEnd(), 100)}
            className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
          >
            {strokeWidths.map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>

          {/* Divider */}
          <div className="w-px h-3 bg-slate-300" />

          {/* Opacity */}
          <select
            value={opacity}
            onChange={(e) => {
              onChangeOpacity(Number(e.target.value));
              setTimeout(() => onInteractionEnd(), 100);
            }}
            onBlur={() => setTimeout(() => onInteractionEnd(), 100)}
            className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
          >
            {[0.1, 0.25, 0.5, 0.75, 1.0].map((op) => (
              <option key={op} value={op}>
                {Math.round(op * 100)}%
              </option>
            ))}
          </select>

          {/* Corner radius (rectangles/speech-bubble) */}
          {showCornerRadius && (
            <>
              <div className="w-px h-3 bg-slate-300" />
              <label className="text-xs text-slate-600">R:</label>
              <input
                type="range"
                min="0"
                max="32"
                step="1"
                value={cornerRadius ?? 0}
                onChange={(e) => onChangeCornerRadius(Number(e.target.value))}
                onMouseUp={() => setTimeout(() => onInteractionEnd(), 100)}
                className="nodrag flex-1 w-14 accent-indigo-500"
              />
              <span className="text-xs text-slate-500 w-6 text-right">{cornerRadius ?? 0}</span>
            </>
          )}

          {/* Arrow head toggle */}
          {shapeType === 'arrow' && (
            <>
              <div className="w-px h-3 bg-slate-300" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangeArrowHead(!arrowHead);
                  setTimeout(() => onInteractionEnd(), 50);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={`px-1.5 py-0.5 rounded text-xs transition-colors nodrag ${
                  arrowHead
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
                title="Arrow head"
                aria-label="Toggle arrow head"
              >
                {arrowHead ? '→ On' : '→ Off'}
              </button>
            </>
          )}
        </div>

        {/* Row 2: Fill color swatches */}
        {!isLineType && (
          <div className="flex items-center gap-1.5">
            {fillColors.map((color) => {
              const isTransparent = color === 'transparent';
              return (
                <button
                  key={`fill-${color}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChangeFill(color);
                    setTimeout(() => onInteractionEnd(), 50);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    backgroundColor: isTransparent ? '#fff' : color,
                    backgroundImage: isTransparent
                      ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                      : undefined,
                    backgroundSize: isTransparent ? '6px 6px' : undefined,
                    backgroundPosition: isTransparent
                      ? '0 0, 0 3px, 3px -3px, -3px 0px'
                      : undefined,
                  }}
                  className={`color-swatch nodrag ${color === fill ? 'active' : ''}`}
                  aria-label={`Fill ${color}`}
                />
              );
            })}
          </div>
        )}

        {/* Row 3: Stroke color swatches */}
        <div className="flex items-center gap-1.5">
          {strokeColors.map((color) => (
            <button
              key={`stroke-${color}`}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChangeStroke(color);
                setTimeout(() => onInteractionEnd(), 50);
              }}
              onMouseDown={(e) => e.preventDefault()}
              style={{ backgroundColor: color }}
              className={`color-swatch nodrag ${color === stroke ? 'active' : ''}`}
              aria-label={`Stroke ${color}`}
            />
          ))}
        </div>
      </div>
    </NodeToolbar>
  );
}
