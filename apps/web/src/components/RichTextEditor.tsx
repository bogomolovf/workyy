import { useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';

type RichTextEditorProps = {
  value?: string; // HTML или plain text (для инициализации)
  plainTextFallback?: string; // fallback текст
  onChange: (content: { html: string; text: string }) => void;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  className?: string;
  showToolbar?: boolean; // показывать ли toolbar
  onFontSizeChange?: (fontSize: number) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
  onColorChange?: (color: string) => void;
  onTextAlignChange?: (textAlign: 'left' | 'center' | 'right') => void;
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onUnderlineToggle?: () => void;
};

// Простая функция для экранирования HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Функция для инициализации контента
function getInitialContent(value?: string, plainTextFallback?: string): string {
  if (value) {
    // Если value похоже на HTML (содержит теги), используем как есть
    if (value.includes('<') && value.includes('>')) {
      return value;
    }
    // Иначе оборачиваем plain text в параграф
    return `<p>${escapeHtml(value)}</p>`;
  }
  if (plainTextFallback) {
    return `<p>${escapeHtml(plainTextFallback)}</p>`;
  }
  return '<p></p>';
}

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const fontFamilies = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Monaco, monospace', label: 'Monospace' },
];

export type RichTextEditorRef = {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  isBold: () => boolean;
  isItalic: () => boolean;
  isUnderline: () => boolean;
};

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor(
    {
      value,
      plainTextFallback,
      onChange,
      color = '#0f172a',
      fontSize = 18,
      fontFamily = 'Inter, sans-serif',
      textAlign = 'left',
      className = '',
      showToolbar = false,
      onFontSizeChange,
      onFontFamilyChange,
      onColorChange,
      onTextAlignChange,
      onBoldToggle,
      onItalicToggle,
      onUnderlineToggle,
    },
    ref,
  ) {
    const onChangeRef = useRef(onChange);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Обновляем ref при изменении onChange
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Debounced onChange для производительности
    const debouncedOnChange = useCallback((html: string, text: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChangeRef.current({ html, text });
      }, 300);
    }, []);

    const initialContent = useMemo(
      () => getInitialContent(value, plainTextFallback),
      [value, plainTextFallback],
    );

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
        }),
        TextStyle,
        Color.configure({ types: ['textStyle'] }),
        TextAlign.configure({
          types: ['paragraph', 'heading'],
          defaultAlignment: textAlign,
        }),
        Underline,
      ],
      content: initialContent,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const text = editor.getText();
        debouncedOnChange(html, text);
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none focus:outline-none nodrag',
          style: `font-size: ${fontSize}px; font-family: ${fontFamily}; color: ${color}; text-align: ${textAlign};`,
          'data-placeholder': 'текст',
        },
      },
    });

    // Применяем цвет/размер/шрифт/выравнивание при изменении пропсов
    useEffect(() => {
      if (!editor) return;

      const currentColor = editor.getAttributes('textStyle').color || color;
      const currentFontSize = editor.getAttributes('textStyle').fontSize || `${fontSize}px`;
      const currentFontFamily = editor.getAttributes('textStyle').fontFamily || fontFamily;

      // Применяем стили через команды, если они изменились
      if (currentColor !== color) {
        editor.chain().focus().setColor(color).run();
      }
      // Font size и font family применяются через inline styles в editorProps
      // Text align применяется через команду
      editor
        .chain()
        .focus()
        .setTextAlign(textAlign as 'left' | 'center' | 'right' | 'justify')
        .run();

      // Обновляем атрибуты редактора для новых значений
      const editorElement = editor.view.dom as HTMLElement;
      if (editorElement) {
        editorElement.style.fontSize = `${fontSize}px`;
        editorElement.style.fontFamily = fontFamily;
        editorElement.style.color = color;
        editorElement.style.textAlign = textAlign;
      }
    }, [editor, color, fontSize, fontFamily, textAlign]);

    // Обновляем контент при изменении value (только если это внешнее изменение, не от пользователя)
    useEffect(() => {
      if (!editor) return;
      const newContent = getInitialContent(value, plainTextFallback);
      const currentContent = editor.getHTML();
      // Обновляем только если контент действительно изменился и это не HTML от пользовательского редактирования
      // Проверяем также plain text, чтобы не обновлять если пользователь только что изменил форматирование
      const currentText = editor.getText().trim();
      const newText = plainTextFallback?.trim() || '';
      // Обновляем только если value изменился извне (не от пользователя)
      if (value && value !== currentContent && currentText !== newText) {
        editor.commands.setContent(newContent);
      }
    }, [editor, value, plainTextFallback]);

    // Cleanup debounce timer
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    const handleColorChange = useCallback(
      (newColor: string) => {
        if (!editor) return;
        editor.chain().focus().setColor(newColor).run();
        onColorChange?.(newColor);
      },
      [editor, onColorChange],
    );

    const handleTextAlignChange = useCallback(
      (newAlign: 'left' | 'center' | 'right') => {
        if (!editor) return;
        editor.chain().focus().setTextAlign(newAlign).run();
        onTextAlignChange?.(newAlign);
      },
      [editor, onTextAlignChange],
    );

    const handleBoldToggle = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleBold().run();
      onBoldToggle?.();
    }, [editor, onBoldToggle]);

    const handleItalicToggle = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleItalic().run();
      onItalicToggle?.();
    }, [editor, onItalicToggle]);

    const handleUnderlineToggle = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleUnderline().run();
      onUnderlineToggle?.();
    }, [editor, onUnderlineToggle]);

    // Экспортируем функции через ref для использования в TextToolbar
    useImperativeHandle(
      ref,
      () => ({
        toggleBold: handleBoldToggle,
        toggleItalic: handleItalicToggle,
        toggleUnderline: handleUnderlineToggle,
        isBold: () => editor?.isActive('bold') ?? false,
        isItalic: () => editor?.isActive('italic') ?? false,
        isUnderline: () => editor?.isActive('underline') ?? false,
      }),
      [editor, handleBoldToggle, handleItalicToggle, handleUnderlineToggle],
    );

    if (!editor) {
      return null;
    }

    const isBold = editor.isActive('bold');
    const isItalic = editor.isActive('italic');
    const isUnderline = editor.isActive('underline');

    return (
      <div
        className={`flex flex-col h-full w-full ${className}`}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onDragStart={(e) => {
          e.preventDefault();
        }}
      >
        {/* Toolbar - показывается только когда showToolbar === true */}
        {showToolbar && (
          <div className="flex items-center gap-1 mb-1 text-xs text-slate-600 nodrag border-b border-slate-200 pb-1 px-1">
            {/* Bold */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBoldToggle();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                isBold
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
              title="Bold"
              aria-label="Toggle bold"
            >
              B
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleItalicToggle();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              className={`px-1.5 py-0.5 rounded text-xs italic transition-colors ${
                isItalic
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
              title="Italic"
              aria-label="Toggle italic"
            >
              I
            </button>

            {/* Underline */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUnderlineToggle();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              className={`px-1.5 py-0.5 rounded text-xs underline transition-colors ${
                isUnderline
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
              title="Underline"
              aria-label="Toggle underline"
            >
              U
            </button>

            {/* Font Size Selector */}
            <select
              value={fontSize}
              onChange={(e) => {
                e.stopPropagation();
                const newSize = Number(e.target.value);
                onFontSizeChange?.(newSize);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
              style={{ fontFamily: fontFamily }}
            >
              {fontSizes.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>

            {/* Font Family Selector */}
            <select
              value={fontFamily}
              onChange={(e) => {
                e.stopPropagation();
                onFontFamilyChange?.(e.target.value);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
            >
              {fontFamilies.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>

            {/* Divider */}
            <div className="w-px h-3 bg-slate-300" />

            {/* Color Swatches */}
            <div className="flex gap-1">
              {[
                '#0f172a',
                '#475569',
                '#CF4C2C',
                '#EA9C41',
                '#EBC347',
                '#438D57',
                '#3F8AE2',
                '#803DEC',
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleColorChange(c);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded border transition-all nodrag ${
                    color === c ? 'border-black border-2' : 'border-slate-300 hover:scale-110'
                  }`}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-3 bg-slate-300" />

            {/* Text Align */}
            <div className="flex gap-0.5 border border-slate-300 rounded overflow-hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTextAlignChange('left');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                className={`px-1.5 py-0.5 text-xs transition-colors nodrag ${
                  textAlign === 'left'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="Align left"
                aria-label="Align left"
              >
                ⬅
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTextAlignChange('center');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                className={`px-1.5 py-0.5 text-xs transition-colors border-l border-r border-slate-300 nodrag ${
                  textAlign === 'center'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="Align center"
                aria-label="Align center"
              >
                ⬌
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTextAlignChange('right');
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                className={`px-1.5 py-0.5 text-xs transition-colors nodrag ${
                  textAlign === 'right'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="Align right"
                aria-label="Align right"
              >
                ➡
              </button>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-auto nodrag">
          <EditorContent
            editor={editor}
            className="h-full w-full"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
          />
        </div>
      </div>
    );
  },
);
