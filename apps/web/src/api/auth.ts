import {
  API_BASE,
  IS_DEV,
  api,
  createApiError,
  getTokenInfo,
  parseApiErrorResponse,
  setToken,
} from './core';

export interface AuthResult {
  accessToken: string;
  user?: {
    userId: string;
    orgId: string;
    roles: string[];
  };
  legal?: {
    requiresUserAcceptance: boolean;
    orgUnlocked: boolean;
    requiresOrgAdminAcceptance: boolean;
    waitingForAdmin: boolean;
  };
}

export async function login(
  email: string,
  password: string,
  orgId?: string,
): Promise<AuthResult> {
  const body: { email: string; password: string; orgId?: string } = {
    email,
    password,
  };
  if (orgId) body.orgId = orgId;
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, {
      ...parsed,
      message: parsed.message || 'Login failed',
    });
  }

  const data = await res.json();
  const token = data.accessToken;
  setToken(token);
  return data as AuthResult;
}

/**
 * Fetch dev token from /auth/dev-token and store it (dev mode only).
 */
export async function fetchDevToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Dev token not available (status: ${res.status})`);
  }

  const data = await res.json();
  const token = data.accessToken;
  setToken(token);
  return token;
}

/**
 * Check if we have a valid (non-expired) token
 */
export function isAuthenticated(): boolean {
  const info = getTokenInfo();
  if (!info) return false;
  // Check expiration (with 60s buffer)
  return info.exp * 1000 > Date.now() + 60000;
}

/**
 * Check if dev mode is enabled
 */
export function isDevMode(): boolean {
  return IS_DEV;
}

/**
 * Result of GET /demo/status. No auth. Never throws.
 * Frontend must use this as the only source of truth for demo mode; do not use VITE_DEMO_MODE for visibility.
 */
export async function createInvitation(input: {
  email: string;
  role?: 'ADMIN' | 'USER' | 'VIEWER';
  expiresInHours?: number;
}): Promise<{
  id: string;
  orgId: string;
  email: string;
  role: string;
  expiresAt: string;
  inviteToken?: string;
}> {
  return api('/auth/invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  name?: string;
}): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/auth/invitations/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Invitation acceptance failed');
  }

  const data = (await res.json()) as AuthResult;
  if (data.accessToken) setToken(data.accessToken);
  return data;
}
