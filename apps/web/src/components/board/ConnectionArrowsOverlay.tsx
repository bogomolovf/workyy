import { useMemo } from 'react';
import { Edge, useReactFlow, useViewport } from 'reactflow';

import { ConnectionArrow } from '../ConnectionArrow';

type ConnectionArrowsOverlayProps = {
  edges: Edge[];
};

export function ConnectionArrowsOverlay({ edges }: ConnectionArrowsOverlayProps) {
  const { getNode } = useReactFlow();
  const viewport = useViewport();

  const segments = useMemo(() => {
    const pairs: Array<{
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }> = [];

    for (const edge of edges) {
      const source = getNode(edge.source);
      const target = getNode(edge.target);
      if (!source || !target) continue;
      if (source.hidden || target.hidden) continue;
      const sourceWidth = source.width ?? 0;
      const sourceHeight = source.height ?? 0;
      const targetWidth = target.width ?? 0;
      const targetHeight = target.height ?? 0;
      const sourcePos = source.positionAbsolute ?? source.position ?? { x: 0, y: 0 };
      const targetPos = target.positionAbsolute ?? target.position ?? { x: 0, y: 0 };

      pairs.push({
        id: edge.id,
        from: {
          x: sourcePos.x + sourceWidth / 2,
          y: sourcePos.y + sourceHeight / 2,
        },
        to: {
          x: targetPos.x + targetWidth / 2,
          y: targetPos.y + targetHeight / 2,
        },
      });
    }

    return pairs;
  }, [edges, getNode]);

  if (segments.length === 0) {
    return null;
  }

  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      style={{ transform, transformOrigin: '0 0' }}
      role="presentation"
    >
      {segments.map((segment) => (
        <ConnectionArrow key={segment.id} id={segment.id} from={segment.from} to={segment.to} />
      ))}
    </svg>
  );
}
