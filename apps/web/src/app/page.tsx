'use client';

import {
  CaretRight,
  DotsThree,
  Kanban,
  List,
  SquaresFour,
  Star,
  Users,
} from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppSidebar } from '../components/AppSidebar';
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
import {
  createTracker,
  deleteTracker,
  fetchTrackers,
  type TrackerSummary,
} from '../lib/trackerApi';
import { useAuthStore } from '../state/authStore';
import { useBoardSettingsStore } from '../state/boardSettingsStore';
import { useTeamStore } from '../state/teamStore';
import { useToastStore } from '../state/toastStore';
import { useTrackerSettingsStore } from '../state/trackerSettingsStore';

function HomePageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { t, locale } = useTranslation();
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showWorkspaceMembers, setShowWorkspaceMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const toggleStarred = useBoardSettingsStore((s) => s.toggleStarred);
  const starredBoardIds = useBoardSettingsStore((s) => s.starredBoardIds);
  const lastVisitedAtByBoardId = useBoardSettingsStore((s) => s.lastVisitedAtByBoardId);
  const boardsListView = useBoardSettingsStore((s) => s.boardsListView);
  const setBoardsListView = useBoardSettingsStore((s) => s.setBoardsListView);
  const showToast = useToastStore((s) => s.show);
  const currentTeamId = useTeamStore((s) => s.currentTeamId);
  const sidebarView = useTeamStore((s) => s.sidebarView);
  const initCurrentTeam = useTeamStore((s) => s.initCurrentTeam);
  const [activeTab, setActiveTab] = useState<'boards' | 'trackers'>('boards');
  const starredTrackerIds = useTrackerSettingsStore((s) => s.starredTrackerIds);
  const toggleTrackerStarred = useTrackerSettingsStore((s) => s.toggleStarred);
  const lastVisitedTrackers = useTrackerSettingsStore((s) => s.lastVisitedAtByTrackerId);

  const workspacesJson = JSON.stringify(user?.workspaces?.map((w) => w.id) ?? []);
  useEffect(() => {
    if (user?.workspaces) {
      initCurrentTeam(user.workspaces);
    }
     
  }, [workspacesJson]);

  const {
    data: boards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['boards', currentTeamId],
    queryFn: () => fetchBoards(currentTeamId!),
    enabled: !!currentTeamId,
  });

  const {
    data: trackers,
    isLoading: trackersLoading,
    isError: trackersError,
  } = useQuery({
    queryKey: ['trackers', currentTeamId],
    queryFn: () => fetchTrackers(currentTeamId!),
    enabled: !!currentTeamId && activeTab === 'trackers',
  });

  const trackersQueryKey = ['trackers', currentTeamId] as const;

  const createTrackerMutation = useMutation({
    mutationFn: (input: { workspaceId: string; title: string }) => createTracker(input),
    onSuccess: async (tracker) => {
      setTitle('');
      setFormError(null);
      window.location.href = `/tracker/${tracker.id}`;
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : 'Failed to create tracker');
    },
  });

  const deleteTrackerMutation = useMutation({
    mutationFn: (trackerId: string) => deleteTracker(trackerId),
    onMutate: async (trackerId) => {
      await queryClient.cancelQueries({ queryKey: trackersQueryKey });
      const prev = queryClient.getQueryData<TrackerSummary[]>(trackersQueryKey);
      queryClient.setQueryData<TrackerSummary[]>(trackersQueryKey, (old) =>
        old ? old.filter((tr) => tr.id !== trackerId) : old,
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(trackersQueryKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trackersQueryKey }),
  });

  const displayedTrackers = useMemo(() => {
    if (!trackers) return undefined;
    let result = [...trackers];
    if (sidebarView === 'starred') {
      result = result.filter((tr) => starredTrackerIds.includes(tr.id));
    }
    if (sidebarView === 'recent') {
      result = result
        .filter((tr) => lastVisitedTrackers[tr.id])
        .sort((a, b) => (lastVisitedTrackers[b.id] ?? 0) - (lastVisitedTrackers[a.id] ?? 0));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter((tr) => tr.title.toLowerCase().includes(q));
    return result;
  }, [trackers, sidebarView, starredTrackerIds, lastVisitedTrackers, searchQuery]);

  const viewFilteredBoards = useMemo(() => {
    if (!boards || boards.length === 0) return boards ?? [];

    let result = [...boards];

    if (sidebarView === 'starred') {
      result = result.filter((b) => starredBoardIds.includes(b.id));
    }

    if (sidebarView === 'recent') {
      result.sort((a, b) => {
        const aTime = lastVisitedAtByBoardId[a.id] ?? 0;
        const bTime = lastVisitedAtByBoardId[b.id] ?? 0;
        return bTime - aTime;
      });
      return result.filter((b) => lastVisitedAtByBoardId[b.id]);
    }

    return result.sort((a, b) => {
      const aStarred = starredBoardIds.includes(a.id);
      const bStarred = starredBoardIds.includes(b.id);
      if (aStarred !== bStarred) return aStarred ? -1 : 1;
      const aTime = lastVisitedAtByBoardId[a.id] ?? new Date(a.updatedAt).getTime();
      const bTime = lastVisitedAtByBoardId[b.id] ?? new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [boards, starredBoardIds, lastVisitedAtByBoardId, sidebarView]);

  const displayedBoards = useMemo(() => {
    if (!viewFilteredBoards) return undefined;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return viewFilteredBoards;
    return viewFilteredBoards.filter((board) => board.title.toLowerCase().includes(q));
  }, [viewFilteredBoards, searchQuery]);

  const boardsQueryKey = ['boards', currentTeamId] as const;

  const createBoardMutation = useMutation({
    mutationFn: (input: { workspaceId: string; title: string }) => createBoard(input),
    onSuccess: async (board) => {
      setTitle('');
      setFormError(null);
      window.location.href = `/board/${board.id}`;
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : t.createBoardError);
    },
  });

  const renameBoardMutation = useMutation({
    mutationFn: (input: { boardId: string; title: string }) =>
      updateBoardMetadata(input.boardId, { title: input.title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boardsQueryKey });
    },
    onError: (error: unknown) => {
      showToast(error instanceof Error ? error.message : 'Failed to rename', 'error');
    },
  });

  const duplicateBoardMutation = useMutation({
    mutationFn: (input: { workspaceId: string; title: string }) => createBoard(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boardsQueryKey });
      showToast('Board duplicated', 'success');
    },
    onError: (error: unknown) => {
      showToast(error instanceof Error ? error.message : 'Failed to duplicate', 'error');
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onMutate: async (boardId) => {
      await queryClient.cancelQueries({ queryKey: boardsQueryKey });
      const previousBoards = queryClient.getQueryData<BoardSummary[]>(boardsQueryKey);
      queryClient.setQueryData<BoardSummary[]>(boardsQueryKey, (old) => {
        if (!old) return old;
        return old.filter((board) => board.id !== boardId);
      });
      return { previousBoards };
    },
    onError: (error: unknown, _boardId, context) => {
      if (context?.previousBoards) {
        queryClient.setQueryData(boardsQueryKey, context.previousBoards);
      }
      console.error('Failed to delete board:', error);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: boardsQueryKey });
    },
  });

  const handleCreateBoard = () => {
    if (!currentTeamId) {
      setFormError(t.teamNotFound);
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError(t.enterBoardTitle);
      return;
    }
    setFormError(null);
    if (activeTab === 'trackers') {
      createTrackerMutation.mutate({ workspaceId: currentTeamId, title: trimmedTitle });
    } else {
      createBoardMutation.mutate({ workspaceId: currentTeamId, title: trimmedTitle });
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleCreateBoard();
  };

  const localeTag = locale === 'ru' ? 'ru-RU' : 'en-US';

  const renderBoardsList = (items: BoardSummary[] | undefined) => {
    if (isLoading) {
      return (
        <div className="flex h-32 items-center justify-center text-sm text-slate-500">
          {t.loadingBoards}
        </div>
      );
    }
    if (isError) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
          {t.loadBoardsError}
        </div>
      );
    }
    if (!items || items.length === 0) {
      return (
        <div className="py-16 text-center text-sm text-slate-400">
          {sidebarView === 'starred'
            ? t.boardMenu.starBoard
            : sidebarView === 'recent'
              ? t.sidebarRecent
              : t.noBoards}
        </div>
      );
    }

    const isList = boardsListView === 'list';

    if (isList) {
      return (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="pb-2 pl-2 font-medium">{t.boardMenu.detailsTitle ?? 'Name'}</th>
              <th className="pb-2 font-medium">{t.onlineUsers}</th>
              <th className="pb-2 font-medium">{t.lastOpened}</th>
              <th className="pb-2 font-medium">{t.owner}</th>
              <th className="pb-2 pr-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((board) => {
              const updated = new Date(board.updatedAt);
              return (
                <tr
                  key={board.id}
                  className="group border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="py-3 pl-2">
                    <Link
                      href={`/board/${board.id}`}
                      className="flex items-center gap-3 focus:outline-none"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-50 text-indigo-600">
                        <SquaresFour size={16} weight="fill" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{board.title}</div>
                        <div className="text-xs text-slate-400">
                          {t.updated}{' '}
                          {Number.isNaN(updated.getTime())
                            ? '—'
                            : updated.toLocaleDateString(localeTag, {
                                month: 'short',
                                day: 'numeric',
                              })}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 text-slate-400">—</td>
                  <td className="py-3 text-slate-500">
                    {Number.isNaN(updated.getTime())
                      ? '—'
                      : updated.toLocaleDateString(localeTag, {
                          month: 'short',
                          day: 'numeric',
                        })}
                  </td>
                  <td className="py-3 text-slate-500">{user?.name ?? user?.email ?? '—'}</td>
                  <td className="py-3 pr-2">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          toggleStarred(board.id);
                          const nowStarred = useBoardSettingsStore.getState().isStarred(board.id);
                          showToast(nowStarred ? 'Board starred' : 'Board unstarred', 'success');
                        }}
                        className="rounded p-1 text-slate-400 hover:text-indigo-600"
                      >
                        <Star
                          size={14}
                          weight={starredBoardIds.includes(board.id) ? 'fill' : 'regular'}
                        />
                      </button>
                      {renderBoardMenu(board)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((board) => {
          const updated = new Date(board.updatedAt);
          return (
            <div key={board.id} className="group relative">
              <Link
                href={`/board/${board.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <div className="mb-12 h-24 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100" />
                <h3 className="truncate text-sm font-semibold text-slate-900">{board.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {t.updated}{' '}
                  {Number.isNaN(updated.getTime())
                    ? '—'
                    : updated.toLocaleDateString(localeTag, {
                        month: 'short',
                        day: 'numeric',
                      })}
                </p>
              </Link>
              <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    toggleStarred(board.id);
                    const nowStarred = useBoardSettingsStore.getState().isStarred(board.id);
                    showToast(nowStarred ? 'Board starred' : 'Board unstarred', 'success');
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                    starredBoardIds.includes(board.id)
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-white/80 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Star
                    size={14}
                    weight={starredBoardIds.includes(board.id) ? 'fill' : 'regular'}
                  />
                </button>
                {renderBoardMenu(board)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBoardMenu = (board: BoardSummary) => (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={deleteBoardMutation.isPending}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
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
                    window.open(`/board/${board.id}`, '_blank', 'noopener,noreferrer');
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
            {starredBoardIds.includes(board.id) ? t.boardMenu.unstarBoard : t.boardMenu.starBoard}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
            onSelect={() => {
              const newTitle = window.prompt(t.boardMenu.rename, board.title);
              if (newTitle != null && newTitle.trim()) {
                renameBoardMutation.mutate({ boardId: board.id, title: newTitle.trim() });
              }
            }}
          >
            {t.boardMenu.rename}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
            onSelect={() => {
              const defaultTitle = `${board.title} (copy)`;
              const newTitle = window.prompt(t.boardMenu.duplicateBoardNamePrompt, defaultTitle);
              if (newTitle != null && newTitle.trim()) {
                const wsId = board.workspaceId || currentTeamId;
                if (wsId) {
                  duplicateBoardMutation.mutate({ workspaceId: wsId, title: newTitle.trim() });
                }
              }
            }}
          >
            {t.boardMenu.duplicate}
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
                showToast(e instanceof Error ? e.message : 'Failed to download', 'error');
              }
            }}
          >
            {t.boardMenu.downloadBackup}
          </DropdownMenu.Item>
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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <div className="flex h-screen bg-[#f5f7fb] text-slate-900">
      {/* Sidebar */}
      <AppSidebar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div />
          <div className="flex items-center gap-3">
            {currentTeamId && (
              <button
                type="button"
                onClick={() => setShowWorkspaceMembers(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Users size={16} />
                {t.inviteMembers}
              </button>
            )}
            <SettingsButton />
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Tab switcher + create */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('boards')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === 'boards'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <SquaresFour
                  size={14}
                  weight="fill"
                  className="mr-1.5 inline-block align-text-bottom"
                />
                {t.tracker.boards}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('trackers')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === 'trackers'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Kanban size={14} weight="fill" className="mr-1.5 inline-block align-text-bottom" />
                {t.tracker.trackers}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  activeTab === 'trackers' ? t.tracker.newTrackerPlaceholder : t.newBoardPlaceholder
                }
                className="h-9 w-60 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={
                  (activeTab === 'boards'
                    ? createBoardMutation.isPending
                    : createTrackerMutation.isPending) || !currentTeamId
                }
                className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
              >
                {(
                  activeTab === 'boards'
                    ? createBoardMutation.isPending
                    : createTrackerMutation.isPending
                )
                  ? t.creating
                  : t.createNew}
              </button>
            </form>
          </div>

          {formError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {formError}
            </div>
          )}

          {activeTab === 'boards' ? (
            <>
              {/* View toggle */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium">{t.filterBy}</span>
                  <span className="rounded border border-slate-200 bg-white px-2 py-1">
                    {t.allBoards}
                  </span>
                  <span className="font-medium">{t.sortBy}</span>
                  <span className="rounded border border-slate-200 bg-white px-2 py-1">
                    {t.lastOpened}
                  </span>
                </div>
                <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setBoardsListView('grid')}
                    className={`rounded p-1.5 transition ${boardsListView === 'grid' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                    title={t.gridView}
                  >
                    <SquaresFour size={16} weight="fill" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardsListView('list')}
                    className={`rounded p-1.5 transition ${boardsListView === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
                    title={t.listView}
                  >
                    <List size={16} weight="fill" />
                  </button>
                </div>
              </div>

              {/* Board list */}
              {renderBoardsList(displayedBoards)}
            </>
          ) : (
            <>
              {/* Tracker list */}
              {trackersLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                  {t.tracker.loadingTrackers}
                </div>
              ) : trackersError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
                  Failed to load trackers
                </div>
              ) : !displayedTrackers || displayedTrackers.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  {t.tracker.noTrackers}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedTrackers.map((tracker) => {
                    const updated = new Date(tracker.updatedAt);
                    return (
                      <div key={tracker.id} className="group relative">
                        <Link
                          href={`/tracker/${tracker.id}`}
                          className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                          <div className="mb-12 flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-violet-100">
                            <Kanban size={32} weight="fill" className="text-indigo-400" />
                          </div>
                          <h3 className="truncate text-sm font-semibold text-slate-900">
                            {tracker.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-400">
                            {tracker.stats.tasks} {t.tracker.tasks} &middot; {t.updated}{' '}
                            {Number.isNaN(updated.getTime())
                              ? '—'
                              : updated.toLocaleDateString(localeTag, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                          </p>
                        </Link>
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              toggleTrackerStarred(tracker.id);
                              showToast(
                                useTrackerSettingsStore.getState().isStarred(tracker.id)
                                  ? 'Tracker starred'
                                  : 'Tracker unstarred',
                                'success',
                              );
                            }}
                            className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                              starredTrackerIds.includes(tracker.id)
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-white/80 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Star
                              size={14}
                              weight={starredTrackerIds.includes(tracker.id) ? 'fill' : 'regular'}
                            />
                          </button>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
                              >
                                <DotsThree size={14} weight="bold" />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="min-w-[10rem] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                                sideOffset={6}
                                align="end"
                              >
                                <DropdownMenu.Item
                                  className="flex cursor-default select-none items-center rounded px-2 py-1.5 text-sm text-rose-600 outline-none data-[highlighted]:bg-rose-50"
                                  onSelect={() => {
                                    if (window.confirm(t.tracker.deleteTrackerConfirm)) {
                                      deleteTrackerMutation.mutate(tracker.id);
                                    }
                                  }}
                                >
                                  {t.tracker.deleteTracker}
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showWorkspaceMembers && currentTeamId && (
        <WorkspaceMembers
          workspaceId={currentTeamId}
          onClose={() => setShowWorkspaceMembers(false)}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomePageContent />
    </RequireAuth>
  );
}
