import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';

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
      // Проверяем, что HTML валидный для TipTap (не содержит пустых текстовых узлов)
      // Если это пустой параграф, заменяем на <p><br></p>
      const trimmed = value.trim();
      if (trimmed === '<p></p>' || trimmed === '<p><br></p>') {
        return '<p><br></p>';
      }
      return value;
    }
    // Иначе оборачиваем plain text в параграф
    const escaped = escapeHtml(value);
    // Если текст пустой, используем <br> вместо пустого параграфа
    return escaped ? `<p>${escaped}</p>` : '<p><br></p>';
  }
  if (plainTextFallback) {
    const escaped = escapeHtml(plainTextFallback);
    // Если текст пустой, используем <br> вместо пустого параграфа
    return escaped ? `<p>${escaped}</p>` : '<p><br></p>';
  }
  // Для пустого редактора используем <br> вместо пустого параграфа
  // Это предотвращает ошибку "Empty text nodes are not allowed"
  return '<p><br></p>';
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
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  toggleLink: (url?: string) => void;
  toggleHighlight: () => void;
  isBold: () => boolean;
  isItalic: () => boolean;
  isUnderline: () => boolean;
  isBulletList: () => boolean;
  isOrderedList: () => boolean;
  isLink: () => boolean;
  isHighlight: () => boolean;
  saveSelection: () => void;
  restoreSelection: () => void;
  focus: () => void;
  getEditor: () => ReturnType<typeof useEditor> | null;
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
    const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
    const editorInstanceRef = useRef<ReturnType<typeof useEditor> | null>(null);

    // Обновляем ref при изменении onChange
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Debounced onChange для производительности
    // Синхронизирован с debounce в BoardCanvas (150ms для плавности)
    const debouncedOnChange = useCallback((html: string, text: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChangeRef.current({ html, text });
      }, 150); // Уменьшено с 300ms до 150ms для синхронизации с BoardCanvas
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
          style: `font-size: ${fontSize}px; font-family: ${fontFamily}; color: ${color}; text-align: ${textAlign}; word-break: keep-all; overflow-wrap: normal; white-space: pre-line; line-height: 1.2;`,
          'data-placeholder': 'Type something',
        },
        handleDOMEvents: {
          // При фокусе на пустом редакторе устанавливаем курсор в начало
          focus: (view) => {
            try {
              const editor = view.state.doc;
              const isEmpty = editor.textContent.trim() === '';

              // Если редактор пустой, устанавливаем курсор в начало
              if (isEmpty) {
                // Используем requestAnimationFrame для установки курсора после того, как TipTap обработает фокус
                requestAnimationFrame(() => {
                  try {
                    // Устанавливаем курсор в начало первого параграфа
                    const { tr } = view.state;
                    // Используем существующий метод для установки курсора в начало
                    const startPos = 1; // Позиция после открывающего тега <p>
                    // Проверяем, что позиция валидна
                    if (startPos <= view.state.doc.content.size) {
                      tr.setSelection(
                        view.state.schema.text('').createAndFill()?.create() ||
                          view.state.selection,
                      );
                      // Проще: используем команду focus() вместо прямой установки selection
                      view.focus();
                    }
                  } catch (error) {
                    console.warn('Failed to set cursor position in TipTap editor:', error);
                  }
                });
              }
            } catch (error) {
              console.warn('Error in TipTap focus handler:', error);
            }
            return false; // Позволяем TipTap обработать событие дальше
          },
        },
      },
    });

    // Сохраняем ссылку на editor instance
    useEffect(() => {
      editorInstanceRef.current = editor;
    }, [editor]);

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
        editorElement.style.lineHeight = '1.2';
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
        // Используем try-catch для предотвращения ошибок при установке контента
        try {
          editor.commands.setContent(newContent);
        } catch (error) {
          console.warn('Failed to set content in TipTap editor:', error);
          // Fallback: используем безопасный контент
          editor.commands.setContent('<p><br></p>');
        }
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

    const handleBulletListToggle = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleBulletList().run();
    }, [editor]);

    const handleOrderedListToggle = useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleOrderedList().run();
    }, [editor]);

    const handleLinkToggle = useCallback(
      (url?: string) => {
        if (!editor) return;
        // Link не входит в StarterKit, используем workaround через HTML
        // Если нужно полноценное Link расширение, нужно установить @tiptap/extension-link
        // Пока используем простой prompt для ввода URL
        const linkUrl = url || window.prompt('Enter URL:');
        if (linkUrl) {
          // Применяем ссылку через команду setMark или напрямую через HTML
          // Для простоты используем execCommand (deprecated, но работает)
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const link = document.createElement('a');
            link.href = linkUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            try {
              range.surroundContents(link);
            } catch (e) {
              // Если не удалось обернуть, вставляем ссылку как новый элемент
              link.textContent = linkUrl;
              range.insertNode(link);
            }
            editor.commands.focus();
          }
        }
      },
      [editor],
    );

    const handleHighlightToggle = useCallback(() => {
      if (!editor) return;
      // Используем backgroundColor через TextStyle для подсветки
      // Это работает без дополнительных расширений
      const currentBg = editor.getAttributes('textStyle').backgroundColor;
      if (currentBg === '#fef08a' || currentBg === 'rgb(254, 240, 138)') {
        editor.chain().focus().unsetMark('textStyle').run();
      } else {
        editor.chain().focus().setMark('textStyle', { backgroundColor: '#fef08a' }).run();
      }
    }, [editor]);

    const saveSelection = useCallback(() => {
      if (!editor) return;
      try {
        const { from, to } = editor.state.selection;
        savedSelectionRef.current = { from, to };
      } catch (error) {
        // Если не удалось сохранить выделение, игнорируем ошибку
        console.debug('Failed to save selection:', error);
      }
    }, [editor]);

    const restoreSelection = useCallback(() => {
      if (!editor || !savedSelectionRef.current) return;
      const { from, to } = savedSelectionRef.current;

      // Используем более надежную стратегию восстановления с несколькими попытками
      const attemptRestore = (attempt = 0) => {
        if (!editor || !savedSelectionRef.current || attempt > 3) {
          // Если не удалось восстановить после нескольких попыток, просто фокусируем
          if (editor) {
            editor.commands.focus();
          }
          return;
        }

        try {
          const { from, to } = savedSelectionRef.current;
          // Проверяем, что индексы в допустимых пределах
          const docSize = editor.state.doc.content.size;
          const safeFrom = Math.max(0, Math.min(from, docSize));
          const safeTo = Math.max(safeFrom, Math.min(to, docSize));

          // Сначала фокусируем редактор
          editor.commands.focus();

          // Затем восстанавливаем выделение с небольшой задержкой
          requestAnimationFrame(() => {
            if (editor && savedSelectionRef.current) {
              try {
                editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
                // Проверяем что выделение восстановилось
                const currentSelection = editor.state.selection;
                if (currentSelection.from !== safeFrom || currentSelection.to !== safeTo) {
                  // Если не восстановилось, пробуем еще раз
                  setTimeout(() => attemptRestore(attempt + 1), 50);
                }
              } catch (error) {
                // Если ошибка, пробуем еще раз
                console.debug('Failed to restore selection, retrying:', error);
                setTimeout(() => attemptRestore(attempt + 1), 50);
              }
            }
          });
        } catch (error) {
          console.debug('Failed to restore selection:', error);
          setTimeout(() => attemptRestore(attempt + 1), 50);
        }
      };

      // Начинаем восстановление
      requestAnimationFrame(() => {
        attemptRestore();
      });
    }, [editor]);

    const focusEditor = useCallback(() => {
      if (!editor) return;
      editor.commands.focus();
    }, [editor]);

    // Экспортируем функции через ref для использования в TextToolbar
    useImperativeHandle(
      ref,
      () => ({
        toggleBold: handleBoldToggle,
        toggleItalic: handleItalicToggle,
        toggleUnderline: handleUnderlineToggle,
        toggleBulletList: handleBulletListToggle,
        toggleOrderedList: handleOrderedListToggle,
        toggleLink: handleLinkToggle,
        toggleHighlight: handleHighlightToggle,
        isBold: () => editor?.isActive('bold') ?? false,
        isItalic: () => editor?.isActive('italic') ?? false,
        isUnderline: () => editor?.isActive('underline') ?? false,
        isBulletList: () => editor?.isActive('bulletList') ?? false,
        isOrderedList: () => editor?.isActive('orderedList') ?? false,
        isLink: () => {
          if (!editor) return false;
          // Проверяем, находится ли курсор внутри ссылки
          const { from, to } = editor.state.selection;
          let isInLink = false;
          editor.state.doc.nodesBetween(from, to, (node) => {
            if (node.type.name === 'link') {
              isInLink = true;
            }
          });
          return isInLink;
        },
        isHighlight: () => {
          if (!editor) return false;
          const bg = editor.getAttributes('textStyle').backgroundColor;
          return bg === '#fef08a' || bg === 'rgb(254, 240, 138)';
        },
        saveSelection,
        restoreSelection,
        focus: focusEditor,
        getEditor: () => editorInstanceRef.current,
      }),
      [
        editor,
        handleBoldToggle,
        handleItalicToggle,
        handleUnderlineToggle,
        handleBulletListToggle,
        handleOrderedListToggle,
        handleLinkToggle,
        handleHighlightToggle,
        saveSelection,
        restoreSelection,
        focusEditor,
      ],
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
