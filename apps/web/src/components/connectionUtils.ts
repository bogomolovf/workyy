import type { Connection, Node, XYPosition } from 'reactflow';
import { Position } from 'reactflow';

export type ConnectionOrigin = {
  nodeId: string | null;
  handleType: 'source' | 'target' | null;
  handleId: string | null; // ID of the handle (left, top, right, bottom)
};

export type HandleType = 'source' | 'target';

// Handle positions for data nodes
const DATA_NODE_HANDLE_POSITIONS = [
  { id: 'left', type: 'target' as const, position: Position.Left },
  { id: 'top', type: 'target' as const, position: Position.Top },
  { id: 'right', type: 'source' as const, position: Position.Right },
  { id: 'bottom', type: 'source' as const, position: Position.Bottom },
] as const;

/**
 * Calculates the position of a handle on a node based on its position and dimensions
 */
function getHandlePosition(node: Node, handleId: 'left' | 'top' | 'right' | 'bottom'): XYPosition {
  const nodeX = node.positionAbsolute?.x ?? node.position.x ?? 0;
  const nodeY = node.positionAbsolute?.y ?? node.position.y ?? 0;
  const nodeWidth = node.width ?? (node.measured?.width as number) ?? 280;
  const nodeHeight = node.height ?? (node.measured?.height as number) ?? 320;

  switch (handleId) {
    case 'left':
      return { x: nodeX, y: nodeY + nodeHeight / 2 };
    case 'right':
      return { x: nodeX + nodeWidth, y: nodeY + nodeHeight / 2 };
    case 'top':
      return { x: nodeX + nodeWidth / 2, y: nodeY };
    case 'bottom':
      return { x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight };
    default:
      return { x: nodeX + nodeWidth / 2, y: nodeY + nodeHeight / 2 };
  }
}

/**
 * Finds the nearest handle ID for a data node based on mouse position
 * Only considers handles of the specified type (source or target)
 */
export function findNearestHandleId(
  node: Node,
  mousePosition: XYPosition,
  handleType: HandleType,
): string | undefined {
  // Check if this is a data node (has the standard 4 handles)
  // We'll check by node type or by checking if it has data-node handles
  const isDataNode =
    node.type === 'sqlNode' ||
    node.type === 'pythonNode' ||
    node.type === 'plotNode' ||
    node.type === 'databaseNode' ||
    node.type === 'csvNode' ||
    node.type === 'notebookNode';

  if (!isDataNode) {
    return undefined;
  }

  // Filter handles by type
  const candidateHandles = DATA_NODE_HANDLE_POSITIONS.filter((h) => h.type === handleType);

  if (candidateHandles.length === 0) {
    return undefined;
  }

  // Calculate distances to each handle
  let minDistance = Infinity;
  let nearestHandleId: string | undefined;

  for (const handle of candidateHandles) {
    const handlePos = getHandlePosition(node, handle.id);
    const distance = Math.sqrt(
      Math.pow(mousePosition.x - handlePos.x, 2) + Math.pow(mousePosition.y - handlePos.y, 2),
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestHandleId = handle.id;
    }
  }

  return nearestHandleId;
}

/**
 * Gets the position of a handle on a node
 */
export function getHandlePositionForNode(node: Node, handleId: string): XYPosition | undefined {
  if (handleId !== 'left' && handleId !== 'top' && handleId !== 'right' && handleId !== 'bottom') {
    return undefined;
  }
  return getHandlePosition(node, handleId);
}

export function resolveConnectionEndpoints(
  connection: Connection,
  origin: ConnectionOrigin | null,
): {
  sourceId?: string;
  targetId?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
} {
  let sourceId = connection.source ?? undefined;
  let targetId = connection.target ?? undefined;
  let sourceHandle = connection.sourceHandle;
  let targetHandle = connection.targetHandle;

  if (origin?.handleType === 'target') {
    // Пользователь начал тянуть из target'а
    // Нужно развернуть соединение
    sourceId = origin.nodeId ?? undefined;
    const possibleTargets = [connection.source, connection.target].filter(
      (candidate) => candidate && candidate !== sourceId,
    );
    targetId = possibleTargets[0];
    // Меняем местами handle'ы при развороте
    [sourceHandle, targetHandle] = [targetHandle, sourceHandle];
  } else {
    if (!sourceId && origin?.nodeId) {
      sourceId = origin.nodeId ?? undefined;
    }
    if (!targetId && connection.target && connection.target !== sourceId) {
      targetId = connection.target;
    }
    if (!targetId && connection.source && connection.source !== sourceId) {
      targetId = connection.source;
    }
  }

  if (!sourceId || !targetId || sourceId === targetId) {
    return {
      sourceId: undefined,
      targetId: undefined,
      sourceHandle: undefined,
      targetHandle: undefined,
    };
  }

  return { sourceId, targetId, sourceHandle, targetHandle };
}
