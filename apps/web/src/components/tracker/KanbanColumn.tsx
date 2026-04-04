'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DotsThree, Plus, Trash, PencilSimple, CheckCircle } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMemo, useState } from 'react';
import type { TaskColumnData, TaskData } from '../../lib/trackerApi';
import { TaskCard } from './TaskCard';

export function KanbanColumn({
  column,
  tasks,
  t,
  selectedTaskId,
  onCreateTask,
  onRenameColumn,
  onDeleteColumn,
  onToggleFinal,
  onOpenTask,
}: {
  column: TaskColumnData;
  tasks: TaskData[];
  t: Record<string, string>;
  selectedTaskId: string | null;
  onCreateTask: (columnId: string, title: string) => void;
  onRenameColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onToggleFinal: (columnId: string, isFinal: boolean) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const sortedTasks = useMemo(() => {
    const active = tasks.filter((t) => !t.completedAt).sort((a, b) => a.position - b.position);
    const completed = tasks
      .filter((t) => !!t.completedAt)
      .sort((a, b) => {
        const aTime = new Date(a.completedAt!).getTime();
        const bTime = new Date(b.completedAt!).getTime();
        return bTime - aTime;
      });
    return [...active, ...completed];
  }, [tasks]);

  const handleSubmit = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onCreateTask(column.id, trimmed);
    setNewTitle('');
    setAdding(false);
  };

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== column.title) onRenameColumn(column.id, trimmed);
    setRenaming(false);
  };

  const taskCount = tasks.length;

  return (
    <div
      className={`flex w-[272px] flex-shrink-0 flex-col rounded-xl bg-[#ebecf0] ${
        isOver ? 'ring-2 ring-indigo-400' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setRenameValue(column.title);
                  setRenaming(false);
                }
              }}
              className="w-full rounded border border-indigo-400 bg-white px-2 py-0.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          ) : (
            <h3 className="truncate text-sm font-bold text-slate-800">{column.title}</h3>
          )}
          <span className="flex-shrink-0 rounded bg-slate-300/60 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {taskCount}
          </span>
          {column.isFinal && (
            <CheckCircle size={15} weight="fill" className="flex-shrink-0 text-green-500" />
          )}
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="rounded p-1 text-slate-500 hover:bg-slate-300/50 hover:text-slate-700"
              aria-label={`${column.title} column menu`}
            >
              <DotsThree size={18} weight="bold" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-[200] min-w-[11rem] rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
              sideOffset={4}
              align="end"
            >
              <DropdownMenu.Item
                className="flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                onSelect={() => {
                  setRenameValue(column.title);
                  setRenaming(true);
                }}
              >
                <PencilSimple size={14} /> {t.renameColumn}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                onSelect={() => onToggleFinal(column.id, !column.isFinal)}
              >
                <CheckCircle size={14} /> {t.markAsFinal} {column.isFinal ? '✕' : '✓'}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-200" />
              {confirmDelete ? (
                <DropdownMenu.Item
                  className="flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-rose-600 outline-none data-[highlighted]:bg-rose-50"
                  onSelect={() => {
                    onDeleteColumn(column.id);
                    setConfirmDelete(false);
                  }}
                >
                  <Trash size={14} /> {t.confirmDeleteColumn}{' '}
                  {taskCount > 0 && `(${taskCount} ${t.confirmDeleteColumnWithTasks})`}
                </DropdownMenu.Item>
              ) : (
                <DropdownMenu.Item
                  className="flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-rose-600 outline-none data-[highlighted]:bg-rose-50"
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 4000);
                  }}
                >
                  <Trash size={14} /> {t.deleteColumn}
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={sortedTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedTasks.length === 0 ? (
            <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300/60 text-xs text-slate-400">
              {t.emptyColumn}
            </div>
          ) : (
            sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isSelected={selectedTaskId === task.id}
                onClick={() => onOpenTask(task.id)}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Add task */}
      <div className="px-2 pb-2">
        {adding ? (
          <div className="rounded-lg border border-slate-300 bg-white p-2.5 shadow-sm">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') setAdding(false);
              }}
              placeholder={t.taskTitle}
              className="w-full border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              aria-label={t.taskTitle}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleSubmit}
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                {t.save}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/80 hover:text-slate-800"
            aria-label={`${t.addTask} in ${column.title}`}
          >
            <Plus size={14} weight="bold" /> {t.addTask}
          </button>
        )}
      </div>
    </div>
  );
}
