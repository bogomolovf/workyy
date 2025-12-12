'use client';

import { memo } from 'react';
import type { ShapeType } from './flowNodes/ShapeNode';

type ShapePaletteProps = {
  selectedShape: ShapeType | null;
  onSelectShape: (shape: ShapeType) => void;
};

type ShapeCategory = {
  name: string;
  shapes: Array<{ type: ShapeType; label: string }>;
};

const shapeCategories: ShapeCategory[] = [
  {
    name: 'Basic',
    shapes: [
      { type: 'rectangle', label: 'Rectangle' },
      { type: 'round-rectangle', label: 'Round Rectangle' },
      { type: 'square', label: 'Square' },
      { type: 'circle', label: 'Circle' },
      { type: 'ellipse', label: 'Ellipse' },
      { type: 'line', label: 'Line' },
    ],
  },
  {
    name: 'Polygons',
    shapes: [
      { type: 'triangle', label: 'Triangle' },
      { type: 'triangle-right', label: 'Right Triangle' },
      { type: 'diamond', label: 'Diamond' },
      { type: 'pentagon', label: 'Pentagon' },
      { type: 'hexagon', label: 'Hexagon' },
      { type: 'polygon', label: 'Polygon' },
      { type: 'parallelogram', label: 'Parallelogram' },
    ],
  },
  {
    name: 'Special',
    shapes: [
      { type: 'cylinder', label: 'Cylinder' },
      { type: 'star', label: 'Star' },
      { type: 'plus', label: 'Plus' },
      { type: 'arrow-rectangle', label: 'Arrow Rectangle' },
    ],
  },
  {
    name: 'Arrows',
    shapes: [
      { type: 'arrow-straight', label: 'Straight Arrow' },
      { type: 'arrow-curved', label: 'Curved Arrow' },
      { type: 'arrow-polyline', label: 'Polyline Arrow' },
      { type: 'arrow-bidirectional', label: 'Bidirectional' },
      { type: 'arrow-outline', label: 'Outline Arrow' },
      { type: 'arrow-filled', label: 'Filled Arrow' },
      { type: 'arrow-dashed', label: 'Dashed Arrow' },
    ],
  },
];

// Flatten for backward compatibility
const shapes: Array<{ type: ShapeType; label: string }> = shapeCategories.flatMap((cat) => cat.shapes);

function generatePath(points: number[][]): string {
  const path = points.map(([x, y]) => `${x},${y}`).join(' L');
  return `M${path} Z`;
}

