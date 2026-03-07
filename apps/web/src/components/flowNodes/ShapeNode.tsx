'use client';

import { useMemo, useRef, useCallback, useState, useEffect, useLayoutEffect } from 'react';
import { NodeResizer, type NodeProps, useStore, NodeToolbar } from 'reactflow';
import { useNodeEditing } from '../../context/EditingPresenceContext';
import { EditingIndicator } from '../EditingIndicator';
import { RichTextEditor, type RichTextEditorRef } from '../RichTextEditor';
import {
  type ShapeType,
  SHAPE_DEFAULTS,
  resolveShapeStyle,
  generateShapePath,
  getShapePoints,
  getStarPoints,
  getCylinderPath,
  getShapeClipPath,
  isLineType as isLineTypeFn,
  getShapeDefinition,
} from '../shape/shapeEngine';
import { ShapeToolbar } from '../shape/ShapeToolbar';
import { StickyToolbar } from '../StickyToolbar';
import { TextToolbar } from '../TextToolbar';

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
    shapeLabel = 'Фигура',
    startX,
    startY,
    endX,
    endY,
    text,
    fontSize: dataFontSize,
    fontFamily: dataFontFamily,
    isBold = false,
    isItalic = false,
    richContentHtml,
    textAlign = 'center',
    color: textColor,
  } = data ?? {};

  const isNote = Boolean((text !== undefined || data?.onChangeText) && !data?.onChangeFormat);

  const fontSize = dataFontSize ?? (isNote ? 48 : 16);
  const fontFamily = dataFontFamily ?? (isNote ? 'Inter, sans-serif' : 'Noto Sans, sans-serif');
  const color = textColor ?? '#0f172a';

  // Ensure shapeType is valid — fallback to rectangle if unknown (e.g. corrupted/old data)
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
  const editorRef = useRef<RichTextEditorRef>(null);
  const hasAutoFocusedRef = useRef(false);
  const currentTextRef = useRef<string>(text || '');

  const initialHtml = useMemo(() => {
    if (richContentHtml) {
      const trimmed = richContentHtml.trim();
      if (trimmed === '<p></p>' || trimmed === '<p><br></p>') return '<p><br></p>';
      return richContentHtml;
    }
    if (text) {
      const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return escaped ? `<p>${escaped}</p>` : '<p><br></p>';
    }
    return '<p><br></p>';
  }, [richContentHtml, text]);

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
    if (!isNote || !selectionRestoreRef.current || !textareaRef.current) return;
    const { start, end } = selectionRestoreRef.current;
    selectionRestoreRef.current = null;
    const textarea = textareaRef.current;
    const len = textarea.value.length;
    const safeStart = Math.min(Math.max(0, start), len);
    const safeEnd = Math.min(Math.max(safeStart, end), len);
    textarea.setSelectionRange(safeStart, safeEnd);
  }, [isNote, text]);

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
    if (!selected || !isActuallyEmpty || !hasTextSupport) hasAutoFocusedRef.current = false;
  }, [selected, isNote, data]);

  useEffect(() => {
    currentTextRef.current = text || '';
  }, [text]);

  // ── Render shape geometry via the engine ───────────────────────────────────

  const shapeGeometry = useMemo(() => {
    if (isLineShape) return null;

    const def = getShapeDefinition(resolvedShapeType);

    // Shapes with a custom render (cylinder, etc.) use the render fn
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
          ry={innerHeight / 2}
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

  return (
    <div
      className="workyy-shape-node relative"
      style={{
        width: finalWidth,
        height: finalHeight,
        ...(!isNote && { cursor: 'grab' }),
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={48}
        keepAspectRatio={shiftPressed}
        lineClassName="!border-slate-300"
        handleStyle={
          isNote
            ? {
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
          activeColor={shapeColor ?? finalFill}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onBoldToggle={handleBoldToggle}
          onItalicToggle={handleItalicToggle}
          onColorChange={handleColorChange}
        />
      )}
      {!isNote && selected && (
        <ShapeToolbar
          shapeType={resolvedShapeType}
          fill={finalFill}
          stroke={finalStroke}
          strokeWidth={finalStrokeWidth}
          opacity={finalOpacity}
          cornerRadius={finalCornerRadius}
          arrowHead={finalArrowHead}
          onChangeFill={(v) => data?.onChangeFill?.(id, v)}
          onChangeStroke={(v) => data?.onChangeStroke?.(id, v)}
          onChangeStrokeWidth={(v) => data?.onChangeStrokeWidth?.(id, v)}
          onChangeOpacity={(v) => data?.onChangeOpacity?.(id, v)}
          onChangeCornerRadius={(v) => data?.onChangeCornerRadius?.(id, v)}
          onChangeArrowHead={(v) => data?.onChangeArrowHead?.(id, v)}
        />
      )}
      {!isNote && (
        <div
          className="absolute inset-0 nodrag"
          style={{ zIndex: 1, pointerEvents: 'none' }}
          aria-hidden
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
      {!isNote && data?.onChangeFormat && selected && (
        <TextToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          activeColor={color}
          activeBackgroundColor="transparent"
          textAlign={textAlign}
          editorRef={editorRef}
          onFontSizeChange={(v) => data?.onChangeFormat?.(id, { fontSize: v })}
          onFontFamilyChange={(v) => data?.onChangeFormat?.(id, { fontFamily: v })}
          onColorChange={(v) => data?.onChangeFormat?.(id, { color: v })}
          onTextAlignChange={(v) => data?.onChangeFormat?.(id, { textAlign: v })}
          onInteractionStart={() => editorRef.current?.saveSelection()}
          onInteractionEnd={() => {
            editorRef.current?.restoreSelection();
            requestAnimationFrame(() => editorRef.current?.focus());
          }}
        />
      )}
      {!isNote && data?.onChangeFormat && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4 nodrag"
          style={{
            pointerEvents: selected ? 'auto' : 'none',
            zIndex: 10,
            background: 'transparent',
            ...(getShapeClipPath(resolvedShapeType) && {
              clipPath: getShapeClipPath(resolvedShapeType),
              WebkitClipPath: getShapeClipPath(resolvedShapeType),
            }),
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.ProseMirror'))
              e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            editorRef.current?.focus();
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
              data?.onChangeFormat?.(id, { text: content.text, richContent: content.html });
            }}
            showToolbar={false}
            className="w-full"
          />
        </div>
      )}
      {isNote && (
        <>
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
              fontFamily,
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal',
              lineHeight: '1.5',
              borderRadius: 'inherit',
              pointerEvents: selected ? 'auto' : 'none',
              boxShadow: isBeingEdited
                ? `0 0 0 2px ${otherEditors[0]?.color || '#6366f1'}`
                : undefined,
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
