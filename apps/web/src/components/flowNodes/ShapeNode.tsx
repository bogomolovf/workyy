'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { NodeResizer, type NodeProps, useStore, NodeToolbar } from 'reactflow';
import { RichTextEditor, type RichTextEditorRef } from '../RichTextEditor';
import { ShapeToolbar } from '../shape/ShapeToolbar';
import { StickyToolbar } from '../StickyToolbar';
import { TextToolbar } from '../TextToolbar';
import { useNodeEditing } from '../../context/EditingPresenceContext';
import { EditingIndicator } from '../EditingIndicator';

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
  | 'rectangle'
  | 'round-rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'ellipse'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'star'
  | 'arrow-rectangle'
  | 'plus'
  | 'line'
  | 'arrow';

export type ShapeNodeData = {
  shapeType?: ShapeType;
  shapeColor?: string; // Legacy, use fill instead
  shapeLabel?: string;
  width?: number;
  height?: number;
  // Style properties (Miro-like)
  fill?: string; // Color or 'none'/'transparent'
  stroke?: string; // Color
  strokeWidth?: number; // Thickness
  opacity?: number; // 0-1
  cornerRadius?: number; // For rectangles
  arrowHead?: boolean; // For arrows
  // For line/arrow types: relative end point (from start)
  endX?: number;
  endY?: number;
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
  // Callbacks для изменения стилей фигур
  onChangeFill?: (id: string, fill: string) => void;
  onChangeStroke?: (id: string, stroke: string) => void;
  onChangeStrokeWidth?: (id: string, strokeWidth: number) => void;
  onChangeOpacity?: (id: string, opacity: number) => void;
  onChangeCornerRadius?: (id: string, cornerRadius: number) => void;
  onChangeArrowHead?: (id: string, arrowHead: boolean) => void;
  // Callbacks для изменения текста в фигурах (как в TextNode)
  onChangeFormat?: (
    id: string,
    patch: Partial<{
      text: string;
      richContent: string;
      fontSize: number;
      fontFamily: string;
      color: string;
      textAlign: 'left' | 'center' | 'right';
    }>,
  ) => void;
  // Параметры текста для фигур
  richContentHtml?: string | null;
  textAlign?: 'left' | 'center' | 'right';
};

