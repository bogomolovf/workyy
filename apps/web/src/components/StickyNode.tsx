import { useCallback, useRef } from "react";
import { NodeResizer, type NodeProps } from "reactflow";
import { StickyToolbar } from "./StickyToolbar";

type StickyData = {
  text?: string;
  color?: string;
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
};

const DEFAULT_STICKY_COLOR = "#EBC347"; // yellow, как в оригинале amber
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_FAMILY = "Inter, sans-serif";

export function StickyNode({ id, data, selected, width, height }: NodeProps<StickyData>) {
  const stickyColor = data.color ?? DEFAULT_STICKY_COLOR;
  const fontSize = data.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = data.fontFamily ?? DEFAULT_FONT_FAMILY;
  // Явно преобразуем в boolean, чтобы гарантировать правильное применение стилей
  const isBold = Boolean(data.isBold ?? false);
  const isItalic = Boolean(data.isItalic ?? false);
  
  // Сохраняем selection range для восстановления после потери фокуса
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      data.onChangeText?.(id, e.target.value);
    },
    [data, id],
  );

  // Сохраняем selection при потере фокуса
  const onBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    // Сохраняем selection только если фокус не перешел на элементы тулбара
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const isToolbarClick = relatedTarget?.closest('.react-flow__node-toolbar');
    
    // Если выделение еще не сохранено (например, пользователь просто кликнул вне textarea),
    // сохраняем его здесь
    if (textarea && !isToolbarClick && !savedSelectionRef.current) {
      savedSelectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    }
  }, []);

  // Восстанавливаем selection при получении фокуса
  const onFocus = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea && savedSelectionRef.current) {
      // Используем requestAnimationFrame чтобы убедиться, что элемент получил фокус
      requestAnimationFrame(() => {
        if (textarea && savedSelectionRef.current) {
          textarea.setSelectionRange(
            savedSelectionRef.current.start,
            savedSelectionRef.current.end
          );
        }
      });
    }
  }, []);

  // Сохраняем текущее выделение перед взаимодействием с тулбаром
  const saveSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Сохраняем выделение независимо от того, в фокусе ли textarea
      // Это важно, так как выделение может сохраняться даже когда фокус теряется
      savedSelectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    }
  }, []);

  // Функция для восстановления фокуса и selection после взаимодействия с тулбаром
  const restoreSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea && savedSelectionRef.current) {
      // Возвращаем фокус на textarea и восстанавливаем выделение
      // Используем двойной requestAnimationFrame для более надежного восстановления
      textarea.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (textarea && savedSelectionRef.current) {
            const { start, end } = savedSelectionRef.current;
            // Убеждаемся, что значения в допустимых пределах
            const maxLength = textarea.value.length;
            const safeStart = Math.min(Math.max(0, start), maxLength);
            const safeEnd = Math.min(Math.max(safeStart, end), maxLength);
            
            textarea.setSelectionRange(safeStart, safeEnd);
            // Форсируем перерисовку выделения
            textarea.blur();
            textarea.focus();
            textarea.setSelectionRange(safeStart, safeEnd);
          }
        });
      });
    }
  }, []);

  const onColorChange = useCallback(
    (color: string) => {
      data.onChangeColor?.(id, color);
    },
    [data, id],
  );

  const onFontSizeChange = useCallback(
    (newFontSize: number) => {
      data.onChangeFontSize?.(id, newFontSize);
    },
    [data, id],
  );

  const onFontFamilyChange = useCallback(
    (newFontFamily: string) => {
      data.onChangeFontFamily?.(id, newFontFamily);
    },
    [data, id],
  );

  const onBoldToggle = useCallback(() => {
    data.onChangeBold?.(id, !isBold);
  }, [data, id, isBold]);

  const onItalicToggle = useCallback(() => {
    data.onChangeItalic?.(id, !isItalic);
  }, [data, id, isItalic]);

  // Вычисляем цвета для border и background на основе выбранного цвета
  // Формируем более светлый непрозрачный оттенок для background и оригинальный цвет для border
  const getColorStyles = (color: string) => {
    const borderColor = color;
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const lighten = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * 0.15));
    const bgColor = `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`; // непрозрачный светлый оттенок

    return {
      borderColor,
      backgroundColor: bgColor,
    };
  };

  const colorStyles = getColorStyles(stickyColor);

  // React Flow управляет размерами wrapper элемента (.react-flow__node-sticky)
  // через width и height props, которые автоматически обновляются при ресайзе
  // Внутренний div должен заполнять wrapper на 100%, чтобы следовать за изменениями размеров

  return (
    <>
      {selected && (
        <StickyToolbar
          fontSize={fontSize}
          fontFamily={fontFamily}
          isBold={isBold}
          isItalic={isItalic}
          activeColor={stickyColor}
          onFontSizeChange={onFontSizeChange}
          onFontFamilyChange={onFontFamilyChange}
          onBoldToggle={onBoldToggle}
          onItalicToggle={onItalicToggle}
          onColorChange={onColorChange}
          onInteractionStart={saveSelection}
          onInteractionEnd={restoreSelection}
        />
      )}
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName="!border-amber-200"
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          border: `2px solid ${stickyColor}`,
          background: colorStyles.backgroundColor,
        }}
      />
      <div
        style={{ 
          // Используем 100% чтобы заполнить wrapper, который управляется React Flow
          // React Flow применяет width/height к wrapper через inline styles
          width: "100%",
          height: "100%",
          minWidth: 120,
          minHeight: 80,
          boxSizing: "border-box",
          borderColor: colorStyles.borderColor,
          backgroundColor: colorStyles.backgroundColor,
        }}
        className="rounded-none border-2 p-2 shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
      >
        <textarea
          ref={textareaRef}
          value={data.text ?? ""}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          onSelect={(e) => {
            // Сохраняем выделение при каждом изменении selection
            // Это позволяет сохранить выделение даже когда пользователь взаимодействует с текстом
            const textarea = e.target as HTMLTextAreaElement;
            if (textarea && document.activeElement === textarea) {
              savedSelectionRef.current = {
                start: textarea.selectionStart,
                end: textarea.selectionEnd,
              };
            }
          }}
          placeholder="Sticky note..."
          className="nodrag h-full w-full resize-none bg-transparent text-slate-800 outline-none"
          style={{
            boxSizing: "border-box",
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily,
            fontWeight: isBold ? "bold" : "normal",
            fontStyle: isItalic ? "italic" : "normal",
            lineHeight: "1.5",
          }}
          onMouseDown={(e) => {
            // Предотвращаем dragging узла при взаимодействии с textarea
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            // Предотвращаем dragging узла при взаимодействии с textarea
            e.stopPropagation();
          }}
          onDragStart={(e) => {
            // Предотвращаем drag события на textarea
            e.preventDefault();
          }}
        />
      </div>
    </>
  );
}


