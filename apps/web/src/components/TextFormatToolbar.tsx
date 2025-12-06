import { NodeToolbar } from 'reactflow';

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const fontFamilies = [
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

type TextFormatToolbarProps = {
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  onFontSizeChange?: (fontSize: number) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
  onColorChange?: (color: string) => void;
  onTextAlignChange?: (textAlign: 'left' | 'center' | 'right') => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

export function TextFormatToolbar({
  fontSize,
  fontFamily,
  color,
  textAlign,
  onFontSizeChange = () => {},
  onFontFamilyChange = () => {},
  onColorChange = () => {},
  onTextAlignChange = () => {},
  onInteractionStart = () => {},
  onInteractionEnd = () => {},
}: TextFormatToolbarProps) {
  return (
    <NodeToolbar className="nodrag" offset={8}>
      <div
        className="flex items-center gap-1.5 rounded-md bg-white px-1.5 py-1 shadow-md border border-slate-200"
        onMouseDownCapture={(e) => {
          onInteractionStart();
        }}
        onMouseEnter={(e) => {
          onInteractionStart();
        }}
      >
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
            setTimeout(() => onInteractionEnd(), 100);
          }}
          onBlur={() => {
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

        {/* Color Swatches */}
        <div className="flex gap-1">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onColorChange(c);
                setTimeout(() => onInteractionEnd(), 50);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              style={{ backgroundColor: c }}
              className={`w-4 h-4 rounded border transition-all ${
                color === c ? 'border-black border-2' : 'border-slate-300 hover:scale-110'
              }`}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-3 bg-slate-300" />

        {/* Text Align Buttons */}
        <div className="flex gap-0.5 border border-slate-300 rounded overflow-hidden">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTextAlignChange('left');
              setTimeout(() => onInteractionEnd(), 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            className={`px-1.5 py-0.5 text-xs transition-colors ${
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
              onTextAlignChange('center');
              setTimeout(() => onInteractionEnd(), 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            className={`px-1.5 py-0.5 text-xs transition-colors border-l border-r border-slate-300 ${
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
              onTextAlignChange('right');
              setTimeout(() => onInteractionEnd(), 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            className={`px-1.5 py-0.5 text-xs transition-colors ${
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
    </NodeToolbar>
  );
}
