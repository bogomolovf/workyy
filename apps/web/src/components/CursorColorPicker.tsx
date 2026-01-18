'use client';

import { Cursor } from '@phosphor-icons/react';
import { CURSOR_COLORS, useCursorSettingsStore } from '../state/cursorSettingsStore';

export function CursorColorPicker() {
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);
  const setCursorColor = useCursorSettingsStore((s) => s.setCursorColor);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Cursor size={18} weight="fill" style={{ color: cursorColor }} />
        <span className="hidden sm:inline">Цвет курсора:</span>
      </div>
      <div className="flex gap-1.5">
        {CURSOR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setCursorColor(color)}
            className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 ${
              cursorColor === color
                ? 'border-slate-800 ring-2 ring-slate-300'
                : 'border-white shadow-sm'
            }`}
            style={{ backgroundColor: color }}
            title={`Выбрать цвет ${color}`}
            aria-label={`Выбрать цвет курсора ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
