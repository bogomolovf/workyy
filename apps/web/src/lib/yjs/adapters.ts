import type { Node, Edge } from 'reactflow';

// Canvas node type from Workyy
export type CanvasNode = {
  id: string;
  boardId?: string;
  type: string;
  position: { x: number; y: number };
  payload?: Record<string, unknown>;
};

// Canvas edge type from Workyy
export type CanvasEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  metadata: Record<string, unknown>;
};

// ReactFlow display types -> canonical canvas types.
// BoardCanvas maps canonical types to these for rendering (via CELL_TYPE_MAP).
// When converting back we must restore the canonical type so routing logic
// (e.g. handleRunNode checking type === 'database') keeps working.
const DISPLAY_TO_CANONICAL: Record<string, string> = {
  sqlNode: 'sql',
  pythonNode: 'python',
  databaseNode: 'database',
  plotNode: 'plot',
  csvNode: 'csv',
  textNode: 'text',
  voiceNode: 'voice',
  imageNode: 'image',
  videoNode: 'video',
  documentNode: 'document',
  notebookNode: 'notebook',
  pythonCellNode: 'pythonCell',
  markdownCellNode: 'markdownCell',
  sqlCellNode: 'sqlCell',
  notebookFrameNode: 'notebookFrame',
  shapeNode: 'shape',
};

/**
 * Convert CanvasNode to ReactFlow Node
 */
export function canvasNodeToReactFlowNode(canvasNode: CanvasNode): Node {
  return {
    id: canvasNode.id,
    type: canvasNode.type,
    position: canvasNode.position,
    data: {
      ...canvasNode.payload,
      // Store original canvas node data for reference
      _canvasNode: canvasNode,
    },
  };
}

/**
 * Convert ReactFlow Node to CanvasNode
 */
export function reactFlowNodeToCanvasNode(reactFlowNode: Node): CanvasNode {
  const canvasNode = (reactFlowNode.data as any)?._canvasNode;
  if (canvasNode) {
    // Always use the canonical type stored in _canvasNode, not the ReactFlow
    // display type (e.g. 'databaseNode') which BoardCanvas sets via CELL_TYPE_MAP.
    return {
      ...canvasNode,
      id: reactFlowNode.id,
      type: canvasNode.type,
      position: reactFlowNode.position,
    };
  }

  // Fallback: create from ReactFlow node
  // For pen nodes, ensure points and initialSize are preserved in payload
  const data = reactFlowNode.data as any;
  const isPenNode = reactFlowNode.type === 'pen' || data?.points !== undefined;

  if (isPenNode) {
    return {
      id: reactFlowNode.id,
      type: 'pen',
      position: reactFlowNode.position,
      payload: {
        points: data.points ?? [],
        initialSize: data.initialSize ?? { width: 100, height: 100 },
        // Preserve pen settings (color, stroke, opacity, etc.)
        color: data.color,
        strokeWidth: data.strokeWidth,
        opacity: data.opacity,
        smoothing: data.smoothing,
        thinning: data.thinning,
      },
    };
  }

  const rawType = reactFlowNode.type ?? '';
  return {
    id: reactFlowNode.id,
    type: (DISPLAY_TO_CANONICAL[rawType] ?? rawType) || 'note',
    position: reactFlowNode.position,
    payload: data,
  };
}

/**
 * Convert CanvasEdge to ReactFlow Edge
 */
export function canvasEdgeToReactFlowEdge(canvasEdge: CanvasEdge): Edge {
  return {
    id: canvasEdge.id,
    source: canvasEdge.sourceId,
    target: canvasEdge.targetId,
    data: canvasEdge.metadata,
  };
}

/**
 * Convert ReactFlow Edge to CanvasEdge
 */
export function reactFlowEdgeToCanvasEdge(reactFlowEdge: Edge): CanvasEdge {
  return {
    id: reactFlowEdge.id,
    sourceId: reactFlowEdge.source,
    targetId: reactFlowEdge.target,
    metadata: (reactFlowEdge.data as Record<string, unknown>) || {},
  };
}
