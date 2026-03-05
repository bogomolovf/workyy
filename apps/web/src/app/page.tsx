'use client';

import { CaretRight, DotsThree, Users, Star, SquaresFour, List } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { RequireAuth } from '../components/RequireAuth';
import { SettingsButton } from '../components/settings';
import { WorkspaceMembers } from '../components/WorkspaceMembers';
import { useTranslation } from '../hooks/useTranslation';
import {
  BoardSummary,
  createBoard,
  deleteBoard,
  fetchBoard,
  fetchBoards,
  updateBoardMetadata,
} from '../lib/api';
import { LANDING_URL } from '../lib/appConfig';
import { useAuthStore } from '../state/authStore';
import { useBoardSettingsStore } from '../state/boardSettingsStore';
import { useToastStore } from '../state/toastStore';

const DEFAULT_WORKSPACE_ID = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? '';

function HomePageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { t, locale } = useTranslation();
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showWorkspaceMembers, setShowWorkspaceMembers] = useState(false);
  const toggleStarred = useBoardSettingsStore((s) => s.toggleStarred);
  const starredBoardIds = useBoardSettingsStore((s) => s.starredBoardIds);
  const lastVisitedAtByBoardId = useBoardSettingsStore((s) => s.lastVisitedAtByBoardId);
  const boardsListView = useBoardSettingsStore((s) => s.boardsListView);
  const setBoardsListView = useBoardSettingsStore((s) => s.setBoardsListView);
  const showToast = useToastStore((s) => s.show);

  const {
    data: boards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['boards'],
    queryFn: () => fetchBoards(),
  });

  const sortedBoards = useMemo(() => {
    if (!boards || boards.length === 0) return boards ?? [];
    return [...boards].sort((a, b) => {
      const aStarred = starredBoardIds.includes(a.id);
      const bStarred = starredBoardIds.includes(b.id);
      if (aStarred !== bStarred) return aStarred ? -1 : 1;
      const aTime = lastVisitedAtByBoardId[a.id] ?? new Date(a.updatedAt).getTime();
      const bTime = lastVisitedAtByBoardId[b.id] ?? new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [boards, starredBoardIds, lastVisitedAtByBoardId]);

  const workspaceIdForCreation = useMemo(() => {
    // Use user's first workspace if available
    if (user?.workspaces && user.workspaces.length > 0) {
      return user.workspaces[0].id;
    }
    // Fallback to default workspace ID from env
    if (DEFAULT_WORKSPACE_ID) {
      return DEFAULT_WORKSPACE_ID;
    }
    // Fallback to first board's workspace
    if (boards && boards.length > 0) {
      return boards[0].workspaceId;
    }
    return null;
  }, [boards, user]);

  const createBoardMutation = useMutation({
    mutationFn: ({ workspaceId, title }: { workspaceId: string; title: string }) =>
      createBoard({ workspaceId, title }),
    onSuccess: async (board) => {
      setTitle('');
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      router.push(`/board/${board.id}`);
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : t.createBoardError);
    },
  });

  const renameBoardMutation = useMutation({
    mutationFn: ({ boardId, title }: { boardId: string; title: string }) =>
      updateBoardMetadata(boardId, { title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (error: unknown) => {
      showToast(error instanceof Error ? error.message : 'Failed to rename', 'error');
    },
  });

  const duplicateBoardMutation = useMutation({
    mutationFn: ({ workspaceId, title }: { workspaceId: string; title: string }) =>
      createBoard({ workspaceId, title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      showToast('Board duplicated', 'success');
    },
    onError: (error: unknown) => {
      showToast(error instanceof Error ? error.message : 'Failed to duplicate', 'error');
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onMutate: async (boardId) => {
      // Отменяем текущие запросы для отмены устаревших обновлений
      await queryClient.cancelQueries({ queryKey: ['boards'] });

      // Сохраняем предыдущее значение для отката
      const previousBoards = queryClient.getQueryData<BoardSummary[]>(['boards']);

      // Оптимистично обновляем кэш, удаляя доску из списка
      queryClient.setQueryData<BoardSummary[]>(['boards'], (old) => {
        if (!old) return old;
        return old.filter((board) => board.id !== boardId);
      });

      // Возвращаем контекст для отката
      return { previousBoards };
    },
    onError: (error: unknown, boardId, context) => {
      // В случае ошибки откатываем изменения
      if (context?.previousBoards) {
        queryClient.setQueryData(['boards'], context.previousBoards);
      }
      console.error('Failed to delete board:', error);
    },
    onSettled: async () => {
      // В любом случае обновляем данные с сервера
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextWorkspace = workspaceIdForCreation;

    if (!nextWorkspace) {
      setFormError(t.workspaceNotFound);
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError(t.enterBoardTitle);
      return;
    }

    setFormError(null);
    createBoardMutation.mutate({
      workspaceId: nextWorkspace,
      title: trimmedTitle,
    });
  };

  const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';

  const renderBoards = (items: BoardSummary[] | undefined) => {
    if (isLoading) {
      return (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 text-sm text-slate-500">
          {t.loadingBoards}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
          {t.loadBoardsError}
        </div>
      );
    }

    if (!items || items.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white/80 px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          {t.noBoards}
        </div>
      );
    }

    const isList = boardsListView === 'list';

    return (
      <ul className={isList ? 'flex flex-col gap-2' : 'grid gap-4 md:grid-cols-2'}>
        {items.map((board) => {
          const updated = new Date(board.updatedAt);
          return (
            <li key={board.id} className="group relative">
              <div
                className={`relative ${isList ? 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-indigo-300' : ''}`}
              >
                <Link
                  href={`/board/${board.id}`}
                  className={
                    isList
                      ? 'flex flex-1 min-w-0 items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1 rounded'
                      : 'block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
                  }
                >
                  <h3
                    className={`text-base font-semibold text-slate-900 truncate ${isList ? 'flex-1 min-w-0' : ''}`}
                  >
                    {board.title}
                  </h3>
                  <div className={isList ? 'flex-shrink-0' : 'mt-4'}>
                    <p className="text-xs text-slate-500">
                      {t.updated}:{' '}
                      {Number.isNaN(updated.getTime()) ? '—' : updated.toLocaleString(localeTag)}
                    </p>
                  </div>
                </Link>
                <div
                  className={`z-10 flex items-center gap-1 ${isList ? 'flex-shrink-0' : 'absolute right-2 top-2'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggleStarred(board.id);
                      const nowStarred = useBoardSettingsStore.getState().isStarred(board.id);
                      showToast(nowStarred ? 'Board starred' : 'Board unstarred', 'success');
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                      starredBoardIds.includes(board.id)
                        ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        : 'bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                    title={
                      starredBoardIds.includes(board.id)
                        ? t.boardMenu.unstarBoard
                        : t.boardMenu.starBoard
                    }
                  >
                    <Star
                      size={14}
                      weight={starredBoardIds.includes(board.id) ? 'fill' : 'regular'}
                    />
                  </button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        disabled={deleteBoardMutation.isPending}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-sm transition hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t.boardMenuTitle}
                      >
                        <DotsThree size={14} weight="bold" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="min-w-[11rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                        sideOffset={6}
                        align="end"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <DropdownMenu.Sub>
                          <DropdownMenu.SubTrigger className="flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100 [&>svg]:ml-auto">
                            {t.boardMenu.share}
                            <CaretRight size={14} />
                          </DropdownMenu.SubTrigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.SubContent
                              className="min-w-[11rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                              sideOffset={4}
                              alignOffset={-4}
                            >
                              <DropdownMenu.Item
                                className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                                onSelect={() => {
                                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${board.id}`;
                                  navigator.clipboard.writeText(url).then(
                                    () => showToast('Link copied', 'success'),
                                    () => showToast('Failed to copy', 'error'),
                                  );
                                }}
                              >
                                {t.boardMenu.copyBoardLink}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                                onSelect={() => {
                                  window.open(
                                    `/board/${board.id}`,
                                    '_blank',
                                    'noopener,noreferrer',
                                  );
                                }}
                              >
                                {t.boardMenu.openInNewTab}
                              </DropdownMenu.Item>
                            </DropdownMenu.SubContent>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Sub>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                          onSelect={() => {
                            toggleStarred(board.id);
                            const nowStarred = useBoardSettingsStore.getState().isStarred(board.id);
                            showToast(nowStarred ? 'Board starred' : 'Board unstarred', 'success');
                          }}
                        >
                          {starredBoardIds.includes(board.id)
                            ? t.boardMenu.unstarBoard
                            : t.boardMenu.starBoard}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                          onSelect={() => {
                            const newTitle = window.prompt(t.boardMenu.rename, board.title);
                            if (newTitle != null && newTitle.trim()) {
                              renameBoardMutation.mutate({
                                boardId: board.id,
                                title: newTitle.trim(),
                              });
                            }
                          }}
                        >
                          {t.boardMenu.rename}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                          onSelect={() => {
                            const defaultTitle = `${board.title} (copy)`;
                            const newTitle = window.prompt(
                              t.boardMenu.duplicateBoardNamePrompt,
                              defaultTitle,
                            );
                            if (newTitle != null && newTitle.trim()) {
                              const wsId = board.workspaceId || workspaceIdForCreation;
                              if (wsId) {
                                duplicateBoardMutation.mutate({
                                  workspaceId: wsId,
                                  title: newTitle.trim(),
                                });
                              }
                            }
                          }}
                        >
                          {t.boardMenu.duplicate}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-500 outline-none data-[highlighted]:bg-slate-100"
                          disabled
                        >
                          {t.boardMenu.changeThumbnail}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                          onSelect={() => showToast(`${board.title} • ${board.id}`, 'info')}
                        >
                          {t.boardMenu.details}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-500 outline-none data-[highlighted]:bg-slate-100"
                          disabled
                        >
                          {t.boardMenu.makeBoardPrivate}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                          onSelect={async () => {
                            try {
                              const data = await fetchBoard(board.id);
                              const backup = {
                                version: 1,
                                boardId: board.id,
                                boardTitle: board.title,
                                exportedAt: new Date().toISOString(),
                                nodes: data.nodes,
                                edges: data.edges,
                              };
                              const blob = new Blob([JSON.stringify(backup, null, 2)], {
                                type: 'application/json',
                              });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.download = `board-backup-${board.id.slice(0, 8)}.json`;
                              link.href = url;
                              link.click();
                              URL.revokeObjectURL(url);
                              showToast('Backup downloaded', 'success');
                            } catch (e) {
                              showToast(
                                e instanceof Error ? e.message : 'Failed to download',
                                'error',
                              );
                            }
                          }}
                        >
                          {t.boardMenu.downloadBackup}
                        </DropdownMenu.Item>
                        <DropdownMenu.Sub>
                          <DropdownMenu.SubTrigger className="flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-500 outline-none data-[highlighted]:bg-slate-100 [&>svg]:ml-auto">
                            {t.boardMenu.moveToTeam}
                            <CaretRight size={14} />
                          </DropdownMenu.SubTrigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.SubContent
                              className="min-w-[11rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                              sideOffset={4}
                              alignOffset={-4}
                            >
                              <DropdownMenu.Item
                                className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-500 outline-none"
                                disabled
                              >
                                {t.boardMenu.notSupportedYet}
                              </DropdownMenu.Item>
                            </DropdownMenu.SubContent>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Sub>
                        <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-rose-600 outline-none data-[highlighted]:bg-rose-50"
                          onSelect={() => {
                            if (window.confirm(t.deleteBoardConfirm(board.title))) {
                              deleteBoardMutation.mutate(board.id);
                            }
                          }}
                        >
                          {t.deleteBoard}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-500 outline-none data-[highlighted]:bg-slate-100"
                          disabled
                        >
                          {t.boardMenu.leave}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <header className="text-center">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <a
                href={LANDING_URL}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {t.backToWebsite}
              </a>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <SettingsButton />
              </div>
            )}
          </div>
          <h1 className="text-4xl font-semibold">{t.workyyMvp}</h1>
          <p className="mt-3 text-lg text-slate-600">{t.tagline}</p>
        </header>

        <div className="mt-12 rounded-3xl bg-white/90 p-8 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{t.yourBoards}</h2>
                <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setBoardsListView('grid')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      boardsListView === 'grid'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    title={t.gridView}
                    aria-label={t.gridView}
                    aria-pressed={boardsListView === 'grid'}
                  >
                    <SquaresFour size={18} weight="fill" />
                    {t.gridView}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardsListView('list')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      boardsListView === 'list'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    title={t.listView}
                    aria-label={t.listView}
                    aria-pressed={boardsListView === 'list'}
                  >
                    <List size={18} weight="fill" />
                    {t.listView}
                  </button>
                </div>
                {workspaceIdForCreation && (
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceMembers(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    title={t.manageMembers}
                  >
                    <Users size={18} />
                    {t.participants}
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{t.boardsDescription}</p>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:w-auto md:flex-row md:items-center"
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.newBoardPlaceholder}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 md:w-72"
              />
              <button
                type="submit"
                disabled={createBoardMutation.isPending || !workspaceIdForCreation}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
              >
                {createBoardMutation.isPending ? t.creating : t.create}
              </button>
            </form>
          </div>

          {formError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {formError}
            </div>
          )}

          <div className="mt-8">{renderBoards(sortedBoards)}</div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">{t.demoDataNote}</p>
      </section>

      {/* Workspace Members Modal */}
      {showWorkspaceMembers && workspaceIdForCreation && (
        <WorkspaceMembers
          workspaceId={workspaceIdForCreation}
          onClose={() => setShowWorkspaceMembers(false)}
        />
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomePageContent />
    </RequireAuth>
  );
}
