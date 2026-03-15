'use client';

import { useMemo, useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { NodeResizer, type NodeProps, useStore } from 'reactflow';
import { useNodeEditing } from '../../context/EditingPresenceContext';
import { EditingIndicator } from '../EditingIndicator';
import {
  type ShapeType,
  SHAPE_DEFAULTS,
  resolveShapeStyle,
  generateShapePath,
  getShapePoints,
  getStarPoints,
  getShapeClipPath,
  isLineType as isLineTypeFn,
  getShapeDefinition,
} from '../shape/shapeEngine';
import { StickyToolbar } from '../StickyToolbar';

export type { ShapeType } from '../shape/shapeEngine';

function useNodeDimensions(id: string) {
  const node = useStore((state) => state.nodeInternals.get(id));
  return {
    width: node?.width || 0,
    height: node?.height || 0,
  };
}

export type ShapeNodeData = {
  shapeType?: ShapeType;
  shapeColor?: string;
  shapeLabel?: string;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
  arrowHead?: boolean;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  onChangeText?: (id: string, text: string) => void;
  onChangeColor?: (id: string, color: string) => void;
  onChangeFontSize?: (id: string, fontSize: number) => void;
  onChangeFontFamily?: (id: string, fontFamily: string) => void;
  onChangeBold?: (id: string, isBold: boolean) => void;
  onChangeItalic?: (id: string, isItalic: boolean) => void;
  // Legacy shape-specific callbacks (kept for backward compat but not used by toolbar)
  onChangeFill?: (id: string, fill: string) => void;
  onChangeStroke?: (id: string, stroke: string) => void;
  onChangeStrokeWidth?: (id: string, strokeWidth: number) => void;
  onChangeOpacity?: (id: string, opacity: number) => void;
  onChangeCornerRadius?: (id: string, cornerRadius: number) => void;
  onChangeArrowHead?: (id: string, arrowHead: boolean) => void;
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
  richContentHtml?: string | null;
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
};

export function ShapeNode({ id, data, selected }: NodeProps<ShapeNodeData>) {
  const {
    shapeType = 'rectangle',
    shapeColor,
    startX,
    startY,
    endX,
    endY,
    text,
    fontSize: dataFontSize,
    fontFamily: dataFontFamily,
    isBold = false,
    isItalic = false,
  } = data ?? {};

  // Notes are shapes rendered via the note type — they have onChangeText but no onChangeFormat
  const isNote = Boolean((text !== undefined || data?.onChangeText) && !data?.onChangeFormat);

  const fontSize = dataFontSize ?? (isNote ? 48 : 16);
  const fontFamily = dataFontFamily ?? (isNote ? 'Inter, sans-serif' : 'Inter, sans-serif');

  // Ensure shapeType is valid — fallback to rectangle if unknown
  const resolvedShapeType: ShapeType = getShapeDefinition(shapeType as ShapeType)
    ? (shapeType as ShapeType)
    : 'rectangle';

  const style = resolveShapeStyle(data, resolvedShapeType);
  const {
    fill: finalFill,
    stroke: finalStroke,
    strokeWidth: finalStrokeWidth,
    opacity: finalOpacity,
    cornerRadius: finalCornerRadius,
    arrowHead: finalArrowHead,
  } = style;

  const isLineShape = isLineTypeFn(resolvedShapeType);

  const { width: nodeWidth, height: nodeHeight } = useNodeDimensions(id);
  const finalWidth = nodeWidth > 0 ? nodeWidth : (data?.width ?? SHAPE_DEFAULTS.defaultWidth);
  const finalHeight = nodeHeight > 0 ? nodeHeight : (data?.height ?? SHAPE_DEFAULTS.defaultHeight);

  const {
    otherEditors,
    isBeingEdited,
    onFocus: handleEditingFocus,
    onChange: handleEditingChange,
    onBlur: handleEditingBlur,
  } = useNodeEditing(id);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRestoreRef = useRef<{ start: number; end: number } | null>(null);

  const [shiftPressed, setShiftPressed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useLayoutEffect(() => {
    if (!selectionRestoreRef.current || !textareaRef.current) return;
    const { start, end } = selectionRestoreRef.current;
    selectionRestoreRef.current = null;
    const textarea = textareaRef.current;
    const len = textarea.value.length;
    const safeStart = Math.min(Math.max(0, start), len);
    const safeEnd = Math.min(Math.max(safeStart, end), len);
    textarea.setSelectionRange(safeStart, safeEnd);
  }, [text]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      selectionRestoreRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
      data?.onChangeText?.(id, e.target.value);
      handleEditingChange();
    },
    [data, id, handleEditingChange],
  );

  const handleColorChange = useCallback(
    (c: string) => {
      data?.onChangeColor?.(id, c);
    },
    [data, id],
  );

  const handleFontSizeChange = useCallback(
    (v: number) => {
      data?.onChangeFontSize?.(id, v);
    },
    [data, id],
  );

  const handleFontFamilyChange = useCallback(
    (v: string) => {
      data?.onChangeFontFamily?.(id, v);
    },
    [data, id],
  );

  const handleBoldToggle = useCallback(() => {
    data?.onChangeBold?.(id, !isBold);
  }, [data, id, isBold]);

  const handleItalicToggle = useCallback(() => {
    data?.onChangeItalic?.(id, !isItalic);
  }, [data, id, isItalic]);

  const innerWidth = useMemo(
    () => (isLineShape ? finalWidth : finalWidth - 2 * finalStrokeWidth),
    [finalWidth, finalStrokeWidth, isLineShape],
  );
  const innerHeight = useMemo(
    () => (isLineShape ? finalHeight : finalHeight - 2 * finalStrokeWidth),
    [finalHeight, finalStrokeWidth, isLineShape],
  );

  const lineStart = useMemo(
    () => ({
      x: isLineShape ? (startX ?? 0) : finalStrokeWidth,
      y: isLineShape ? (startY ?? 0) : finalStrokeWidth,
    }),
    [isLineShape, startX, startY, finalStrokeWidth],
  );
  const lineEnd = useMemo(
    () => ({
      x: isLineShape ? (endX ?? finalWidth) : innerWidth,
      y: isLineShape ? (endY ?? finalHeight) : innerHeight,
    }),
    [isLineShape, endX, endY, finalWidth, finalHeight, innerWidth, innerHeight],
  );

  // ── Render shape geometry via the engine ───────────────────────────────────

  const shapeGeometry = useMemo(() => {
    if (isLineShape) return null;

    const def = getShapeDefinition(resolvedShapeType);

    // Shapes with a custom render (cylinder, cloud, heart, speech-bubble, document-shape, etc.)
    if (def?.render) {
      return def.render({
        width: innerWidth,
        height: innerHeight,
        fill: finalFill,
        stroke: isNote ? 'none' : finalStroke,
        strokeWidth: isNote ? 0 : finalStrokeWidth,
        opacity: finalOpacity,
        cornerRadius: finalCornerRadius,
        nodeId: id,
      });
    }

    // Circle / ellipse
    if (resolvedShapeType === 'circle' || resolvedShapeType === 'ellipse') {
      return (
        <ellipse
          cx={innerWidth / 2}
          cy={innerHeight / 2}
          rx={innerWidth / 2}
          ry={resolvedShapeType === 'ellipse' ? innerHeight / 2 : innerWidth / 2}
          fill={finalFill}
          stroke={finalStroke}
          strokeWidth={finalStrokeWidth}
        />
      );
    }

    // Rectangle
    if (resolvedShapeType === 'rectangle') {
      return (
        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill={finalFill}
          stroke={isNote ? 'none' : finalStroke}
          strokeWidth={isNote ? 0 : finalStrokeWidth}
          rx={finalCornerRadius}
          ry={finalCornerRadius}
        />
      );
    }

    // Round rectangle
    if (resolvedShapeType === 'round-rectangle') {
      const r = Math.min(finalCornerRadius || 8, 0.2 * Math.min(innerWidth, innerHeight));
      return (
        <rect
          x={0}
          y={0}
          rx={r}
          ry={r}
          width={innerWidth}
          height={innerHeight}
          fill={finalFill}
          stroke={finalStroke}
          strokeWidth={finalStrokeWidth}
        />
      );
    }

    // Star (polygon points string, not array)
    if (resolvedShapeType === 'star') {
      return (
        <polygon
          points={getStarPoints(innerWidth, innerHeight)}
          fill={finalFill}
          stroke={finalStroke}
          strokeWidth={finalStrokeWidth}
        />
      );
    }

    // All other polygon-based shapes via the engine
    const pts = getShapePoints(resolvedShapeType, innerWidth, innerHeight);
    if (pts) {
      return (
        <path
          d={generateShapePath(pts)}
          fill={finalFill}
          stroke={finalStroke}
          strokeWidth={finalStrokeWidth}
        />
      );
    }

    return null;
  }, [
    resolvedShapeType,
    innerWidth,
    innerHeight,
    finalFill,
    finalStroke,
    finalStrokeWidth,
    finalOpacity,
    finalCornerRadius,
    isNote,
    isLineShape,
    id,
  ]);

  // ── Line/arrow geometry ────────────────────────────────────────────────────

  const lineGeometry = useMemo(() => {
    if (!isLineShape) return null;
    const def = getShapeDefinition(resolvedShapeType);
    if (def?.render) {
      return def.render({
        width: finalWidth,
        height: finalHeight,
        fill: 'none',
        stroke: finalStroke,
        strokeWidth: finalStrokeWidth,
        opacity: finalOpacity,
        cornerRadius: 0,
        arrowHead: finalArrowHead,
        nodeId: id,
        startX: lineStart.x,
        startY: lineStart.y,
        endX: lineEnd.x,
        endY: lineEnd.y,
      });
    }
    return null;
  }, [
    isLineShape,
    resolvedShapeType,
    finalWidth,
    finalHeight,
    finalStroke,
    finalStrokeWidth,
    finalOpacity,
    finalArrowHead,
    id,
    lineStart,
    lineEnd,
  ]);

  // The active fill color for the toolbar palette
  const activeColor = shapeColor ?? finalFill;

  return (
    <div
      className="workyy-shape-node relative"
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={48}
        keepAspectRatio={shiftPressed}
        lineClassName="!border-slate-300"
        handleStyle={{
          width: 12,
          height: 12,
          borderRadius: 6,
          border: '2px solid #6366f1',
          background: '#EEF2FF',
        }}
      />
      {/* Unified StickyToolbar for all shapes (same as notes) */}
      {selected && !isLineShape && (
        <StickyToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          isBold={isBold}
          isItalic={isItalic}
          activeColor={activeColor}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onBoldToggle={handleBoldToggle}
          onItalicToggle={handleItalicToggle}
          onColorChange={handleColorChange}
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
            isLineShape ? 'translate(0, 0)' : `translate(${finalStrokeWidth}, ${finalStrokeWidth})`
          }
        >
          {lineGeometry}
          {shapeGeometry}
        </g>
      </svg>
      {/* Textarea for text input — same approach as notes */}
      {!isLineShape && (
        <>
          {isBeingEdited && <EditingIndicator editors={otherEditors} position="top-right" />}
          <textarea
            ref={textareaRef}
            value={text ?? ''}
            onChange={handleTextChange}
            onFocus={handleEditingFocus}
            onBlur={handleEditingBlur}
            placeholder=""
            className="absolute inset-0 w-full h-full resize-none bg-transparent text-slate-800 outline-none p-2 cursor-pointer"
            style={{
              boxSizing: 'border-box',
              fontSize: `${fontSize}px`,
              fontFamily,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              lineHeight: '1.5',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'inherit',
              pointerEvents: selected ? 'auto' : 'none',
              boxShadow: isBeingEdited
                ? `0 0 0 2px ${otherEditors[0]?.color || '#6366f1'}`
                : undefined,
              ...(getShapeClipPath(resolvedShapeType) && {
                clipPath: getShapeClipPath(resolvedShapeType),
                WebkitClipPath: getShapeClipPath(resolvedShapeType),
              }),
            }}
            onMouseDown={(e) => {
              const ta = e.target as HTMLTextAreaElement;
              const isEmpty = !text || text.trim().length === 0;
              const hasSel = ta.selectionStart !== ta.selectionEnd;
              if (isEmpty && !hasSel) return;
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              const ta = e.target as HTMLTextAreaElement;
              const isEmpty = !text || text.trim().length === 0;
              const hasSel = ta.selectionStart !== ta.selectionEnd;
              if (isEmpty && !hasSel) return;
              e.stopPropagation();
            }}
            onDragStart={(e) => {
              const ta = e.target as HTMLTextAreaElement;
              if (ta.selectionStart !== ta.selectionEnd) e.preventDefault();
            }}
          />
        </>
      )}
    </div>
  );
}

export default ShapeNode;
