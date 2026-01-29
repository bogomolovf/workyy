'use client';

import { memo } from 'react';
import { ArrowCounterClockwise, ArrowClockwise } from '@phosphor-icons/react';

type UndoRedoControlsProps = {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Undo/Redo controls for the board header
 * 
 * Key features:
 * - Per-user undo/redo (only undoes your own changes)
 * - Positioned in the top area of the board
 * - Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
 */
export const UndoRedoControls = memo(function UndoRedoControls({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: UndoRedoControlsProps) {
  const baseButtonClass = `
    flex items-center justify-center
    w-8 h-8 rounded-md
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
  `;

  const enabledClass = `
    bg-white border border-slate-200
    text-slate-600 hover:text-slate-900
    hover:bg-slate-50 hover:border-slate-300
    active:bg-slate-100
    shadow-sm
  `;

  const disabledClass = `
    bg-slate-50 border border-slate-100
    text-slate-300
    cursor-not-allowed
  `;

  return (
    <div className="flex items-center gap-1 px-1">
      <button
        type="button"
        onClick={() => {
          if (canUndo) {
            onUndo();
          }
        }}
        disabled={!canUndo}
        className={`${baseButtonClass} ${canUndo ? enabledClass : disabledClass}`}
        title="Undo your last change (Ctrl+Z)"
        aria-label="Undo"
      >
        <ArrowCounterClockwise size={16} weight="bold" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (canRedo) {
            onRedo();
          }
        }}
        disabled={!canRedo}
        className={`${baseButtonClass} ${canRedo ? enabledClass : disabledClass}`}
        title="Redo your last undone change (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <ArrowClockwise size={16} weight="bold" />
      </button>
    </div>
  );
});
