"use client";

import { memo } from "react";
import type { ShapeType } from "./flowNodes/ShapeNode";

type ShapePaletteProps = {
  selectedShape: ShapeType | null;
  onSelectShape: (shape: ShapeType) => void;
};

const shapes: Array<{ type: ShapeType; label: string }> = [
  { type: "rectangle", label: "Rectangle" },
  { type: "round-rectangle", label: "Round Rectangle" },
  { type: "circle", label: "Circle" },
  { type: "diamond", label: "Diamond" },
  { type: "triangle", label: "Triangle" },
  { type: "ellipse", label: "Ellipse" },
  { type: "hexagon", label: "Hexagon" },
  { type: "parallelogram", label: "Parallelogram" },
  { type: "cylinder", label: "Cylinder" },
  { type: "arrow-rectangle", label: "Arrow Rectangle" },
  { type: "plus", label: "Plus" },
  { type: "star", label: "Star" },
];

function generatePath(points: number[][]): string {
  const path = points.map(([x, y]) => `${x},${y}`).join(' L');
  return `M${path} Z`;
}

function ShapeIcon({ shapeType, size = 16 }: { shapeType: ShapeType; size?: number }) {
  const color = "#6366f1";
  const strokeWidth = 0.5;
  const innerSize = size - 2 * strokeWidth;
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
        {shapeType === "rectangle" && (
          <rect x={0} y={2} width={innerSize} height={innerSize - 4} fill={color} />
        )}
        {shapeType === "round-rectangle" && (
          <rect x={0} y={2} width={innerSize} height={innerSize - 4} rx={2} fill={color} />
        )}
        {shapeType === "circle" && (
          <ellipse cx={innerSize / 2} cy={innerSize / 2} rx={innerSize / 2} ry={innerSize / 2} fill={color} />
        )}
        {shapeType === "diamond" && (
          <path d={generatePath([
            [0, innerSize / 2],
            [innerSize / 2, 0],
            [innerSize, innerSize / 2],
            [innerSize / 2, innerSize],
          ])} fill={color} />
        )}
        {shapeType === "triangle" && (
          <path d={generatePath([
            [0, innerSize],
            [innerSize / 2, 0],
            [innerSize, innerSize],
          ])} fill={color} />
        )}
        {shapeType === "ellipse" && (
          <ellipse cx={innerSize / 2} cy={innerSize / 2} rx={innerSize / 2} ry={innerSize / 2} fill={color} />
        )}
        {shapeType === "hexagon" && (
          <path d={generatePath([
            [0, innerSize / 2],
            [innerSize * 0.1, 0],
            [innerSize * 0.9, 0],
            [innerSize, innerSize / 2],
            [innerSize * 0.9, innerSize],
            [innerSize * 0.1, innerSize],
          ])} fill={color} />
        )}
        {shapeType === "parallelogram" && (
          <path d={generatePath([
            [0, innerSize],
            [innerSize * 0.25, 0],
            [innerSize, 0],
            [innerSize - innerSize * 0.25, innerSize],
          ])} fill={color} />
        )}
        {shapeType === "cylinder" && (
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
        {shapeType === "arrow-rectangle" && (
          <path d={generatePath([
            [0, 0],
            [innerSize - innerSize * 0.1, 0],
            [innerSize, innerSize / 2],
            [innerSize - innerSize * 0.1, innerSize],
            [0, innerSize],
          ])} fill={color} />
        )}
        {shapeType === "plus" && (
          <path d={generatePath([
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
          ])} fill={color} />
        )}
        {shapeType === "star" && (
          <polygon
            points={`${innerSize / 2},${innerSize * 0.1} ${innerSize * 0.6},${innerSize * 0.35} ${innerSize},${innerSize * 0.35} ${innerSize * 0.7},${innerSize * 0.55} ${innerSize * 0.85},${innerSize * 0.9} ${innerSize / 2},${innerSize * 0.7} ${innerSize * 0.15},${innerSize * 0.9} ${innerSize * 0.3},${innerSize * 0.55} 0,${innerSize * 0.35} ${innerSize * 0.4},${innerSize * 0.35}`}
            fill={color}
          />
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
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-md">
      <div className="flex items-center gap-1">
        {shapes.slice(0, 6).map((shape) => {
          const isSelected = selectedShape === shape.type;
          return (
            <button
              key={shape.type}
              type="button"
              onClick={() => onSelectShape(shape.type)}
              className={`grid h-8 w-8 place-items-center rounded-md transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isSelected ? "bg-indigo-100" : ""
              }`}
              title={shape.label}
            >
              <ShapeIcon shapeType={shape.type} size={16} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        {shapes.slice(6, 12).map((shape) => {
          const isSelected = selectedShape === shape.type;
          return (
            <button
              key={shape.type}
              type="button"
              onClick={() => onSelectShape(shape.type)}
              className={`grid h-8 w-8 place-items-center rounded-md transition-all duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isSelected ? "bg-indigo-100" : ""
              }`}
              title={shape.label}
            >
              <ShapeIcon shapeType={shape.type} size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
});

