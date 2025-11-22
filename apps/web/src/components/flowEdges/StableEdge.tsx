import { memo, useMemo } from "react";
import type { EdgeProps } from "reactflow";
import { BaseEdge, MarkerType, getMarkerEnd, getSmoothStepPath } from "reactflow";

export const StableEdge = memo(
  function StableEdge(props: EdgeProps): JSX.Element {
    const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style } = props;

    const bend = typeof props.data === "object" && props.data && "bend" in props.data ? Number(props.data.bend) || 24 : 24;
    const [pathD] = useMemo(() => {
      return getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 0,
        centerX: undefined,
        centerY: undefined,
        offset: bend,
      });
    }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, bend]);
    const mergedStyle = useMemo(() => ({ stroke: "#111827", strokeWidth: 2, strokeLinecap: "round", ...(style ?? {}) }), [style]);
    const resolvedMarkerEnd = useMemo(
      () => getMarkerEnd(markerEnd ?? { type: MarkerType.ArrowClosed, color: "#111827" }),
      [markerEnd],
    );

    return <BaseEdge id={id} path={pathD} style={mergedStyle} markerEnd={resolvedMarkerEnd} />;
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.sourceX === next.sourceX &&
    prev.sourceY === next.sourceY &&
    prev.sourcePosition === next.sourcePosition &&
    prev.targetX === next.targetX &&
    prev.targetY === next.targetY &&
    prev.targetPosition === next.targetPosition &&
    prev.data === next.data &&
    prev.style === next.style,
);
