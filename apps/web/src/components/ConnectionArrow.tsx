import { memo, useMemo } from 'react';

type Point = { x: number; y: number };

type ConnectionArrowProps = {
  id: string;
  from: Point;
  to: Point;
  color?: string;
  width?: number;
};

export const ConnectionArrow = memo(function ConnectionArrow({
  id,
  from,
  to,
  color = 'var(--slate-400)',
  width = 2.5,
}: ConnectionArrowProps) {
  const path = useMemo(() => `M${from.x},${from.y} L${to.x},${to.y}`, [from.x, from.y, to.x, to.y]);

  return (
    <path key={id} d={path} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
  );
});
