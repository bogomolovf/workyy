import { NodeToolbar } from 'reactflow';

const fontSizes = [12, 14, 16, 18, 20, 24];

const fontFamilies = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Monaco, monospace', label: 'Monospace' },
];

type StickyFormatToolbarProps = {
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  onFontSizeChange?: (fontSize: number) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export function StickyFormatToolbar({
  fontSize,
  fontFamily,
  isBold,
  isItalic,
  onFontSizeChange = () => {},
  onFontFamilyChange = () => {},
  onBoldToggle = () => {},
  onItalicToggle = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
}: StickyFormatToolbarProps) {
  return (
    <NodeToolbar className="nodrag" offset={38}>
      <div
        className="flex items-center gap-1.5 rounded-md bg-white px-1.5 py-1 shadow-md border border-slate-200"
        onMouseDownCapture={(e) => {
          // Сохраняем выделение в capture фазе ДО того, как textarea потеряет фокус
          onInteractionStart();
        }}
        onMouseEnter={(e) => {
          // Сохраняем выделение когда мышь наводится на тулбар
          onInteractionStart();
        }}
      >
        {/* Font Size Selector */}
        <select
          value={fontSize}
          onChange={(e) => {
            onFontSizeChange(Number(e.target.value));
            // Восстанавливаем выделение после изменения
            setTimeout(() => onInteractionEnd(), 100);
          }}
          onBlur={() => {
            // Восстанавливаем выделение после закрытия select
            setTimeout(() => onInteractionEnd(), 100);
          }}
          className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            onFontFamilyChange(e.target.value);
            // Восстанавливаем выделение после изменения
            setTimeout(() => onInteractionEnd(), 100);
          }}
          onBlur={() => {
            // Восстанавливаем выделение после закрытия select
            setTimeout(() => onInteractionEnd(), 100);
          }}
          className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Divider */}
        <div className="w-px h-3 bg-slate-300" />

        {/* Bold Button */}
        <button
          type="button"
          onClick={(e) => {
            // Используем onClick вместо onMouseDown для более надежного срабатывания
            e.preventDefault();
            e.stopPropagation();
            onBoldToggle();
            // Восстанавливаем выделение после переключения
            setTimeout(() => onInteractionEnd(), 50);
          }}
          onMouseDown={(e) => {
            // Предотвращаем потерю фокуса textarea при клике на кнопку
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

        {/* Italic Button */}
        <button
          type="button"
          onClick={(e) => {
            // Используем onClick вместо onMouseDown для более надежного срабатывания
            e.preventDefault();
            e.stopPropagation();
            onItalicToggle();
            // Восстанавливаем выделение после переключения
            setTimeout(() => onInteractionEnd(), 50);
          }}
          onMouseDown={(e) => {
            // Предотвращаем потерю фокуса textarea при клике на кнопку
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
      </div>
    </NodeToolbar>
  );
}
