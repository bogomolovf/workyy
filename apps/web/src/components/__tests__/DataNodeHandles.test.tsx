import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "reactflow";
import { DataNodeHandles } from "../BoardCanvas";

describe("DataNodeHandles", () => {
  it("renders handles for all four sides", () => {
    const { container } = render(
      <ReactFlowProvider>
        <div>
          <DataNodeHandles />
        </div>
      </ReactFlowProvider>,
    );

    ["left", "right", "top", "bottom"].forEach((id) => {
      expect(container.querySelector(`[data-handle-id="${id}"]`)).not.toBeNull();
    });
  });
});


