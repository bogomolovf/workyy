import type { SqlResult, PythonResult } from "../state/executionStore";
import { runPythonInPool } from "../workers/pythonClient";

function prepareSqlContext(sqlResult?: SqlResult | null) {
  if (!sqlResult) return null;
  return JSON.stringify(sqlResult);
}

export type PythonExecutionOutput = PythonResult & {
  success: boolean;
  error?: string;
};

export async function runPython(
  code: string,
  context: { sqlResult?: SqlResult | null },
  options?: { timeoutMs?: number },
): Promise<PythonExecutionOutput> {
  // Use JSON-only transport for reliability in pyodide
  const sqlArrowBuffer = undefined;
  return runPythonInPool(
    {
      code,
      sqlResultJson: prepareSqlContext(context.sqlResult),
      sqlArrowIpc: sqlArrowBuffer ?? null,
    },
    { timeoutMs: options?.timeoutMs ?? 20000 },
  );
}


