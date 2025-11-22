import { NodeToolbar } from "reactflow";

const fontSizes = [28, 32, 36, 40, 44, 48];

const fontFamilies = [
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Monaco, monospace", label: "Monospace" },
];

const colors = [
  "#FFB3BA", // пастельный розовый
  "#FFDFBA", // пастельный персиковый
  "#FFFFBA", // пастельный желтый
  "#BAFFC9", // пастельный мятный
  "#BAE1FF", // пастельный голубой
  "#E0BBE4", // пастельный лавандовый
];

type StickyToolbarProps = {
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  activeColor: string;
  onFontSizeChange?: (fontSize: number) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
  onBoldToggle?: () => void;
  onItalicToggle?: () => void;
  onColorChange?: (color: string) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export function StickyToolbar({
  fontSize,
  fontFamily,
  isBold,
  isItalic,
  activeColor,
  onFontSizeChange = () => {},
  onFontFamilyChange = () => {},
  onBoldToggle = () => {},
  onItalicToggle = () => {},
  onColorChange = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
}: StickyToolbarProps) {
  return (
    <NodeToolbar className="nodrag" offset={8}>
      <div
        className="flex flex-col gap-2 rounded-lg bg-white px-2 py-2 shadow-lg border border-slate-200"
        onMouseDownCapture={(e) => {
          onInteractionStart();
        }}
        onMouseEnter={(e) => {
          onInteractionStart();
        }}
      >
        {/* Верхний уровень: Настройки шрифтов */}
        <div className="flex items-center gap-1.5">
          {/* Font Size Selector */}
          <select
            value={fontSize}
            onChange={(e) => {
              onFontSizeChange(Number(e.target.value));
              setTimeout(() => onInteractionEnd(), 100);
            }}
            onBlur={() => {
              setTimeout(() => onInteractionEnd(), 100);
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
              onFontFamilyChange(e.target.value);
              setTimeout(() => onInteractionEnd(), 100);
            }}
            onBlur={() => {
              setTimeout(() => onInteractionEnd(), 100);
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

          {/* Bold Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBoldToggle();
              setTimeout(() => onInteractionEnd(), 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-colors nodrag ${
              isBold
                ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
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
              e.preventDefault();
              e.stopPropagation();
              onItalicToggle();
              setTimeout(() => onInteractionEnd(), 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            className={`px-1.5 py-0.5 rounded text-xs italic transition-colors nodrag ${
              isItalic
                ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
            title="Italic"
            aria-label="Toggle italic"
          >
            I
          </button>
        </div>

        {/* Нижний уровень: Палитра цветов */}
        <div className="flex items-center gap-1.5">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onColorChange(color);
                setTimeout(() => onInteractionEnd(), 50);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              style={{ backgroundColor: color }}
              className={`color-swatch nodrag ${color === activeColor ? "active" : ""}`}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>
    </NodeToolbar>
  );
}

