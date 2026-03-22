/** Types for the main board/workspace/auth API */

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
    type: NodeType;
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

export type NodeType =
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
  | 'draw'
  | 'pen'
  | 'database'
  | 'csv'
  | 'voice'
  | 'notebook'
  | 'pythonCell'
  | 'markdownCell'
  | 'sqlCell'
  | 'notebookFrame';

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

export type UpdateBoardMetadataInput = {
  title?: string;
  description?: string | null;
};

export type PersistedNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  payload?: Record<string, unknown>;
  boardId?: string;
};

export type EdgeHandleMetadata = {
  sourceHandleId?: string;
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

export type WorkspaceMember = {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: string;
};

export type UploadedFile = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};
