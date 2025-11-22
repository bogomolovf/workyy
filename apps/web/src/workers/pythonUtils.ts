export function cleanStderr(raw: string): string {
  if (!raw) return "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*exec>:\d+:\s*/, "").trim())
    .filter(Boolean)
    .join("\n");
}

export function formatResultLine(resultPayload: unknown): string | null {
  if (resultPayload === undefined || resultPayload === null) {
    return null;
  }

  if (
    typeof resultPayload === "object" &&
    resultPayload &&
    "value" in (resultPayload as Record<string, unknown>) &&
    ((resultPayload as Record<string, unknown>).value === "undefined" ||
      (resultPayload as Record<string, unknown>).value === undefined ||
      (resultPayload as Record<string, unknown>).value === null)
  ) {
    return null;
  }

  try {
    return JSON.stringify(resultPayload);
  } catch {
    return String(resultPayload);
  }
}


