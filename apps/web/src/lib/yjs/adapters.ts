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
    // Preserve original canvas node structure
    return {
      ...canvasNode,
      id: reactFlowNode.id,
      type: reactFlowNode.type || canvasNode.type,
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
      },
    };
  }

  return {
    id: reactFlowNode.id,
    type: reactFlowNode.type || 'note',
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

