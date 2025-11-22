export type DagNode = {
  id: string;
  type: string;
};

export type DagEdge = {
  id: string;
  sourceId: string;
  targetId: string;
};

function buildAdjacency(edges: DagEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceId)) {
      adjacency.set(edge.sourceId, new Set());
    }
    adjacency.get(edge.sourceId)!.add(edge.targetId);
  }
  return adjacency;
}

export function getDownstreamNodeIds(startNodeId: string, edges: DagEdge[]): string[] {
  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>();
  const queue = [startNodeId];
  visited.add(startNodeId);
  const downstream: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbours = adjacency.get(current);
    if (!neighbours) continue;
    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        downstream.push(neighbour);
        queue.push(neighbour);
      }
    }
  }

  return downstream;
}

export function topologicalSort(nodes: DagNode[], edges: DagEdge[]): string[] {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    incoming.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    const targets = adjacency.get(edge.sourceId);
    if (targets) {
      targets.push(edge.targetId);
    }
    incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
  }

  const queue = Array.from(incoming.entries())
    .filter(([, count]) => count === 0)
    .map(([id]) => id);

  const order: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    order.push(nodeId);

    const targets = adjacency.get(nodeId) ?? [];
    for (const target of targets) {
      const count = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, count);
      if (count === 0) {
        queue.push(target);
      }
    }
  }

  return order;
}

export function computeExecutionPlan(
  startNodeId: string,
  nodes: DagNode[],
  edges: DagEdge[],
): { orderedNodeIds: string[]; downstreamNodeIds: string[] } {
  const downstreamNodeIds = getDownstreamNodeIds(startNodeId, edges);
  const relevantNodeIds = new Set([startNodeId, ...downstreamNodeIds]);
  const filteredNodes = nodes.filter((node) => relevantNodeIds.has(node.id));
  const filteredEdges = edges.filter(
    (edge) => relevantNodeIds.has(edge.sourceId) && relevantNodeIds.has(edge.targetId),
  );

  const orderedNodeIds = topologicalSort(filteredNodes, filteredEdges).filter((id) =>
    relevantNodeIds.has(id),
  );

  return {
    orderedNodeIds,
    downstreamNodeIds,
  };
}

