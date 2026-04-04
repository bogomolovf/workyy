'use client';

import { ArrowLeft, Funnel, Kanban } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RequireAuth } from '../../../components/RequireAuth';
import { KanbanBoard } from '../../../components/tracker/KanbanBoard';
import { TaskDetailPanel } from '../../../components/tracker/TaskDetailPanel';
import { useTranslation } from '../../../hooks/useTranslation';
import { isValidUuid, fetchWorkspaceMembers, type WorkspaceMember } from '../../../lib/api';
import {
  createColumn,
  createTask,
  deleteColumn,
  fetchTracker,
  reorderColumns,
  updateColumn,
  updateTask,
  updateTracker,
  type TaskData,
} from '../../../lib/trackerApi';
import { useTrackerSettingsStore } from '../../../state/trackerSettingsStore';

const DEFAULT_BG =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80&auto=format';

function TrackerPageContent() {
  const params = useParams();
  const trackerId = params.trackerId as string;
  const { t } = useTranslation();
  const tt = t.tracker;
  const queryClient = useQueryClient();
  const recordVisit = useTrackerSettingsStore((s) => s.recordTrackerVisit);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);

  const isValid = isValidUuid(trackerId);

  const {
    data: tracker,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['tracker', trackerId],
    queryFn: () => fetchTracker(trackerId),
    enabled: isValid,
    refetchInterval: isDragging ? false : 5_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', tracker?.workspaceId],
    queryFn: () => fetchWorkspaceMembers(tracker!.workspaceId),
    enabled: !!tracker?.workspaceId,
  });

  useEffect(() => {
    if (isValid) recordVisit(trackerId);
  }, [isValid, trackerId, recordVisit]);

  useEffect(() => {
    if (tracker) setTitleDraft(tracker.title);
  }, [tracker]);

  const trackerKey = ['tracker', trackerId];

  const createTaskMutation = useMutation({
    mutationFn: ({ columnId, title }: { columnId: string; title: string }) =>
      createTask(trackerId, { title, columnId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      columnId,
      position,
    }: {
      taskId: string;
      columnId: string;
      position: number;
    }) => updateTask(trackerId, taskId, { columnId, position }),
    onMutate: async ({ taskId, columnId, position }) => {
      await queryClient.cancelQueries({ queryKey: trackerKey });
      const prev = queryClient.getQueryData(trackerKey);
      queryClient.setQueryData(trackerKey, (old: typeof tracker) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t: TaskData) =>
            t.id === taskId ? { ...t, columnId, position } : t,
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(trackerKey, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const createColumnMutation = useMutation({
    mutationFn: (title: string) => createColumn(trackerId, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const renameColumnMutation = useMutation({
    mutationFn: ({ columnId, title }: { columnId: string; title: string }) =>
      updateColumn(trackerId, columnId, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteColumn(trackerId, columnId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const toggleFinalMutation = useMutation({
    mutationFn: ({ columnId, isFinal }: { columnId: string; isFinal: boolean }) =>
      updateColumn(trackerId, columnId, { isFinal }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const reorderMutation = useMutation({
    mutationFn: (cols: { id: string; position: number }[]) => reorderColumns(trackerId, cols),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => updateTracker(trackerId, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerKey }),
  });

  const handleCreateTask = useCallback(
    (columnId: string, title: string) => createTaskMutation.mutate({ columnId, title }),
    [createTaskMutation],
  );

  const handleMoveTask = useCallback(
    (taskId: string, newColumnId: string, newPosition: number) =>
      moveTaskMutation.mutate({ taskId, columnId: newColumnId, position: newPosition }),
    [moveTaskMutation],
  );

  const filteredTasks = useMemo(() => {
    if (!tracker) return [];
    let tasks = tracker.tasks;
    if (filterPriority) tasks = tasks.filter((t) => t.priority === filterPriority);
    if (filterAssignee) tasks = tasks.filter((t) => t.assigneeId === filterAssignee);
    return tasks;
  }, [tracker, filterPriority, filterAssignee]);

  if (!isValid) {
    return (
      <main className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-sm text-amber-600">Invalid tracker ID.</p>
          <Link href="/" className="text-sm text-indigo-500 hover:underline">
            {tt.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">{tt.loadingTrackers}</p>
      </main>
    );
  }

  if (isError || !tracker) {
    return (
      <main className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-sm text-rose-600">Failed to load tracker</p>
          <Link href="/" className="text-sm text-indigo-500 hover:underline">
            {tt.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  const memberRefs = members.map((m: WorkspaceMember) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatarUrl,
  }));

  const bgUrl = tracker.backgroundUrl ?? DEFAULT_BG;
  const hasFilters = !!filterPriority || !!filterAssignee;

  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      {/* Background image -- purely decorative, no backdrop-filter to avoid stacking context issues */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgUrl})` }}
        aria-hidden="true"
      />
      {/* Overlay -- using plain bg-opacity, NOT backdrop-blur to avoid creating stacking contexts */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/35"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <header className="flex flex-shrink-0 flex-col gap-1.5 border-b border-white/10 bg-black/30 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">{tt.backToHome}</span>
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Kanban size={18} weight="fill" className="text-white/80" />
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    setEditingTitle(false);
                    if (titleDraft.trim() && titleDraft !== tracker.title)
                      renameMutation.mutate(titleDraft.trim());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      setTitleDraft(tracker.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="border-b border-white/50 bg-transparent text-sm font-bold text-white focus:outline-none"
                  aria-label={tt.taskTitle}
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-sm font-bold text-white hover:text-white/80"
                  role="heading"
                  aria-level={1}
                >
                  {tracker.title}
                </button>
              )}
            </div>
            <span className="ml-auto rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">
              {tracker.tasks.length} {tt.tasks}
            </span>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 text-[11px]">
            <Funnel size={13} className="text-white/50" />
            <button
              onClick={() => {
                setFilterPriority(null);
                setFilterAssignee(null);
              }}
              className={`rounded-md px-2 py-0.5 font-medium transition ${!hasFilters ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white/70'}`}
            >
              {tt.allFilters}
            </button>
            <select
              value={filterAssignee ?? ''}
              onChange={(e) => setFilterAssignee(e.target.value || null)}
              className="rounded-md border-0 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80"
              aria-label={tt.filterAssignee}
            >
              <option value="">{tt.filterAssignee}</option>
              {memberRefs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
            <select
              value={filterPriority ?? ''}
              onChange={(e) => setFilterPriority(e.target.value || null)}
              className="rounded-md border-0 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80"
              aria-label={tt.filterPriority}
            >
              <option value="">{tt.filterPriority}</option>
              <option value="urgent">{tt.priorityUrgent}</option>
              <option value="high">{tt.priorityHigh}</option>
              <option value="medium">{tt.priorityMedium}</option>
              <option value="low">{tt.priorityLow}</option>
            </select>
          </div>
        </header>

        {/* Kanban */}
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            columns={tracker.columns}
            tasks={filteredTasks}
            t={tt}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            selectedTaskId={selectedTaskId}
            onCreateTask={handleCreateTask}
            onMoveTask={handleMoveTask}
            onCreateColumn={(title) => createColumnMutation.mutate(title)}
            onRenameColumn={(columnId, title) => renameColumnMutation.mutate({ columnId, title })}
            onDeleteColumn={(columnId) => deleteColumnMutation.mutate(columnId)}
            onToggleFinal={(columnId, isFinal) => toggleFinalMutation.mutate({ columnId, isFinal })}
            onOpenTask={(taskId) => setSelectedTaskId(taskId)}
            onReorderColumns={(cols) => reorderMutation.mutate(cols)}
          />
        </div>

        {/* Detail panel */}
        {selectedTaskId && (
          <TaskDetailPanel
            trackerId={trackerId}
            taskId={selectedTaskId}
            columns={tracker.columns}
            labels={tracker.labels}
            members={memberRefs}
            t={tt}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </div>
    </main>
  );
}

export default function TrackerPage() {
  return (
    <RequireAuth>
      <TrackerPageContent />
    </RequireAuth>
  );
}
