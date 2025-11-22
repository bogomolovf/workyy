"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { NodeResizer, type NodeProps, useStore, NodeToolbar } from "reactflow";
import { StickyToolbar } from "../StickyToolbar";

// Утилита для генерации SVG path из точек (как в React Flow Pro)
function generatePath(points: number[][]): string {
  const path = points.map(([x, y]) => `${x},${y}`).join(' L');
  return `M${path} Z`;
}

// Получаем актуальные размеры узла из внутреннего состояния React Flow (как в референсе)
function useNodeDimensions(id: string) {
  const node = useStore((state) => state.nodeInternals.get(id));
  return {
    width: node?.width || 0,
    height: node?.height || 0,
  };
}

export type ShapeType = 
  | "rectangle" 
  | "round-rectangle"
  | "circle" 
  | "diamond" 
  | "triangle" 
  | "ellipse"
  | "hexagon"
  | "parallelogram"
  | "cylinder"
  | "star"
  | "arrow-rectangle"
  | "plus";

export type ShapeNodeData = {
  shapeType?: ShapeType;
  shapeColor?: string;
  shapeLabel?: string;
  width?: number;
  height?: number;
  // Поддержка текста для заметок
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  // Callbacks для изменения текста и форматирования
  onChangeText?: (id: string, text: string) => void;
  onChangeColor?: (id: string, color: string) => void;
  onChangeFontSize?: (id: string, fontSize: number) => void;
  onChangeFontFamily?: (id: string, fontFamily: string) => void;
  onChangeBold?: (id: string, isBold: boolean) => void;
  onChangeItalic?: (id: string, isItalic: boolean) => void;
};

