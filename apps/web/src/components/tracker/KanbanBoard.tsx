'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Plus } from '@phosphor-icons/react';
import { useState, useCallback } from 'react';
import type { TaskColumnData, TaskData } from '../../lib/trackerApi';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';

function midpoint(a: number | undefined, b: number | undefined): number {
  if (a != null && b != null) return (a + b) / 2;
  if (a != null) return a + 1;
  if (b != null) return b - 1;
  return 1;
}

export function KanbanBoard({
  columns,
  tasks,
  t,
  isDragging: isDraggingExternal,
  setIsDragging,
  selectedTaskId,
  onCreateTask,
  onMoveTask,
  onCreateColumn,
  onRenameColumn,
  onDeleteColumn,
  onToggleFinal,
  onOpenTask,
  onReorderColumns,
}: {
  columns: TaskColumnData[];
  tasks: TaskData[];
  t: Record<string, string>;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  selectedTaskId: string | null;
  onCreateTask: (columnId: string, title: string) => void;
  onMoveTask: (taskId: string, newColumnId: string, newPosition: number) => void;
  onCreateColumn: (title: string) => void;
  onRenameColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onToggleFinal: (columnId: string, isFinal: boolean) => void;
  onOpenTask: (taskId: string) => void;
  onReorderColumns: (cols: { id: string; position: number }[]) => void;
}) {
  const [activeTask, setActiveTask] = useState<TaskData | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tasksByColumn = useCallback(
    (columnId: string) =>
      tasks.filter((t) => t.columnId === columnId).sort((a, b) => a.position - b.position),
    [tasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'task') {
      setActiveTask(data.task as TaskData);
      setIsDragging(true);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let targetColumnId = overId;
    const overData = over.data.current;
    if (overData?.type === 'task') {
      targetColumnId = (overData.task as TaskData).columnId;
    }

    const isColumn = columns.some((c) => c.id === targetColumnId);
    if (!isColumn) return;

    const colTasks = tasksByColumn(targetColumnId).filter((t) => t.id !== taskId);
    const overIndex = colTasks.findIndex((t) => t.id === overId);

    let newPosition: number;
    if (overIndex >= 0) {
      const prev = overIndex > 0 ? colTasks[overIndex - 1].position : undefined;
      const next = colTasks[overIndex].position;
      newPosition = midpoint(prev, next);
    } else {
      const last = colTasks.length > 0 ? colTasks[colTasks.length - 1].position : undefined;
      newPosition = midpoint(last, undefined);
    }

    onMoveTask(taskId, targetColumnId, newPosition);
  };

  const handleAddColumn = () => {
    const trimmed = newColTitle.trim();
    if (!trimmed) return;
    onCreateColumn(trimmed);
    setNewColTitle('');
    setAddingColumn(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto px-4 py-4">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn(col.id)}
            t={t}
            selectedTaskId={selectedTaskId}
            onCreateTask={onCreateTask}
            onRenameColumn={onRenameColumn}
            onDeleteColumn={onDeleteColumn}
            onToggleFinal={onToggleFinal}
            onOpenTask={onOpenTask}
          />
        ))}

        {/* Add column */}
        <div className="w-[272px] flex-shrink-0">
          {addingColumn ? (
            <div className="rounded-xl bg-[#ebecf0] p-3">
              <input
                autoFocus
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                  if (e.key === 'Escape') setAddingColumn(false);
                }}
                placeholder={t.newColumnPlaceholder}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                aria-label={t.newColumnPlaceholder}
              />
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={handleAddColumn}
                  className="rounded-md bg-indigo-600 px-3.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
                >
                  {t.save}
                </button>
                <button
                  onClick={() => setAddingColumn(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="flex w-full items-center gap-1.5 rounded-xl bg-white/60 px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-white/80 hover:text-slate-800"
              aria-label={t.addColumn}
            >
              <Plus size={15} weight="bold" /> {t.addColumn}
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[272px] rotate-[2deg]">
            <TaskCard task={activeTask} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
