'use client';


import { DotsThree } from '@phosphor-icons/react';
import { useCallback } from 'react';
import type { BoardMenuContext } from '../../features/boardMenu/boardMenuActions';
import { useTranslation } from '../../hooks/useTranslation';
import { BoardMenu } from './BoardMenu';

export type BoardMenuButtonProps = Omit<BoardMenuContext, 'onCloseMenu'>;

export function BoardMenuButton(props: BoardMenuButtonProps) {
  const { t } = useTranslation();
  const handleDeleteBoard = useCallback(() => {
    if (typeof window !== 'undefined' && window.confirm(t.deleteCurrentBoardConfirm)) {
      props.onDeleteBoard(props.boardId);
    }
  }, [props.boardId, props.onDeleteBoard, t]);

  const menuContext: Omit<BoardMenuContext, 'onCloseMenu'> = {
    ...props,
    onDeleteBoard: handleDeleteBoard,
  };

  const trigger = (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1"
      aria-label={t.boardMenuTitle}
      title={t.boardMenuTitle}
    >
      <DotsThree size={20} weight="bold" />
    </button>
  );

  return <BoardMenu trigger={trigger} menuContext={menuContext} />;
}
