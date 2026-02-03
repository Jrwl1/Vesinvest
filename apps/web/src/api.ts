/**
 * API helper for asset maintenance app.
 * Reads JWT from localStorage and attaches Authorization header.
 */

const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

// Validate API base URL in production
const envApiBase = import.meta.env.VITE_API_BASE_URL;
if (IS_PROD && !envApiBase) {
  throw new Error('VITE_API_BASE_URL is required in production');
}
const API_BASE = envApiBase ?? 'http://localhost:3000';

const TOKEN_KEY = 'access_token';

/**
 * Get the configured API base URL
 */
export function getApiBaseUrl(): string {
  return API_BASE;
}

/**
 * API status type: green (all ok), yellow (api up but db down), red (unreachable)
 */
export type ApiStatus = 'green' | 'yellow' | 'red' | 'checking';

/**
 * Check API liveness (just confirms NestJS is up, no DB required)
 */
export async function checkApiLive(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health/live`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check API readiness (confirms DB is connected)
 */
export async function checkApiReady(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get combined API status: green, yellow, or red
 */
export async function getApiStatus(): Promise<ApiStatus> {
  const live = await checkApiLive();
  if (!live) return 'red';
  const ready = await checkApiReady();
  return ready ? 'green' : 'yellow';
}

export interface DecodedToken {
  sub: string;
  org_id: string;
  roles: string[];
  iat: number;
  exp: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Decode JWT payload (does NOT verify signature - dev only)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Get decoded token info from localStorage
 */
export function getTokenInfo(): DecodedToken | null {
  const token = getToken();
  if (!token) return null;
  return decodeToken(token);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 by trying dev token refresh (dev only) or signaling logout
  if (res.status === 401 && retryOn401) {
    // In dev mode, try to refresh dev token
    if (IS_DEV) {
      try {
        await fetchDevToken();
        return api<T>(path, options, false);
      } catch {
        clearToken();
        throw new Error('Session expired. Please log in again.');
      }
    }
    // In production, clear token and signal need to re-login
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }

  return res.json();
}

/**
 * Login with email/password
 */
export async function login(email: string, password: string, orgId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, orgId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Login failed');
  }

  const data = await res.json();
  const token = data.accessToken;
  setToken(token);
  return token;
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
 * Check if demo mode is enabled (via VITE_DEMO_MODE env var)
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/**
 * Check if demo key is configured (required for demo login to work)
 */
export function hasDemoKey(): boolean {
  return !!import.meta.env.VITE_DEMO_KEY;
}

/**
 * Demo login: calls /auth/demo-login which bootstraps demo data and returns token.
 * Requires API DEMO_MODE=true and matching DEMO_KEY.
 * Throws if VITE_DEMO_KEY is not configured.
 */
export async function demoLogin(): Promise<string> {
  const demoKey = import.meta.env.VITE_DEMO_KEY;

  if (!demoKey) {
    throw new Error('VITE_DEMO_KEY not configured');
  }

  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-demo-key': demoKey,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Demo not enabled on server');
    }
    if (res.status === 429) {
      throw new Error('Demo rate limit exceeded');
    }
    throw new Error(`Demo login failed (${res.status})`);
  }

  const data = await res.json();
  const token = data.accessToken;
  setToken(token);
  console.log('demo-login OK');
  return token;
}

// ============ Asset API ============

import type { Asset, MaintenanceItem, CreateMaintenanceItemPayload } from './types';

export async function getAsset(id: string): Promise<Asset> {
  return api<Asset>(`/assets/${id}`);
}

// ============ Maintenance Items API ============

export async function listMaintenanceItems(assetId: string): Promise<MaintenanceItem[]> {
  return api<MaintenanceItem[]>(`/maintenance-items?assetId=${assetId}`);
}

export async function createMaintenanceItem(
  payload: CreateMaintenanceItemPayload
): Promise<MaintenanceItem> {
  return api<MaintenanceItem>('/maintenance-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
