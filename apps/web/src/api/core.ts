/**
 * API helper for the Vesipolku app.
 * Reads JWT from sessionStorage (legacy localStorage migration) and attaches Authorization header.
 */
export const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

/** In dev with no env: use same-origin /api so single Cloudflare tunnel works (Vite proxies /api -> localhost:3000). */
const DEFAULT_DEV_API_BASE_RELATIVE = '/api';

const raw = import.meta.env.VITE_API_BASE_URL;
const envApiBase = raw === undefined || raw === null ? '' : String(raw).trim();
if (IS_PROD && !envApiBase) {
  throw new Error('VITE_API_BASE_URL is required in production');
}
// If set, use VITE_API_BASE_URL; else in dev use same-origin /api (works with single tunnel).
export const API_BASE = envApiBase
  ? envApiBase.replace(/\/+$/, '')
  : IS_DEV
  ? DEFAULT_DEV_API_BASE_RELATIVE
  : envApiBase.replace(/\/+$/, '');

const TOKEN_KEY = 'access_token';
export const AUTH_INVALIDATED_EVENT = 'vesipolku:auth-invalidated';
export type AuthInvalidationReason = 'expired' | 'logout' | 'manual';

const inFlightGetRequests = new Map<string, Promise<unknown>>();
const cachedGetResponses = new Map<
  string,
  { value: unknown; expiresAt: number }
>();
const DEFAULT_GET_CACHE_TTL_MS = 10_000;

export type GetRequestOptions = {
  force?: boolean;
  ttlMs?: number;
};

export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: Record<string, unknown> | null;
};

export function dedupeInFlightGet<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlightGetRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const request = run().finally(() => {
    inFlightGetRequests.delete(key);
  });
  inFlightGetRequests.set(key, request as Promise<unknown>);
  return request;
}

export function getCachedGet<T>(
  key: string,
  run: () => Promise<T>,
  options?: GetRequestOptions,
): Promise<T> {
  const force = options?.force === true;
  const ttlMs = Math.max(0, options?.ttlMs ?? DEFAULT_GET_CACHE_TTL_MS);

  if (!force) {
    const cached = cachedGetResponses.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.value as T);
    }
    if (cached) {
      cachedGetResponses.delete(key);
    }
  }

  const requestKey = force ? `${key}::force` : key;
  return dedupeInFlightGet(requestKey, async () => {
    const value = await run();
    cachedGetResponses.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  });
}

export function invalidateCachedGets(...keys: string[]): void {
  for (const key of keys) {
    cachedGetResponses.delete(key);
    inFlightGetRequests.delete(key);
    inFlightGetRequests.delete(`${key}::force`);
  }
}

export async function parseApiErrorResponse(res: Response): Promise<{
  message: string;
  details: Record<string, unknown> | null;
  code?: string;
}> {
  const contentType = res.headers.get('Content-Type') ?? '';
  const errorText = (await res.text()).trim();

  if (!errorText) {
    return {
      message: `Request failed (${res.status})`,
      details: null,
    };
  }

  if (!contentType.includes('application/json')) {
    return {
      message: errorText,
      details: null,
    };
  }

  try {
    const parsedBody = JSON.parse(errorText) as Record<string, unknown>;
    const bodyMessage = parsedBody?.message;
    let message: string | null = null;

    if (typeof bodyMessage === 'string' && bodyMessage.trim()) {
      message = bodyMessage;
    } else if (Array.isArray(bodyMessage) && bodyMessage.length > 0) {
      message = bodyMessage.map((item) => String(item)).join(', ');
    } else if (
      bodyMessage &&
      typeof bodyMessage === 'object' &&
      typeof (bodyMessage as { message?: unknown }).message === 'string'
    ) {
      message = String((bodyMessage as { message: string }).message);
    } else if (
      typeof parsedBody.error === 'string' &&
      parsedBody.error.trim()
    ) {
      message = parsedBody.error;
    }

    const code =
      typeof parsedBody.code === 'string' ? parsedBody.code : undefined;

    return {
      message: message ?? `Request failed (${res.status})`,
      details: parsedBody,
      code,
    };
  } catch {
    return {
      message: errorText,
      details: null,
    };
  }
}

export function createApiError(
  status: number,
  parsed: {
    message: string;
    details: Record<string, unknown> | null;
    code?: string;
  },
): ApiError {
  const err = new Error(parsed.message) as ApiError;
  err.status = status;
  err.details = parsed.details;
  if (parsed.code) err.code = parsed.code;
  return err;
}

// Demo availability is never inferred from frontend env; always use GET /demo/status.

/**
 * Get the configured API base URL (for display). When using relative /api, return full same-origin URL.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && API_BASE === '/api') {
    return `${window.location.origin}/api`;
  }
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

export type AppMode = 'production' | 'trial' | 'internal_demo';

export function getToken(): string | null {
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) return sessionToken;
  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }
  return null;
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(
  reason: AuthInvalidationReason = 'manual',
  message?: string,
): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AUTH_INVALIDATED_EVENT, {
        detail: { reason, message: message ?? null },
      }),
    );
  }
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
 * Get decoded token info from current session token storage
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

  // On 401: clear token and require re-login. No automatic dev-token or demo-login refresh.
  if (res.status === 401) {
    const message = 'Session expired. Please log in again.';
    clearToken('expired', message);
    throw new Error(message);
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  return res.json();
}

/**
 * Login with email/password
 */
