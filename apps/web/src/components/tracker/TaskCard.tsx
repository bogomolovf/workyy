'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, ChatCircle, CheckSquare, DotsSixVertical, User } from '@phosphor-icons/react';
import type { TaskData } from '../../lib/trackerApi';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function TaskCard({
  task,
  onClick,
  isSelected,
}: {
  task: TaskData;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = !!task.completedAt;
  const totalSubs = task._count.subtasks;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={task.title}
      className={`group relative cursor-pointer rounded-lg border bg-white shadow-sm transition-all
        ${isDragging ? 'z-50 scale-[1.02] opacity-60 shadow-xl' : ''}
        ${isCompleted ? 'border-l-[3px] border-l-green-400 border-t-slate-200 border-r-slate-200 border-b-slate-200 opacity-55' : 'border-slate-200'}
        ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-300' : ''}
        hover:shadow-md hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
    >
      {/* Drag handle */}
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        className="absolute -left-0.5 top-1/2 -translate-y-1/2 cursor-grab rounded p-0.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <DotsSixVertical size={14} weight="bold" />
      </div>

      <div className="px-3 py-2.5">
        {/* Labels row */}
        {task.labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {task.labels.map(({ label }) => (
              <span
                key={label.id}
                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                style={{
                  backgroundColor: label.color ? `${label.color}20` : '#e2e8f0',
                  color: label.color ?? '#475569',
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <p
          className={`text-[13px] font-medium leading-snug ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}
        >
          {task.title}
        </p>

        {/* Meta row */}
        {(task.priority ||
          task.dueDate ||
          totalSubs > 0 ||
          task._count.comments > 0 ||
          task.assignee) && (
          <div className="mt-2 flex items-center gap-2.5 text-[11px] text-slate-500">
            {task.priority && (
              <span className="flex items-center gap-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${PRIORITY_COLORS[task.priority]}`}
                />
                <span className="font-medium">{PRIORITY_LABELS[task.priority]}</span>
              </span>
            )}

            {task.dueDate && (
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar size={12} />
                {new Date(task.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}

            {totalSubs > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <CheckSquare size={12} />
                {totalSubs}
              </span>
            )}

            {task._count.comments > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <ChatCircle size={12} />
                {task._count.comments}
              </span>
            )}

            {task.assignee && (
              <span className="ml-auto flex items-center">
                {task.assignee.avatarUrl ? (
                  <img
                    src={task.assignee.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full ring-1 ring-white"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600">
                    {(task.assignee.name ?? task.assignee.email)?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
