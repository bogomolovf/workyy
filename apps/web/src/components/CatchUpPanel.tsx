'use client';

import { ArrowRight, CheckCircle, X } from '@phosphor-icons/react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useBoardCanvasApiStore } from '../state/boardCanvasApiStore';
import { useBoardSettingsStore } from '../state/boardSettingsStore';

type CatchUpItem = {
  id: string;
  label: string;
  type: string;
  status: 'added' | 'removed';
  position?: { x: number; y: number };
};

export type CatchUpPanelProps = {
  boardId: string;
  open: boolean;
  onClose: () => void;
};

export function CatchUpPanel({ boardId, open, onClose }: CatchUpPanelProps) {
  const { t } = useTranslation();
  const previousNodeIds = useBoardSettingsStore((s) => s.getNodeIdsAtLastVisit(boardId));
  const getNodes = useBoardCanvasApiStore((s) => s.getNodes);
  const setCenter = useBoardCanvasApiStore((s) => s.setCenter);
  const fitView = useBoardCanvasApiStore((s) => s.fitView);

  const items = useMemo<CatchUpItem[]>(() => {
    if (!getNodes) return [];
    const currentNodes = getNodes();
    const prevSet = new Set(previousNodeIds);
    const currentSet = new Set(currentNodes.map((n) => n.id));
    const result: CatchUpItem[] = [];

    for (const node of currentNodes) {
      if (!prevSet.has(node.id)) {
        result.push({
          id: node.id,
          label: (node.data as { label?: string })?.label ?? node.type ?? 'Node',
          type: node.type ?? 'unknown',
          status: 'added',
          position: node.position,
        });
      }
    }
    for (const prevId of previousNodeIds) {
      if (!currentSet.has(prevId)) {
        result.push({ id: prevId, label: prevId.slice(0, 8), type: 'unknown', status: 'removed' });
      }
    }
    return result;
  }, [getNodes, previousNodeIds]);

  const handleGoTo = useCallback(
    (item: CatchUpItem) => {
      if (item.position && setCenter) {
        setCenter(item.position.x + 150, item.position.y + 50, { zoom: 1.2, duration: 400 });
      }
    },
    [setCenter],
  );

  const handleFitAll = useCallback(() => {
    fitView?.();
    onClose();
  }, [fitView, onClose]);

  if (!open) return null;

  const hasChanges = items.length > 0;

  return (
    <div className="absolute left-4 top-14 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {t.boardMenu?.catchUp ?? 'Catch up'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      {hasChanges ? (
        <ul className="max-h-60 overflow-y-auto p-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  item.status === 'added' ? 'bg-emerald-500' : 'bg-red-400'
                }`}
              />
              <span className="flex-1 truncate text-slate-700">
                {item.label} <span className="text-xs text-slate-400">({item.type})</span>
              </span>
              {item.status === 'added' && item.position && (
                <button
                  type="button"
                  onClick={() => handleGoTo(item)}
                  className="rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                  title={t.boardMenu?.catchUpGoTo ?? 'Go to'}
                >
                  <ArrowRight size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <CheckCircle size={32} className="text-emerald-500" />
          <p className="text-sm text-slate-500">
            {t.boardMenu?.catchUpAllCaughtUp ?? 'All caught up!'}
          </p>
        </div>
      )}

      <div className="border-t border-slate-100 px-4 py-2">
        <button
          type="button"
          onClick={handleFitAll}
          className="w-full rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          {t.boardMenu?.catchUpFitView ?? 'Fit all to view'}
        </button>
      </div>
    </div>
  );
}
