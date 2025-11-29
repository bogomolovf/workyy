// API client for Workyy Landing to communicate with Workyy Product backend
// This is prepared for future integration (demo signups, etc.)

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface DemoSignupPayload {
  email: string;
  name?: string;
  company?: string;
}

export interface ApiError {
  title: string;
  detail: string;
  status: number;
}

/**
 * Submit a demo signup request
 * This endpoint may not exist yet on the backend, but the client is ready
 */
export async function postDemoSignup(payload: DemoSignupPayload) {
  const res = await fetch(`${API_URL}/api/demo-signups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include', // Important for cookies/sessions
  });

  if (!res.ok) {
    let error: ApiError;
    try {
      error = await res.json();
    } catch {
      error = {
        title: 'Request failed',
        detail: `HTTP ${res.status}: ${res.statusText}`,
        status: res.status,
      };
    }
    throw new Error(error.detail || 'Failed to submit demo request');
  }

  return res.json();
}

/**
 * Health check - verify backend is accessible
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      method: 'GET',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Auth API functions
 */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  workspaces?: Array<{
    id: string;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
  }>;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      credentials: 'include',
    });
    if (res.status === 401) return null;
    if (!res.ok) {
      throw new Error('Failed to fetch current user');
    }
    return res.json();
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

