'use client';

import {
  Calendar,
  ChatCircle,
  CheckSquare,
  ClockCounterClockwise,
  Tag,
  TextAlignLeft,
  Trash,
  User,
  X,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  addComment,
  attachLabel,
  createLabel,
  createTask,
  deleteTask,
  detachLabel,
  fetchTask,
  fetchTaskActivity,
  updateTask,
  type TaskActivityData,
  type TaskColumnData,
  type TaskDetail,
  type TaskLabelData,
  type UserRef,
} from '../../lib/trackerApi';

const PRIORITY_OPTIONS = [
  { value: null, label: 'noPriority' },
  { value: 'low', label: 'priorityLow' },
  { value: 'medium', label: 'priorityMedium' },
  { value: 'high', label: 'priorityHigh' },
  { value: 'urgent', label: 'priorityUrgent' },
] as const;

const LABEL_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
];

type Tab = 'chat' | 'log' | 'description' | 'subtasks';

const ACTIVITY_LABELS: Record<string, string> = {
  'task.created': 'activityTaskCreated',
  'task.moved': 'activityTaskMoved',
  'task.assignee_changed': 'activityAssigneeChanged',
  'task.priority_changed': 'activityPriorityChanged',
  'task.deleted': 'activityTaskDeleted',
  'comment.added': 'activityCommentAdded',
  'label.added': 'activityLabelAdded',
  'label.removed': 'activityLabelRemoved',
  'subtask.created': 'activitySubtaskCreated',
};

