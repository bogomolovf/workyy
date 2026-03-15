import { useCallback, useRef, useEffect } from 'react';
import { NodeResizer, type NodeProps } from 'reactflow';
import { useNodeEditing } from '../context/EditingPresenceContext';
import { EditingIndicator } from './EditingIndicator';
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor';
import { TextToolbar } from './TextToolbar';

type TextData = {
  nodeId: string;
  nodeType: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right';
  richContentHtml?: string | null;
  onChangeText: (id: string, text: string) => void;
  onChangeFormat: (
    id: string,
    patch: Partial<{
      text: string;
      fontSize: number;
      fontFamily: string;
      color: string;
      backgroundColor?: string;
      textAlign: 'left' | 'center' | 'right';
      richContent: string;
      ui?: { width: number; height: number };
    }>,
  ) => void;
  onDeleteNode?: (id: string) => void;
};

const DEFAULT_TEXT = '';
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_FONT_FAMILY = 'Noto Sans, sans-serif';
const DEFAULT_COLOR = '#CF4C2C';
const DEFAULT_BACKGROUND_COLOR = 'transparent';
const DEFAULT_TEXT_ALIGN: 'left' | 'center' | 'right' = 'left';

export function TextNode({ id, data, selected, ...nodeProps }: NodeProps<TextData>) {
  const width = (nodeProps as any)?.width;
  const height = (nodeProps as any)?.height;
  const nodeWidth = typeof width === 'number' ? width : Number(width ?? 240);
  const nodeHeight = typeof height === 'number' ? height : Number(height ?? 80);

  const text = data.text ?? DEFAULT_TEXT;
  const fontSize = data.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = data.fontFamily ?? DEFAULT_FONT_FAMILY;
  const color = data.color ?? DEFAULT_COLOR;
  const backgroundColor = data.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
  const textAlign = data.textAlign ?? DEFAULT_TEXT_ALIGN;
  const richContentHtml = data.richContentHtml ?? null;

  const editorRef = useRef<RichTextEditorRef>(null);
  const hasAutoFocusedRef = useRef(false);
  const currentTextRef = useRef<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const isUpdatingSizeRef = useRef(false);
  const pendingSizeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyResizingRef = useRef(false);
  const manualResizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    otherEditors,
    isBeingEdited,
    onFocus: handleEditingFocus,
    onChange: handleEditingChange,
    onBlur: handleEditingBlur,
  } = useNodeEditing(id);

  const initialHtml = richContentHtml
    ? richContentHtml.trim() === '<p></p>'
      ? '<p><br></p>'
      : richContentHtml
    : text
      ? `<p>${escapeHtml(text)}</p>`
      : '<p><br></p>';

  useEffect(() => {
    currentTextRef.current = text || '';
  }, [text]);

  const updateNodeSize = useCallback(() => {
    if (!contentRef.current || isUpdatingSizeRef.current || isManuallyResizingRef.current) return;

    const editorElement = contentRef.current.querySelector('.ProseMirror') as HTMLElement;
    if (!editorElement) return;

    isUpdatingSizeRef.current = true;

    const padding = 32;
    const minWidth = 120;
    const minHeight = 60;

    requestAnimationFrame(() => {
      if (!editorElement) {
        isUpdatingSizeRef.current = false;
        return;
      }

      const originalWhiteSpace = editorElement.style.whiteSpace;
      editorElement.style.whiteSpace = 'nowrap';
      const contentWidth = editorElement.scrollWidth;
      editorElement.style.whiteSpace = originalWhiteSpace || '';

      const contentHeight = editorElement.scrollHeight;

      const requiredContentWidth = contentWidth + padding;
      const newWidth = Math.max(minWidth, Math.ceil(requiredContentWidth));
      const newHeight = Math.max(minHeight, Math.ceil(contentHeight + padding));

      const widthDiff = Math.abs(newWidth - nodeWidth);
      const heightDiff = Math.abs(newHeight - nodeHeight);

      if (widthDiff > 1 || heightDiff > 1) {
        data.onChangeFormat?.(id, {
          ui: {
            width: newWidth,
            height: newHeight,
          },
        });
      }

      requestAnimationFrame(() => {
        isUpdatingSizeRef.current = false;
      });
    });
  }, [id, data, nodeWidth, nodeHeight]);

  const handleChange = useCallback(
    (content: { html: string; text: string }) => {
      currentTextRef.current = content.text || '';

      data.onChangeText?.(id, content.text);
      data.onChangeFormat?.(id, {
        richContent: content.html,
        text: content.text,
      });

      handleEditingChange();

      if (pendingSizeUpdateRef.current) {
        clearTimeout(pendingSizeUpdateRef.current);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          pendingSizeUpdateRef.current = setTimeout(() => {
            updateNodeSize();
          }, 0);
        });
      });
    },
    [data, id, updateNodeSize, handleEditingChange],
  );

  const handleFontSizeChange = useCallback(
    (newFontSize: number) => {
      data.onChangeFormat?.(id, { fontSize: newFontSize });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateNodeSize();
        });
      });
    },
    [data, id, updateNodeSize],
  );

  const handleFontFamilyChange = useCallback(
    (newFontFamily: string) => {
      data.onChangeFormat?.(id, { fontFamily: newFontFamily });
    },
    [data, id],
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      data.onChangeFormat?.(id, { color: newColor });
    },
    [data, id],
  );

  const handleBackgroundColorChange = useCallback(
    (newBackgroundColor: string) => {
      data.onChangeFormat?.(id, { backgroundColor: newBackgroundColor });
    },
    [data, id],
  );

  const handleTextAlignChange = useCallback(
    (newTextAlign: 'left' | 'center' | 'right') => {
      data.onChangeFormat?.(id, { textAlign: newTextAlign });
    },
    [data, id],
  );

  const handleBoldToggle = useCallback(() => {
    editorRef.current?.toggleBold();
  }, []);

  const handleItalicToggle = useCallback(() => {
    editorRef.current?.toggleItalic();
  }, []);

  const handleInteractionStart = useCallback(() => {
    editorRef.current?.saveSelection();
  }, []);

  const handleInteractionEnd = useCallback(() => {
    const restoreFocus = () => {
      if (editorRef.current) {
        editorRef.current.restoreSelection();
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        });
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(restoreFocus, { timeout: 200 });
    } else {
      requestAnimationFrame(() => {
        setTimeout(restoreFocus, 50);
      });
    }
  }, []);

  const handleResizeStart = useCallback(() => {
    isManuallyResizingRef.current = true;
    if (manualResizeTimeoutRef.current) {
      clearTimeout(manualResizeTimeoutRef.current);
    }
  }, []);

  const handleResizeEnd = useCallback(() => {
    manualResizeTimeoutRef.current = setTimeout(() => {
      isManuallyResizingRef.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    const isActuallyEmpty = currentTextRef.current.trim() === '';
    if (selected && isActuallyEmpty && !hasAutoFocusedRef.current && editorRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            hasAutoFocusedRef.current = true;
          }
        });
      });
    }
    if (!selected || !isActuallyEmpty) {
      hasAutoFocusedRef.current = false;
    }
  }, [selected]);

  useEffect(() => {
    if (isManuallyResizingRef.current) return;

    requestAnimationFrame(() => {
      updateNodeSize();
    });
  }, [fontSize, fontFamily, textAlign, updateNodeSize]);

  useEffect(() => {
    return () => {
      if (pendingSizeUpdateRef.current) {
        clearTimeout(pendingSizeUpdateRef.current);
        pendingSizeUpdateRef.current = null;
      }
      if (manualResizeTimeoutRef.current) {
        clearTimeout(manualResizeTimeoutRef.current);
        manualResizeTimeoutRef.current = null;
      }
      isUpdatingSizeRef.current = false;
      isManuallyResizingRef.current = false;
    };
  }, []);

  const wasSelectedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasSelectedRef.current === null) {
      wasSelectedRef.current = selected;
      return;
    }

    const wasSelected = wasSelectedRef.current;
    const isNowSelected = selected;

    if (wasSelected && !isNowSelected && data.onDeleteNode) {
      const checkAndDelete = () => {
        const editor = editorRef.current?.getEditor();
        let isEmpty = false;

        if (editor) {
          const editorText = editor.getText().trim();
          isEmpty = editorText === '';
        } else {
          isEmpty = currentTextRef.current.trim() === '';
        }

        if (isEmpty) {
          data.onDeleteNode?.(id);
        }
      };

      const timeoutId = setTimeout(checkAndDelete, 300);
      wasSelectedRef.current = selected;
      return () => clearTimeout(timeoutId);
    }

    wasSelectedRef.current = selected;
  }, [selected, id, data]);

  return (
    <div
      className="relative rounded-md bg-transparent"
      style={{
        width: '100%',
        height: '100%',
        minWidth: 140,
        minHeight: 60,
        boxSizing: 'border-box',
        padding: 4,
        boxShadow: isBeingEdited ? `0 0 0 2px ${otherEditors[0]?.color || '#6366f1'}` : undefined,
      }}
      onFocus={handleEditingFocus}
      onBlur={handleEditingBlur}
    >
      {isBeingEdited && <EditingIndicator editors={otherEditors} position="top-right" />}
      {selected && (
        <TextToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          activeColor={color}
          activeBackgroundColor={backgroundColor}
          textAlign={textAlign}
          editorRef={editorRef}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onColorChange={handleColorChange}
          onBackgroundColorChange={handleBackgroundColorChange}
          onTextAlignChange={handleTextAlignChange}
          onInteractionStart={handleInteractionStart}
          onInteractionEnd={handleInteractionEnd}
        />
      )}
      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={60}
        lineClassName="!border-slate-300"
        handleStyle={{
          width: 12,
          height: 12,
          borderRadius: 9999,
          border: '2px solid #cbd5e1',
          background: '#ffffff',
        }}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />
      <div
        ref={contentRef}
        className="p-4 flex flex-col justify-center rounded-md"
        style={{
          backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor,
          height: '100%',
          minHeight: '100%',
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
          onChange={handleChange}
          showToolbar={false}
          onFontSizeChange={handleFontSizeChange}
          onFontFamilyChange={handleFontFamilyChange}
          onColorChange={handleColorChange}
          onTextAlignChange={handleTextAlignChange}
          className="nodrag"
        />
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