function ShapeIcon({ shapeType, size = 16 }: { shapeType: ShapeType; size?: number }) {
  const color = '#6366f1';
  const strokeWidth = 0.5;
  const innerSize = size - 2 * strokeWidth;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
        {shapeType === 'rectangle' && (
          <rect x={0} y={2} width={innerSize} height={innerSize - 4} fill={color} />
        )}
        {shapeType === 'round-rectangle' && (
          <rect x={0} y={2} width={innerSize} height={innerSize - 4} rx={2} fill={color} />
        )}
        {shapeType === 'circle' && (
          <ellipse
            cx={innerSize / 2}
            cy={innerSize / 2}
            rx={innerSize / 2}
            ry={innerSize / 2}
            fill={color}
          />
        )}
        {shapeType === 'diamond' && (
          <path
            d={generatePath([
              [0, innerSize / 2],
              [innerSize / 2, 0],
              [innerSize, innerSize / 2],
              [innerSize / 2, innerSize],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'triangle' && (
          <path
            d={generatePath([
              [0, innerSize],
              [innerSize / 2, 0],
              [innerSize, innerSize],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'triangle-right' && (
          <path
            d={generatePath([
              [0, 0],
              [innerSize, innerSize / 2],
              [0, innerSize],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'pentagon' && (
          <polygon
            points={`${innerSize / 2},0 ${innerSize * 0.95},${innerSize * 0.35} ${innerSize * 0.8},${innerSize} ${innerSize * 0.2},${innerSize} ${innerSize * 0.05},${innerSize * 0.35}`}
            fill={color}
          />
        )}
        {shapeType === 'polygon' && (
          <polygon
            points={`${innerSize / 2},0 ${innerSize},${innerSize * 0.25} ${innerSize},${innerSize * 0.75} ${innerSize / 2},${innerSize} 0,${innerSize * 0.75} 0,${innerSize * 0.25}`}
            fill={color}
          />
        )}
        {shapeType === 'square' && (
          <rect x={2} y={2} width={innerSize - 4} height={innerSize - 4} fill={color} />
        )}
        {shapeType === 'ellipse' && (
          <ellipse
            cx={innerSize / 2}
            cy={innerSize / 2}
            rx={innerSize / 2}
            ry={innerSize / 2}
            fill={color}
          />
        )}
        {shapeType === 'line' && (
          <line x1={0} y1={innerSize / 2} x2={innerSize} y2={innerSize / 2} stroke={color} strokeWidth={2} />
        )}
        {shapeType === 'hexagon' && (
          <path
            d={generatePath([
              [0, innerSize / 2],
              [innerSize * 0.1, 0],
              [innerSize * 0.9, 0],
              [innerSize, innerSize / 2],
              [innerSize * 0.9, innerSize],
              [innerSize * 0.1, innerSize],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'parallelogram' && (
          <path
            d={generatePath([
              [0, innerSize],
              [innerSize * 0.25, 0],
              [innerSize, 0],
              [innerSize - innerSize * 0.25, innerSize],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'cylinder' && (
          <path
            d={`M0,${innerSize * 0.125}  L 0,${innerSize - innerSize * 0.125} A ${
              innerSize / 2
            } ${innerSize * 0.125} 0 1 0 ${innerSize} ${innerSize - innerSize * 0.125} L ${innerSize},${innerSize * 0.125} A ${
              innerSize / 2
            } ${innerSize * 0.125} 0 1 1 0 ${innerSize * 0.125} A ${
              innerSize / 2
            } ${innerSize * 0.125} 0 1 1 ${innerSize} ${innerSize * 0.125} A ${
              innerSize / 2
            } ${innerSize * 0.125} 0 1 1 0 ${innerSize * 0.125} z`}
            fill={color}
          />
        )}
        {shapeType === 'arrow-rectangle' && (
          <path
            d={generatePath([
              [0, 0],
              [innerSize - innerSize * 0.1, 0],
              [innerSize, innerSize / 2],
              [innerSize - innerSize * 0.1, innerSize],
              [0, innerSize],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'plus' && (
          <path
            d={generatePath([
              [innerSize / 3, 0],
              [innerSize * (2 / 3), 0],
              [innerSize * (2 / 3), innerSize / 3],
              [innerSize, innerSize / 3],
              [innerSize, innerSize * (2 / 3)],
              [innerSize * (2 / 3), innerSize * (2 / 3)],
              [innerSize * (2 / 3), innerSize],
              [innerSize / 3, innerSize],
              [innerSize / 3, innerSize * (2 / 3)],
              [0, innerSize * (2 / 3)],
              [0, innerSize / 3],
              [innerSize / 3, innerSize / 3],
            ])}
            fill={color}
          />
        )}
        {shapeType === 'star' && (
          <polygon
            points={`${innerSize / 2},${innerSize * 0.1} ${innerSize * 0.6},${innerSize * 0.35} ${innerSize},${innerSize * 0.35} ${innerSize * 0.7},${innerSize * 0.55} ${innerSize * 0.85},${innerSize * 0.9} ${innerSize / 2},${innerSize * 0.7} ${innerSize * 0.15},${innerSize * 0.9} ${innerSize * 0.3},${innerSize * 0.55} 0,${innerSize * 0.35} ${innerSize * 0.4},${innerSize * 0.35}`}
            fill={color}
          />
        )}
        {/* Arrow shapes */}
        {(shapeType === 'arrow-straight' ||
          shapeType === 'arrow-bidirectional' ||
          shapeType === 'arrow-outline' ||
          shapeType === 'arrow-filled' ||
          shapeType === 'arrow-dashed') && (
          <>
            <line
              x1={2}
              y1={innerSize / 2}
              x2={innerSize - 4}
              y2={innerSize / 2}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray={shapeType === 'arrow-dashed' ? '2 2' : 'none'}
            />
            <polygon
              points={`${innerSize - 4},${innerSize / 2} ${innerSize - 8},${innerSize / 2 - 3} ${innerSize - 8},${innerSize / 2 + 3}`}
              fill={shapeType === 'arrow-filled' ? color : 'none'}
              stroke={color}
              strokeWidth={1}
            />
            {shapeType === 'arrow-bidirectional' && (
              <polygon
                points={`${2},${innerSize / 2} ${6},${innerSize / 2 - 3} ${6},${innerSize / 2 + 3}`}
                fill="none"
                stroke={color}
                strokeWidth={1}
              />
            )}
          </>
        )}
        {shapeType === 'arrow-curved' && (
          <>
            <path
              d={`M 2,${innerSize / 2} Q ${innerSize / 2},${innerSize * 0.2} ${innerSize - 4},${innerSize / 2}`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
            />
            <polygon
              points={`${innerSize - 4},${innerSize / 2} ${innerSize - 8},${innerSize / 2 - 3} ${innerSize - 8},${innerSize / 2 + 3}`}
              fill={color}
            />
          </>
        )}
        {shapeType === 'arrow-polyline' && (
          <>
            <polyline
              points={`2,${innerSize / 2} ${innerSize / 2},${innerSize * 0.25} ${innerSize - 4},${innerSize / 2}`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
            />
            <polygon
              points={`${innerSize - 4},${innerSize / 2} ${innerSize - 8},${innerSize / 2 - 3} ${innerSize - 8},${innerSize / 2 + 3}`}
              fill={color}
            />
          </>
        )}
      </g>
    </svg>
  );
}

export const ShapePalette = memo(function ShapePalette({
  selectedShape,
  onSelectShape,
}: ShapePaletteProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-md max-h-[400px] overflow-y-auto">
      {shapeCategories.map((category) => (
        <div key={category.name} className="flex flex-col gap-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-1">
            {category.name}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {category.shapes.map((shape) => {
              const isSelected = selectedShape === shape.type;
              return (
                <button
                  key={shape.type}
                  type="button"
                  onClick={() => onSelectShape(shape.type)}
                  className={`grid h-8 w-8 place-items-center rounded-md transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isSelected ? 'bg-indigo-100' : ''
                  }`}
                  title={shape.label}
                >
                  <ShapeIcon shapeType={shape.type} size={16} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
