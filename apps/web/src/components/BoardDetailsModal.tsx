'use client';

import { X, Copy, ArrowSquareOut } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useBoardCanvasApiStore } from '../state/boardCanvasApiStore';
import { useToastStore } from '../state/toastStore';

export type BoardDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  boardId: string;
  boardTitle: string | null | undefined;
  workspaceId: string;
  createdAt?: string | null;
  collaboratorsCount?: number;
};

export function BoardDetailsModal({
  open,
  onClose,
  boardId,
  boardTitle,
  workspaceId,
  createdAt,
  collaboratorsCount,
}: BoardDetailsModalProps) {
  const { t } = useTranslation();
  const getNodes = useBoardCanvasApiStore((s) => s.getNodes);
  const getEdges = useBoardCanvasApiStore((s) => s.getEdges);

  const nodeCount = getNodes?.()?.length ?? 0;
  const edgeCount = getEdges?.()?.length ?? 0;

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(boardId).then(() => {
      useToastStore.getState().show('Board ID copied', 'success');
    });
  }, [boardId]);

  if (!open) return null;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: t.boardMenu?.detailsTitle ?? 'Title',
      value: boardTitle ?? 'Untitled',
    },
    {
      label: t.boardMenu?.detailsBoardId ?? 'Board ID',
      value: (
        <span className="flex items-center gap-1">
          <code className="text-xs">{boardId.slice(0, 12)}…</code>
          <button
            type="button"
            onClick={handleCopyId}
            className="rounded p-0.5 text-slate-400 hover:text-indigo-600"
          >
            <Copy size={12} />
          </button>
        </span>
      ),
    },
    {
      label: t.boardMenu?.detailsWorkspace ?? 'Workspace',
      value: workspaceId.slice(0, 12) + '…',
    },
    {
      label: t.boardMenu?.detailsNodes ?? 'Nodes',
      value: nodeCount,
    },
    {
      label: t.boardMenu?.detailsEdges ?? 'Edges',
      value: edgeCount,
    },
    ...(collaboratorsCount != null
      ? [
          {
            label: t.boardMenu?.detailsCollaborators ?? 'Online',
            value: collaboratorsCount,
          },
        ]
      : []),
    ...(createdAt
      ? [
          {
            label: t.boardMenu?.detailsCreatedAt ?? 'Created',
            value: new Date(createdAt).toLocaleDateString(),
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {t.boardMenu?.details ?? 'Details'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{row.label}</td>
                  <td className="py-2 font-medium text-slate-900">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/board/${boardId}`;
              navigator.clipboard.writeText(url).then(() => {
                useToastStore
                  .getState()
                  .show(t.boardMenu?.copyBoardLink ?? 'Link copied', 'success');
              });
            }}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <ArrowSquareOut size={14} />
            {t.boardMenu?.copyBoardLink ?? 'Copy board link'}
          </button>
        </div>
      </div>
    </div>
  );
}
