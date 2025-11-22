import type { NodeProps } from "reactflow";

export function GenericNode({ data }: NodeProps<{ label: string }>) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-xs text-slate-300 shadow">
      {data?.label ?? "Node"}
    </div>
  );
}
