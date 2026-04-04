type NodeRect = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
};

type PositionUpdate = { id: string; position: { x: number; y: number } };

export function alignLeft(nodes: NodeRect[]): PositionUpdate[] {
  const minX = Math.min(...nodes.map((n) => n.position.x));
  return nodes.map((n) => ({ id: n.id, position: { x: minX, y: n.position.y } }));
}

export function alignRight(nodes: NodeRect[]): PositionUpdate[] {
  const maxRight = Math.max(...nodes.map((n) => n.position.x + n.width));
  return nodes.map((n) => ({
    id: n.id,
    position: { x: maxRight - n.width, y: n.position.y },
  }));
}

export function alignTop(nodes: NodeRect[]): PositionUpdate[] {
  const minY = Math.min(...nodes.map((n) => n.position.y));
  return nodes.map((n) => ({ id: n.id, position: { x: n.position.x, y: minY } }));
}

export function alignBottom(nodes: NodeRect[]): PositionUpdate[] {
  const maxBottom = Math.max(...nodes.map((n) => n.position.y + n.height));
  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.position.x, y: maxBottom - n.height },
  }));
}

export function alignCenterH(nodes: NodeRect[]): PositionUpdate[] {
  const centers = nodes.map((n) => n.position.x + n.width / 2);
  const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
  return nodes.map((n) => ({
    id: n.id,
    position: { x: avg - n.width / 2, y: n.position.y },
  }));
}

export function alignCenterV(nodes: NodeRect[]): PositionUpdate[] {
  const centers = nodes.map((n) => n.position.y + n.height / 2);
  const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
  return nodes.map((n) => ({
    id: n.id,
    position: { x: n.position.x, y: avg - n.height / 2 },
  }));
}

export function distributeH(nodes: NodeRect[]): PositionUpdate[] {
  if (nodes.length < 3) return nodes.map((n) => ({ id: n.id, position: n.position }));
  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
  const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0);
  const totalSpan =
    sorted[sorted.length - 1].position.x + sorted[sorted.length - 1].width - sorted[0].position.x;
  const gap = (totalSpan - totalWidth) / (sorted.length - 1);
  let x = sorted[0].position.x;
  return sorted.map((n) => {
    const pos = { id: n.id, position: { x, y: n.position.y } };
    x += n.width + gap;
    return pos;
  });
}

export function distributeV(nodes: NodeRect[]): PositionUpdate[] {
  if (nodes.length < 3) return nodes.map((n) => ({ id: n.id, position: n.position }));
  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0);
  const totalSpan =
    sorted[sorted.length - 1].position.y + sorted[sorted.length - 1].height - sorted[0].position.y;
  const gap = (totalSpan - totalHeight) / (sorted.length - 1);
  let y = sorted[0].position.y;
  return sorted.map((n) => {
    const pos = { id: n.id, position: { x: n.position.x, y } };
    y += n.height + gap;
    return pos;
  });
}
