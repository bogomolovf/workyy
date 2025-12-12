'use client';

import { memo, useMemo } from 'react';
import type { EdgeProps } from 'reactflow';
import { useReactFlow, BaseEdge } from 'reactflow';
import type { ArrowConfig, ArrowHeadType, ArrowHeadConfig } from '@workyy/core-domain';
import {
  generateArrowPath,
  generateArrowHeadPath,
  calculateAngle,
  type Point,
} from '../../lib/arrowUtils';
import { resolveAnchorPoints } from '../../lib/anchorUtils';
import { ArrowTextLabel } from './ArrowTextLabel';

type ArrowEdgeProps = EdgeProps & {
  data?: {
    arrowConfig?: ArrowConfig;
  };
};

/**
 * Arrow edge component that supports all arrow types and styles
 */
export const ArrowEdge = memo(function ArrowEdge(props: ArrowEdgeProps): JSX.Element {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    data,
  } = props;

  const { getNode } = useReactFlow();

  // Get arrow configuration from edge data or use defaults
  const arrowConfig: ArrowConfig = data?.arrowConfig || {
    shapeType: 'straight',
    headPlacement: 'end',
    lineStyle: {
      width: 2,
      color: '#94a3b8',
      dashArray: 'solid',
    },
    headEnd: {
      type: 'triangle',
      size: 8,
    },
    orthogonalOffset: 24,
  };

  // Resolve anchor points if specified
  const sourceNode = props.source ? getNode(props.source) : null;
  const targetNode = props.target ? getNode(props.target) : null;

  const { source: resolvedSource, target: resolvedTarget } = useMemo(
    () =>
      resolveAnchorPoints(
        sourceNode,
        targetNode,
        arrowConfig.sourceAnchor,
        arrowConfig.targetAnchor,
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
      ),
    [
      sourceNode,
      targetNode,
      arrowConfig.sourceAnchor,
      arrowConfig.targetAnchor,
      sourceX,
      sourceY,
      targetX,
      targetY,
    ],
  );

  // Generate path based on arrow shape type
  const pathD = useMemo(
    () =>
      generateArrowPath(
        arrowConfig.shapeType,
        resolvedSource,
        resolvedTarget,
        arrowConfig,
      ),
    [arrowConfig.shapeType, resolvedSource, resolvedTarget, arrowConfig],
  );

  // Prepare line style
  const lineStyle = useMemo(() => {
    const lineConfig = arrowConfig.lineStyle || {
      width: 2,
      color: '#94a3b8',
      dashArray: 'solid',
    };

    const strokeDasharray =
      lineConfig.dashArray === 'solid' ? 'none' : lineConfig.dashArray;

    return {
      stroke: lineConfig.color,
      strokeWidth: lineConfig.width,
      strokeDasharray,
      fill: 'none',
      strokeLinecap: 'round' as const,
      ...style,
    };
  }, [arrowConfig.lineStyle, style]);

  // Generate markers for arrow heads
  const markers = useMemo(() => {
    const markerElements: JSX.Element[] = [];
    const headPlacement = arrowConfig.headPlacement || 'end';

    // Determine which heads to show
    const showStart = headPlacement === 'start' || headPlacement === 'both';
    const showEnd = headPlacement === 'end' || headPlacement === 'both';

    // Start head
    if (showStart && arrowConfig.headStart) {
      const head = arrowConfig.headStart;
      const markerId = `arrow-head-start-${id}`;
      const headColor = head.color || arrowConfig.lineStyle?.color || '#94a3b8';
      const headSize = head.size || 8;
      const path = generateArrowHeadPath(head.type, headSize);
      markerElements.push(
        <marker
          key={markerId}
          id={markerId}
          markerWidth={headSize}
          markerHeight={headSize}
          refX={headSize}
          refY={headSize / 2}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d={path} fill={headColor} stroke={headColor} />
        </marker>,
      );
    }

    // End head
    if (showEnd && arrowConfig.headEnd) {
      const head = arrowConfig.headEnd;
      const markerId = `arrow-head-end-${id}`;
      const headColor = head.color || arrowConfig.lineStyle?.color || '#94a3b8';
      const headSize = head.size || 8;
      const path = generateArrowHeadPath(head.type, headSize);
      markerElements.push(
        <marker
          key={markerId}
          id={markerId}
          markerWidth={headSize}
          markerHeight={headSize}
          refX={headSize}
          refY={headSize / 2}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d={path} fill={headColor} stroke={headColor} />
        </marker>,
      );
    }

    return markerElements;
  }, [id, arrowConfig.headPlacement, arrowConfig.headStart, arrowConfig.headEnd, arrowConfig.lineStyle]);

  // Calculate marker references (ReactFlow expects URL format)
  const markerStartId = useMemo(() => {
    const headPlacement = arrowConfig.headPlacement || 'end';
    if (headPlacement === 'start' || headPlacement === 'both') {
      return `url(#arrow-head-start-${id})`;
    }
    return undefined;
  }, [id, arrowConfig.headPlacement]);

  const markerEndId = useMemo(() => {
    const headPlacement = arrowConfig.headPlacement || 'end';
    if (headPlacement === 'end' || headPlacement === 'both') {
      return `url(#arrow-head-end-${id})`;
    }
    return undefined;
  }, [id, arrowConfig.headPlacement]);

  // Calculate text label position
  const textLabelPosition = useMemo(() => {
    if (!arrowConfig.textLabel) return null;

    const midX = (resolvedSource.x + resolvedTarget.x) / 2;
    const midY = (resolvedSource.y + resolvedTarget.y) / 2;
    const angle = calculateAngle(resolvedSource, resolvedTarget);

    let x = midX;
    let y = midY;

    switch (arrowConfig.textLabel.position) {
      case 'start':
        x = resolvedSource.x;
        y = resolvedSource.y;
        break;
      case 'end':
        x = resolvedTarget.x;
        y = resolvedTarget.y;
        break;
      case 'middle':
      default:
        x = midX;
        y = midY;
        break;
    }

    // Apply offset if specified
    if (arrowConfig.textLabel.offset) {
      x += arrowConfig.textLabel.offset.x;
      y += arrowConfig.textLabel.offset.y;
    }

    return { x, y, angle };
  }, [arrowConfig.textLabel, resolvedSource, resolvedTarget]);

  return (
    <>
      <defs>{markers}</defs>
      <BaseEdge
        id={id}
        path={pathD}
        style={lineStyle}
        markerStart={markerStartId}
        markerEnd={markerEndId}
      />
      {arrowConfig.textLabel && textLabelPosition && (
        <ArrowTextLabel
          text={arrowConfig.textLabel.text}
          x={textLabelPosition.x}
          y={textLabelPosition.y}
          angle={textLabelPosition.angle}
          style={arrowConfig.textLabel.style}
        />
      )}
    </>
  );
});

