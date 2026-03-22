/**
 * Generic typed API client — single fetch wrapper used by all API modules.
 */

export const API_URL =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ??
      'http://localhost:4000')
    : (process.env.NEXT_PUBLIC_API_URL ??
      process.env.NEXT_PUBLIC_WS_URL?.replace(/^ws/, 'http') ??
      'http://localhost:4000');

const NETWORK_ERROR_MESSAGE =
  'Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен (./start.sh или pnpm dev).';

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = (err as Error)?.message ?? '';
  return (
    msg === 'Load failed' ||
    msg === 'Failed to fetch' ||
    msg === 'NetworkError when attempting to fetch resource' ||
    /^fetch failed$/i.test(msg)
  );
}

export function isValidUuid(value: string | null | undefined): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip JSON content-type header (e.g. for FormData uploads) */
  rawBody?: boolean;
};

/**
 * Typed fetch wrapper with standard error handling.
 * - Adds credentials: 'include' and JSON headers by default
 * - Parses error detail from JSON problem responses
 * - Wraps network errors with a user-friendly message
 * - Returns `undefined` for 204 No Content
 */
export async function apiFetch<T>(url: string, init?: ApiRequestInit): Promise<T> {
  const { body, rawBody, ...rest } = init ?? {};

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  if (!rawBody && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers,
      body: rawBody ? (body as BodyInit) : body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const problem = await res.json();
        detail = problem?.detail ?? problem?.title ?? detail;
      } catch {
        detail = (await res.text().catch(() => null)) ?? detail;
      }
      throw new Error(detail);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json();
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw err;
  }
}
