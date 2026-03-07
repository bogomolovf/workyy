'use client';

import { memo, useId } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import {
  type ShapeType,
  generateShapePath,
  getShapePoints,
  getStarPoints,
  getCylinderPath,
} from './shape/shapeEngine';
import { SHAPE_LIST } from './shape/shapes';

type ShapePaletteProps = {
  selectedShape: ShapeType | null;
  onSelectShape: (shape: ShapeType) => void;
};

function ShapeIcon({ shapeType, size = 16 }: { shapeType: ShapeType; size?: number }) {
  const markerId = useId();
  const color = '#6366f1';
  const sw = 0.5;
  const inner = size - 2 * sw;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <g transform={`translate(${sw}, ${sw})`}>
        {/* Circle / Ellipse */}
        {(shapeType === 'circle' || shapeType === 'ellipse') && (
          <ellipse cx={inner / 2} cy={inner / 2} rx={inner / 2} ry={inner / 2} fill={color} />
        )}

        {/* Rectangle */}
        {shapeType === 'rectangle' && (
          <rect x={0} y={2} width={inner} height={inner - 4} fill={color} />
        )}

        {/* Round Rectangle */}
        {shapeType === 'round-rectangle' && (
          <rect x={0} y={2} width={inner} height={inner - 4} rx={2} fill={color} />
        )}

        {/* Star */}
        {shapeType === 'star' && <polygon points={getStarPoints(inner, inner)} fill={color} />}

        {/* Cylinder */}
        {shapeType === 'cylinder' && <path d={getCylinderPath(inner, inner)} fill={color} />}

        {/* Line */}
        {shapeType === 'line' && (
          <line
            x1={0}
            y1={inner}
            x2={inner}
            y2={0}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        )}

        {/* Arrow */}
        {shapeType === 'arrow' && (
          <g>
            <defs>
              <marker
                id={markerId}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L6,3 z" fill={color} />
              </marker>
            </defs>
            <line
              x1={0}
              y1={inner}
              x2={inner}
              y2={0}
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
            />
          </g>
        )}

        {/* All other polygon-based shapes */}
        {![
          'rectangle',
          'round-rectangle',
          'circle',
          'ellipse',
          'star',
          'cylinder',
          'line',
          'arrow',
        ].includes(shapeType) &&
          (() => {
            const pts = getShapePoints(shapeType, inner, inner);
            if (!pts) return null;
            return <path d={generateShapePath(pts)} fill={color} />;
          })()}
      </g>
    </svg>
  );
}

export const ShapePalette = memo(function ShapePalette({
  selectedShape,
  onSelectShape,
}: ShapePaletteProps) {
  const { t } = useTranslation();
  const ROW_SIZE = 7;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-md">
      <div className="flex items-center gap-1">
        {SHAPE_LIST.slice(0, ROW_SIZE).map((shape) => {
          const isSelected = selectedShape === shape.type;
          return (
            <button
              key={shape.type}
              type="button"
              onClick={() => onSelectShape(shape.type as ShapeType)}
              className={`grid h-8 w-8 place-items-center rounded-md transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isSelected ? 'bg-indigo-100' : ''
              }`}
              title={t.shapeLabels[shape.type] ?? shape.label}
            >
              <ShapeIcon shapeType={shape.type as ShapeType} size={16} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        {SHAPE_LIST.slice(ROW_SIZE).map((shape) => {
          const isSelected = selectedShape === shape.type;
          return (
            <button
              key={shape.type}
              type="button"
              onClick={() => onSelectShape(shape.type as ShapeType)}
              className={`grid h-8 w-8 place-items-center rounded-md transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isSelected ? 'bg-indigo-100' : ''
              }`}
              title={t.shapeLabels[shape.type] ?? shape.label}
            >
              <ShapeIcon shapeType={shape.type as ShapeType} size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
});
