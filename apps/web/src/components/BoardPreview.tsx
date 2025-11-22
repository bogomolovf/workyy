"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchBoard } from "../lib/api";

const DEMO_BOARD_ID = process.env.NEXT_PUBLIC_DEMO_BOARD_ID ?? "";

export function BoardPreview() {
  const { data, status } = useQuery({
    queryKey: ["board", DEMO_BOARD_ID, "preview"],
    queryFn: () => fetchBoard(DEMO_BOARD_ID),
    enabled: Boolean(DEMO_BOARD_ID),
  });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Demo board snapshot</h2>
          <p className="text-sm text-slate-400">
            SQL → Python pipeline. Результаты в реальном времени доступны на странице борда.
          </p>
        </div>
        <Link
          className="rounded-md border border-indigo-400 px-3 py-1.5 text-sm font-medium text-indigo-200 hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          href="/board/demo"
        >
          View board
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Nodes</p>
          {!DEMO_BOARD_ID && (
            <p className="mt-2 text-sm text-slate-400">
              Set <code>NEXT_PUBLIC_DEMO_BOARD_ID</code> to show a preview.
            </p>
          )}
          {status === "pending" && DEMO_BOARD_ID && (
            <p className="mt-2 text-sm text-slate-400">Loading nodes…</p>
          )}
          {status === "error" && DEMO_BOARD_ID && (
            <p className="mt-2 text-sm text-red-400">
              Board preview unavailable. Проверьте `NEXT_PUBLIC_DEMO_BOARD_ID`.
            </p>
          )}
          {status === "success" && (
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {data.nodes.map((node) => (
                <li key={node.id} className="rounded border border-slate-800 bg-slate-900/70 p-2">
                  <span className="font-semibold uppercase text-indigo-300">{node.type}</span>
                  <span className="ml-2 text-slate-300">
                    {node.type === "sql"
                      ? (node.payload?.sql as string)?.split("\n")[0]
                      : (node.payload?.python as string)?.split("\n")[0]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Edges</p>
          {status === "success" ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {data.edges.map((edge) => (
                <li key={edge.id} className="rounded border border-slate-800 bg-slate-900/70 p-2">
                  {edge.sourceId} <span className="mx-2 text-slate-500">→</span> {edge.targetId}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Loading…</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-dashed border-slate-700 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
        <p>
          API: <code>GET /api/boards/{DEMO_BOARD_ID || "…"}</code> •{" "}
          <code>POST /api/runs</code> • <code>GET /api/runs</code>
        </p>
      </div>
    </div>
  );
}

