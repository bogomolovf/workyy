const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ??
      'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ??
      'http://localhost:4000');

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const problem = await res.json();
    return problem?.detail ?? fallback;
  } catch {
    return res.text().catch(() => fallback);
  }
}

// ── Types ────────────────────────────────────────────────────────────

export type TrackerSummary = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  stats: { tasks: number; columns: number };
};

export type TaskColumnData = {
  id: string;
  trackerId: string;
  title: string;
  position: number;
  isFinal: boolean;
  createdAt: string;
};

export type TaskLabelData = {
  id: string;
  trackerId: string;
  name: string;
  color: string | null;
  createdAt: string;
};

export type UserRef = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type TaskData = {
  id: string;
  trackerId: string;
  columnId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  assigneeId: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  dueDate: string | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  assignee: UserRef | null;
  labels: { label: TaskLabelData }[];
  _count: { subtasks: number; comments: number };
};

export type TaskCommentData = {
  id: string;
  taskId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: UserRef | null;
};

export type TaskDetail = TaskData & {
  subtasks: (TaskData & { assignee: UserRef | null })[];
  comments: TaskCommentData[];
  column: { id: string; title: string; isFinal: boolean };
};

export type TaskActivityData = {
  id: string;
  trackerId: string;
  taskId: string | null;
  actorId: string | null;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actor: UserRef | null;
};

export type TrackerDetail = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  backgroundUrl: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  columns: TaskColumnData[];
  tasks: TaskData[];
  labels: TaskLabelData[];
};

// ── Tracker CRUD ─────────────────────────────────────────────────────

export async function fetchTrackers(workspaceId?: string): Promise<TrackerSummary[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set('workspaceId', workspaceId);
  const res = await fetch(`${API_URL}/api/trackers${params.size ? `?${params}` : ''}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load trackers'));
  const data = await res.json();
  return Array.isArray(data.trackers) ? data.trackers : [];
}

export async function fetchTracker(trackerId: string): Promise<TrackerDetail> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load tracker'));
  const data = await res.json();
  return data.tracker;
}

export async function createTracker(payload: {
  workspaceId: string;
  title: string;
  description?: string;
}): Promise<TrackerDetail> {
  const res = await fetch(`${API_URL}/api/trackers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to create tracker'));
  return res.json();
}

export async function updateTracker(
  trackerId: string,
  payload: { title?: string; description?: string | null },
): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update tracker'));
}

export async function deleteTracker(trackerId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete tracker'));
}

// ── Columns ──────────────────────────────────────────────────────────

export async function createColumn(
  trackerId: string,
  payload: { title: string; isFinal?: boolean },
): Promise<TaskColumnData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to create column'));
  const data = await res.json();
  return data.column;
}

export async function updateColumn(
  trackerId: string,
  columnId: string,
  payload: { title?: string; position?: number; isFinal?: boolean },
): Promise<TaskColumnData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/columns/${columnId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update column'));
  const data = await res.json();
  return data.column;
}

export async function deleteColumn(trackerId: string, columnId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/columns/${columnId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete column'));
}

export async function reorderColumns(
  trackerId: string,
  columns: { id: string; position: number }[],
): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/columns/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ columns }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to reorder columns'));
}

// ── Tasks ────────────────────────────────────────────────────────────

export async function createTask(
  trackerId: string,
  payload: {
    title: string;
    columnId: string;
    description?: string;
    parentTaskId?: string | null;
    assigneeId?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    dueDate?: string | null;
  },
): Promise<TaskData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to create task'));
  const data = await res.json();
  return data.task;
}

export async function fetchTask(trackerId: string, taskId: string): Promise<TaskDetail> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load task'));
  const data = await res.json();
  return data.task;
}

export async function updateTask(
  trackerId: string,
  taskId: string,
  payload: {
    title?: string;
    description?: string | null;
    columnId?: string;
    assigneeId?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    dueDate?: string | null;
    position?: number;
  },
): Promise<TaskData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update task'));
  const data = await res.json();
  return data.task;
}

export async function deleteTask(trackerId: string, taskId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete task'));
}

// ── Labels ───────────────────────────────────────────────────────────

export async function fetchLabels(trackerId: string): Promise<TaskLabelData[]> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/labels`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load labels'));
  const data = await res.json();
  return data.labels;
}

export async function createLabel(
  trackerId: string,
  payload: { name: string; color?: string },
): Promise<TaskLabelData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to create label'));
  const data = await res.json();
  return data.label;
}

export async function updateLabel(
  trackerId: string,
  labelId: string,
  payload: { name?: string; color?: string | null },
): Promise<TaskLabelData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/labels/${labelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update label'));
  const data = await res.json();
  return data.label;
}

export async function deleteLabelApi(trackerId: string, labelId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/labels/${labelId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete label'));
}

export async function attachLabel(
  trackerId: string,
  taskId: string,
  labelId: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ labelId }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to attach label'));
}

export async function detachLabel(
  trackerId: string,
  taskId: string,
  labelId: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/trackers/${trackerId}/tasks/${taskId}/labels/${labelId}`,
    { method: 'DELETE', credentials: 'include' },
  );
  if (!res.ok) throw new Error(await parseError(res, 'Failed to detach label'));
}

// ── Comments ─────────────────────────────────────────────────────────

export async function fetchComments(trackerId: string, taskId: string): Promise<TaskCommentData[]> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}/comments`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load comments'));
  const data = await res.json();
  return data.comments;
}

export async function addComment(
  trackerId: string,
  taskId: string,
  body: string,
): Promise<TaskCommentData> {
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to add comment'));
  const data = await res.json();
  return data.comment;
}

// ── Activity ─────────────────────────────────────────────────────────

export async function fetchTaskActivity(
  trackerId: string,
  taskId: string,
  cursor?: string,
): Promise<TaskActivityData[]> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const qs = params.size ? `?${params}` : '';
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/tasks/${taskId}/activity${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load activity'));
  const data = await res.json();
  return data.activities;
}

export async function fetchTrackerActivity(
  trackerId: string,
  cursor?: string,
): Promise<TaskActivityData[]> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const qs = params.size ? `?${params}` : '';
  const res = await fetch(`${API_URL}/api/trackers/${trackerId}/activity${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to load activity'));
  const data = await res.json();
  return data.activities;
}
