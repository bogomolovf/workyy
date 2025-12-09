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
      | 'pen'
      | 'database';
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
    | 'pen'
    | 'database';
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
      headers: { 'Content-Type': 'application/json' },
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
  } catch (err: any) {
    if (err.message) {
      throw err;
    }
    // Network error or other issues
    console.error('Registration network error:', err);
    throw new Error(
      'Failed to connect to server. Make sure backend is running on http://localhost:4000',
    );
  }
}

export async function loginUser(payload: { email: string; password: string }) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Login failed');
  }
  return res.json();
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

// Workspace members API functions

export type WorkspaceMember = {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: string;
};

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  if (!isValidUuid(workspaceId)) {
    throw new Error('invalid-workspace-id');
  }

  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/members`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = 'Failed to load workspace members';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }

  const data = await res.json();
  return Array.isArray(data.members) ? (data.members as WorkspaceMember[]) : [];
}

export type AddWorkspaceMemberInput = {
  email: string;
  role?: 'owner' | 'editor' | 'viewer';
};

export type AddedWorkspaceMember = {
  userId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'editor' | 'viewer';
};

export async function addWorkspaceMember(
  workspaceId: string,
  payload: AddWorkspaceMemberInput,
): Promise<AddedWorkspaceMember> {
  if (!isValidUuid(workspaceId)) {
    throw new Error('invalid-workspace-id');
  }

  const res = await fetch(`${API_URL}/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = 'Failed to add member';
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

export async function removeWorkspaceMember(
  workspaceId: string,
  memberUserId: string,
): Promise<void> {
  if (!isValidUuid(workspaceId) || !isValidUuid(memberUserId)) {
    throw new Error('invalid-id');
  }

  const res = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/members/${memberUserId}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    },
  );

  if (!res.ok) {
    let detail = 'Failed to remove member';
    try {
      const problem = await res.json();
      detail = problem?.detail ?? detail;
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
  }
}

export type UpdateWorkspaceMemberRoleInput = {
  role: 'owner' | 'editor' | 'viewer';
};

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberUserId: string,
  payload: UpdateWorkspaceMemberRoleInput,
): Promise<{ userId: string; role: 'owner' | 'editor' | 'viewer' }> {
  if (!isValidUuid(workspaceId) || !isValidUuid(memberUserId)) {
    throw new Error('invalid-id');
  }

  const res = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/members/${memberUserId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    let detail = 'Failed to update member role';
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