export function ShapeNode({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const {
    shapeType = 'rectangle',
    shapeColor, // Legacy
    shapeLabel = 'Фигура',
    fill,
    stroke,
    strokeWidth,
    opacity,
    cornerRadius,
    arrowHead,
    endX,
    endY,
    // Параметры текста (для заметок и для текста внутри фигур)
    text,
    fontSize: dataFontSize,
    fontFamily: dataFontFamily,
    isBold = false,
    isItalic = false,
    richContentHtml,
    textAlign = 'center',
    color: textColor,
  } = data ?? {};

  // Проверяем, является ли это заметкой (есть текст или callbacks для заметок, но нет onChangeFormat)
  // Заметки используют textarea, фигуры с текстом используют RichTextEditor (onChangeFormat)
  // ВАЖНО: определяем isNote ДО использования в дефолтных значениях fontSize, fontFamily, color
  const isNote = Boolean((text !== undefined || data?.onChangeText) && !data?.onChangeFormat);

  // Дефолтные значения для текста в фигурах (отличаются от заметок)
  const fontSize = dataFontSize ?? (isNote ? 48 : 16);
  const fontFamily = dataFontFamily ?? (isNote ? 'Inter, sans-serif' : 'Noto Sans, sans-serif');
  const color = textColor ?? (isNote ? '#0f172a' : '#0f172a');

  // Default styles (Miro-like)
  const finalFill = fill ?? shapeColor ?? 'transparent';
  const finalStroke = stroke ?? '#1f1f1f';
  const finalStrokeWidth = strokeWidth ?? 2;
  const finalOpacity = opacity ?? 1.0;
  const finalCornerRadius = cornerRadius ?? (shapeType === 'round-rectangle' ? 8 : 0);
  const finalArrowHead = arrowHead ?? (shapeType === 'arrow' ? true : undefined);

  // Check if line/arrow type
  const isLineType = shapeType === 'line' || shapeType === 'arrow';

  // Используем useNodeDimensions для получения актуальных размеров в реальном времени (как в референсе)
  // Это позволяет NodeResizer обновлять размеры плавно во время ресайза
  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);

  // Fallback на дефолтные размеры, если React Flow еще не измерил узел
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? 160);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? 96);

  // Проверяем, является ли это заметкой (есть текст или callbacks)
  const isNote = Boolean(text !== undefined || data?.onChangeText);

  // Use editing presence to show who is editing this note
  const {
    otherEditors,
    isBeingEdited,
    onFocus: handleEditingFocus,
    onChange: handleEditingChange,
    onBlur: handleEditingBlur,
  } = useNodeEditing(id);

  // Refs для textarea (если это заметка)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs для RichTextEditor (для текста в фигурах)
  const editorRef = useRef<RichTextEditorRef>(null);
  const hasAutoFocusedRef = useRef(false);
  const currentTextRef = useRef<string>(text || '');

  // Инициализация контента для RichTextEditor
  const initialHtml = useMemo(() => {
    if (richContentHtml) {
      const trimmed = richContentHtml.trim();
      if (trimmed === '<p></p>' || trimmed === '<p><br></p>') {
        return '<p><br></p>';
      }
      return richContentHtml;
    }
    if (text) {
      const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return escaped ? `<p>${escaped}</p>` : '<p><br></p>';
    }
    return '<p><br></p>';
  }, [richContentHtml, text]);

  // Состояние для отслеживания перетаскивания фигур
  const [isDragging, setIsDragging] = useState(false);

  // Callbacks для заметок
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      data?.onChangeText?.(id, e.target.value);
      // Update editing presence timestamp on each keystroke
      handleEditingChange();
    },
    [data, id, handleEditingChange],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      data?.onChangeColor?.(id, color);
    },
    [data, id],
  );

  const handleFontSizeChange = useCallback(
    (newFontSize: number) => {
      data?.onChangeFontSize?.(id, newFontSize);
    },
    [data, id],
  );

  const handleFontFamilyChange = useCallback(
    (newFontFamily: string) => {
      data?.onChangeFontFamily?.(id, newFontFamily);
    },
    [data, id],
  );

  const handleBoldToggle = useCallback(() => {
    data?.onChangeBold?.(id, !isBold);
  }, [data, id, isBold]);

  const handleItalicToggle = useCallback(() => {
    data?.onChangeItalic?.(id, !isItalic);
  }, [data, id, isItalic]);

  // Учитываем strokeWidth при расчете внутренних размеров (как в React Flow Pro)
  // Для line/arrow используем размеры как есть (width/height = bounding box)
  const innerWidth = useMemo(
    () => (isLineType ? finalWidth : finalWidth - 2 * finalStrokeWidth),
    [finalWidth, finalStrokeWidth, isLineType],
  );
  const innerHeight = useMemo(
    () => (isLineType ? finalHeight : finalHeight - 2 * finalStrokeWidth),
    [finalHeight, finalStrokeWidth, isLineType],
  );

  // Для line/arrow вычисляем точки начала и конца
  const lineStart = useMemo(
    () => ({
      x: isLineType && endX !== undefined ? 0 : finalStrokeWidth,
      y: isLineType && endY !== undefined ? 0 : finalStrokeWidth,
    }),
    [isLineType, endX, endY, finalStrokeWidth],
  );
  const lineEnd = useMemo(
    () => ({
      x: isLineType && endX !== undefined ? endX : innerWidth,
      y: isLineType && endY !== undefined ? endY : innerHeight,
    }),
    [isLineType, endX, endY, innerWidth, innerHeight],
  );

  // Обработчики для перетаскивания фигур
  const handleShapeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isNote) {
        setIsDragging(true);
        // Не останавливаем propagation - React Flow обработает перетаскивание
      }
    },
    [isNote],
  );

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

  // Автофокус для текста в фигурах (как в TextNode)
  useEffect(() => {
    const isActuallyEmpty = currentTextRef.current.trim() === '';
    const hasTextSupport = !isNote && data?.onChangeFormat;

    if (
      selected &&
      hasTextSupport &&
      isActuallyEmpty &&
      !hasAutoFocusedRef.current &&
      editorRef.current
    ) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            hasAutoFocusedRef.current = true;
          }
        });
      });
    }

    if (!selected || !isActuallyEmpty || !hasTextSupport) {
      hasAutoFocusedRef.current = false;
    }
  }, [selected, isNote, data]);

  // Инициализируем currentTextRef при монтировании
  useEffect(() => {
    currentTextRef.current = text || '';
  }, [text]);

  return (
    <div className="workyy-shape-node relative" style={{ width: finalWidth, height: finalHeight }}>
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={48}
        keepAspectRatio={false}
        lineClassName="!border-slate-300"
        handleStyle={
          isNote
            ? {
                // Для заметок используем такой же размер, как у дата клеток
                width: 12,
                height: 12,
                borderRadius: 6,
                border: '2px solid #6366f1',
                background: '#EEF2FF',
              }
            : {
                width: 10,
                height: 10,
                borderRadius: 9999,
                border: '2px solid #64748b',
                background: '#ffffff',
              }
        }
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
      {!isNote && selected && (
        <ShapeToolbar
          shapeType={shapeType}
          fill={finalFill}
          stroke={finalStroke}
          strokeWidth={finalStrokeWidth}
          opacity={finalOpacity}
          cornerRadius={finalCornerRadius}
          arrowHead={finalArrowHead}
          onChangeFill={(newFill) => {
            data?.onChangeFill?.(id, newFill);
          }}
          onChangeStroke={(newStroke) => {
            data?.onChangeStroke?.(id, newStroke);
          }}
          onChangeStrokeWidth={(newStrokeWidth) => {
            data?.onChangeStrokeWidth?.(id, newStrokeWidth);
          }}
          onChangeOpacity={(newOpacity) => {
            data?.onChangeOpacity?.(id, newOpacity);
          }}
          onChangeCornerRadius={(newCornerRadius) => {
            data?.onChangeCornerRadius?.(id, newCornerRadius);
          }}
          onChangeArrowHead={(newArrowHead) => {
            data?.onChangeArrowHead?.(id, newArrowHead);
          }}
        />
      )}
      {/* Прозрачный слой для перетаскивания фигур - поверх SVG, но не блокирует NodeResizer */}
      {!isNote && (
        <div
          className="absolute inset-0"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 5,
            pointerEvents: 'auto',
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
        style={{ pointerEvents: 'none', opacity: finalOpacity }}
      >
        <g
          transform={
            isLineType ? 'translate(0, 0)' : `translate(${finalStrokeWidth}, ${finalStrokeWidth})`
          }
        >
          {/* Line and Arrow types */}
          {(shapeType === 'line' || shapeType === 'arrow') && (
            <>
              <defs>
                {shapeType === 'arrow' && finalArrowHead && (
                  <marker
                    id={`arrowhead-${id}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L0,6 L9,3 z" fill={finalStroke} />
                  </marker>
                )}
              </defs>
              <line
                x1={lineStart.x}
                y1={lineStart.y}
                x2={lineEnd.x}
                y2={lineEnd.y}
                stroke={finalStroke}
                strokeWidth={finalStrokeWidth}
                fill="none"
                strokeLinecap="round"
                markerEnd={
                  shapeType === 'arrow' && finalArrowHead ? `url(#arrowhead-${id})` : undefined
                }
              />
            </>
          )}
          {/* Rectangle types */}
          {shapeType === 'rectangle' && (
            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill={isNote ? (shapeColor ?? finalFill) : finalFill}
              stroke={isNote ? 'none' : finalStroke}
              strokeWidth={isNote ? 0 : finalStrokeWidth}
              rx={finalCornerRadius}
              ry={finalCornerRadius}
            />
          )}
          {shapeType === 'round-rectangle' && (
            <rect
              x={0}
              y={0}
              rx={Math.min(finalCornerRadius || 8, 0.2 * Math.min(innerWidth, innerHeight))}
              ry={Math.min(finalCornerRadius || 8, 0.2 * Math.min(innerWidth, innerHeight))}
              width={innerWidth}
              height={innerHeight}
              fill={finalFill}
              stroke={finalStroke}
              strokeWidth={finalStrokeWidth}
            />
          )}
          {shapeType === 'circle' && (
            <ellipse
              cx={innerWidth / 2}
              cy={innerHeight / 2}
              rx={innerWidth / 2}
              ry={innerHeight / 2}
              fill={finalFill}
              stroke={finalStroke}
              strokeWidth={finalStrokeWidth}
            />
          )}
          {shapeType === 'diamond' && (
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
          {shapeType === 'triangle' && (
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
          {shapeType === 'ellipse' && (
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
          {shapeType === 'hexagon' && (
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
          {shapeType === 'parallelogram' && (
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
          {shapeType === 'cylinder' && (
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
          {shapeType === 'star' && (
            <polygon
              points={`${innerWidth / 2},${innerHeight * 0.1} ${innerWidth * 0.6},${innerHeight * 0.35} ${innerWidth},${innerHeight * 0.35} ${innerWidth * 0.7},${innerHeight * 0.55} ${innerWidth * 0.85},${innerHeight * 0.9} ${innerWidth / 2},${innerHeight * 0.7} ${innerWidth * 0.15},${innerHeight * 0.9} ${innerWidth * 0.3},${innerHeight * 0.55} 0,${innerHeight * 0.35} ${innerWidth * 0.4},${innerHeight * 0.35}`}
              fill={shapeColor}
              stroke="#64748b"
              strokeWidth={strokeWidth}
            />
          )}
          {shapeType === 'arrow-rectangle' && (
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
          {shapeType === 'plus' && (
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
        </g>
      </svg>
      {/* Текстовое поле для фигур (не заметок) - используем RichTextEditor как в TextNode */}
      {!isNote && data?.onChangeFormat && selected && (
        <TextToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          activeColor={color}
          activeBackgroundColor="transparent"
          textAlign={textAlign}
          editorRef={editorRef}
          onFontSizeChange={(newFontSize) => {
            data?.onChangeFormat?.(id, { fontSize: newFontSize });
          }}
          onFontFamilyChange={(newFontFamily) => {
            data?.onChangeFormat?.(id, { fontFamily: newFontFamily });
          }}
          onColorChange={(newColor) => {
            data?.onChangeFormat?.(id, { color: newColor });
          }}
          onTextAlignChange={(newTextAlign) => {
            data?.onChangeFormat?.(id, { textAlign: newTextAlign });
          }}
          onInteractionStart={() => {
            editorRef.current?.saveSelection();
          }}
          onInteractionEnd={() => {
            editorRef.current?.restoreSelection();
            requestAnimationFrame(() => {
              editorRef.current?.focus();
            });
          }}
        />
      )}
      {!isNote && data?.onChangeFormat && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4 nodrag"
          style={{
            pointerEvents: selected ? 'auto' : 'none',
            zIndex: 10,
          }}
          onMouseDown={(e) => {
            // Разрешаем редактирование текста только при клике на текстовую область
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.ProseMirror')) {
              e.stopPropagation();
            }
          }}
          onDoubleClick={(e) => {
            // Двойной клик для начала редактирования
            if (editorRef.current) {
              editorRef.current.focus();
            }
            e.stopPropagation();
          }}
        >
          <RichTextEditor
            ref={editorRef}
            value={initialHtml}
            plainTextFallback={text}
            color={color}
            fontSize={fontSize}
            fontFamily={fontFamily}
            textAlign={textAlign}
            onChange={(content) => {
              currentTextRef.current = content.text || '';
              data?.onChangeText?.(id, content.text);
              data?.onChangeFormat?.(id, {
                text: content.text,
                richContent: content.html,
              });
            }}
            showToolbar={false}
            className="w-full"
          />
        </div>
      )}
      {isNote && (
        <>
          {/* Show editing indicator when others are editing this note */}
          {isBeingEdited && <EditingIndicator editors={otherEditors} position="top-right" />}
          <textarea
            ref={textareaRef}
            value={text ?? ''}
            onChange={handleTextChange}
            onFocus={handleEditingFocus}
            onBlur={handleEditingBlur}
            placeholder="Sticky note..."
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-slate-800 outline-none p-2 cursor-pointer"
            style={{
              boxSizing: 'border-box',
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              lineHeight: '1.5',
              borderRadius: 'inherit',
              pointerEvents: selected ? 'auto' : 'none',
              // Add visual indicator border when others are editing
              boxShadow: isBeingEdited ? `0 0 0 2px ${otherEditors[0]?.color || '#6366f1'}` : undefined,
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
        </>
      )}
    </div>
  );
}

export default ShapeNode;