export function ShapeNode({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const {
    shapeType = "rectangle",
    shapeColor = "#BFDBFE",
    shapeLabel = "Фигура",
    text,
    fontSize = 48,
    fontFamily = "Inter, sans-serif",
    isBold = false,
    isItalic = false,
  } = data ?? {};

  // Используем useNodeDimensions для получения актуальных размеров в реальном времени (как в референсе)
  // Это позволяет NodeResizer обновлять размеры плавно во время ресайза
  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);
  
  // Fallback на дефолтные размеры, если React Flow еще не измерил узел
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? 160);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? 96);
  
  // Проверяем, является ли это заметкой (есть текст или callbacks)
  const isNote = Boolean(text !== undefined || data?.onChangeText);

  // Refs для textarea (если это заметка)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Состояние для отслеживания перетаскивания фигур
  const [isDragging, setIsDragging] = useState(false);
  
  // Callbacks для заметок
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      data?.onChangeText?.(id, e.target.value);
    },
    [data, id]
  );
  
  const handleColorChange = useCallback(
    (color: string) => {
      data?.onChangeColor?.(id, color);
    },
    [data, id]
  );
  
  const handleFontSizeChange = useCallback(
    (newFontSize: number) => {
      data?.onChangeFontSize?.(id, newFontSize);
    },
    [data, id]
  );
  
  const handleFontFamilyChange = useCallback(
    (newFontFamily: string) => {
      data?.onChangeFontFamily?.(id, newFontFamily);
    },
    [data, id]
  );
  
  const handleBoldToggle = useCallback(() => {
    data?.onChangeBold?.(id, !isBold);
  }, [data, id, isBold]);
  
  const handleItalicToggle = useCallback(() => {
    data?.onChangeItalic?.(id, !isItalic);
  }, [data, id, isItalic]);
  
  // Учитываем strokeWidth при расчете внутренних размеров (как в React Flow Pro)
  const strokeWidth = 2;
  const innerWidth = useMemo(() => finalWidth - 2 * strokeWidth, [finalWidth]);
  const innerHeight = useMemo(() => finalHeight - 2 * strokeWidth, [finalHeight]);

  // Обработчики для перетаскивания фигур
  const handleShapeMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isNote) {
      setIsDragging(true);
      // Не останавливаем propagation - React Flow обработает перетаскивание
    }
  }, [isNote]);

  const handleShapeMouseUp = useCallback(() => {
    if (!isNote) {
      setIsDragging(false);
    }
  }, [isNote]);

  const handleShapeMouseLeave = useCallback(() => {
    if (!isNote) {
      setIsDragging(false);
    }
  }, [isNote]);

  return (
    <div 
      className="workyy-shape-node relative"
      style={{ width: finalWidth, height: finalHeight }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={48}
        keepAspectRatio={false}
        lineClassName="!border-slate-300"
        handleStyle={isNote ? {
          // Для заметок используем такой же размер, как у дата клеток
          width: 12,
          height: 12,
          borderRadius: 6,
          border: "2px solid #6366f1",
          background: "#EEF2FF",
        } : {
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: "2px solid #64748b",
          background: "#ffffff",
        }}
      />
      {isNote && selected && (
        <StickyToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          isBold={isBold}
          isItalic={isItalic}
          activeColor={shapeColor}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onBoldToggle={handleBoldToggle}
          onItalicToggle={handleItalicToggle}
          onColorChange={handleColorChange}
        />
      )}
      {/* Прозрачный слой для перетаскивания фигур - поверх SVG, но не блокирует NodeResizer */}
      {!isNote && (
        <div
          className="absolute inset-0"
          style={{ 
            cursor: isDragging ? "grabbing" : "grab",
            zIndex: 5,
            pointerEvents: "auto"
          }}
          onMouseDown={(e) => {
            // Не блокируем NodeResizer - если клик на handle, пропускаем событие
            const target = e.target as HTMLElement;
            if (target.closest('.react-flow__resize-control')) {
              return;
            }
            handleShapeMouseDown(e);
          }}
          onMouseUp={handleShapeMouseUp}
          onMouseLeave={handleShapeMouseLeave}
        />
      )}
      <svg
        width={finalWidth}
        height={finalHeight}
        className="rounded-md overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
          {shapeType === "rectangle" && (
            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill={shapeColor}
              stroke={isNote ? "none" : "#64748b"}
              strokeWidth={isNote ? 0 : strokeWidth}
            />
          )}
          {shapeType === "round-rectangle" && (
            <rect
              x={0}
              y={0}
              rx={Math.min(12, 0.2 * Math.min(innerWidth, innerHeight))}
              ry={Math.min(12, 0.2 * Math.min(innerWidth, innerHeight))}
              width={innerWidth}
              height={innerHeight}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "circle" && (
            <ellipse
              cx={innerWidth / 2}
              cy={innerHeight / 2}
              rx={innerWidth / 2}
              ry={innerHeight / 2}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "diamond" && (
            <path
              d={generatePath([
                [0, innerHeight / 2],
                [innerWidth / 2, 0],
                [innerWidth, innerHeight / 2],
                [innerWidth / 2, innerHeight],
              ])}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "triangle" && (
            <path
              d={generatePath([
                [0, innerHeight],
                [innerWidth / 2, 0],
                [innerWidth, innerHeight],
              ])}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "ellipse" && (
            <ellipse
              cx={innerWidth / 2}
              cy={innerHeight / 2}
              rx={innerWidth / 2}
              ry={innerHeight / 2}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "hexagon" && (
            <path
              d={generatePath([
                [0, innerHeight / 2],
                [innerWidth * 0.1, 0],
                [innerWidth * 0.9, 0],
                [innerWidth, innerHeight / 2],
                [innerWidth * 0.9, innerHeight],
                [innerWidth * 0.1, innerHeight],
              ])}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "parallelogram" && (
            <path
              d={generatePath([
                [0, innerHeight],
                [innerWidth * 0.25, 0],
                [innerWidth, 0],
                [innerWidth - innerWidth * 0.25, innerHeight],
              ])}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "cylinder" && (
            <path
              d={`M0,${innerHeight * 0.125}  L 0,${innerHeight - innerHeight * 0.125} A ${
                innerWidth / 2
              } ${innerHeight * 0.125} 0 1 0 ${innerWidth} ${innerHeight - innerHeight * 0.125} L ${innerWidth},${innerHeight * 0.125} A ${
                innerWidth / 2
              } ${innerHeight * 0.125} 0 1 1 0 ${innerHeight * 0.125} A ${
                innerWidth / 2
              } ${innerHeight * 0.125} 0 1 1 ${innerWidth} ${innerHeight * 0.125} A ${
                innerWidth / 2
              } ${innerHeight * 0.125} 0 1 1 0 ${innerHeight * 0.125} z`}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "star" && (
            <polygon
              points={`${innerWidth / 2},${innerHeight * 0.1} ${innerWidth * 0.6},${innerHeight * 0.35} ${innerWidth},${innerHeight * 0.35} ${innerWidth * 0.7},${innerHeight * 0.55} ${innerWidth * 0.85},${innerHeight * 0.9} ${innerWidth / 2},${innerHeight * 0.7} ${innerWidth * 0.15},${innerHeight * 0.9} ${innerWidth * 0.3},${innerHeight * 0.55} 0,${innerHeight * 0.35} ${innerWidth * 0.4},${innerHeight * 0.35}`}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "arrow-rectangle" && (
            <path
              d={generatePath([
                [0, 0],
                [innerWidth - innerWidth * 0.1, 0],
                [innerWidth, innerHeight / 2],
                [innerWidth - innerWidth * 0.1, innerHeight],
                [0, innerHeight],
              ])}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === "plus" && (
            <path
              d={generatePath([
                [innerWidth / 3, 0],
                [innerWidth * (2 / 3), 0],
                [innerWidth * (2 / 3), innerHeight / 3],
                [innerWidth, innerHeight / 3],
                [innerWidth, innerHeight * (2 / 3)],
                [innerWidth * (2 / 3), innerHeight * (2 / 3)],
                [innerWidth * (2 / 3), innerHeight],
                [innerWidth / 3, innerHeight],
                [innerWidth / 3, innerHeight * (2 / 3)],
                [0, innerHeight * (2 / 3)],
                [0, innerHeight / 3],
                [innerWidth / 3, innerHeight / 3],
              ])}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {!isNote && shapeLabel && (
            <text
              x={innerWidth / 2}
              y={innerHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#0f172a"
              fontSize="13"
              fontWeight="500"
              style={{ pointerEvents: "none" }}
            >
              {shapeLabel}
            </text>
          )}
        </g>
      </svg>
      {isNote && (
        <textarea
          ref={textareaRef}
          value={text ?? ""}
          onChange={handleTextChange}
          placeholder="Sticky note..."
          className="absolute inset-0 w-full h-full resize-none bg-transparent text-slate-800 outline-none p-2 cursor-pointer"
          style={{
            boxSizing: "border-box",
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily,
            fontWeight: isBold ? "bold" : "normal",
            fontStyle: isItalic ? "italic" : "normal",
            lineHeight: "1.5",
            borderRadius: "inherit",
            pointerEvents: selected ? "auto" : "none",
          }}
          onMouseDown={(e) => {
            const textarea = e.target as HTMLTextAreaElement;
            const isEmpty = !text || text.trim().length === 0;
            const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
            
            // Если заметка пустая, разрешаем перетаскивание (не останавливаем propagation)
            if (isEmpty && !hasSelection) {
              return; // Не останавливаем propagation - React Flow обработает перетаскивание
            }
            
            // Если есть выделение текста, останавливаем для работы с текстом
            if (hasSelection) {
              e.stopPropagation();
              return;
            }
            
            // Если клик на тексте, останавливаем для редактирования
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            const textarea = e.target as HTMLTextAreaElement;
            const isEmpty = !text || text.trim().length === 0;
            const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
            
            if (isEmpty && !hasSelection) {
              return;
            }
            
            if (hasSelection) {
              e.stopPropagation();
              return;
            }
            
            e.stopPropagation();
          }}
          onDragStart={(e) => {
            // Предотвращаем drag только если это выделение текста
            const textarea = e.target as HTMLTextAreaElement;
            if (textarea.selectionStart !== textarea.selectionEnd) {
              e.preventDefault();
            }
          }}
        />
      )}
    </div>
  );
}

export default ShapeNode;

