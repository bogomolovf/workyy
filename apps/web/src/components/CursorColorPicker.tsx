'use client';

import { Cursor } from '@phosphor-icons/react';
import { useTranslation } from '../hooks/useTranslation';
import {
  CURSOR_COLORS,
  DEFAULT_CURSOR,
  useCursorSettingsStore,
} from '../state/cursorSettingsStore';

export function CursorColorPicker() {
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);
  const setCursorColor = useCursorSettingsStore((s) => s.setCursorColor);
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Cursor
          size={18}
          weight="fill"
          style={{
            color: cursorColor === DEFAULT_CURSOR ? '#94a3b8' : cursorColor,
          }}
        />
        <span className="hidden sm:inline">{t.cursorColor}</span>
      </div>
      <div className="flex gap-1.5 items-center">
        {/* White circle = standard system cursor — no overlay */}
        <button
          type="button"
          onClick={() => setCursorColor(DEFAULT_CURSOR)}
          className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 bg-white ${
            cursorColor === DEFAULT_CURSOR
              ? 'border-slate-800 ring-2 ring-slate-300'
              : 'border-slate-200 shadow-sm'
          }`}
          title={t.defaultCursor}
          aria-label={t.defaultCursor}
        />
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
            title={t.selectColor(color)}
            aria-label={t.selectColor(color)}
          />
        ))}
      </div>
    </div>
  );
}
