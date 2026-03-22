import { apiFetch, API_URL } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────

export type UserRef = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type Reaction = {
  messageId: string;
  emoji: string;
  userId: string;
};

export type CommentMessageData = {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  author: UserRef;
  reactions: Reaction[];
};

export type ThreadSummary = {
  id: string;
  boardId: string;
  nodeId: string | null;
  anchorX: number;
  anchorY: number;
  resolved: boolean;
  resolvedAt: string | null;
  createdById: string;
  createdBy: UserRef;
  resolvedBy: { id: string; name: string | null } | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  firstMessage: {
    id: string;
    body: string;
    authorId: string;
    createdAt: string;
    author: UserRef;
  } | null;
  subscribed: boolean;
};

export type ThreadDetail = {
  id: string;
  boardId: string;
  nodeId: string | null;
  anchorX: number;
  anchorY: number;
  resolved: boolean;
  resolvedAt: string | null;
  createdById: string;
  createdBy: UserRef;
  resolvedBy: { id: string; name: string | null } | null;
  createdAt: string;
  updatedAt: string;
  subscribed: boolean;
  messages: CommentMessageData[];
};

// ─── API functions ────────────────────────────────────────────────────

export async function fetchThreads(boardId: string, resolved?: boolean): Promise<ThreadSummary[]> {
  const params = new URLSearchParams();
  if (resolved !== undefined) params.set('resolved', String(resolved));
  const qs = params.size ? `?${params.toString()}` : '';
  const data = await apiFetch<{ threads: ThreadSummary[] }>(
    `${API_URL}/api/boards/${boardId}/threads${qs}`,
  );
  return data.threads;
}

export async function fetchThread(boardId: string, threadId: string): Promise<ThreadDetail> {
  return apiFetch<ThreadDetail>(`${API_URL}/api/boards/${boardId}/threads/${threadId}`);
}

export async function createThread(
  boardId: string,
  payload: { body: string; anchorX: number; anchorY: number; nodeId?: string | null },
): Promise<ThreadDetail> {
  return apiFetch<ThreadDetail>(`${API_URL}/api/boards/${boardId}/threads`, {
    method: 'POST',
    body: payload,
  });
}

export async function resolveThread(
  boardId: string,
  threadId: string,
  resolved: boolean,
): Promise<{ id: string; resolved: boolean }> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}`, {
    method: 'PATCH',
    body: { resolved },
  });
}

export async function moveThreadAnchor(
  boardId: string,
  threadId: string,
  anchorX: number,
  anchorY: number,
): Promise<{ id: string; anchorX: number; anchorY: number }> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}/move`, {
    method: 'PATCH',
    body: { anchorX, anchorY },
  });
}

export async function deleteThread(boardId: string, threadId: string): Promise<void> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}`, { method: 'DELETE' });
}

export async function addReply(
  boardId: string,
  threadId: string,
  body: string,
): Promise<CommentMessageData> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}/messages`, {
    method: 'POST',
    body: { body },
  });
}

export async function editMessage(
  boardId: string,
  threadId: string,
  messageId: string,
  body: string,
): Promise<CommentMessageData> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}/messages/${messageId}`, {
    method: 'PATCH',
    body: { body },
  });
}

export async function deleteMessage(
  boardId: string,
  threadId: string,
  messageId: string,
): Promise<void> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function toggleReaction(
  boardId: string,
  threadId: string,
  messageId: string,
  emoji: string,
): Promise<{ toggled: boolean; reactions: Reaction[] }> {
  return apiFetch(
    `${API_URL}/api/boards/${boardId}/threads/${threadId}/messages/${messageId}/reactions`,
    { method: 'PUT', body: { emoji } },
  );
}

export async function toggleSubscription(
  boardId: string,
  threadId: string,
  subscribed: boolean,
): Promise<{ subscribed: boolean }> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/threads/${threadId}/subscription`, {
    method: 'PUT',
    body: { subscribed },
  });
}
