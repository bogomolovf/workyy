'use client';

import {
  AlignLeft,
  AlignRight,
  AlignTop,
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Rows,
  Columns,
} from '@phosphor-icons/react';
import { useCallback, useMemo } from 'react';
import {
  alignLeft,
  alignRight,
  alignTop,
  alignBottom,
  alignCenterH,
  alignCenterV,
  distributeH,
  distributeV,
} from '../lib/alignmentUtils';
import { useBoardCanvasApiStore } from '../state/boardCanvasApiStore';

const DEFAULT_SIZE = 200;

export type AlignmentToolbarProps = {
  alignEnabled: boolean;
};

export function AlignmentToolbar({ alignEnabled }: AlignmentToolbarProps) {
  const getNodes = useBoardCanvasApiStore((s) => s.getNodes);
  const setNodes = useBoardCanvasApiStore((s) => s.setNodes);

  const selectedNodes = useMemo(() => {
    if (!getNodes) return [];
    return getNodes().filter((n) => n.selected);
  }, [getNodes]);

  const rects = useMemo(
    () =>
      selectedNodes.map((n) => ({
        id: n.id,
        position: n.position,
        width: (n.width as number) ?? DEFAULT_SIZE,
        height: (n.height as number) ?? DEFAULT_SIZE,
      })),
    [selectedNodes],
  );

  const applyAlignment = useCallback(
    (fn: typeof alignLeft) => {
      if (!setNodes || rects.length < 2) return;
      const updates = fn(rects);
      const updateMap = new Map(updates.map((u) => [u.id, u.position]));
      setNodes((prev) =>
        prev.map((n) => {
          const pos = updateMap.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }),
      );
    },
    [setNodes, rects],
  );

  if (!alignEnabled || selectedNodes.length < 2) return null;

  const btnClass =
    'rounded p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors';

  return (
    <div className="absolute bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-lg">
      <button
        type="button"
        className={btnClass}
        onClick={() => applyAlignment(alignLeft)}
        title="Align left"
      >
        <AlignLeft size={16} />
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={() => applyAlignment(alignCenterH)}
        title="Align center horizontal"
      >
        <AlignCenterHorizontal size={16} />
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={() => applyAlignment(alignRight)}
        title="Align right"
      >
        <AlignRight size={16} />
      </button>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <button
        type="button"
        className={btnClass}
        onClick={() => applyAlignment(alignTop)}
        title="Align top"
      >
        <AlignTop size={16} />
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={() => applyAlignment(alignCenterV)}
        title="Align center vertical"
      >
        <AlignCenterVertical size={16} />
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={() => applyAlignment(alignBottom)}
        title="Align bottom"
      >
        <AlignBottom size={16} />
      </button>
      {selectedNodes.length >= 3 && (
        <>
          <div className="mx-1 h-4 w-px bg-slate-200" />
          <button
            type="button"
            className={btnClass}
            onClick={() => applyAlignment(distributeH)}
            title="Distribute horizontal"
          >
            <Columns size={16} />
          </button>
          <button
            type="button"
            className={btnClass}
            onClick={() => applyAlignment(distributeV)}
            title="Distribute vertical"
          >
            <Rows size={16} />
          </button>
        </>
      )}
    </div>
  );
}
