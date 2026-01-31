import { CaretUp, CaretDown, ListBullets, Link as LinkIcon } from '@phosphor-icons/react';
import { useState, useEffect, useRef } from 'react';
import { NodeToolbar } from 'reactflow';
import type { RichTextEditorRef } from './RichTextEditor';

const fontSizes = [10, 12, 14, 16, 18, 24, 36, 48, 64, 80, 144, 288];

const fontFamilies = [
  { value: 'Noto Sans, sans-serif', label: 'Noto Sans' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Monaco, monospace', label: 'Monospace' },
];

const colors = [
  '#0f172a', // slate-900 (black)
  '#475569', // slate-600
  '#CF4C2C', // orange-red
  '#EA9C41', // orange
  '#EBC347', // yellow
  '#438D57', // green
  '#3F8AE2', // blue
  '#803DEC', // purple
];

type TextToolbarProps = {
  fontSize: number;
  fontFamily: string;
  activeColor: string;
  activeBackgroundColor?: string;
  textAlign: 'left' | 'center' | 'right';
  editorRef: React.RefObject<RichTextEditorRef>;
  onFontSizeChange?: (fontSize: number) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
  onColorChange?: (color: string) => void;
  onBackgroundColorChange?: (backgroundColor: string) => void;
  onTextAlignChange?: (textAlign: 'left' | 'center' | 'right') => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export function TextToolbar({
  fontSize,
  fontFamily,
  activeColor,
  activeBackgroundColor = 'transparent',
  textAlign,
  editorRef,
  onFontSizeChange = () => {},
  onFontFamilyChange = () => {},
  onColorChange = () => {},
  onBackgroundColorChange = () => {},
  onTextAlignChange = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
}: TextToolbarProps) {
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isBackgroundColorOpen, setIsBackgroundColorOpen] = useState(false);
  const [isFontFamilyOpen, setIsFontFamilyOpen] = useState(false);
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const [localFontSize, setLocalFontSize] = useState<number | string>(fontSize); // Локальное состояние для input
  const textColorRef = useRef<HTMLDivElement>(null);
  const backgroundColorRef = useRef<HTMLDivElement>(null);
  const fontFamilyDropdownRef = useRef<HTMLDivElement>(null);
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null);
  const fontSizeInputRef = useRef<HTMLInputElement>(null); // Ref для input поля
  const fontSizeSelectingRef = useRef(false); // Флаг для отслеживания выбора размера
  // Состояние редактора для отслеживания изменений
  const [, forceUpdate] = useState({});

  // Обновляем состояние редактора при каждом рендере
  const getEditorState = () => {
    if (!editorRef.current) {
      return {
        isBold: false,
        isItalic: false,
        isUnderline: false,
        isBulletList: false,
        isOrderedList: false,
        isLink: false,
        isHighlight: false,
      };
    }
    return {
      isBold: editorRef.current.isBold(),
      isItalic: editorRef.current.isItalic(),
      isUnderline: editorRef.current.isUnderline(),
      isBulletList: editorRef.current.isBulletList(),
      isOrderedList: editorRef.current.isOrderedList(),
      isLink: editorRef.current.isLink(),
      isHighlight: editorRef.current.isHighlight(),
    };
  };

  // Обновляем локальное состояние при изменении пропса fontSize
  useEffect(() => {
    setLocalFontSize(fontSize);
  }, [fontSize]);

  // Периодически обновляем состояние для отслеживания изменений в редакторе
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 100); // Обновляем каждые 100ms

    return () => clearInterval(interval);
  }, []);

  // Закрываем палитры и dropdown при клике вне их
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // ИСКЛЮЧАЕМ input поле размера шрифта - не обрабатываем клики на него
      if (fontSizeInputRef.current?.contains(target)) {
        return; // Не обрабатываем клики на input
      }

      // Проверяем закрытие font family dropdown
      if (
        fontFamilyDropdownRef.current &&
        !fontFamilyDropdownRef.current.contains(target) &&
        isFontFamilyOpen
      ) {
        setIsFontFamilyOpen(false);
        // Возвращаем фокус в редактор при закрытии dropdown
        requestAnimationFrame(() => {
          onInteractionEnd();
        });
      }

      // Проверяем закрытие font size dropdown
      if (
        fontSizeDropdownRef.current &&
        !fontSizeDropdownRef.current.contains(target) &&
        isFontSizeOpen &&
        !fontSizeSelectingRef.current // Не закрываем если идет выбор размера
      ) {
        setIsFontSizeOpen(false);
        // Возвращаем фокус в редактор при закрытии dropdown
        requestAnimationFrame(() => {
          onInteractionEnd();
        });
      }

      // Закрываем палитры цветов
      if (
        textColorRef.current &&
        !textColorRef.current.contains(target) &&
        backgroundColorRef.current &&
        !backgroundColorRef.current.contains(target)
      ) {
        setIsTextColorOpen(false);
        setIsBackgroundColorOpen(false);
      }
    };

    // Используем click вместо mousedown чтобы дать время onMouseDown на кнопках в dropdown сработать
    // click срабатывает после mousedown, так что onMouseDown на кнопках успеет обработать выбор
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isFontFamilyOpen, isFontSizeOpen, onInteractionEnd]);

  const editorState = getEditorState();
  const isBold = editorState.isBold;
  const isItalic = editorState.isItalic;
  const isUnderline = editorState.isUnderline;
  const isBulletList = editorState.isBulletList;
  const isOrderedList = editorState.isOrderedList;
  const isLink = editorState.isLink;
  const isHighlight = editorState.isHighlight;

  // Функция для применения размера шрифта ко всему тексту
  const applyFontSizeToAllText = (newSize: number) => {
    const editor = editorRef.current?.getEditor();
    if (editor) {
      const docSize = editor.state.doc.content.size;
      if (docSize > 0) {
        // Сохраняем текущее выделение
        const currentSelection = editor.state.selection;
        // Выделяем весь документ и применяем размер шрифта
        editor
          .chain()
          .setTextSelection({ from: 0, to: docSize })
          .setMark('textStyle', { fontSize: `${newSize}px` })
          .setTextSelection(currentSelection) // Восстанавливаем выделение
          .run();
      }
    }
  };

  const handleFontSizeIncrease = () => {
    const currentIndex = fontSizes.indexOf(fontSize);
    let newSize: number;
    if (currentIndex < fontSizes.length - 1) {
      newSize = fontSizes[currentIndex + 1];
    } else {
      // Если текущий размер больше максимального в списке, увеличиваем на 2
      newSize = fontSize + 2;
    }
    onFontSizeChange(newSize);
    applyFontSizeToAllText(newSize);
    setLocalFontSize(newSize); // Обновляем локальное состояние
    onInteractionEnd();
  };

  const handleFontSizeDecrease = () => {
    const currentIndex = fontSizes.indexOf(fontSize);
    let newSize: number;
    if (currentIndex > 0) {
      newSize = fontSizes[currentIndex - 1];
    } else if (fontSize > 8) {
      // Если текущий размер меньше минимального в списке, уменьшаем на 2
      newSize = Math.max(8, fontSize - 2);
    } else {
      return; // Нельзя уменьшить меньше 8
    }
    onFontSizeChange(newSize);
    applyFontSizeToAllText(newSize);
    setLocalFontSize(newSize); // Обновляем локальное состояние
    onInteractionEnd();
  };

  const handleFontSizeSelect = (selectedSize: number) => {
    fontSizeSelectingRef.current = true;
    onFontSizeChange(selectedSize);
    applyFontSizeToAllText(selectedSize);
    setLocalFontSize(selectedSize); // Обновляем локальное состояние
    setIsFontSizeOpen(false);

    // Немедленно возвращаем фокус в редактор после выбора
    requestAnimationFrame(() => {
      onInteractionEnd();
      // Сбрасываем флаг после небольшой задержки
      setTimeout(() => {
        fontSizeSelectingRef.current = false;
      }, 100);
    });
  };

  const handleFontSizeSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFontSizeChange(Number(e.target.value));
    onInteractionEnd();
  };

  const handleFontFamilySelect = (selectedFont: string) => {
    onFontFamilyChange(selectedFont);
    setIsFontFamilyOpen(false);
    // Немедленно возвращаем фокус в редактор после выбора
    // Используем requestAnimationFrame для надежного восстановления
    requestAnimationFrame(() => {
      onInteractionEnd();
    });
  };

  const handleBoldToggle = () => {
    editorRef.current?.toggleBold();
    onInteractionEnd();
  };

  const handleItalicToggle = () => {
    editorRef.current?.toggleItalic();
    onInteractionEnd();
  };

  const handleUnderlineToggle = () => {
    editorRef.current?.toggleUnderline();
    onInteractionEnd();
  };

  const handleBulletListToggle = () => {
    editorRef.current?.toggleBulletList();
    onInteractionEnd();
  };

  const handleOrderedListToggle = () => {
    editorRef.current?.toggleOrderedList();
    onInteractionEnd();
  };

  const handleLinkToggle = () => {
    editorRef.current?.toggleLink();
    onInteractionEnd();
  };

  const handleHighlightToggle = () => {
    editorRef.current?.toggleHighlight();
    onInteractionEnd();
  };

  return (
    <NodeToolbar className="nodrag" offset={8}>
      <div
        className="flex items-center gap-0 rounded-lg bg-white px-1.5 py-1 shadow-lg border border-slate-200"
        style={{ borderRadius: '8px' }}
      >
        {/* Text Mode Icon (T) - как в референсе */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-slate-100 transition-colors nodrag"
          title="Text mode"
          aria-label="Text mode"
        >
          <span className="text-sm font-bold text-slate-700">T</span>
        </button>

        {/* Font Family Selector - кастомный dropdown */}
        <div ref={fontFamilyDropdownRef} className="relative nodrag">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Сохраняем выделение только при реальном клике
              onInteractionStart();
              setIsFontFamilyOpen(!isFontFamilyOpen);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-xs border-0 rounded px-2 py-1 bg-transparent cursor-pointer hover:bg-slate-50 focus:outline-none focus:bg-slate-50 nodrag text-left"
            style={{ fontFamily: fontFamily, minWidth: '100px' }}
            aria-label="Select font family"
            aria-expanded={isFontFamilyOpen}
          >
            {fontFamilies.find((f) => f.value === fontFamily)?.label || 'Noto Sans'}
            <span className="ml-1 inline-block">▼</span>
          </button>
          {isFontFamilyOpen && (
            <div
              className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 min-w-[120px]"
              style={{ fontFamily: fontFamily }}
            >
              {fontFamilies.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFontFamilySelect(font.value);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 first:rounded-t-md last:rounded-b-md transition-colors ${
                    font.value === fontFamily ? 'bg-slate-100 font-medium' : ''
                  }`}
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Control with arrows and dropdown */}
        <div
          ref={fontSizeDropdownRef}
          className="relative flex items-center gap-0.5 border-l border-slate-200 pl-1.5 ml-1 nodrag"
        >
          <div className="relative flex items-center">
            <input
              ref={fontSizeInputRef}
              type="number"
              value={localFontSize}
              onChange={(e) => {
                const inputValue = e.target.value;
                // Разрешаем пустое значение для ввода
                if (inputValue === '') {
                  setLocalFontSize('');
                  return;
                }
                const newSize = Number(inputValue);
                // Обновляем локальное состояние для отображения, но не применяем размер
                if (!isNaN(newSize) && newSize > 0) {
                  setLocalFontSize(newSize);
                }
                // НЕ вызываем onInteractionEnd() здесь - это мешает вводу
              }}
              onBlur={(e) => {
                // Применяем размер только при blur
                const inputValue = e.target.value;
                if (inputValue === '') {
                  // Восстанавливаем значение если пустое
                  setLocalFontSize(fontSize);
                  onInteractionEnd();
                  return;
                }
                const newSize = Number(inputValue);
                if (newSize >= 8 && newSize <= 500 && !isNaN(newSize) && newSize > 0) {
                  // Применяем размер только если значение валидное
                  onFontSizeChange(newSize);
                  applyFontSizeToAllText(newSize);
                  // Только теперь возвращаем фокус
                  onInteractionEnd();
                } else {
                  // Восстанавливаем значение если невалидное
                  setLocalFontSize(fontSize);
                  onInteractionEnd();
                }
              }}
              onKeyDown={(e) => {
                // Применяем размер при нажатии Enter
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur(); // Триггерит onBlur, который применит размер
                }
                // Останавливаем всплытие чтобы не мешать другим обработчикам
                e.stopPropagation();
              }}
              onWheel={(e) => {
                // Предотвращаем изменение значения при прокрутке колесиком мыши
                e.currentTarget.blur();
              }}
              onFocus={(e) => {
                // Сохраняем выделение при получении фокуса input
                onInteractionStart();
              }}
              onMouseDown={(e) => {
                // Предотвращаем изменение значения при клике на стрелки spinner
                const target = e.target as HTMLInputElement;
                const rect = target.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                const inputHeight = rect.height;

                // Если клик в верхней или нижней части (где обычно находятся стрелки)
                // и это не сам input, то предотвращаем действие
                if (clickY < inputHeight * 0.3 || clickY > inputHeight * 0.7) {
                  // Проверяем, что это не клик на сам текст input
                  const selectionStart = target.selectionStart;
                  const selectionEnd = target.selectionEnd;
                  // Если нет выделения текста, значит это клик на стрелки
                  if (selectionStart === selectionEnd) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Фокусируем input без изменения значения
                    target.focus();
                    onInteractionStart();
                    return;
                  }
                }
                // Только останавливаем всплытие, НЕ используем preventDefault - это мешает вводу
                e.stopPropagation();
                onInteractionStart();
              }}
              className="w-10 text-xs border-0 rounded px-1 py-0.5 bg-transparent focus:outline-none focus:bg-slate-50 nodrag text-center cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{
                MozAppearance: 'textfield',
              }}
              min="8"
              max="500"
              step="1"
            />
            {/* Кнопка для открытия dropdown */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onInteractionStart();
                setIsFontSizeOpen(!isFontSizeOpen);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex items-center justify-center w-3 h-3 rounded hover:bg-slate-100 transition-colors nodrag ml-0.5"
              title="Font size options"
              aria-label="Font size options"
            >
              <CaretDown size={8} className="text-slate-600" />
            </button>
            {isFontSizeOpen && (
              <div
                className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 min-w-[80px] max-h-[300px] overflow-y-auto"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
              >
                {fontSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFontSizeSelect(size);
                    }}
                    onMouseDown={(e) => {
                      // Предотвращаем всплытие чтобы handleClickOutside не закрыл dropdown
                      e.stopPropagation();
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 first:rounded-t-md last:rounded-b-md transition-colors nodrag ${
                      size === fontSize ? 'bg-slate-100 font-medium' : ''
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <button
              type="button"
              onClick={handleFontSizeIncrease}
              onMouseDown={(e) => {
                e.preventDefault();
                onInteractionStart();
              }}
              className="flex items-center justify-center w-4 h-3 rounded hover:bg-slate-100 transition-colors nodrag"
              title="Increase font size"
              aria-label="Increase font size"
            >
              <CaretUp size={10} className="text-slate-600" />
            </button>
            <button
              type="button"
              onClick={handleFontSizeDecrease}
              onMouseDown={(e) => {
                e.preventDefault();
                onInteractionStart();
              }}
              className="flex items-center justify-center w-4 h-3 rounded hover:bg-slate-100 transition-colors nodrag"
              title="Decrease font size"
              aria-label="Decrease font size"
            >
              <CaretDown size={10} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        {/* Font Style: Bold */}
        <button
          type="button"
          onClick={handleBoldToggle}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            isBold ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Bold"
          aria-label="Toggle bold"
        >
          <span className="text-sm font-bold">B</span>
        </button>

        {/* Font Style: Italic */}
        <button
          type="button"
          onClick={handleItalicToggle}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            isItalic ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Italic"
          aria-label="Toggle italic"
        >
          <span className="text-sm italic">I</span>
        </button>

        {/* Font Style: Underline */}
        <button
          type="button"
          onClick={handleUnderlineToggle}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            isUnderline ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Underline"
          aria-label="Toggle underline"
        >
          <span className="text-sm underline">U</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        {/* Alignment: Left */}
        <button
          type="button"
          onClick={() => {
            onTextAlignChange('left');
            onInteractionEnd();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            textAlign === 'left'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Align left"
          aria-label="Align left"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 3h10M2 7h10M2 11h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Alignment: Center */}
        <button
          type="button"
          onClick={() => {
            onTextAlignChange('center');
            onInteractionEnd();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            textAlign === 'center'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Align center"
          aria-label="Align center"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 3h10M4 7h6M2 11h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Alignment: Right */}
        <button
          type="button"
          onClick={() => {
            onTextAlignChange('right');
            onInteractionEnd();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            textAlign === 'right'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Align right"
          aria-label="Align right"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 3h10M2 7h10M6 11h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        {/* Add List (Bullet List) */}
        <button
          type="button"
          onClick={handleBulletListToggle}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            isBulletList ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Bullet list"
          aria-label="Toggle bullet list"
        >
          <ListBullets size={16} weight={isBulletList ? 'fill' : 'regular'} />
        </button>

        {/* Insert Link */}
        <button
          type="button"
          onClick={handleLinkToggle}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            isLink ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Insert link"
          aria-label="Insert link"
        >
          <LinkIcon size={16} weight={isLink ? 'fill' : 'regular'} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-0.5" />

        {/* Text Color (A with underline) - с выпадающей палитрой */}
        <div ref={textColorRef} className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsTextColorOpen(!isTextColorOpen);
              setIsBackgroundColorOpen(false);
              onInteractionStart();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              onInteractionStart();
            }}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors nodrag text-slate-600 hover:bg-slate-50 relative"
            title="Text color"
            aria-label="Text color"
          >
            <span className="text-sm font-semibold">A</span>
            <div
              className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-0.5"
              style={{ backgroundColor: activeColor }}
            />
          </button>
          {isTextColorOpen && (
            <div
              className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50"
              style={{ minWidth: '120px' }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onColorChange(c);
                      setIsTextColorOpen(false);
                      onInteractionEnd();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded border transition-all nodrag ${
                      activeColor === c
                        ? 'border-black border-2 scale-110'
                        : 'border-slate-300 hover:scale-110'
                    }`}
                    aria-label={`Select text color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight Text */}
        <button
          type="button"
          onClick={handleHighlightToggle}
          onMouseDown={(e) => {
            e.preventDefault();
            onInteractionStart();
          }}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors nodrag ${
            isHighlight ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
          }`}
          title="Highlight text"
          aria-label="Highlight text"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 4L6 2L10 4L14 2L10 6L14 10L10 14L6 10L2 14L6 6L2 4Z"
              fill={isHighlight ? '#fef08a' : 'currentColor'}
              fillOpacity={isHighlight ? 1 : 0.3}
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Background Color - иконка с заливкой */}
        <div ref={backgroundColorRef} className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsBackgroundColorOpen(!isBackgroundColorOpen);
              setIsTextColorOpen(false);
              onInteractionStart();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              onInteractionStart();
            }}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors nodrag text-slate-600 hover:bg-slate-50 relative"
            title="Background color"
            aria-label="Background color"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                rx="1"
                fill={activeBackgroundColor === 'transparent' ? 'none' : activeBackgroundColor}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={activeBackgroundColor === 'transparent' ? '2 2' : '0'}
              />
            </svg>
          </button>
          {isBackgroundColorOpen && (
            <div
              className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50"
              style={{ minWidth: '120px' }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {/* Прозрачный фон */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onBackgroundColorChange('transparent');
                    setIsBackgroundColorOpen(false);
                    onInteractionEnd();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  className={`w-6 h-6 rounded border-2 transition-all nodrag flex items-center justify-center ${
                    activeBackgroundColor === 'transparent'
                      ? 'border-black scale-110'
                      : 'border-slate-300 hover:scale-110'
                  }`}
                  aria-label="Transparent background"
                  title="Transparent"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 1L11 11M11 1L1 11"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBackgroundColorChange(c);
                      setIsBackgroundColorOpen(false);
                      onInteractionEnd();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded border transition-all nodrag ${
                      activeBackgroundColor === c
                        ? 'border-black border-2 scale-110'
                        : 'border-slate-300 hover:scale-110'
                    }`}
                    aria-label={`Select background color ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeToolbar>
  );
}
