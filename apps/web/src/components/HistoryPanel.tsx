'use client';

import { ArrowCounterClockwise, ArrowClockwise, Trash, X } from '@phosphor-icons/react';
import { useCallback, useMemo } from 'react';
import type { UndoManager } from 'yjs';
import { useTranslation } from '../hooks/useTranslation';

export type HistoryPanelProps = {
  open: boolean;
  onClose: () => void;
  undoManager: UndoManager | null;
  undoStackLength: number;
  redoStackLength: number;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type HistoryEntry = { index: number; timestamp: number; stack: 'undo' | 'redo' };

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function HistoryPanel({
  open,
  onClose,
  undoManager,
  undoStackLength,
  redoStackLength,
  undo,
  redo,
  clear,
  canUndo,
  canRedo,
}: HistoryPanelProps) {
  const { t } = useTranslation();

  const entries = useMemo<HistoryEntry[]>(() => {
    if (!undoManager) return [];
    const result: HistoryEntry[] = [];

    undoManager.redoStack.forEach((item, i) => {
      const ts = (item.meta.get('timestamp') as number) ?? 0;
      result.push({ index: i, timestamp: ts, stack: 'redo' });
    });

    result.reverse();

    undoManager.undoStack.forEach((item, i) => {
      const ts = (item.meta.get('timestamp') as number) ?? 0;
      result.push({ index: i, timestamp: ts, stack: 'undo' });
    });

    result.sort((a, b) => b.timestamp - a.timestamp);
    return result;
  }, [undoManager, undoStackLength, redoStackLength]);

  const handleUndoToIndex = useCallback(
    (targetIndex: number) => {
      if (!undoManager) return;
      const steps = undoManager.undoStack.length - targetIndex;
      for (let i = 0; i < steps; i++) {
        if (undoManager.canUndo()) undoManager.undo();
      }
    },
    [undoManager],
  );

  if (!open) return null;

  return (
    <div className="absolute right-4 top-14 z-50 flex w-72 flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {t.boardMenu?.history ?? 'History'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          <ArrowCounterClockwise size={14} />
          {t.boardMenu?.undo ?? 'Undo'}
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={redo}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          <ArrowClockwise size={14} />
          {t.boardMenu?.redo ?? 'Redo'}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={entries.length === 0}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
        >
          <Trash size={14} />
          {t.boardMenu?.historyClear ?? 'Clear'}
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            {t.boardMenu?.historyEmpty ?? 'No history yet'}
          </p>
        ) : (
          <ul className="p-2">
            {entries.map((entry, i) => (
              <li
                key={`${entry.stack}-${entry.index}-${entry.timestamp}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-50"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    entry.stack === 'undo' ? 'bg-indigo-500' : 'bg-slate-300'
                  }`}
                />
                <span className="flex-1 text-slate-600">
                  {entry.stack === 'undo'
                    ? (t.boardMenu?.historyChange ?? 'Change')
                    : (t.boardMenu?.historyUndone ?? 'Undone')}{' '}
                  #{entry.index + 1}
                </span>
                <span className="text-slate-400">
                  {entry.timestamp ? formatTime(entry.timestamp) : '—'}
                </span>
                {entry.stack === 'undo' && (
                  <button
                    type="button"
                    onClick={() => handleUndoToIndex(entry.index)}
                    className="rounded p-0.5 text-slate-400 hover:text-indigo-600"
                    title={t.boardMenu?.historyUndoTo ?? 'Undo to here'}
                  >
                    <ArrowCounterClockwise size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
