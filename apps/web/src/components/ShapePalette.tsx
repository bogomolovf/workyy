'use client';

import { memo, useId, useMemo } from 'react';
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

function ShapeIcon({ shapeType, size = 20 }: { shapeType: ShapeType; size?: number }) {
  const markerId = useId();
  const fill = '#6366f1';
  const stroke = '#4f46e5';
  const sw = 1.2;
  const pad = 2;
  const inner = size - 2 * pad;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <g transform={`translate(${pad}, ${pad})`}>
        {/* Circle / Ellipse */}
        {(shapeType === 'circle' || shapeType === 'ellipse') && (
          <ellipse
            cx={inner / 2}
            cy={inner / 2}
            rx={inner / 2 - sw / 2}
            ry={shapeType === 'ellipse' ? inner * 0.35 : inner / 2 - sw / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Rectangle */}
        {shapeType === 'rectangle' && (
          <rect
            x={sw / 2}
            y={inner * 0.15}
            width={inner - sw}
            height={inner * 0.7}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Round Rectangle */}
        {shapeType === 'round-rectangle' && (
          <rect
            x={sw / 2}
            y={inner * 0.15}
            width={inner - sw}
            height={inner * 0.7}
            rx={3}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Star */}
        {shapeType === 'star' && (
          <polygon
            points={getStarPoints(inner, inner)}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Cylinder */}
        {shapeType === 'cylinder' && (
          <path
            d={getCylinderPath(inner, inner)}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Cloud */}
        {shapeType === 'cloud' && (
          <path
            d={`M${inner * 0.25},${inner * 0.55} C${inner * 0.05},${inner * 0.55} ${inner * 0.0},${inner * 0.3} ${inner * 0.2},${inner * 0.25} C${inner * 0.15},${inner * 0.05} ${inner * 0.4},${inner * 0.0} ${inner * 0.5},${inner * 0.15} C${inner * 0.6},${inner * 0.0} ${inner * 0.85},${inner * 0.05} ${inner * 0.8},${inner * 0.25} C${inner * 1.0},${inner * 0.3} ${inner * 0.95},${inner * 0.55} ${inner * 0.75},${inner * 0.55} C${inner * 0.95},${inner * 0.6} ${inner * 0.95},${inner * 0.8} ${inner * 0.75},${inner * 0.8} L${inner * 0.25},${inner * 0.8} C${inner * 0.05},${inner * 0.8} ${inner * 0.05},${inner * 0.6} ${inner * 0.25},${inner * 0.55} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Heart */}
        {shapeType === 'heart' && (
          <path
            d={`M${inner * 0.5},${inner * 0.3} C${inner * 0.5},${inner * 0.2} ${inner * 0.35},0 ${inner * 0.15},0 C0,0 0,${inner * 0.25} 0,${inner * 0.25} C0,${inner * 0.5} ${inner * 0.25},${inner * 0.7} ${inner * 0.5},${inner} C${inner * 0.75},${inner * 0.7} ${inner},${inner * 0.5} ${inner},${inner * 0.25} C${inner},${inner * 0.25} ${inner},0 ${inner * 0.85},0 C${inner * 0.65},0 ${inner * 0.5},${inner * 0.2} ${inner * 0.5},${inner * 0.3} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity={0.85}
          />
        )}

        {/* Speech bubble */}
        {shapeType === 'speech-bubble' &&
          (() => {
            const r = 2;
            const bodyH = inner * 0.75;
            return (
              <path
                d={`M${r},0 L${inner - r},0 Q${inner},0 ${inner},${r} L${inner},${bodyH - r} Q${inner},${bodyH} ${inner - r},${bodyH} L${inner * 0.35},${bodyH} L${inner * 0.15},${inner} L${inner * 0.2},${bodyH} L${r},${bodyH} Q0,${bodyH} 0,${bodyH - r} L0,${r} Q0,0 ${r},0 Z`}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
                opacity={0.85}
              />
            );
          })()}

        {/* Document shape */}
        {shapeType === 'document-shape' &&
          (() => {
            const wave = inner * 0.1;
            const bodyH = inner - wave;
            return (
              <path
                d={`M0,0 L${inner},0 L${inner},${bodyH} C${inner * 0.75},${bodyH + wave * 2} ${inner * 0.25},${bodyH - wave} 0,${bodyH} Z`}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
                opacity={0.85}
              />
            );
          })()}

        {/* Line */}
        {shapeType === 'line' && (
          <line
            x1={1}
            y1={inner - 1}
            x2={inner - 1}
            y2={1}
            stroke={stroke}
            strokeWidth={sw + 0.5}
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
                <path d="M0,0 L0,6 L6,3 z" fill={stroke} />
              </marker>
            </defs>
            <line
              x1={1}
              y1={inner - 1}
              x2={inner - 1}
              y2={1}
              stroke={stroke}
              strokeWidth={sw + 0.5}
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
          'cloud',
          'heart',
          'speech-bubble',
          'document-shape',
          'line',
          'arrow',
        ].includes(shapeType) &&
          (() => {
            const pts = getShapePoints(shapeType, inner, inner);
            if (!pts) return null;
            return (
              <path
                d={generateShapePath(pts)}
                fill={fill}
                stroke={stroke}
                strokeWidth={sw}
                opacity={0.85}
              />
            );
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

  const categories = useMemo(() => {
    const basicShapes = SHAPE_LIST.filter((s) => s.category === 'basic');
    const flowchartShapes = SHAPE_LIST.filter((s) => s.category === 'flowchart');
    const lineShapes = SHAPE_LIST.filter((s) => s.category === 'line');
    return { basicShapes, flowchartShapes, lineShapes };
  }, []);

  const renderShapeButton = (shape: { type: string; label: string }) => {
    const isSelected = selectedShape === shape.type;
    return (
      <button
        key={shape.type}
        type="button"
        onClick={() => onSelectShape(shape.type as ShapeType)}
        className={`grid h-9 w-9 place-items-center rounded-lg transition-all duration-100 ${
          isSelected ? 'bg-indigo-100 ring-1 ring-indigo-400 shadow-sm' : 'hover:bg-slate-100'
        }`}
        title={t.shapeLabels[shape.type] ?? shape.label}
      >
        <ShapeIcon shapeType={shape.type as ShapeType} size={20} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-lg min-w-[200px]">
      {/* Basic shapes */}
      <div>
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1 mb-0.5">
          {t.shapeLabels._categoryBasic ?? 'Basic'}
        </div>
        <div className="flex flex-wrap gap-0.5">
          {categories.basicShapes.map(renderShapeButton)}
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Flowchart shapes */}
      <div>
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1 mb-0.5">
          {t.shapeLabels._categoryFlowchart ?? 'Flowchart'}
        </div>
        <div className="flex flex-wrap gap-0.5">
          {categories.flowchartShapes.map(renderShapeButton)}
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* Lines */}
      <div>
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider px-1 mb-0.5">
          {t.shapeLabels._categoryLines ?? 'Lines'}
        </div>
        <div className="flex flex-wrap gap-0.5">{categories.lineShapes.map(renderShapeButton)}</div>
      </div>
    </div>
  );
});
