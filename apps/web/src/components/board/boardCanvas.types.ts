import type { EdgeChange, NodeChange } from 'reactflow';

import type { ExecutionEntry } from '../../state/executionStore';

export type CanvasNodeType =
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

export type BoardCanvasProps = {
  board: {
    id: string;
    workspaceId: string;
    title: string;
    userInfo?: { userId?: string; userName?: string };
  };
  nodes: Array<{
    id: string;
    boardId?: string;
    type: CanvasNodeType;
    position: { x: number; y: number };
    payload?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }>;
  executionEntries: Record<string, ExecutionEntry | undefined>;
  onCodeChange: (nodeId: string, code: string) => void;
  onRunNode: (nodeId: string) => void;
  onRunNodeFull?: (nodeId: string) => void;
  onRunDownstream: (nodeId: string) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onNodesChange?: (nodes: BoardCanvasProps['nodes']) => void;
  onEdgesChange?: (edges: BoardCanvasProps['edges']) => void;
  yjsOnNodesChange?: (changes: NodeChange[]) => void;
  yjsOnEdgesChange?: (changes: EdgeChange[]) => void;
  cursorsMap?: any;
  editingMap?: any;
  commentDragMap?: any;
  presentationBroadcastsMap?: any;
  ydoc?: { transact: (fn: () => void, origin?: unknown) => void } | null;
  clientId?: string;
  userInfo?: { userId?: string; userName?: string };
  onCsvDatasetAdded?: (dataset: {
    tableName: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
  }) => void;
  onOpenPresentationViewer?: (nodeId: string, followMode?: boolean) => void;
};

export type NodeData = {
  nodeId: string;
  nodeType: 'sql' | 'python';
  nodeKind: 'sql' | 'python' | 'table' | 'plot';
  execution?: ExecutionEntry;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onRunFull?: () => void;
  onRunDownstream: () => void;
  width: number;
  isCodeCollapsed: boolean;
  onToggleCodeCollapsed: () => void;
};
