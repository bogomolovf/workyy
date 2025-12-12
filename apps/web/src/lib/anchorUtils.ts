import type { Node, XYPosition } from 'reactflow';
import type { AnchorPoint, Point } from '@workyy/core-domain';

/**
 * Calculates anchor point position for a node
 */
export function calculateAnchorPosition(
  node: Node,
  anchor: AnchorPoint,
): XYPosition | null {
  const nodeX = node.positionAbsolute?.x ?? node.position.x ?? 0;
  const nodeY = node.positionAbsolute?.y ?? node.position.y ?? 0;
  const nodeWidth = node.width ?? (node.measured?.width as number) ?? 280;
  const nodeHeight = node.height ?? (node.measured?.height as number) ?? 320;

  switch (anchor.position) {
    case 'center':
      return {
        x: nodeX + nodeWidth / 2,
        y: nodeY + nodeHeight / 2,
      };

    case 'top':
      return {
        x: nodeX + nodeWidth / 2,
        y: nodeY,
      };

    case 'right':
      return {
        x: nodeX + nodeWidth,
        y: nodeY + nodeHeight / 2,
      };

    case 'bottom':
      return {
        x: nodeX + nodeWidth / 2,
        y: nodeY + nodeHeight,
      };

    case 'left':
      return {
        x: nodeX,
        y: nodeY + nodeHeight / 2,
      };

    case 'top-left':
      return {
        x: nodeX,
        y: nodeY,
      };

    case 'top-right':
      return {
        x: nodeX + nodeWidth,
        y: nodeY,
      };

    case 'bottom-left':
      return {
        x: nodeX,
        y: nodeY + nodeHeight,
      };

    case 'bottom-right':
      return {
        x: nodeX + nodeWidth,
        y: nodeY + nodeHeight,
      };

    case 'boundary':
      // For boundary, we need a target point to calculate the nearest boundary point
      // This will be called with target point in the arrow component
      return null; // Will be calculated dynamically

    case 'custom':
      return {
        x: nodeX + (anchor.customX ?? 0),
        y: nodeY + (anchor.customY ?? 0),
      };

    default:
      return {
        x: nodeX + nodeWidth / 2,
        y: nodeY + nodeHeight / 2,
      };
  }
}

/**
 * Calculates the nearest point on node boundary to a target point
 */
export function calculateNearestBoundaryPoint(
  node: Node,
  targetPoint: XYPosition,
  preferredDirection?: 'left' | 'top' | 'right' | 'bottom',
): XYPosition {
  const nodeX = node.positionAbsolute?.x ?? node.position.x ?? 0;
  const nodeY = node.positionAbsolute?.y ?? node.position.y ?? 0;
  const nodeWidth = node.width ?? (node.measured?.width as number) ?? 280;
  const nodeHeight = node.height ?? (node.measured?.height as number) ?? 320;

  const centerX = nodeX + nodeWidth / 2;
  const centerY = nodeY + nodeHeight / 2;

  // If preferred direction is specified, use it
  if (preferredDirection) {
    switch (preferredDirection) {
      case 'left':
        return { x: nodeX, y: centerY };
      case 'top':
        return { x: centerX, y: nodeY };
      case 'right':
        return { x: nodeX + nodeWidth, y: centerY };
      case 'bottom':
        return { x: centerX, y: nodeY + nodeHeight };
    }
  }

  // Calculate distances to each edge
  const distances = {
    left: Math.abs(targetPoint.x - nodeX),
    top: Math.abs(targetPoint.y - nodeY),
    right: Math.abs(targetPoint.x - (nodeX + nodeWidth)),
    bottom: Math.abs(targetPoint.y - (nodeY + nodeHeight)),
  };

  // Find the closest edge
  const minDistance = Math.min(...Object.values(distances));
  let closestEdge: 'left' | 'top' | 'right' | 'bottom' | null = null;

  for (const [edge, distance] of Object.entries(distances)) {
    if (distance === minDistance) {
      closestEdge = edge as 'left' | 'top' | 'right' | 'bottom';
      break;
    }
  }

  // Calculate intersection point on the closest edge
  switch (closestEdge) {
    case 'left':
      return {
        x: nodeX,
        y: Math.max(nodeY, Math.min(nodeY + nodeHeight, targetPoint.y)),
      };
    case 'top':
      return {
        x: Math.max(nodeX, Math.min(nodeX + nodeWidth, targetPoint.x)),
        y: nodeY,
      };
    case 'right':
      return {
        x: nodeX + nodeWidth,
        y: Math.max(nodeY, Math.min(nodeY + nodeHeight, targetPoint.y)),
      };
    case 'bottom':
      return {
        x: Math.max(nodeX, Math.min(nodeX + nodeWidth, targetPoint.x)),
        y: nodeY + nodeHeight,
      };
    default:
      return { x: centerX, y: centerY };
  }
}

/**
 * Resolves anchor points for source and target nodes
 */
export function resolveAnchorPoints(
  sourceNode: Node | null,
  targetNode: Node | null,
  sourceAnchor: AnchorPoint | undefined,
  targetAnchor: AnchorPoint | undefined,
  sourcePoint: XYPosition,
  targetPoint: XYPosition,
): { source: XYPosition; target: XYPosition } {
  let resolvedSource = sourcePoint;
  let resolvedTarget = targetPoint;

  if (sourceNode && sourceAnchor) {
    if (sourceAnchor.position === 'boundary') {
      resolvedSource = calculateNearestBoundaryPoint(
        sourceNode,
        targetPoint,
        sourceAnchor.preferredDirection,
      );
    } else {
      const anchorPos = calculateAnchorPosition(sourceNode, sourceAnchor);
      if (anchorPos) {
        resolvedSource = anchorPos;
      }
    }
  }

  if (targetNode && targetAnchor) {
    if (targetAnchor.position === 'boundary') {
      resolvedTarget = calculateNearestBoundaryPoint(
        targetNode,
        sourcePoint,
        targetAnchor.preferredDirection,
      );
    } else {
      const anchorPos = calculateAnchorPosition(targetNode, targetAnchor);
      if (anchorPos) {
        resolvedTarget = anchorPos;
      }
    }
  }

  return { source: resolvedSource, target: resolvedTarget };
}


