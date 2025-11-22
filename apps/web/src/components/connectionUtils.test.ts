import { describe, it, expect } from "vitest";
import type { Connection } from "reactflow";
import { resolveConnectionEndpoints } from "./connectionUtils";

describe("resolveConnectionEndpoints", () => {
  it("keeps default direction when starting from a source handle", () => {
    const connection: Connection = { source: "sql-a", target: "py-b" };
    const { sourceId, targetId } = resolveConnectionEndpoints(connection, null);
    expect(sourceId).toBe("sql-a");
    expect(targetId).toBe("py-b");
  });

  it("flips direction when the drag started from a target handle", () => {
    const connection: Connection = { source: "py-b", target: "sql-a" };
    const { sourceId, targetId } = resolveConnectionEndpoints(connection, {
      nodeId: "sql-a",
      handleType: "target",
    });
    expect(sourceId).toBe("sql-a");
    expect(targetId).toBe("py-b");
  });
});


