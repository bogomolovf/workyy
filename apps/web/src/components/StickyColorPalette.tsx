import { NodeToolbar } from "reactflow";

const colors = [
  "#CF4C2C", // orange-red
  "#EA9C41", // orange
  "#EBC347", // yellow
  "#438D57", // green
  "#3F8AE2", // blue
  "#803DEC", // purple
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