export function TaskDetailPanel({
  trackerId,
  taskId,
  columns,
  labels: allLabels,
  members,
  t,
  onClose,
}: {
  trackerId: string;
  taskId: string;
  columns: TaskColumnData[];
  labels: TaskLabelData[];
  members: UserRef[];
  t: Record<string, string>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const trackerQueryKey = ['tracker', trackerId];
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', trackerId, taskId],
    queryFn: () => fetchTask(trackerId, taskId),
    refetchInterval: activeTab === 'chat' ? 5_000 : false,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['task-activity', trackerId, taskId],
    queryFn: () => fetchTaskActivity(trackerId, taskId),
    enabled: activeTab === 'log',
  });

  const patchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateTask>[2]) =>
      updateTask(trackerId, taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', trackerId, taskId] });
      queryClient.invalidateQueries({ queryKey: trackerQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(trackerId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trackerQueryKey });
      onClose();
    },
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => addComment(trackerId, taskId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', trackerId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', trackerId, taskId] });
    },
  });

  const attachMutation = useMutation({
    mutationFn: (labelId: string) => attachLabel(trackerId, taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', trackerId, taskId] });
      queryClient.invalidateQueries({ queryKey: trackerQueryKey });
    },
  });

  const detachMutation = useMutation({
    mutationFn: (labelId: string) => detachLabel(trackerId, taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', trackerId, taskId] });
      queryClient.invalidateQueries({ queryKey: trackerQueryKey });
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: (payload: { name: string; color?: string }) => createLabel(trackerId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trackerQueryKey }),
  });

  const subtaskMutation = useMutation({
    mutationFn: (title: string) =>
      createTask(trackerId, { title, columnId: task!.columnId, parentTaskId: taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', trackerId, taskId] });
      queryClient.invalidateQueries({ queryKey: trackerQueryKey });
    },
  });

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showLabelCreator, setShowLabelCreator] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description ?? '');
    }
  }, [task]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (isLoading || !task) {
    return (
      <div
        className="fixed inset-y-0 right-0 z-[100] flex w-full border-l border-slate-200 bg-white shadow-2xl md:w-[440px]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  const taskLabels = task.labels.map((l) => l.label);
  const taskLabelIds = new Set(taskLabels.map((l) => l.id));
  const availableLabels = allLabels.filter((l) => !taskLabelIds.has(l.id));

  const tabs: { id: Tab; label: string; icon: typeof ChatCircle }[] = [
    { id: 'chat', label: t.tabChat, icon: ChatCircle },
    { id: 'log', label: t.tabInfoLog, icon: ClockCounterClockwise },
    { id: 'description', label: t.tabDescription, icon: TextAlignLeft },
    { id: 'subtasks', label: t.tabSubtasks, icon: CheckSquare },
  ];

  return (
    <div
      className="fixed inset-y-0 right-0 z-[100] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:w-[440px]"
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/50 px-4 pb-3 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
              {task.column.title}
            </span>
            {task.completedAt && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                {t.completed}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {confirmDeleteTask ? (
              <button
                onClick={() => deleteMutation.mutate()}
                className="rounded bg-rose-500 px-2 py-0.5 text-[11px] font-medium text-white"
              >
                {t.confirmDeleteColumn}
              </button>
            ) : (
              <button
                onClick={() => {
                  setConfirmDeleteTask(true);
                  setTimeout(() => setConfirmDeleteTask(false), 3000);
                }}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                aria-label={t.delete}
              >
                <Trash size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={t.close}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Title */}
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => {
            if (editTitle.trim() && editTitle !== task.title)
              patchMutation.mutate({ title: editTitle.trim() });
          }}
          className="mb-3 w-full border-0 bg-transparent text-lg font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          placeholder={t.taskTitle}
          aria-label={t.taskTitle}
        />

        {/* Meta fields */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {t.status}
            </label>
            <select
              value={task.columnId}
              onChange={(e) => patchMutation.mutate({ columnId: e.target.value })}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              aria-label={t.status}
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {t.assignee}
            </label>
            <select
              value={task.assigneeId ?? ''}
              onChange={(e) => patchMutation.mutate({ assigneeId: e.target.value || null })}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              aria-label={t.assignee}
            >
              <option value="">{t.unassigned}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {t.priority}
            </label>
            <select
              value={task.priority ?? ''}
              onChange={(e) =>
                patchMutation.mutate({
                  priority: (e.target.value || null) as TaskDetail['priority'],
                })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              aria-label={t.priority}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ''}>
                  {t[opt.label] ?? opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {t.dueDate}
            </label>
            <input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
              onChange={(e) =>
                patchMutation.mutate({
                  dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              aria-label={t.dueDate}
            />
          </div>
        </div>

        {/* Labels */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {taskLabels.map((label) => (
            <span
              key={label.id}
              className="group inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium"
              style={{
                backgroundColor: label.color ? `${label.color}22` : '#e2e8f0',
                color: label.color ?? '#475569',
              }}
            >
              {label.name}
              <button
                onClick={() => detachMutation.mutate(label.id)}
                className="opacity-0 group-hover:opacity-100"
                aria-label={`Remove ${label.name}`}
              >
                <X size={8} />
              </button>
            </span>
          ))}
          {availableLabels.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) attachMutation.mutate(e.target.value);
              }}
              className="rounded border border-dashed border-slate-300 bg-transparent px-1.5 py-px text-[10px] text-slate-500"
              aria-label={t.labels}
            >
              <option value="">+ {t.labels}</option>
              {availableLabels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          {showLabelCreator ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder={t.labelName}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLabelName.trim()) {
                    createLabelMutation.mutate({ name: newLabelName.trim(), color: newLabelColor });
                    setNewLabelName('');
                    setShowLabelCreator(false);
                  }
                  if (e.key === 'Escape') setShowLabelCreator(false);
                }}
              />
              <div className="flex gap-0.5">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewLabelColor(c)}
                    className={`h-3 w-3 rounded-full border ${newLabelColor === c ? 'border-slate-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLabelCreator(true)}
              className="text-[10px] text-indigo-500 hover:text-indigo-600"
            >
              {t.createLabel}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 gap-0.5 border-b border-slate-200 bg-white px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium transition ${
                active
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
              role="tab"
              aria-selected={active}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === 'chat' && (
          <ChatTab
            task={task}
            t={t}
            commentBody={commentBody}
            setCommentBody={setCommentBody}
            commentMutation={commentMutation}
          />
        )}
        {activeTab === 'log' && <LogTab activities={activities} t={t} />}
        {activeTab === 'description' && (
          <DescriptionTab
            task={task}
            t={t}
            editDesc={editDesc}
            setEditDesc={setEditDesc}
            patchMutation={patchMutation}
          />
        )}
        {activeTab === 'subtasks' && (
          <SubtasksTab
            task={task}
            t={t}
            subtaskTitle={subtaskTitle}
            setSubtaskTitle={setSubtaskTitle}
            subtaskMutation={subtaskMutation}
          />
        )}
      </div>
    </div>
  );
}

// ── Tab components ──────────────────────────────────────────────────

function ChatTab({
  task,
  t,
  commentBody,
  setCommentBody,
  commentMutation,
}: {
  task: TaskDetail;
  t: Record<string, string>;
  commentBody: string;
  setCommentBody: (v: string) => void;
  commentMutation: { mutate: (body: string) => void };
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3">
        {task.comments.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">{t.noComments}</p>
        ) : (
          task.comments.map((c) => (
            <div key={c.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">
                  {c.author?.name ?? c.author?.email ?? 'Unknown'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(c.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-0.5 text-slate-600">{c.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <input
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder={t.addComment}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && commentBody.trim()) {
              commentMutation.mutate(commentBody.trim());
              setCommentBody('');
            }
          }}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          aria-label={t.addComment}
        />
        <button
          onClick={() => {
            if (commentBody.trim()) {
              commentMutation.mutate(commentBody.trim());
              setCommentBody('');
            }
          }}
          disabled={!commentBody.trim()}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {t.send}
        </button>
      </div>
    </div>
  );
}

function LogTab({ activities, t }: { activities: TaskActivityData[]; t: Record<string, string> }) {
  if (activities.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">{t.noActivity}</p>;
  }
  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const labelKey = ACTIVITY_LABELS[a.type] ?? a.type;
        const label = t[labelKey] ?? labelKey;
        const payload = a.payload as Record<string, string> | null;
        return (
          <div key={a.id} className="flex items-start gap-2 text-[11px]">
            <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
            <div className="flex-1">
              <span className="font-medium text-slate-700">
                {a.actor?.name ?? a.actor?.email ?? '?'}
              </span>{' '}
              <span className="text-slate-500">{label}</span>
              {payload?.from && payload?.to && (
                <span className="text-slate-400">
                  {' '}
                  {t.from} <b>{payload.from}</b> {t.to} <b>{payload.to}</b>
                </span>
              )}
              {payload?.title && <span className="text-slate-400">: {payload.title}</span>}
              {payload?.labelName && <span className="text-slate-400">: {payload.labelName}</span>}
            </div>
            <span className="flex-shrink-0 text-[10px] text-slate-400">
              {new Date(a.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DescriptionTab({
  task,
  t,
  editDesc,
  setEditDesc,
  patchMutation,
}: {
  task: TaskDetail;
  t: Record<string, string>;
  editDesc: string;
  setEditDesc: (v: string) => void;
  patchMutation: { mutate: (p: { description?: string | null }) => void };
}) {
  return (
    <textarea
      value={editDesc}
      onChange={(e) => setEditDesc(e.target.value)}
      onBlur={() => {
        if (editDesc !== (task.description ?? ''))
          patchMutation.mutate({ description: editDesc || null });
      }}
      placeholder={t.description}
      rows={12}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
      aria-label={t.description}
    />
  );
}

function SubtasksTab({
  task,
  t,
  subtaskTitle,
  setSubtaskTitle,
  subtaskMutation,
}: {
  task: TaskDetail;
  t: Record<string, string>;
  subtaskTitle: string;
  setSubtaskTitle: (v: string) => void;
  subtaskMutation: { mutate: (title: string) => void };
}) {
  return (
    <div>
      {task.subtasks.length > 0 ? (
        <ul className="space-y-1">
          {task.subtasks.map((sub) => (
            <li
              key={sub.id}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${sub.completedAt ? 'text-slate-400 line-through' : 'text-slate-900'}`}
            >
              <span
                className={`h-3 w-3 rounded border ${sub.completedAt ? 'border-green-500 bg-green-500' : 'border-slate-300'}`}
              />
              {sub.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-xs text-slate-400">{t.noSubtasks}</p>
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={subtaskTitle}
          onChange={(e) => setSubtaskTitle(e.target.value)}
          placeholder={t.addSubtask}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && subtaskTitle.trim()) {
              subtaskMutation.mutate(subtaskTitle.trim());
              setSubtaskTitle('');
            }
          }}
          className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          aria-label={t.addSubtask}
        />
      </div>
    </div>
  );
}
