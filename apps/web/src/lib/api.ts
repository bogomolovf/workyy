export type BoardResponse = {
  board: {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
  };
  nodes: Array<{
    id: string;
    boardId: string;
    type:
      | 'sql'
      | 'python'
      | 'table'
      | 'plot'
      | 'note'
      | 'text'
      | 'shape'
      | 'image'
      | 'video'
      | 'document'
      | 'pen'
      | 'database'
      | 'voice';
    position: { x: number; y: number };
    payload?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }>;
};

const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ??
      'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ??
      'http://localhost:4000');

const NETWORK_ERROR_MESSAGE =
  'Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен (./start.sh или pnpm dev).';

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = (err as Error)?.message ?? '';
  return (
    msg === 'Load failed' ||
    msg === 'Failed to fetch' ||
    msg === 'NetworkError when attempting to fetch resource' ||
    /^fetch failed$/i.test(msg)
  );
}

export function isValidUuid(value: string | null | undefined): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function fetchBoard(boardId: string): Promise<BoardResponse> {
  if (!isValidUuid(boardId)) {
    throw new Error('invalid-board-id');
  }

  const res = await fetch(`${API_URL}/api/boards/${boardId}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to load board');
  }
  return res.json();
}

export type BoardSummary = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    nodes: number;
    edges: number;
  };
};

export async function fetchBoards(workspaceId?: string): Promise<BoardSummary[]> {
  const params = new URLSearchParams();
  if (workspaceId) {
    params.set('workspaceId', workspaceId);
  }

  const res = await fetch(`${API_URL}/api/boards${params.size ? `?${params.toString()}` : ''}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to load boards');
  }

  const data = await res.json();
  return Array.isArray(data.boards) ? (data.boards as BoardSummary[]) : [];
}

export type CreateBoardInput = {
  workspaceId: string;
  title: string;
  description?: string | null;
};

export type CreatedBoard = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function createBoard(payload: CreateBoardInput): Promise<CreatedBoard> {
  const res = await fetch(`${API_URL}/api/boards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = 'Failed to create board';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }

  return res.json();
}

// Persisted node type must accept all types that server API supports
export type PersistedNode = {
  id: string;
  type:
    | 'sql'
    | 'python'
    | 'table'
    | 'plot'
    | 'note'
    | 'text'
    | 'shape'
    | 'image'
    | 'video'
    | 'document'
    | 'pen'
    | 'database'
    | 'voice';
  position: { x: number; y: number };
  payload?: Record<string, unknown>;
  boardId?: string;
};

export type EdgeHandleMetadata = {
  sourceHandleId?: string; // "left" | "top" | "right" | "bottom" | undefined
  targetHandleId?: string;
};

export type PersistedEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  metadata?: EdgeHandleMetadata & Record<string, unknown>;
};

export type SaveBoardStructureInput = {
  nodes: PersistedNode[];
  edges: PersistedEdge[];
};

export async function saveBoardStructure(
  boardId: string,
  payload: SaveBoardStructureInput,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/boards/${boardId}/nodes`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = 'Failed to save board';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }
}

export async function deleteBoard(boardId: string): Promise<void> {
  if (!isValidUuid(boardId)) {
    throw new Error('invalid-board-id');
  }

  const res = await fetch(`${API_URL}/api/boards/${boardId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = 'Failed to delete board';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }
}

export type UpdateBoardMetadataInput = {
  title?: string;
  description?: string | null;
};

export async function updateBoardMetadata(
  boardId: string,
  payload: UpdateBoardMetadataInput,
): Promise<void> {
  if (!isValidUuid(boardId)) {
    throw new Error('invalid-board-id');
  }

  if (payload.title === undefined && payload.description === undefined) {
    throw new Error('No fields provided for update');
  }

  const res = await fetch(`${API_URL}/api/boards/${boardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = 'Failed to update board';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }
}

// Auth API functions

export async function registerUser(payload: { email: string; password: string; name?: string }) {
  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorDetail = 'Registration failed';
      try {
        const error = await res.json();
        errorDetail = error.detail || error.title || errorDetail;
        console.error('Registration error:', error);
      } catch {
        const text = await res.text().catch(() => '');
        errorDetail = text || errorDetail;
        console.error('Registration failed with status:', res.status, text);
      }
      throw new Error(errorDetail);
    }

    return res.json();
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      console.error('Registration network error:', err);
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    if (err instanceof Error && err.message) throw err;
    console.error('Registration error:', err);
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

export async function loginUser(payload: { email: string; password: string }) {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let errorDetail = 'Login failed';
      try {
        const error = (await res.json()) as { detail?: string; title?: string };
        errorDetail = error.detail ?? error.title ?? errorDetail;
      } catch {
        // non-JSON response
      }
      throw new Error(errorDetail);
    }
    return res.json();
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      console.error('Login network error:', err);
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw err;
  }
}

export async function logoutUser() {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    credentials: 'include',
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error('Failed to fetch current user');
  }
  return res.json();
}

// File upload API

export type UploadedFile = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

export async function uploadFile(boardId: string, file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/files/upload?boardId=${encodeURIComponent(boardId)}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    let detail = 'Failed to upload file';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }

  return res.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/files/${fileId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok && res.status !== 204) {
    let detail = 'Failed to delete file';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }
}

export function getFileUrl(fileId: string): string {
  return `${API_URL}/api/files/${fileId}`;
}

// Determine node type from MIME type
export function getNodeTypeFromMimeType(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}
