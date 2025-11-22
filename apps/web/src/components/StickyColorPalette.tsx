import { NodeToolbar } from "reactflow";

const colors = [
  "#FFB3BA", // пастельный розовый
  "#FFDFBA", // пастельный персиковый
  "#FFFFBA", // пастельный желтый
  "#BAFFC9", // пастельный мятный
  "#BAE1FF", // пастельный голубой
  "#E0BBE4", // пастельный лавандовый
];

type StickyColorPaletteProps = {
  activeColor: string;
  onColorChange?: (color: string) => void;
};

export function StickyColorPalette({
  onColorChange = () => {},
  activeColor,
}: StickyColorPaletteProps) {
  return (
    <NodeToolbar className="nodrag" offset={8}>
      <div className="flex gap-1.5 rounded-md bg-white px-1.5 py-1 shadow-md border border-slate-200">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
            className={`color-swatch ${color === activeColor ? "active" : ""}`}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
    </NodeToolbar>
  );
}

