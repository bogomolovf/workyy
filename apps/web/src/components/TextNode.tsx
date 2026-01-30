import { useCallback, useRef, useEffect } from 'react';
import { NodeResizer, type NodeProps } from 'reactflow';
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
  richContentHtml?: string | null; // HTML контент от TipTap
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
  onDeleteNode?: (id: string) => void; // Callback для удаления узла
};

const DEFAULT_TEXT = '';
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_FONT_FAMILY = 'Noto Sans, sans-serif'; // Как в референсе Miro
const DEFAULT_COLOR = '#CF4C2C'; // orange-red (первый цвет в палитре, как у стикеров)
const DEFAULT_BACKGROUND_COLOR = 'transparent';
const DEFAULT_TEXT_ALIGN: 'left' | 'center' | 'right' = 'left';

export function TextNode({ id, data, selected, ...nodeProps }: NodeProps<TextData>) {
  // Получаем размеры из пропсов узла (React Flow передает их через nodeProps)
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
  const hasAutoFocusedRef = useRef(false); // Отслеживаем, был ли уже установлен автофокус для этого узла
  const currentTextRef = useRef<string>(''); // Отслеживаем текущий текст для проверки пустоты
  const contentRef = useRef<HTMLDivElement>(null); // Ref для контейнера содержимого редактора
  const resizeObserverRef = useRef<ResizeObserver | null>(null); // Ref для ResizeObserver
  const isUpdatingSizeRef = useRef(false); // Флаг для предотвращения одновременных обновлений размеров
  const pendingSizeUpdateRef = useRef<NodeJS.Timeout | null>(null); // Таймер для debounce обновлений размеров

  // Инициализируем контент: если есть richContent, используем его, иначе plain text
  // Используем <p><br></p> для пустого контента, чтобы избежать ошибки "Empty text nodes are not allowed"
  const initialHtml = richContentHtml
    ? richContentHtml.trim() === '<p></p>'
      ? '<p><br></p>'
      : richContentHtml
    : text
      ? `<p>${escapeHtml(text)}</p>`
      : '<p><br></p>';

  // Инициализируем currentTextRef при монтировании и при изменении text извне
  useEffect(() => {
    currentTextRef.current = text || '';
  }, [text]);

  // Проверяем, пустой ли узел - используем реальный текст из редактора
  const isEmpty = currentTextRef.current.trim() === '';

  // Функция для вычисления размеров узла на основе контента
  // При печати текст идет в одну строку, узел расширяется по ширине (по диагонали)
  const updateNodeSize = useCallback(() => {
    if (!contentRef.current || isUpdatingSizeRef.current) return;

    // Получаем размер содержимого редактора
    const editorElement = contentRef.current.querySelector('.ProseMirror') as HTMLElement;
    if (!editorElement) return;

    // Устанавливаем флаг обновления для предотвращения параллельных вызовов
    isUpdatingSizeRef.current = true;

    const padding = 32;
    const minWidth = 120;
    const minHeight = 40;

    // Используем requestAnimationFrame для измерения после полного рендера контента
    requestAnimationFrame(() => {
      if (!editorElement) {
        isUpdatingSizeRef.current = false;
        return;
      }

      // Для измерения ширины используем временное изменение white-space на nowrap
      // Это даст нам реальную ширину контента в одну строку (без переносов)
      const originalWhiteSpace = editorElement.style.whiteSpace;
      editorElement.style.whiteSpace = 'nowrap';
      const contentWidth = editorElement.scrollWidth;
      editorElement.style.whiteSpace = originalWhiteSpace || '';

      // Высота: измеряем реальную высоту контента с учетом переносов через Enter (многострочный текст)
      const contentHeight = editorElement.scrollHeight;

      // Вычисляем новые размеры с учетом padding
      // Ширина: растет по самой длинной строке текста (grow + shrink по диагонали)
      const requiredContentWidth = contentWidth + padding;
      const newWidth = Math.max(minWidth, Math.ceil(requiredContentWidth));

      // Высота: всегда должна соответствовать высоте контента с учетом строк через Enter
      const newHeight = Math.max(minHeight, Math.ceil(contentHeight + padding));

      // Обновляем размер узла только если он изменился (с небольшой погрешностью)
      const currentWidth = nodeWidth;
      const currentHeight = nodeHeight;
      const widthDiff = Math.abs(newWidth - currentWidth);
      const heightDiff = Math.abs(newHeight - currentHeight);

      if (widthDiff > 1 || heightDiff > 1) {
        // Обновляем размер узла через onChangeFormat
        // Это вызовет ререндер React Flow с новыми размерами
        data.onChangeFormat?.(id, {
          ui: {
            width: newWidth,
            height: newHeight,
          },
        });
      }

      // Сбрасываем флаг обновления после небольшой задержки, чтобы дать время React Flow обновить размеры
      requestAnimationFrame(() => {
        isUpdatingSizeRef.current = false;
      });
    });
  }, [id, data, nodeWidth, nodeHeight]);

  const handleChange = useCallback(
    (content: { html: string; text: string }) => {
      // Сохраняем текущий текст для проверки пустоты
      currentTextRef.current = content.text || '';

      // Обновляем и plain text, и rich content
      data.onChangeText?.(id, content.text);
      data.onChangeFormat?.(id, {
        richContent: content.html,
        text: content.text, // подстраховка
      });

      // Временно отключаем ResizeObserver, чтобы избежать конфликта обновлений
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      // Очищаем предыдущий отложенный вызов updateNodeSize
      if (pendingSizeUpdateRef.current) {
        clearTimeout(pendingSizeUpdateRef.current);
      }

      // Обновляем размер узла с debounce для плавности
      // Используем двойной requestAnimationFrame для гарантированного ожидания рендера контента
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Используем небольшой debounce для батчинга частых обновлений
          pendingSizeUpdateRef.current = setTimeout(() => {
            updateNodeSize();

            // Восстанавливаем ResizeObserver после обновления
            requestAnimationFrame(() => {
              const editorElement = contentRef.current?.querySelector(
                '.ProseMirror',
              ) as HTMLElement;
              if (editorElement && resizeObserverRef.current) {
                resizeObserverRef.current.observe(editorElement);
              }
            });
          }, 0); // Убрали задержку, так как уже есть двойной requestAnimationFrame
        });
      });
    },
    [data, id, updateNodeSize],
  );

  const handleFontSizeChange = useCallback(
    (newFontSize: number) => {
      data.onChangeFormat?.(id, { fontSize: newFontSize });
      // Немедленно обновляем размер после изменения размера шрифта
      // Используем requestAnimationFrame для обновления после применения нового размера
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

  // Сохраняем выделение перед взаимодействием с тулбаром
  const handleInteractionStart = useCallback(() => {
    editorRef.current?.saveSelection();
  }, []);

  // Восстанавливаем выделение после взаимодействия с тулбаром
  const handleInteractionEnd = useCallback(() => {
    // Используем комбинацию requestIdleCallback и requestAnimationFrame для более надежного восстановления
    const restoreFocus = () => {
      if (editorRef.current) {
        editorRef.current.restoreSelection();
        // Дополнительный requestAnimationFrame для гарантированного восстановления фокуса
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        });
      }
    };

    // Используем requestIdleCallback если доступен, иначе setTimeout с большей задержкой
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(restoreFocus, { timeout: 200 });
    } else {
      // Fallback для браузеров без requestIdleCallback
      requestAnimationFrame(() => {
        setTimeout(restoreFocus, 50);
      });
    }
  }, []);

  // Автофокус редактора когда узел только что создан (пустой) и selected (как в Miro)
  useEffect(() => {
    // Проверяем пустоту через реальный текст
    const isActuallyEmpty = currentTextRef.current.trim() === '';

    // Фокусируем только если:
    // 1. Узел selected
    // 2. Узел пустой (только что создан)
    // 3. Еще не был установлен автофокус для этого узла
    if (selected && isActuallyEmpty && !hasAutoFocusedRef.current && editorRef.current) {
      // Используем requestAnimationFrame чтобы дождаться монтирования редактора
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            hasAutoFocusedRef.current = true;
          }
        });
      });
    }

    // Сбрасываем флаг автофокуса если узел больше не selected или стал непустым
    if (!selected || !isActuallyEmpty) {
      hasAutoFocusedRef.current = false;
    }
  }, [selected]);

  // Автоматическое изменение размера при изменении содержимого или размера шрифта
  useEffect(() => {
    if (!contentRef.current) return;

    // Создаем ResizeObserver для отслеживания изменений размера содержимого
    // ResizeObserver будет отключаться во время обновления через handleChange
    const observer = new ResizeObserver(() => {
      // Игнорируем обновления, если идет обновление через handleChange
      if (isUpdatingSizeRef.current) return;

      // Очищаем предыдущий отложенный вызов
      if (pendingSizeUpdateRef.current) {
        clearTimeout(pendingSizeUpdateRef.current);
      }

      // Используем debounce для ResizeObserver, чтобы избежать конфликтов
      pendingSizeUpdateRef.current = setTimeout(() => {
        if (!isUpdatingSizeRef.current) {
          requestAnimationFrame(() => {
            updateNodeSize();
          });
        }
      }, 100);
    });

    const editorElement = contentRef.current.querySelector('.ProseMirror') as HTMLElement;
    if (editorElement) {
      observer.observe(editorElement);
      resizeObserverRef.current = observer;
    }

    // Также обновляем размер при изменении размера шрифта или других свойств
    // Используем requestAnimationFrame для обновления после рендера
    requestAnimationFrame(() => {
      updateNodeSize();
    });

    return () => {
      if (pendingSizeUpdateRef.current) {
        clearTimeout(pendingSizeUpdateRef.current);
        pendingSizeUpdateRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      // Сбрасываем флаг обновления при размонтировании
      isUpdatingSizeRef.current = false;
    };
  }, [fontSize, fontFamily, textAlign, updateNodeSize]);

  // Пересчитываем размеры при изменении ширины через resize
  // При resize пользователь может изменить ширину, размеры пересчитываются
  useEffect(() => {
    if (!contentRef.current) return;

    // Пересчитываем размеры при изменении ширины
    requestAnimationFrame(() => {
      updateNodeSize();
    });
  }, [nodeWidth, updateNodeSize]);

  // Автоматическое удаление пустого узла при потере выделения (как в Miro)
  const wasSelectedRef = useRef<boolean | null>(null);
  useEffect(() => {
    // Инициализируем ref при первом рендере
    if (wasSelectedRef.current === null) {
      wasSelectedRef.current = selected;
      return;
    }

    // Отслеживаем переход selected: true -> false
    const wasSelected = wasSelectedRef.current;
    const isNowSelected = selected;

    // Если узел был selected, а теперь не selected - проверяем пустоту и удаляем
    if (wasSelected && !isNowSelected && data.onDeleteNode) {
      // Проверяем реальное содержимое редактора
      const checkAndDelete = () => {
        // Сначала пробуем через TipTap API (самый надежный способ)
        const editor = editorRef.current?.getEditor();
        let isEmpty = false;

        if (editor) {
          const editorText = editor.getText().trim();
          isEmpty = editorText === '';
        } else {
          // Если редактор еще не готов, проверяем через ref (обновляется в handleChange)
          isEmpty = currentTextRef.current.trim() === '';
        }

        // Если узел пустой - удаляем его
        if (isEmpty) {
          data.onDeleteNode?.(id);
        }
      };

      // Используем небольшую задержку чтобы избежать конфликтов с другими обработчиками
      // и дать время редактору обновить состояние после потери фокуса
      // Увеличиваем задержку до 300ms для более надежной проверки
      const timeoutId = setTimeout(checkAndDelete, 300);

      // Обновляем ref перед возвратом
      wasSelectedRef.current = selected;
      return () => clearTimeout(timeoutId);
    }

    // Обновляем ref для следующего рендера
    wasSelectedRef.current = selected;
  }, [selected, id, data]);

  return (
    <div
      className="relative rounded-md bg-transparent"
      style={{
        width: '100%',
        height: '100%',
        minWidth: 120,
        minHeight: 40,
        boxSizing: 'border-box',
      }}
    >
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
        minWidth={120}
        minHeight={40}
        lineClassName="!border-slate-300"
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: '2px solid #cbd5e1',
          background: '#ffffff',
        }}
        // Miro-like поведение: разрешаем resize по всем направлениям (width и height)
        // Высота будет автоматически пересчитана после завершения resize
        // Если нужно ограничить только шириной - используем keepAspectRatio={false} и обрабатываем отдельно
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

// Простая функция для экранирования HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
