'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Users } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BoardSummary, createBoard, deleteBoard, fetchBoards } from '../lib/api';
import { LANDING_URL } from '../lib/appConfig';
import { RequireAuth } from '../components/RequireAuth';
import { useAuthStore } from '../state/authStore';
import { WorkspaceMembers } from '../components/WorkspaceMembers';

const DEFAULT_WORKSPACE_ID = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? '';

function HomePageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showWorkspaceMembers, setShowWorkspaceMembers] = useState(false);

  const {
    data: boards,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['boards'],
    queryFn: () => fetchBoards(),
  });

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
      setFormError(error instanceof Error ? error.message : 'Не удалось создать доску');
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
      setFormError(
        'Не найден workspace для создания доски. Укажите NEXT_PUBLIC_DEFAULT_WORKSPACE_ID.',
      );
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Введите название доски.');
      return;
    }

    setFormError(null);
    createBoardMutation.mutate({
      workspaceId: nextWorkspace,
      title: trimmedTitle,
    });
  };

  const renderBoards = (items: BoardSummary[] | undefined) => {
    if (isLoading) {
      return (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 text-sm text-slate-500">
          Загружаем список досок…
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-600">
          Не удалось загрузить список досок. Проверьте соединение с realtime-сервером.
        </div>
      );
    }

    if (!items || items.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white/80 px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          Досок пока нет — создайте первую и начните собирать пайплайны.
        </div>
      );
    }

    return (
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((board) => {
          const updated = new Date(board.updatedAt);
          return (
            <li key={board.id} className="group relative">
              <Link
                href={`/board/${board.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Удалить доску "${board.title}"? Это действие нельзя отменить.`,
                        )
                      ) {
                        deleteBoardMutation.mutate(board.id);
                      }
                    }}
                    disabled={deleteBoardMutation.isPending}
                    className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 opacity-0 shadow-sm transition hover:bg-rose-100 hover:text-rose-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-rose-400 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Удалить доску"
                  >
                    <X size={14} weight="bold" />
                  </button>
                  <h3 className="text-base font-semibold text-slate-900">{board.title}</h3>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-slate-500">
                    Обновлено: {Number.isNaN(updated.getTime()) ? '—' : updated.toLocaleString()}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <header className="text-center">
          <div className="flex justify-between items-center mb-4">
            <a
              href={LANDING_URL}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back to website
            </a>
            {user && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user.name || user.email}</p>
                  {user.name && <p className="text-xs text-slate-500">{user.email}</p>}
                  {user.workspaces && user.workspaces.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {user.workspaces.length} workspace{user.workspaces.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Выйти и войти с другого аккаунта"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
          <h1 className="text-4xl font-semibold">Workyy MVP</h1>
          <p className="mt-3 text-lg text-slate-600">
            Смешанные SQL и Python узлы, DAG и совместная работа в реальном времени в одном
            браузере.
          </p>
        </header>

        <div className="mt-12 rounded-3xl bg-white/90 p-8 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-900">Ваши доски</h2>
                {workspaceIdForCreation && (
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceMembers(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    title="Управление участниками workspace"
                  >
                    <Users size={18} />
                    Участники
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Открывайте существующие или создайте новую доску прямо отсюда.
              </p>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:w-auto md:flex-row md:items-center"
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Название новой доски"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 md:w-72"
              />
              <button
                type="submit"
                disabled={createBoardMutation.isPending || !workspaceIdForCreation}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-200"
              >
                {createBoardMutation.isPending ? 'Создаём…' : 'Создать'}
              </button>
            </form>
          </div>

          {formError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {formError}
            </div>
          )}

          <div className="mt-8">{renderBoards(boards)}</div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Готовые демо-данные остаются доступны: открывайте любую доску, ссылка ведёт на
          canvas-представление.
        </p>
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
