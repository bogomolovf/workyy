'use client';

import { useState, useRef, useEffect } from 'react';
import { NodeToolbar } from 'reactflow';
import type { ShapeType } from '../flowNodes/ShapeNode';

const colors = [
  '#ffffff', // white
  '#f1f5f9', // slate-100
  '#cbd5e1', // slate-300
  '#475569', // slate-600
  '#1f1f1f', // almost black (default stroke)
  '#ef4444', // red
  '#f59e0b', // amber
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  'transparent', // none
];

const strokeWidths = [1, 2, 3, 4, 6, 8];

const opacities = [0.1, 0.25, 0.5, 0.75, 1.0];

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
  const [isFillOpen, setIsFillOpen] = useState(false);
  const [isStrokeOpen, setIsStrokeOpen] = useState(false);
  const fillButtonRef = useRef<HTMLButtonElement>(null);
  const strokeButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isFillOpen && !isStrokeOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        fillButtonRef.current &&
        !fillButtonRef.current.contains(e.target as Node) &&
        strokeButtonRef.current &&
        !strokeButtonRef.current.contains(e.target as Node)
      ) {
        setIsFillOpen(false);
        setIsStrokeOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isFillOpen, isStrokeOpen]);

  const isLineType = shapeType === 'line' || shapeType === 'arrow';
  const isRectangle = shapeType === 'rectangle' || shapeType === 'round-rectangle';
  const showCornerRadius = isRectangle;

  return (
    <NodeToolbar className="nodrag" offset={8}>
      <div
        className="flex flex-col gap-2 rounded-lg bg-white px-2 py-2 shadow-lg border border-slate-200"
        onMouseDownCapture={(e) => {
          onInteractionStart();
        }}
        onMouseEnter={(e) => {
          onInteractionStart();
        }}
      >
        {/* Fill and Stroke colors */}
        <div className="flex items-center gap-1.5">
          {/* Fill color button */}
          <div className="relative">
            <button
              ref={fillButtonRef}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isLineType) {
                  setIsFillOpen(!isFillOpen);
                  setIsStrokeOpen(false);
                }
                setTimeout(() => onInteractionEnd(), 50);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              disabled={isLineType}
              className={`px-2 py-1 rounded text-xs border nodrag transition-colors ${
                isLineType
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title={isLineType ? 'Fill not available for lines' : 'Fill color'}
              aria-label="Fill color"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded border border-slate-300"
                  style={{
                    backgroundColor: fill === 'transparent' || fill === 'none' ? 'white' : fill,
                    backgroundImage:
                      fill === 'transparent' || fill === 'none'
                        ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                        : undefined,
                    backgroundSize:
                      fill === 'transparent' || fill === 'none' ? '8px 8px' : undefined,
                    backgroundPosition:
                      fill === 'transparent' || fill === 'none'
                        ? '0 0, 0 4px, 4px -4px, -4px 0px'
                        : undefined,
                  }}
                />
                <span>Fill</span>
              </div>
            </button>
            {isFillOpen && !isLineType && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                <div className="grid grid-cols-4 gap-1.5">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onChangeFill(color);
                        setIsFillOpen(false);
                        setTimeout(() => onInteractionEnd(), 50);
                      }}
                      className={`w-6 h-6 rounded border-2 nodrag ${
                        fill === color ? 'border-indigo-500' : 'border-slate-300'
                      }`}
                      style={{
                        backgroundColor: color === 'transparent' ? 'white' : color,
                        backgroundImage:
                          color === 'transparent'
                            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                            : undefined,
                        backgroundSize: color === 'transparent' ? '8px 8px' : undefined,
                        backgroundPosition:
                          color === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                      }}
                      aria-label={`Select fill color ${color}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stroke color button */}
          <div className="relative">
            <button
              ref={strokeButtonRef}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsStrokeOpen(!isStrokeOpen);
                setIsFillOpen(false);
                setTimeout(() => onInteractionEnd(), 50);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              className="px-2 py-1 rounded text-xs bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 nodrag transition-colors"
              title="Stroke color"
              aria-label="Stroke color"
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{ borderColor: stroke, backgroundColor: stroke }}
                />
                <span>Stroke</span>
              </div>
            </button>
            {isStrokeOpen && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                <div className="grid grid-cols-4 gap-1.5">
                  {colors
                    .filter((c) => c !== 'transparent')
                    .map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onChangeStroke(color);
                          setIsStrokeOpen(false);
                          setTimeout(() => onInteractionEnd(), 50);
                        }}
                        className={`w-6 h-6 rounded border-2 nodrag ${
                          stroke === color ? 'border-indigo-500' : 'border-slate-300'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select stroke color ${color}`}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stroke width and opacity */}
        <div className="flex items-center gap-1.5">
          {/* Stroke width selector */}
          <select
            value={strokeWidth}
            onChange={(e) => {
              onChangeStrokeWidth(Number(e.target.value));
              setTimeout(() => onInteractionEnd(), 100);
            }}
            onBlur={() => {
              setTimeout(() => onInteractionEnd(), 100);
            }}
            className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
          >
            {strokeWidths.map((width) => (
              <option key={width} value={width}>
                {width}px
              </option>
            ))}
          </select>

          {/* Opacity selector */}
          <select
            value={opacity}
            onChange={(e) => {
              onChangeOpacity(Number(e.target.value));
              setTimeout(() => onInteractionEnd(), 100);
            }}
            onBlur={() => {
              setTimeout(() => onInteractionEnd(), 100);
            }}
            className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
          >
            {opacities.map((op) => (
              <option key={op} value={op}>
                {Math.round(op * 100)}%
              </option>
            ))}
          </select>
        </div>

        {/* Corner radius (for rectangles only) */}
        {showCornerRadius && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">Radius:</label>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={cornerRadius ?? 0}
              onChange={(e) => {
                onChangeCornerRadius(Number(e.target.value));
              }}
              onMouseUp={() => {
                setTimeout(() => onInteractionEnd(), 100);
              }}
              className="nodrag flex-1"
            />
            <span className="text-xs text-slate-600 w-8 text-right">{cornerRadius ?? 0}px</span>
          </div>
        )}

        {/* Arrow head toggle (for arrows only) */}
        {shapeType === 'arrow' && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">Arrow head:</label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChangeArrowHead(!arrowHead);
                setTimeout(() => onInteractionEnd(), 50);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              className={`px-2 py-1 rounded text-xs border nodrag transition-colors ${
                arrowHead
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Toggle arrow head"
              aria-label="Toggle arrow head"
            >
              {arrowHead ? 'On' : 'Off'}
            </button>
          </div>
        )}
      </div>
    </NodeToolbar>
  );
}
