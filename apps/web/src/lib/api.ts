import { apiFetch, API_URL, isValidUuid } from './apiClient';
import type {
  BoardResponse,
  BoardSummary,
  CreateBoardInput,
  CreatedBoard,
  PersistedEdge,
  PersistedNode,
  SaveBoardStructureInput,
  UpdateBoardMetadataInput,
  UploadedFile,
  WorkspaceMember,
  EdgeHandleMetadata,
  NodeType,
} from './api.types';

// Re-export everything consumers need
export { API_URL, isValidUuid } from './apiClient';
export type {
  BoardResponse,
  BoardSummary,
  CreateBoardInput,
  CreatedBoard,
  EdgeHandleMetadata,
  NodeType,
  PersistedEdge,
  PersistedNode,
  SaveBoardStructureInput,
  UpdateBoardMetadataInput,
  UploadedFile,
  WorkspaceMember,
};

// ─── Board API ───────────────────────────────────────────────────────

export async function fetchBoard(boardId: string): Promise<BoardResponse> {
  if (!isValidUuid(boardId)) throw new Error('invalid-board-id');
  return apiFetch<BoardResponse>(`${API_URL}/api/boards/${boardId}`);
}

export async function fetchBoards(workspaceId?: string): Promise<BoardSummary[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set('workspaceId', workspaceId);
  const qs = params.size ? `?${params.toString()}` : '';
  const data = await apiFetch<{ boards: BoardSummary[] }>(`${API_URL}/api/boards${qs}`, {
    cache: 'no-store',
  });
  return Array.isArray(data.boards) ? data.boards : [];
}

export async function createBoard(payload: CreateBoardInput): Promise<CreatedBoard> {
  return apiFetch<CreatedBoard>(`${API_URL}/api/boards`, {
    method: 'POST',
    body: payload,
  });
}

export async function saveBoardStructure(
  boardId: string,
  payload: SaveBoardStructureInput,
): Promise<void> {
  return apiFetch(`${API_URL}/api/boards/${boardId}/nodes`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteBoard(boardId: string): Promise<void> {
  if (!isValidUuid(boardId)) throw new Error('invalid-board-id');
  return apiFetch(`${API_URL}/api/boards/${boardId}`, { method: 'DELETE' });
}

export async function updateBoardMetadata(
  boardId: string,
  payload: UpdateBoardMetadataInput,
): Promise<void> {
  if (!isValidUuid(boardId)) throw new Error('invalid-board-id');
  if (payload.title === undefined && payload.description === undefined) {
    throw new Error('No fields provided for update');
  }
  return apiFetch(`${API_URL}/api/boards/${boardId}`, {
    method: 'PATCH',
    body: payload,
  });
}

// ─── Auth API ────────────────────────────────────────────────────────

export async function registerUser(payload: { email: string; password: string; name?: string }) {
  return apiFetch<{ id: string; email: string }>(`${API_URL}/api/auth/register`, {
    method: 'POST',
    body: payload,
  });
}

export async function loginUser(payload: { email: string; password: string }) {
  return apiFetch<{ id: string; email: string }>(`${API_URL}/api/auth/login`, {
    method: 'POST',
    body: payload,
  });
}

export async function logoutUser() {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch current user');
  return res.json();
}

// ─── Workspace Members API ──────────────────────────────────────────

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  if (!isValidUuid(workspaceId)) throw new Error('invalid-workspace-id');
  const data = await apiFetch<{ members: WorkspaceMember[] }>(
    `${API_URL}/api/workspaces/${workspaceId}/members`,
  );
  return Array.isArray(data.members) ? data.members : [];
}

export async function addWorkspaceMember(
  workspaceId: string,
  payload: { email: string; role: 'owner' | 'editor' | 'viewer' },
): Promise<void> {
  if (!isValidUuid(workspaceId)) throw new Error('invalid-workspace-id');
  return apiFetch(`${API_URL}/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: payload,
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberUserId: string,
): Promise<void> {
  if (!isValidUuid(workspaceId) || !isValidUuid(memberUserId)) {
    throw new Error('invalid-workspace-or-user-id');
  }
  return apiFetch(`${API_URL}/api/workspaces/${workspaceId}/members/${memberUserId}`, {
    method: 'DELETE',
  });
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberUserId: string,
  payload: { role: 'owner' | 'editor' | 'viewer' },
): Promise<void> {
  if (!isValidUuid(workspaceId) || !isValidUuid(memberUserId)) {
    throw new Error('invalid-workspace-or-user-id');
  }
  return apiFetch(`${API_URL}/api/workspaces/${workspaceId}/members/${memberUserId}`, {
    method: 'PATCH',
    body: payload,
  });
}

// ─── File Upload API ────────────────────────────────────────────────

export async function uploadFile(boardId: string, file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadedFile>(
    `${API_URL}/api/files/upload?boardId=${encodeURIComponent(boardId)}`,
    {
      method: 'POST',
      body: formData,
      rawBody: true,
    },
  );
}

export async function deleteFile(fileId: string): Promise<void> {
  return apiFetch(`${API_URL}/api/files/${fileId}`, { method: 'DELETE' });
}

export function getFileUrl(fileId: string): string {
  return `${API_URL}/api/files/${fileId}`;
}

export function getNodeTypeFromMimeType(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

// ── Dataset server storage ──

export type DatasetPayload = {
  tableName: string;
  fileName: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

export type DatasetMeta = {
  id: string;
  tableName: string;
  fileName: string;
  columns: string[];
  rowCount: number;
};

/** Upload dataset rows to server for persistent storage */
export async function saveDatasetToServer(
  boardId: string,
  dataset: DatasetPayload,
): Promise<DatasetMeta> {
  return apiFetch<DatasetMeta>(`${API_URL}/api/boards/${boardId}/datasets`, {
    method: 'POST',
    body: dataset,
  });
}

/** Fetch dataset rows from server (for DuckDB restore after page refresh) */
export async function fetchDatasetFromServer(
  boardId: string,
  tableName: string,
): Promise<DatasetPayload & { rowCount: number }> {
  return apiFetch<DatasetPayload & { rowCount: number }>(
    `${API_URL}/api/boards/${boardId}/datasets/${encodeURIComponent(tableName)}`,
  );
}

/** List all datasets on a board (metadata only, no rows) */
export async function listBoardDatasets(boardId: string): Promise<{ datasets: DatasetMeta[] }> {
  return apiFetch<{ datasets: DatasetMeta[] }>(`${API_URL}/api/boards/${boardId}/datasets`);
}

/** Delete a dataset from server */
export async function deleteDatasetFromServer(boardId: string, tableName: string): Promise<void> {
  return apiFetch<void>(
    `${API_URL}/api/boards/${boardId}/datasets/${encodeURIComponent(tableName)}`,
    { method: 'DELETE' },
  );
}
