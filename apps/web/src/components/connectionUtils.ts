import type { Connection } from "reactflow";

export type ConnectionOrigin = {
  nodeId: string | null;
  handleType: "source" | "target" | null;
};

export function resolveConnectionEndpoints(connection: Connection, origin: ConnectionOrigin | null): {
  sourceId?: string;
  targetId?: string;
} {
  let sourceId = connection.source ?? undefined;
  let targetId = connection.target ?? undefined;

  if (origin?.handleType === "target") {
    sourceId = origin.nodeId ?? undefined;
    const possibleTargets = [connection.source, connection.target].filter(
      (candidate) => candidate && candidate !== sourceId,
    );
    targetId = possibleTargets[0];
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
    return { sourceId: undefined, targetId: undefined };
  }

  return { sourceId, targetId };
}


