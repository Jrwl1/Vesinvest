/**
 * API helper for the Vesipolku app.
 * Reads JWT from sessionStorage (legacy localStorage migration) and attaches Authorization header.
 */
import type { DemoResetResult } from './types';

const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

/** In dev with no env: use same-origin /api so single Cloudflare tunnel works (Vite proxies /api -> localhost:3000). */
const DEFAULT_DEV_API_BASE_RELATIVE = '/api';

const raw = import.meta.env.VITE_API_BASE_URL;
const envApiBase = raw === undefined || raw === null ? '' : String(raw).trim();
if (IS_PROD && !envApiBase) {
  throw new Error('VITE_API_BASE_URL is required in production');
}
// If set, use VITE_API_BASE_URL; else in dev use same-origin /api (works with single tunnel).
const API_BASE = envApiBase
  ? envApiBase.replace(/\/+$/, '')
  : IS_DEV
  ? DEFAULT_DEV_API_BASE_RELATIVE
  : envApiBase.replace(/\/+$/, '');

const TOKEN_KEY = 'access_token';
export const AUTH_INVALIDATED_EVENT = 'vesipolku:auth-invalidated';

const inFlightGetRequests = new Map<string, Promise<unknown>>();
const cachedGetResponses = new Map<
  string,
  { value: unknown; expiresAt: number }
>();
const DEFAULT_GET_CACHE_TTL_MS = 10_000;

type GetRequestOptions = {
  force?: boolean;
  ttlMs?: number;
};

type ApiError = Error & {
  status?: number;
  code?: string;
  details?: Record<string, unknown> | null;
};

function dedupeInFlightGet<T>(key: string, run: () => Promise<T>): Promise<T> {
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

function getCachedGet<T>(
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

function invalidateCachedGets(...keys: string[]): void {
  for (const key of keys) {
    cachedGetResponses.delete(key);
    inFlightGetRequests.delete(key);
    inFlightGetRequests.delete(`${key}::force`);
  }
}

async function parseApiErrorResponse(res: Response): Promise<{
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

function createApiError(
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

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT));
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
    clearToken();
    throw new Error('Session expired. Please log in again.');
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
export type DemoStatusResult =
  | {
      enabled: boolean;
      appMode: AppMode;
      authBypassEnabled: boolean;
      demoLoginEnabled: boolean;
      orgId?: string | null;
    }
  | { unreachable: true };

/**
 * Fetch demo status from backend. GET /demo/status, no auth, never throws.
 * Use this on app bootstrap and store in context; never infer demo mode from env alone.
 * Handles 304 (empty body) so we don't misclassify as "backend not responding".
 * In dev, retries a few times with delay so cold "pnpm dev" doesn't show red banner before API is up.
 */
export async function getDemoStatus(): Promise<DemoStatusResult> {
  return dedupeInFlightGet('GET /demo/status', async () => {
    const maxAttempts = IS_DEV ? 5 : 1;
    const delayMs = IS_DEV ? 1200 : 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/demo/status`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return { unreachable: true };
        const text = await res.text();
        if (!text.trim()) {
          return {
            enabled: false,
            appMode: 'trial',
            authBypassEnabled: false,
            demoLoginEnabled: false,
            orgId: null,
          };
        }
        let data: {
          enabled?: boolean;
          orgId?: string | null;
          appMode?: AppMode;
          authBypassEnabled?: boolean;
          demoLoginEnabled?: boolean;
        } = {};
        try {
          data = JSON.parse(text);
        } catch {
          return {
            enabled: false,
            appMode: 'trial',
            authBypassEnabled: false,
            demoLoginEnabled: false,
            orgId: null,
          };
        }
        const enabled = data?.enabled === true;
        return {
          enabled,
          appMode: data.appMode ?? 'trial',
          authBypassEnabled: data.authBypassEnabled === true,
          demoLoginEnabled: data.demoLoginEnabled === true,
          orgId: enabled
            ? data?.orgId ?? 'demo-org-00000000-0000-0000-0000-000000000001'
            : null,
        };
      } catch {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return { unreachable: true };
      }
    }
    return { unreachable: true };
  });
}

/**
 * Demo login: calls /auth/demo-login which issues a demo token when the API is in internal demo mode.
 * Preferred backend switch: APP_MODE=internal_demo. Legacy fallback: DEMO_MODE=true when APP_MODE is unset.
 * Demo gating is backend-owned; the browser does not ship a shared secret.
 */
export async function demoLogin(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Demo login endpoint missing on backend (/auth/demo-login).',
      );
    }
    if (res.status === 429) {
      throw new Error('Demo rate limit exceeded');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Demo login rejected by server (check APP_MODE/DEMO_MODE).',
      );
    }
    throw new Error(`Demo login failed (${res.status})`);
  }

  const data = await res.json();
  const token = data.accessToken;
  setToken(token);
  console.log('demo-login OK');
  return token;
}

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

export async function getLegalCurrent(): Promise<{
  termsVersion: string;
  termsUrl: string | null;
  dpaVersion: string;
  dpaUrl: string | null;
  publishedAt: string;
}> {
  return api('/legal/current', { method: 'GET' });
}

export async function getLegalStatus(): Promise<{
  requiresUserAcceptance: boolean;
  orgUnlocked: boolean;
  requiresOrgAdminAcceptance: boolean;
  waitingForAdmin: boolean;
}> {
  return dedupeInFlightGet('GET /legal/status', () =>
    api('/legal/status', { method: 'GET' }),
  );
}

export async function acceptLegal(): Promise<{
  acceptedAt: string;
  termsVersion: string;
  dpaVersion: string;
  requiresUserAcceptance: boolean;
  orgUnlocked: boolean;
  requiresOrgAdminAcceptance: boolean;
  waitingForAdmin: boolean;
}> {
  return api('/legal/accept', {
    method: 'POST',
    body: JSON.stringify({ acceptTerms: true, acceptDpa: true }),
  });
}

export interface TrialStatusDto {
  appMode: AppMode;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialStatus: 'active' | 'expired' | 'locked';
  daysLeft: number | null;
  locked: boolean;
  lockReason: string | null;
}

export async function getTrialStatus(): Promise<TrialStatusDto> {
  return api('/trial/status', { method: 'GET' });
}

export async function resetTrialData(): Promise<DemoResetResult> {
  return api('/trial/reset-data', { method: 'POST' });
}

// ============ Demo Mode API ============

/**
 * Reset all demo data to a clean state.
 * Only works when the backend reports internal demo mode.
 */
export async function resetDemoData(): Promise<DemoResetResult> {
  return api<DemoResetResult>('/demo/reset', { method: 'POST' });
}

/**
 * Result of POST /demo/seed. Only available when demo mode is enabled (404 otherwise).
 */
export interface DemoSeedResult {
  alreadySeeded: boolean;
  seededAt: string;
  /** When a 3-year set was created (or already existed), use this to load the set and show 3 cards. */
  batchId?: string;
  created?: { assumptions: number; budget: boolean; projection: boolean };
}

/**
 * Seed optional demo dataset (budget, assumptions, projection). Idempotent.
 * Only available when demo mode is enabled; returns 404 in production.
 */
export async function seedDemoData(): Promise<DemoSeedResult> {
  return api<DemoSeedResult>('/demo/seed', { method: 'POST' });
}

// ============ Vesipolku Budget API ============

/**
 * Subtotal line from KVA import (TalousarvioValisumma). Used for section totals when rivit are empty.
 * categoryKey and tyyppi align with GET /budgets/:id and KVA confirm payload (deterministic readback).
 */
export interface BudgetValisumma {
  id: string;
  talousarvioId: string;
  palvelutyyppi: string;
  categoryKey: string;
  tyyppi:
    | 'tulo'
    | 'kulu'
    | 'poisto'
    | 'rahoitus_tulo'
    | 'rahoitus_kulu'
    | 'investointi'
    | 'tulos';
  label: string | null;
  summa: string;
  lahde: string | null;
}

/** API may return partial lines; normalize in BudgetPage before use. */
export type BudgetLineFromApi = Partial<BudgetLine>;

/** API may return partial valisummat; normalize in BudgetPage before use. */
export type BudgetValisummaFromApi = Partial<BudgetValisumma>;

export interface Budget {
  id: string;
  orgId: string;
  vuosi: number;
  nimi: string | null;
  tila: 'luonnos' | 'vahvistettu';
  /** Annual base-fee total (EUR). ADR-013. */
  perusmaksuYhteensa?: number | null;
  lahde?: string | null;
  veetiVuosi?: number | null;
  veetiImportedAt?: string | null;
  userEdited?: boolean;
  importBatchId?: string | null;
  importSourceFileName?: string | null;
  importedAt?: string | null;
  inputCompleteness?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  /** Normalize with normalizeBudgetLine before use; API may omit fields. */
  rivit?: BudgetLine[];
  tuloajurit?: RevenueDriver[];
  /** Normalize with normalizeValisumma before use; API may omit fields. */
  valisummat?: BudgetValisumma[];
  _count?: { rivit: number; tuloajurit: number };
}

export interface BudgetLine {
  id: string;
  talousarvioId: string;
  parentId?: string | null;
  sortOrder?: number;
  rowKind?: 'group' | 'line';
  serviceType?: 'vesi' | 'jatevesi' | 'muu' | null;
  imported?: boolean;
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: string; // Decimal comes as string from Prisma
  muistiinpanot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueDriver {
  id: string;
  talousarvioId: string;
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta: string;
  myytyMaara: string;
  perusmaksu: string | null;
  liittymamaara: number | null;
  alvProsentti: string | null;
  sourceMeta?: Record<string, unknown> | null;
  muistiinpanot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assumption {
  id: string;
  orgId: string;
  avain: string;
  nimi: string;
  arvo: string;
  yksikko: string | null;
  kuvaus: string | null;
  createdAt: string;
  updatedAt: string;
}

// Budgets
export async function listBudgets(): Promise<Budget[]> {
  return api<Budget[]>('/budgets');
}

/** KVA import set (budgets sharing same importBatchId). For Talousarvio set selector. */
export interface BudgetSet {
  batchId: string;
  id: string;
  vuosi: number;
  nimi: string;
  minVuosi?: number;
  maxVuosi?: number;
  yearsCount?: number;
}

export async function getBudgetSets(): Promise<BudgetSet[]> {
  return api<BudgetSet[]>('/budgets/sets');
}

export async function getBudgetsByBatchId(batchId: string): Promise<Budget[]> {
  return api<Budget[]>(`/budgets/sets/${encodeURIComponent(batchId)}`);
}

export async function getBudget(id: string): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`);
}

export async function createBudget(data: {
  vuosi: number;
  nimi?: string;
  perusmaksuYhteensa?: number;
  importBatchId?: string;
}): Promise<Budget> {
  return api<Budget>('/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type ValisummaItem = {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  categoryKey: string;
  tyyppi:
    | 'tulo'
    | 'kulu'
    | 'poisto'
    | 'rahoitus_tulo'
    | 'rahoitus_kulu'
    | 'investointi'
    | 'tulos';
  summa: number;
  label?: string;
  lahde?: string;
};

export async function updateValisumma(
  budgetId: string,
  valisummaId: string,
  data: { summa: number },
): Promise<BudgetValisumma> {
  return api<BudgetValisumma>(
    `/budgets/${budgetId}/valisummat/${valisummaId}`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export async function setValisummat(
  budgetId: string,
  items: ValisummaItem[],
): Promise<unknown> {
  return api(`/budgets/${budgetId}/valisummat`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function updateBudget(
  id: string,
  data: {
    nimi?: string;
    tila?: string;
    perusmaksuYhteensa?: number;
    inputCompleteness?: Record<string, unknown>;
  },
): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  await api(`/budgets/${id}`, { method: 'DELETE' });
}

// Budget Lines
export async function createBudgetLine(
  budgetId: string,
  data: {
    tiliryhma: string;
    nimi: string;
    tyyppi: string;
    summa: number;
    muistiinpanot?: string;
    parentId?: string;
    sortOrder?: number;
    rowKind?: 'group' | 'line';
    serviceType?: 'vesi' | 'jatevesi' | 'muu';
  },
): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBudgetLine(
  budgetId: string,
  lineId: string,
  data: Record<string, unknown>,
): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function moveBudgetLine(
  budgetId: string,
  lineId: string,
  data: { parentId?: string | null; sortOrder: number },
): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit/${lineId}/move`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteBudgetLine(
  budgetId: string,
  lineId: string,
): Promise<void> {
  await api(`/budgets/${budgetId}/rivit/${lineId}`, { method: 'DELETE' });
}

// Revenue Drivers
export async function createRevenueDriver(
  budgetId: string,
  data: Record<string, unknown>,
): Promise<RevenueDriver> {
  return api<RevenueDriver>(`/budgets/${budgetId}/tuloajurit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRevenueDriver(
  budgetId: string,
  driverId: string,
  data: Record<string, unknown>,
): Promise<RevenueDriver> {
  return api<RevenueDriver>(`/budgets/${budgetId}/tuloajurit/${driverId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteRevenueDriver(
  budgetId: string,
  driverId: string,
): Promise<void> {
  await api(`/budgets/${budgetId}/tuloajurit/${driverId}`, {
    method: 'DELETE',
  });
}

// Assumptions
export async function listAssumptions(): Promise<Assumption[]> {
  return api<Assumption[]>('/assumptions');
}

export async function upsertAssumption(
  avain: string,
  data: { arvo: number; nimi?: string; yksikko?: string; kuvaus?: string },
): Promise<Assumption> {
  return api<Assumption>(`/assumptions/${avain}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function resetAssumptionDefaults(): Promise<Assumption[]> {
  return api<Assumption[]>('/assumptions/reset-defaults', { method: 'POST' });
}

// ============ Projections API ============

export type DriverType = 'vesi' | 'jatevesi';
export type DriverField = 'yksikkohinta' | 'myytyMaara';

export interface DriverValuePlan {
  mode: 'manual' | 'percent';
  baseYear?: number;
  baseValue?: number;
  annualPercent?: number;
  values?: Record<number, number>;
}

export type DriverPaths = Partial<
  Record<DriverType, Partial<Record<DriverField, DriverValuePlan>>>
>;

export type YearOverrideLockMode = 'price' | 'percent';

export interface ProjectionYearCategoryGrowthPct {
  personnel?: number;
  energy?: number;
  opexOther?: number;
  otherIncome?: number;
  investments?: number;
}

export interface ProjectionYearLineOverride {
  mode: 'percent' | 'absolute';
  value: number;
}

export interface ProjectionYearOverride {
  waterPriceEurM3?: number;
  waterPriceGrowthPct?: number;
  lockMode?: YearOverrideLockMode;
  investmentEur?: number;
  categoryGrowthPct?: ProjectionYearCategoryGrowthPct;
  lineOverrides?: Record<string, ProjectionYearLineOverride>;
}

export type ProjectionYearOverrides = Record<number, ProjectionYearOverride>;

export interface ProjectionYear {
  id: string;
  ennusteId: string;
  vuosi: number;
  tulotYhteensa: string;
  kulutYhteensa: string;
  investoinnitYhteensa: string;
  /** S-03: baseline depreciation */
  poistoPerusta?: string | null;
  /** S-03: investment-driven depreciation */
  poistoInvestoinneista?: string | null;
  tulos: string;
  kumulatiivinenTulos: string;
  /** Kassaflode(y) = Tulos(y) - Investoinnit(y) */
  kassafloede?: number;
  /** Ackumulerad kassa(y) = sum of Kassaflode(0..y) */
  ackumuleradKassa?: number;
  vesihinta: string | null;
  myytyVesimaara: string | null;
  erittelyt: {
    tulot?: Array<{ nimi: string; summa: number }>;
    kulut?: Array<{ tiliryhma: string; nimi: string; summa: number }>;
    investoinnit?: Array<{ tiliryhma: string; nimi: string; summa: number }>;
    ajurit?: Array<{
      palvelutyyppi: string;
      yksikkohinta: number;
      myytyMaara: number;
      perusmaksu: number;
      liittymamaara: number;
      laskettuTulo: number;
    }>;
  } | null;
}

export interface Projection {
  id: string;
  orgId: string;
  talousarvioId: string;
  nimi: string;
  aikajaksoVuosia: number;
  olettamusYlikirjoitukset: Record<string, number> | null;
  ajuriPolut?: DriverPaths | null;
  userInvestments?: Array<{ year: number; amount: number }> | null;
  vuosiYlikirjoitukset?: ProjectionYearOverrides | null;
  /** Required water price EUR/m3 such that accumulated cash >= 0; null if infeasible */
  requiredTariff?: number | null;
  onOletus: boolean;
  createdAt: string;
  updatedAt: string;
  talousarvio?: {
    id: string;
    vuosi: number;
    nimi: string;
    tuloajurit?: RevenueDriver[];
  };
  vuodet?: ProjectionYear[];
  _count?: { vuodet: number };
}

export async function listProjections(): Promise<Projection[]> {
  return api<Projection[]>('/projections');
}

export async function getProjection(id: string): Promise<Projection> {
  return api<Projection>(`/projections/${id}`);
}

export async function createProjection(data: {
  talousarvioId: string;
  nimi: string;
  aikajaksoVuosia: number;
  olettamusYlikirjoitukset?: Record<string, number>;
  ajuriPolut?: DriverPaths;
  userInvestments?: Array<{ year: number; amount: number }>;
  vuosiYlikirjoitukset?: ProjectionYearOverrides;
}): Promise<Projection> {
  return api<Projection>('/projections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProjection(
  id: string,
  data: {
    nimi?: string;
    aikajaksoVuosia?: number;
    olettamusYlikirjoitukset?: Record<string, number>;
    ajuriPolut?: DriverPaths;
    userInvestments?: Array<{ year: number; amount: number }>;
    vuosiYlikirjoitukset?: ProjectionYearOverrides;
    onOletus?: boolean;
  },
): Promise<Projection> {
  return api<Projection>(`/projections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProjection(id: string): Promise<void> {
  await api(`/projections/${id}`, { method: 'DELETE' });
}

export async function computeProjection(id: string): Promise<Projection> {
  return api<Projection>(`/projections/${id}/compute`, { method: 'POST' });
}

/**
 * Resilient compute: find-or-create a projection for a budget, then compute.
 * Use this instead of computeProjection when the projection ID might be stale.
 */
export async function computeForBudget(
  talousarvioId: string,
  olettamusYlikirjoitukset?: Record<string, number>,
  ajuriPolut?: DriverPaths,
  vuosiYlikirjoitukset?: ProjectionYearOverrides,
): Promise<Projection> {
  return api<Projection>('/projections/compute-for-budget', {
    method: 'POST',
    body: JSON.stringify({
      talousarvioId,
      olettamusYlikirjoitukset,
      ajuriPolut,
      vuosiYlikirjoitukset,
    }),
  });
}

export function getProjectionExportUrl(id: string): string {
  return `${API_BASE}/projections/${id}/export`;
}

/** V1 PDF cashflow export route (ADR-017). */
export function getProjectionExportPdfUrl(id: string): string {
  return `${API_BASE}/projections/${id}/export-pdf`;
}

export interface VeetiLinkStatus {
  connected: boolean;
  orgId?: string;
  veetiId?: number;
  nimi?: string | null;
  ytunnus?: string | null;
  kunta?: string | null;
  kieliId?: number | null;
  uiLanguage?: 'fi' | 'sv' | null;
  linkedAt?: string;
  lastFetchedAt?: string | null;
  fetchStatus?: string | null;
}

export interface VeetiYearInfo {
  vuosi: number;
  planningRole?: 'historical' | 'current_year_estimate';
  dataTypes: string[];
  datasetCounts?: {
    tilinpaatos: number;
    taksa: number;
    volume_vesi: number;
    volume_jatevesi: number;
    investointi: number;
    energia: number;
    verkko: number;
  };
  completeness: Record<string, boolean>;
  missingRequirements?: Array<
    'financials' | 'prices' | 'volumes' | 'tariffRevenue'
  >;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  warnings?: Array<
    | 'missing_financials'
    | 'missing_prices'
    | 'missing_volumes'
    | 'fallback_zero_used'
  >;
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown?: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  manualEditedAt?: string | null;
  manualEditedBy?: string | null;
  manualReason?: string | null;
  manualProvenance?: V2OverrideProvenance | null;
}

export interface VeetiConnectResult {
  linked: {
    orgId: string;
    veetiId: number;
    nimi: string | null;
    ytunnus: string | null;
    kieliId?: number | null;
    uiLanguage?: 'fi' | 'sv' | null;
  };
  fetchedAt: string;
  years: number[];
  availableYears?: number[];
  workspaceYears?: number[];
  snapshotUpserts: number;
}

export interface VeetiPreviewBudget {
  vuosi: number;
  valisummat: Array<{
    palvelutyyppi: 'muu';
    categoryKey: string;
    tyyppi:
      | 'tulo'
      | 'kulu'
      | 'poisto'
      | 'rahoitus_tulo'
      | 'rahoitus_kulu'
      | 'investointi'
      | 'tulos';
    label: string;
    summa: number;
  }>;
  drivers: Array<{
    palvelutyyppi: 'vesi' | 'jatevesi';
    yksikkohinta: number;
    myytyMaara: number;
    sourceMeta: Record<string, unknown>;
  }>;
  investmentBaseline: number;
  completeness: {
    required: {
      liikevaihto: boolean;
      projectionDriver: boolean;
    };
    fieldsMapped: number;
    fieldsPresent: number;
  };
  missing: {
    liikevaihto: boolean;
    projectionDriver: boolean;
  };
}

export interface VeetiOrganizationSearchHit {
  Id: number;
  Nimi?: string | null;
  YTunnus?: string | null;
  Kunta?: string | null;
  Kieli_Id?: number | null;
}

export interface BenchmarkMetric {
  metricKey: string;
  yourValue: number | null;
  avgValue: number;
  medianValue: number | null;
  p25Value: number | null;
  p75Value: number | null;
  minValue: number | null;
  maxValue: number | null;
  orgCount: number;
}

export interface BenchmarkYearResult {
  vuosi: number;
  computedAt: string | null;
  isStale: boolean;
  staleAfterDays: number;
  orgCount: number;
  kokoluokka: 'pieni' | 'keski' | 'suuri';
  metrics: BenchmarkMetric[];
}

export interface BenchmarkTrendResult {
  metricKey: string;
  computedAt: string | null;
  isStale: boolean;
  staleAfterDays: number;
  orgCount: number;
  trend: Array<{
    vuosi: number;
    kokoluokka: string;
    yourValue: number | null;
    medianValue: number | null;
    p25Value: number | null;
    p75Value: number | null;
    orgCount: number;
    computedAt: string;
  }>;
}

export interface BenchmarkPeerGroupResult {
  kokoluokka: 'pieni' | 'keski' | 'suuri';
  latestYear: number | null;
  orgCount: number;
  peerCount?: number;
  computedAt: string | null;
  isStale: boolean;
  staleAfterDays: number;
  peers: Array<{
    veetiId: number;
    nimi: string | null;
    ytunnus: string | null;
    kunta: string | null;
  }>;
}

export async function searchVeetiOrganizations(
  q: string,
  limit = 20,
): Promise<VeetiOrganizationSearchHit[]> {
  return api<VeetiOrganizationSearchHit[]>(
    `/veeti/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export async function connectVeeti(
  veetiId: number,
): Promise<VeetiConnectResult> {
  return api<VeetiConnectResult>('/veeti/connect', {
    method: 'POST',
    body: JSON.stringify({ veetiId }),
  });
}

export async function getVeetiStatus(): Promise<VeetiLinkStatus> {
  return api<VeetiLinkStatus>('/veeti/status');
}

export async function refreshVeeti(): Promise<VeetiConnectResult> {
  return api<VeetiConnectResult>('/veeti/refresh', { method: 'POST' });
}

export async function getVeetiYears(): Promise<VeetiYearInfo[]> {
  return api<VeetiYearInfo[]>('/veeti/years');
}

export async function getVeetiTilinpaatos(vuosi: number): Promise<unknown[]> {
  return api<unknown[]>(`/veeti/tilinpaatos/${vuosi}`);
}

export async function getVeetiInvestoinnit(): Promise<unknown[]> {
  return api<unknown[]>('/veeti/investoinnit');
}

export async function getVeetiDrivers(vuosi: number): Promise<{
  vuosi: number;
  taksa: unknown[];
  volumeVesi: unknown[];
  volumeJatevesi: unknown[];
}> {
  return api(`/veeti/drivers/${vuosi}`);
}

export async function previewVeetiBudget(
  vuosi: number,
): Promise<VeetiPreviewBudget> {
  return api<VeetiPreviewBudget>(`/veeti/preview-budget/${vuosi}`);
}

export async function generateVeetiBudgets(years: number[]): Promise<{
  success: boolean;
  count: number;
  results: Array<{
    budgetId: string;
    vuosi: number;
    mode: 'created' | 'updated';
  }>;
  skipped?: Array<{ vuosi: number; reason: string }>;
}> {
  return api('/veeti/generate-budgets', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function getBenchmarks(
  vuosi: number,
): Promise<BenchmarkYearResult> {
  return api<BenchmarkYearResult>(`/benchmarks/${vuosi}`);
}

export async function getBenchmarkTrend(
  metric: string,
): Promise<BenchmarkTrendResult> {
  return api<BenchmarkTrendResult>(
    `/benchmarks/trends?metric=${encodeURIComponent(metric)}`,
  );
}

export async function getBenchmarkPeerGroup(): Promise<BenchmarkPeerGroupResult> {
  return api<BenchmarkPeerGroupResult>('/benchmarks/peer-group');
}

// ============ V2 API ============

export type V2MetricKpi = {
  value: number;
  deltaYoY: number | null;
};

export type V2TrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

export type V2PeerSnapshot = {
  year: number | null;
  available: boolean;
  reason?: string;
  kokoluokka?: 'pieni' | 'keski' | 'suuri';
  orgCount?: number;
  peerCount?: number;
  computedAt?: string | null;
  isStale?: boolean;
  staleAfterDays?: number;
  peers?: Array<{
    veetiId: number;
    nimi: string | null;
    ytunnus: string | null;
    kunta: string | null;
  }>;
  metrics?: BenchmarkMetric[];
};

export type V2ImportStatus = {
  connected: boolean;
  link: VeetiLinkStatus | null;
  tariffScope?: 'usage_fee_only' | string;
  years: VeetiYearInfo[];
  availableYears?: VeetiYearInfo[];
  workspaceYears?: number[];
  excludedYears?: number[];
  planningBaselineYears?: number[];
};

export type V2WorkbookImportKind = 'kva_import' | 'excel_import';

export type V2DocumentImportProfile =
  | 'generic_pdf'
  | 'statement_pdf'
  | 'qdis_pdf'
  | 'unknown_pdf';

export type V2DocumentImportDatasetKind =
  | 'financials'
  | 'prices'
  | 'volumes';

export type V2DocumentImportSourceLine = {
  text: string;
  pageNumber?: number | null;
};

export type V2WorkbookCandidateRowAction =
  | 'keep_veeti'
  | 'apply_workbook';

export type V2WorkbookCandidateRow = {
  sourceField: string;
  workbookValue: number | null;
  action: V2WorkbookCandidateRowAction;
};

export type V2OverrideProvenanceRef = {
  kind:
    | 'manual_edit'
    | 'statement_import'
    | 'qdis_import'
    | 'document_import'
    | V2WorkbookImportKind;
  fileName: string | null;
  pageNumber: number | null;
  pageNumbers?: number[];
  confidence: number | null;
  scannedPageCount: number | null;
  matchedFields: string[];
  warnings: string[];
  documentProfile?: V2DocumentImportProfile | null;
  datasetKinds?: V2DocumentImportDatasetKind[];
  sourceLines?: V2DocumentImportSourceLine[];
  sheetName?: string | null;
  matchedYears?: number[];
  confirmedSourceFields?: string[];
  candidateRows?: V2WorkbookCandidateRow[];
};

export type V2OverrideFinancialFieldSource = {
  sourceField: V2ImportYearSummarySourceField;
  provenance: V2OverrideProvenanceRef;
};

export type V2OverrideProvenance = V2OverrideProvenanceRef & {
  fieldSources?: V2OverrideFinancialFieldSource[];
};

export type V2ImportYearSummaryFieldKey =
  | 'revenue'
  | 'materialsCosts'
  | 'personnelCosts'
  | 'depreciation'
  | 'otherOperatingCosts'
  | 'result';

export type V2ImportYearSummarySourceField =
  | 'Liikevaihto'
  | 'AineetJaPalvelut'
  | 'Henkilostokulut'
  | 'Poistot'
  | 'LiiketoiminnanMuutKulut'
  | 'TilikaudenYliJaama';

export type V2ImportYearSummarySource = 'direct' | 'missing';

export type V2ImportYearSummaryRow = {
  key: V2ImportYearSummaryFieldKey;
  sourceField: V2ImportYearSummarySourceField;
  rawValue: number | null;
  effectiveValue: number | null;
  changed: boolean;
  rawSource: V2ImportYearSummarySource;
  effectiveSource: V2ImportYearSummarySource;
};

export type V2ImportYearTrustReason =
  | 'manual_override'
  | 'statement_import'
  | 'qdis_import'
  | 'document_import'
  | 'workbook_import'
  | 'mixed_source'
  | 'incomplete_source'
  | 'result_changed';

export type V2ImportYearTrustSignal = {
  level: 'none' | 'review' | 'material';
  reasons: V2ImportYearTrustReason[];
  changedSummaryKeys: V2ImportYearSummaryFieldKey[];
  statementImport: V2OverrideProvenance | null;
  documentImport?: V2OverrideProvenance | null;
  workbookImport: V2OverrideProvenance | null;
};

export type V2ImportYearResultToZeroSignal = {
  rawValue: number | null;
  effectiveValue: number | null;
  delta: number | null;
  absoluteGap: number | null;
  marginPct: number | null;
  direction: 'above_zero' | 'below_zero' | 'at_zero' | 'missing';
};

export type V2ImportYearSubrowAvailability = {
  truthfulSubrowsAvailable: boolean;
  reason: 'year_summary_only';
  rawRowCount: number;
  effectiveRowCount: number;
};

export type V2BaselineDatasetSource = {
  dataType: string;
  source: 'veeti' | 'manual' | 'none';
  provenance: V2OverrideProvenance | null;
  editedAt: string | null;
  editedBy: string | null;
  reason: string | null;
};

export type V2BaselineSourceSummary = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: V2BaselineDatasetSource;
  prices: V2BaselineDatasetSource;
  volumes: V2BaselineDatasetSource;
};

export type V2ManualYearPatchPayload = {
  year: number;
  financials?: {
    liikevaihto?: number;
    perusmaksuYhteensa?: number;
    aineetJaPalvelut?: number;
    henkilostokulut?: number;
    liiketoiminnanMuutKulut?: number;
    poistot?: number;
    arvonalentumiset?: number;
    rahoitustuototJaKulut?: number;
    tilikaudenYliJaama?: number;
    omistajatuloutus?: number;
    omistajanTukiKayttokustannuksiin?: number;
  };
  prices?: {
    waterUnitPrice: number;
    wastewaterUnitPrice: number;
  };
  volumes?: {
    soldWaterVolume: number;
    soldWastewaterVolume: number;
  };
  investments?: {
    investoinninMaara: number;
    korvausInvestoinninMaara: number;
  };
  energy?: {
    prosessinKayttamaSahko: number;
  };
  network?: {
    verkostonPituus: number;
  };
  reason?: string;
  statementImport?: {
    fileName: string;
    pageNumber?: number;
    confidence?: number;
    scannedPageCount?: number;
    matchedFields?: string[];
    warnings?: string[];
  };
  qdisImport?: {
    fileName: string;
    pageNumber?: number;
    confidence?: number;
    scannedPageCount?: number;
    matchedFields?: string[];
    warnings?: string[];
  };
  documentImport?: {
    fileName: string;
    pageNumber?: number;
    pageNumbers?: number[];
    confidence?: number;
    scannedPageCount?: number;
    matchedFields?: string[];
    warnings?: string[];
    documentProfile?: V2DocumentImportProfile;
    datasetKinds?: V2DocumentImportDatasetKind[];
    sourceLines?: V2DocumentImportSourceLine[];
  };
  workbookImport?: {
    kind?: V2WorkbookImportKind;
    fileName: string;
    sheetName?: string;
    matchedYears?: number[];
    matchedFields?: string[];
    confirmedSourceFields?: string[];
    candidateRows?: V2WorkbookCandidateRow[];
    warnings?: string[];
  };
};

export type V2ManualYearPatchResponse = {
  year: number;
  patchedDataTypes: string[];
  missingBefore: Array<'financials' | 'prices' | 'volumes' | 'tariffRevenue'>;
  missingAfter: Array<'financials' | 'prices' | 'volumes' | 'tariffRevenue'>;
  syncReady: boolean;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  status: V2ImportStatus;
};

export type V2ImportYearDataResponse = {
  year: number;
  veetiId: number;
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  completeness: Record<string, boolean>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  hasManualOverrides: boolean;
  hasVeetiData: boolean;
  summaryRows?: V2ImportYearSummaryRow[];
  trustSignal?: V2ImportYearTrustSignal;
  resultToZero?: V2ImportYearResultToZeroSignal;
  subrowAvailability?: V2ImportYearSubrowAvailability;
  datasets: Array<{
    dataType: string;
    rawRows: Array<Record<string, unknown>>;
    effectiveRows: Array<Record<string, unknown>>;
    source: 'veeti' | 'manual' | 'none';
    hasOverride: boolean;
    reconcileNeeded: boolean;
    overrideMeta: {
      editedAt: string;
      editedBy: string | null;
      reason: string | null;
      provenance: V2OverrideProvenance | null;
    } | null;
  }>;
};

export type V2StatementPreviewFieldKey =
  | 'liikevaihto'
  | 'aineetJaPalvelut'
  | 'henkilostokulut'
  | 'liiketoiminnanMuutKulut'
  | 'poistot'
  | 'arvonalentumiset'
  | 'rahoitustuototJaKulut'
  | 'tilikaudenYliJaama'
  | 'omistajatuloutus'
  | 'omistajanTukiKayttokustannuksiin';

export type V2StatementPreviewResponse = {
  year: number;
  statementType: 'result_statement';
  document: {
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    receivedAt: string;
    parserStatus: 'pending_parser';
  };
  fields: Array<{
    key: V2StatementPreviewFieldKey;
    label: string;
    sourceField: string;
    veetiValue: number | null;
    effectiveValue: number | null;
    extractedValue: number | null;
    proposedValue: number | null;
    changed: boolean;
  }>;
  sourceRows: Array<{
    label: string;
    currentYearValue: number | null;
    previousYearValue: number | null;
    pageNumber: number | null;
    lineIndex: number | null;
    mappingStatus: 'pending';
    mappedKey: V2StatementPreviewFieldKey | null;
  }>;
  warnings: string[];
  canApply: boolean;
};

export type V2WorkbookPreviewResponse = {
  document: {
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    receivedAt: string;
  };
  sheetName: string;
  workbookYears: number[];
  importedYears: number[];
  matchedYears: number[];
  unmatchedImportedYears: number[];
  unmatchedWorkbookYears: number[];
  years: Array<{
    year: number;
    sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
    rows: Array<{
      key: V2ImportYearSummaryFieldKey;
      sourceField: V2ImportYearSummarySourceField;
      currentValue: number | null;
      workbookValue: number | null;
      differs: boolean;
      currentSource: V2ImportYearSummarySource;
      suggestedAction: 'keep_veeti' | 'apply_workbook';
    }>;
  }>;
  canApply: boolean;
};

export type V2OpsEventPayload = {
  event: string;
  status?: 'info' | 'ok' | 'warn' | 'error';
  attrs?: Record<string, unknown>;
};

export type V2OpsFunnelSnapshot = {
  organization: {
    orgId: string;
    connected: boolean;
    importedYearCount: number;
    syncReadyYearCount: number;
    blockedYearCount: number;
    latestFetchedAt: string | null;
    veetiBudgetCount: number;
    scenarioCount: number;
    computedScenarioCount: number;
    reportCount: number;
  };
  system: {
    orgCount: number;
    connectedOrgCount: number;
    importedOrgCount: number;
    scenarioOrgCount: number;
  };
  computedAt: string;
};

export type V2OverviewResponse = {
  latestVeetiYear: number | null;
  importStatus: V2ImportStatus;
  kpis: {
    revenue: V2MetricKpi;
    operatingCosts: V2MetricKpi;
    costs: V2MetricKpi;
    financingNet: V2MetricKpi;
    otherResultItems: V2MetricKpi;
    yearResult: V2MetricKpi;
    result: V2MetricKpi;
    volume: V2MetricKpi;
    combinedPrice: V2MetricKpi;
  };
  trendSeries: V2TrendPoint[];
  peerSnapshot: V2PeerSnapshot;
};

export type V2PlanningContextResponse = {
  canCreateScenario?: boolean;
  vesinvest?: {
    hasPlan: boolean;
    planCount: number;
    activePlan: V2VesinvestPlanSummary | null;
    selectedPlan: V2VesinvestPlanSummary | null;
  };
  baselineYears: Array<{
    year: number;
    planningRole?: 'historical' | 'current_year_estimate';
    quality: 'complete' | 'partial' | 'missing';
    sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
    sourceBreakdown: {
      veetiDataTypes: string[];
      manualDataTypes: string[];
    };
    financials: V2BaselineDatasetSource;
    prices: V2BaselineDatasetSource;
    volumes: V2BaselineDatasetSource;
    investmentAmount: number;
    soldWaterVolume: number;
    soldWastewaterVolume: number;
    combinedSoldVolume: number;
    processElectricity: number;
    pumpedWaterVolume: number;
    waterBoughtVolume: number;
    waterSoldVolume: number;
    netWaterTradeVolume: number;
  }>;
  operations: {
    latestYear: number | null;
    energySeries: Array<{ year: number; processElectricity: number }>;
    networkRehabSeries: Array<{ year: number; length: number }>;
    networkAssetsCount: number;
    toimintakertomusCount: number;
    toimintakertomusLatestYear: number | null;
    vedenottolupaCount: number;
    activeVedenottolupaCount: number;
  };
};

export type V2VesinvestGroupDefinition = {
  key: string;
  label: string;
  defaultAccountKey: string;
  defaultDepreciationClassKey: string | null;
  reportGroupKey: string;
  serviceSplit: 'water' | 'wastewater' | 'mixed';
};

export type V2VesinvestGroupUpdateInput = {
  label?: string;
  defaultAccountKey?: string;
  defaultDepreciationClassKey?: string | null;
  reportGroupKey?: string;
  serviceSplit?: 'water' | 'wastewater' | 'mixed';
};

export type V2VesinvestPlanSummary = {
  id: string;
  seriesId: string;
  name: string;
  utilityName: string;
  businessId: string | null;
  veetiId: number | null;
  identitySource: 'manual' | 'veeti' | 'mixed';
  horizonYears: number;
  versionNumber: number;
  status: 'draft' | 'active' | 'archived';
  baselineStatus: 'draft' | 'incomplete' | 'verified';
  pricingStatus: 'blocked' | 'provisional' | 'verified';
  selectedScenarioId: string | null;
  projectCount: number;
  totalInvestmentAmount: number;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
  classificationReviewRequired: boolean;
  baselineChangedSinceAcceptedRevision: boolean;
  investmentPlanChangedSinceFeeRecommendation: boolean;
  baselineFingerprint: string | null;
  scenarioFingerprint: string | null;
  updatedAt: string;
  createdAt: string;
};

export type V2VesinvestProjectAllocation = {
  id?: string;
  year: number;
  totalAmount: number;
  waterAmount: number;
  wastewaterAmount: number;
};

export type V2VesinvestProject = {
  id?: string;
  code: string;
  name: string;
  investmentType: 'sanering' | 'nyanlaggning' | 'reparation';
  groupKey: string;
  groupLabel?: string;
  depreciationClassKey: string | null;
  defaultAccountKey: string | null;
  reportGroupKey: string | null;
  subtype: string | null;
  notes: string | null;
  waterAmount: number;
  wastewaterAmount: number;
  totalAmount: number;
  allocations: V2VesinvestProjectAllocation[];
};

export type V2VesinvestBaselineSnapshotDataset = V2BaselineDatasetSource;

export type V2VesinvestBaselineSnapshotYear = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  quality: 'complete' | 'partial' | 'missing';
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: V2VesinvestBaselineSnapshotDataset;
  prices: V2VesinvestBaselineSnapshotDataset;
  volumes: V2VesinvestBaselineSnapshotDataset;
  combinedSoldVolume: number;
};

export type V2VesinvestBaselineSourceState = {
  source?: string | null;
  veetiId?: number | null;
  utilityName?: string | null;
  businessId?: string | null;
  identitySource?: 'veeti' | null;
  acceptedYears?: number[];
  latestAcceptedBudgetId?: string | null;
  verifiedAt?: string | null;
  snapshotCapturedAt?: string | null;
  baselineYears?: V2VesinvestBaselineSnapshotYear[];
};

export type V2VesinvestFeeRecommendation = {
  savedAt: string;
  linkedScenarioId: string;
  baselineFingerprint: string;
  scenarioFingerprint: string;
  baselineCombinedPrice: number | null;
  totalInvestments: number;
  combined: {
    baselinePriceToday: number | null;
    annualResult: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      peakDeficit: number | null;
      underfundingStartYear: number | null;
    };
    cumulativeCash: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      peakGap: number | null;
      underfundingStartYear: number | null;
    };
  };
  water: {
    currentPrice: number | null;
    forecastPath: Array<{
      year: number;
      price: number | null;
    }>;
  };
  wastewater: {
    currentPrice: number | null;
    forecastPath: Array<{
      year: number;
      price: number | null;
    }>;
  };
  baseFee: {
    currentRevenue: number | null;
    connectionCount: number | null;
  };
  annualResults: Array<{
    year: number;
    result: number | null;
    cashflow: number | null;
    cumulativeCashflow: number | null;
  }>;
  plan: {
    id: string;
    seriesId: string;
    versionNumber: number;
  };
};

export type V2VesinvestPlan = V2VesinvestPlanSummary & {
  feeRecommendationStatus: 'blocked' | 'provisional' | 'verified';
  feeRecommendation: V2VesinvestFeeRecommendation | null;
  baselineSourceState: V2VesinvestBaselineSourceState | null;
  baselineFingerprint: string | null;
  scenarioFingerprint: string | null;
  horizonYearsRange: number[];
  yearlyTotals: Array<{
    year: number;
    totalAmount: number;
    waterAmount: number;
    wastewaterAmount: number;
  }>;
  fiveYearBands: Array<{
    startYear: number;
    endYear: number;
    totalAmount: number;
  }>;
  projects: V2VesinvestProject[];
};

export type V2VesinvestPlanProjectInput = {
  id?: string;
  code: string;
  name: string;
  investmentType: 'sanering' | 'nyanlaggning' | 'reparation';
  groupKey: string;
  depreciationClassKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
  subtype?: string | null;
  notes?: string | null;
  waterAmount?: number | null;
  wastewaterAmount?: number | null;
  allocations?: Array<{
    year: number;
    totalAmount: number;
    waterAmount?: number | null;
    wastewaterAmount?: number | null;
  }>;
};

export type V2VesinvestPlanCreateInput = {
  name?: string;
  horizonYears?: number;
  baselineSourceState?: V2VesinvestBaselineSourceState | null;
  projects?: V2VesinvestPlanProjectInput[];
};

export type V2VesinvestPlanInput = V2VesinvestPlanCreateInput & {
  status?: 'draft' | 'active' | 'archived';
  baselineStatus?: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus?: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
};

export type V2ForecastScenarioListItem = {
  id: string;
  name: string;
  onOletus: boolean;
  scenarioType: V2ForecastScenarioType;
  horizonYears: number;
  baselineYear: number | null;
  talousarvioId: string;
  updatedAt: string;
  computedAt: string | null;
  computedFromUpdatedAt: string | null;
  computedYears: number;
};

export type V2ForecastScenarioType =
  | 'base'
  | 'committed'
  | 'hypothesis'
  | 'stress';

export type V2ForecastYear = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  investments: number;
  baselineDepreciation: number;
  investmentDepreciation: number;
  totalDepreciation: number;
  combinedPrice: number;
  soldVolume: number;
  cashflow: number;
  cumulativeCashflow: number;
  waterPrice: number;
  wastewaterPrice: number;
  baseFeeRevenue: number;
  connectionCount: number;
};

export type V2ForecastScenario = {
  id: string;
  name: string;
  onOletus: boolean;
  scenarioType: V2ForecastScenarioType;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: V2YearlyInvestmentPlanRow[];
  nearTermExpenseAssumptions: Array<{
    year: number;
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  }>;
  thereafterExpenseAssumptions: {
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  };
  requiredPriceTodayCombined: number | null;
  baselinePriceTodayCombined: number | null;
  requiredAnnualIncreasePct: number | null;
  requiredPriceTodayCombinedAnnualResult: number | null;
  requiredAnnualIncreasePctAnnualResult: number | null;
  requiredPriceTodayCombinedCumulativeCash: number | null;
  requiredAnnualIncreasePctCumulativeCash: number | null;
  feeSufficiency: {
    baselineCombinedPrice: number | null;
    annualResult: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      underfundingStartYear: number | null;
      peakDeficit: number;
    };
    cumulativeCash: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      underfundingStartYear: number | null;
      peakGap: number;
    };
  };
  years: V2ForecastYear[];
  priceSeries: Array<{
    year: number;
    combinedPrice: number;
    waterPrice: number;
    wastewaterPrice: number;
  }>;
  investmentSeries: Array<{ year: number; amount: number }>;
  cashflowSeries: Array<{
    year: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
  computedAt: string | null;
  computedFromUpdatedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type V2YearlyInvestmentPlanRow = {
  rowId?: string | null;
  year: number;
  amount: number;
  target: string | null;
  category: string | null;
  depreciationClassKey?: string | null;
  depreciationRuleSnapshot?: V2DepreciationRuleSnapshot | null;
  investmentType: 'replacement' | 'new' | null;
  confidence: 'low' | 'medium' | 'high' | null;
  waterAmount: number | null;
  wastewaterAmount: number | null;
  note: string | null;
  vesinvestPlanId?: string | null;
  vesinvestProjectId?: string | null;
  allocationId?: string | null;
  projectCode?: string | null;
  groupKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
};

export type V2YearlyInvestmentPlanInput = {
  rowId?: string | null;
  year: number;
  amount: number;
  target?: string | null;
  category?: string | null;
  depreciationClassKey?: string | null;
  investmentType?: 'replacement' | 'new' | null;
  confidence?: 'low' | 'medium' | 'high' | null;
  waterAmount?: number | null;
  wastewaterAmount?: number | null;
  note?: string | null;
  vesinvestPlanId?: string | null;
  vesinvestProjectId?: string | null;
  allocationId?: string | null;
  projectCode?: string | null;
  groupKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
};

export type V2DepreciationRuleMethod =
  | 'linear'
  | 'residual'
  | 'straight-line'
  | 'custom-annual-schedule'
  | 'none';

export type V2EditableDepreciationRuleMethod =
  | 'residual'
  | 'straight-line'
  | 'none';

export type V2DepreciationRule = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: V2DepreciationRuleMethod;
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule?: number[] | null;
  createdAt: string;
  updatedAt: string;
};

export type V2DepreciationRuleSnapshot = {
  assetClassKey: string;
  assetClassName: string | null;
  method: V2DepreciationRuleMethod;
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule?: number[] | null;
};

export type V2ScenarioClassAllocationYear = {
  year: number;
  allocations: Array<{ classKey: string; sharePct: number }>;
};

export async function listDepreciationRulesV2(): Promise<V2DepreciationRule[]> {
  return api<V2DepreciationRule[]>('/v2/forecast/depreciation-rules');
}

export async function listScenarioDepreciationRulesV2(
  scenarioId: string,
): Promise<V2DepreciationRule[]> {
  return api<V2DepreciationRule[]>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules`,
  );
}

export async function createDepreciationRuleV2(data: {
  assetClassKey: string;
  assetClassName?: string;
  method: V2EditableDepreciationRuleMethod;
  linearYears?: number;
  residualPercent?: number;
}): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>('/v2/forecast/depreciation-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createScenarioDepreciationRuleV2(
  scenarioId: string,
  data: {
    assetClassKey: string;
    assetClassName?: string;
    method: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function updateDepreciationRuleV2(
  id: string,
  data: {
    assetClassKey?: string;
    assetClassName?: string;
    method?: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(`/v2/forecast/depreciation-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateScenarioDepreciationRuleV2(
  scenarioId: string,
  id: string,
  data: {
    assetClassKey?: string;
    assetClassName?: string;
    method?: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

export async function deleteDepreciationRuleV2(
  id: string,
): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/v2/forecast/depreciation-rules/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteScenarioDepreciationRuleV2(
  scenarioId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules/${id}`,
    {
      method: 'DELETE',
    },
  );
}

export async function getScenarioClassAllocationsV2(
  scenarioId: string,
): Promise<{
  scenarioId: string;
  years: V2ScenarioClassAllocationYear[];
}> {
  return api(`/v2/forecast/scenarios/${scenarioId}/class-allocations`);
}

export async function updateScenarioClassAllocationsV2(
  scenarioId: string,
  data: { years: V2ScenarioClassAllocationYear[] },
): Promise<{
  scenarioId: string;
  years: V2ScenarioClassAllocationYear[];
}> {
  return api(`/v2/forecast/scenarios/${scenarioId}/class-allocations`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type V2ReportListItem = {
  id: string;
  title: string;
  createdAt: string;
  ennuste: { id: string; nimi: string | null };
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  baselineSourceSummary?: V2BaselineSourceSummary | null;
  variant: 'public_summary' | 'confidential_appendix';
  pdfUrl: string;
};

export type V2ReportDetail = {
  id: string;
  title: string;
  createdAt: string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  ennuste: { id: string; nimi: string | null };
  snapshot: {
    scenario: V2ForecastScenario;
    generatedAt: string;
    acceptedBaselineYears: number[];
    baselineSourceSummaries: V2BaselineSourceSummary[];
    baselineSourceSummary: V2BaselineSourceSummary | null;
    vesinvestPlan?: {
      id: string;
      seriesId?: string;
      name: string;
      utilityName: string;
      businessId?: string | null;
      veetiId?: number | null;
      identitySource?: 'veeti' | null;
      versionNumber: number;
      status?: string;
      baselineFingerprint?: string | null;
      scenarioFingerprint?: string | null;
      feeRecommendation?: V2VesinvestFeeRecommendation | null;
    } | null;
    vesinvestAppendix?: {
      yearlyTotals: Array<{
        year: number;
        totalAmount: number;
      }>;
      fiveYearBands: Array<{
        startYear: number;
        endYear: number;
        totalAmount: number;
      }>;
      groupedProjects: Array<{
        classKey: string;
        classLabel: string;
        totalAmount: number;
        projects: Array<{
          code: string;
          name: string;
          classKey: string;
          classLabel: string;
          accountKey: string | null;
          allocations: Array<{
            year: number;
            totalAmount: number;
            waterAmount: number | null;
            wastewaterAmount: number | null;
          }>;
          totalAmount: number;
        }>;
      }>;
      depreciationPlan: Array<{
        classKey: string;
        classLabel: string;
        accountKey: string | null;
        serviceSplit: 'water' | 'wastewater' | 'mixed';
        method: V2DepreciationRuleMethod;
        linearYears: number | null;
        residualPercent: number | null;
      }>;
    } | null;
    reportVariant: 'public_summary' | 'confidential_appendix';
    reportSections: {
      baselineSources: boolean;
      investmentPlan: boolean;
      assumptions: boolean;
      yearlyInvestments: boolean;
      riskSummary: boolean;
    };
  };
  variant: 'public_summary' | 'confidential_appendix';
  pdfUrl: string;
};

export async function getOverviewV2(): Promise<V2OverviewResponse> {
  return dedupeInFlightGet('GET /v2/overview', () =>
    api<V2OverviewResponse>('/v2/overview'),
  );
}

export async function getPlanningContextV2(
  options?: GetRequestOptions,
): Promise<V2PlanningContextResponse> {
  return getCachedGet(
    'GET /v2/context',
    () => api<V2PlanningContextResponse>('/v2/context'),
    options,
  );
}

export async function refreshOverviewPeerV2(vuosi?: number): Promise<{
  targetYear: number;
  recompute: {
    vuosi: number;
    computed: number;
    sourceOrgCount: number;
    computedAt: string;
  };
  peerSnapshot: V2PeerSnapshot;
}> {
  return api('/v2/overview/peer-refresh', {
    method: 'POST',
    body: JSON.stringify({ vuosi }),
  });
}

export async function searchImportOrganizationsV2(
  q: string,
  limit = 25,
): Promise<VeetiOrganizationSearchHit[]> {
  const normalizedQuery = q.trim();
  const safeLimit = Math.min(Math.max(Math.round(limit) || 25, 1), 25);
  return api<VeetiOrganizationSearchHit[]>(
    `/v2/import/search?q=${encodeURIComponent(normalizedQuery)}&limit=${safeLimit}`,
  );
}

export async function connectImportOrganizationV2(
  veetiId: number,
): Promise<VeetiConnectResult> {
  return api<VeetiConnectResult>('/v2/import/connect', {
    method: 'POST',
    body: JSON.stringify({ veetiId }),
  });
}

export async function importYearsV2(years: number[]): Promise<{
  selectedYears: number[];
  importedYears: number[];
  workspaceYears: number[];
  skippedYears: Array<{ vuosi: number; reason: string }>;
  sync: VeetiConnectResult;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/import', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function createPlanningBaselineV2(years: number[]): Promise<{
  selectedYears: number[];
  includedYears: number[];
  skippedYears: Array<{ vuosi: number; reason: string }>;
  planningBaseline: {
    success: boolean;
    count: number;
    results: Array<{
      budgetId: string;
      vuosi: number;
      mode: 'created' | 'updated';
    }>;
  };
  status: V2ImportStatus;
}> {
  const result = await api<{
    selectedYears: number[];
    includedYears: number[];
    skippedYears: Array<{ vuosi: number; reason: string }>;
    planningBaseline: {
      success: boolean;
      count: number;
      results: Array<{
        budgetId: string;
        vuosi: number;
        mode: 'created' | 'updated';
      }>;
    };
    status: V2ImportStatus;
  }>('/v2/import/planning-baseline', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
  invalidateCachedGets('GET /v2/context', 'GET /v2/forecast/scenarios');
  return result;
}

// Legacy review/fix helper. Step-2 import should use importYearsV2 and
// planning-baseline creation should use createPlanningBaselineV2.
export async function syncImportV2(years: number[]): Promise<{
  selectedYears: number[];
  importedYears: number[];
  workspaceYears: number[];
  sync: VeetiConnectResult;
  sanity?: {
    checkedAt: string;
    rows: Array<{
      year: number;
      status: 'ok' | 'mismatch' | 'missing_live' | 'missing_effective';
      mismatches: string[];
    }>;
  };
  generatedBudgets: {
    success: boolean;
    count: number;
    results: Array<{
      budgetId: string;
      vuosi: number;
      mode: 'created' | 'updated';
    }>;
    skipped?: Array<{ vuosi: number; reason: string }>;
  };
  status: V2ImportStatus;
}> {
  return api('/v2/import/sync', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function getImportStatusV2(): Promise<V2ImportStatus> {
  return dedupeInFlightGet('GET /v2/import/status', () =>
    api<V2ImportStatus>('/v2/import/status'),
  );
}

export async function deleteImportYearV2(year: number): Promise<{
  vuosi: number;
  deletedSnapshots: number;
  deletedOverrides?: number;
  deletedBudgets: number;
  excludedPolicyApplied?: boolean;
  status: V2ImportStatus;
}> {
  return api(`/v2/import/years/${year}`, {
    method: 'DELETE',
  });
}

export async function deleteImportYearsBulkV2(years: number[]): Promise<{
  requestedYears: number[];
  deletedCount: number;
  failedCount: number;
  results: Array<
    | {
        vuosi: number;
        ok: true;
        deletedSnapshots: number;
        deletedOverrides?: number;
        deletedBudgets: number;
        excludedPolicyApplied?: boolean;
      }
    | {
        vuosi: number;
        ok: false;
        error: string;
      }
  >;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function excludeImportYearsV2(years: number[]): Promise<{
  requestedYears: number[];
  excludedCount: number;
  alreadyExcludedCount: number;
  results: Array<{
    vuosi: number;
    excluded: boolean;
    reason: string | null;
  }>;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/exclude', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function restoreImportYearsV2(years: number[]): Promise<{
  requestedYears: number[];
  restoredCount: number;
  notExcludedCount: number;
  results: Array<{
    vuosi: number;
    restored: boolean;
    reason: string | null;
  }>;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/restore', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function clearImportAndScenariosV2(confirmToken: string): Promise<{
  deletedScenarios: number;
  deletedVeetiBudgets: number;
  deletedVeetiSnapshots: number;
  deletedVeetiOverrides?: number;
  deletedVeetiYearPolicies?: number;
  deletedVesinvestPlanSeries?: number;
  deletedVeetiLinks: number;
  status: V2ImportStatus;
}> {
  // V2 account drawer destructive action. Backend handler: POST /v2/import/clear.
  const result = await api<{
    deletedScenarios: number;
    deletedVeetiBudgets: number;
    deletedVeetiSnapshots: number;
    deletedVeetiOverrides?: number;
    deletedVeetiYearPolicies?: number;
    deletedVesinvestPlanSeries?: number;
    deletedVeetiLinks: number;
    status: V2ImportStatus;
  }>('/v2/import/clear', {
    method: 'POST',
    body: JSON.stringify({ confirmToken }),
  });
  invalidateCachedGets(
    'GET /v2/context',
    'GET /v2/forecast/scenarios',
    'GET /v2/reports',
    'GET /v2/vesinvest/plans',
  );
  return result;
}

export async function completeImportYearManuallyV2(
  payload: V2ManualYearPatchPayload,
): Promise<V2ManualYearPatchResponse> {
  return api('/v2/import/manual-year', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getImportYearDataV2(
  year: number,
): Promise<V2ImportYearDataResponse> {
  return api(`/v2/import/years/${year}/data`);
}

export async function previewStatementImportV2(
  year: number,
  file: File,
): Promise<V2StatementPreviewResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('statementType', 'result_statement');
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/v2/import/years/${year}/statement-preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  return res.json();
}

export async function previewWorkbookImportV2(
  file: File,
): Promise<V2WorkbookPreviewResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/v2/import/workbook-preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  return res.json();
}

export async function reconcileImportYearV2(
  year: number,
  payload: {
    action: 'keep_manual' | 'apply_veeti';
    dataTypes?: string[];
  },
): Promise<{
  year: number;
  action: 'keep_manual' | 'apply_veeti';
  reconciledDataTypes: string[];
  status: V2ImportStatus;
  yearData: V2ImportYearDataResponse;
}> {
  return api(`/v2/import/years/${year}/reconcile`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function trackOpsEventV2(
  payload: V2OpsEventPayload,
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  await fetch(`${API_BASE}/v2/ops/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

export async function getOpsFunnelV2(): Promise<V2OpsFunnelSnapshot> {
  return api<V2OpsFunnelSnapshot>('/v2/ops/funnel');
}

export async function listForecastScenariosV2(
  options?: GetRequestOptions,
): Promise<V2ForecastScenarioListItem[]> {
  return getCachedGet(
    'GET /v2/forecast/scenarios',
    () => api<V2ForecastScenarioListItem[]>('/v2/forecast/scenarios'),
    options,
  );
}

export async function createForecastScenarioV2(data: {
  name?: string;
  talousarvioId?: string;
  horizonYears?: number;
  copyFromScenarioId?: string;
  scenarioType?: V2ForecastScenarioType;
  compute?: boolean;
}): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>('/v2/forecast/scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getForecastScenarioV2(
  id: string,
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}`);
}

export async function updateForecastScenarioV2(
  id: string,
  data: {
    name?: string;
    horizonYears?: number;
    scenarioType?: V2ForecastScenarioType;
    yearlyInvestments?: V2YearlyInvestmentPlanInput[];
    scenarioAssumptions?: Partial<
      Record<
        | 'inflaatio'
        | 'energiakerroin'
        | 'henkilostokerroin'
        | 'vesimaaran_muutos'
        | 'hintakorotus'
        | 'perusmaksuMuutos'
        | 'investointikerroin',
        number
      >
    >;
    nearTermExpenseAssumptions?: Array<{
      year: number;
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    }>;
    thereafterExpenseAssumptions?: {
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    };
  },
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteForecastScenarioV2(id: string): Promise<void> {
  await api(`/v2/forecast/scenarios/${id}`, { method: 'DELETE' });
}

export async function computeForecastScenarioV2(
  id: string,
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}/compute`, {
    method: 'POST',
  });
}

export async function listVesinvestGroupsV2(): Promise<V2VesinvestGroupDefinition[]> {
  return api<V2VesinvestGroupDefinition[]>('/v2/vesinvest/groups');
}

export async function updateVesinvestGroupV2(
  key: string,
  body: V2VesinvestGroupUpdateInput,
): Promise<V2VesinvestGroupDefinition> {
  return api<V2VesinvestGroupDefinition>(
    `/v2/vesinvest/groups/${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function listVesinvestPlansV2(): Promise<V2VesinvestPlanSummary[]> {
  return api<V2VesinvestPlanSummary[]>('/v2/vesinvest/plans');
}

export async function createVesinvestPlanV2(
  data: V2VesinvestPlanCreateInput,
): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>('/v2/vesinvest/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function getVesinvestPlanV2(id: string): Promise<V2VesinvestPlan> {
  return api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}`);
}

export async function updateVesinvestPlanV2(
  id: string,
  data: V2VesinvestPlanInput,
): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function cloneVesinvestPlanV2(id: string): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}/clone`, {
    method: 'POST',
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function syncVesinvestPlanToForecastV2(
  id: string,
  data?: {
    compute?: boolean;
    baselineSourceState?: V2VesinvestBaselineSourceState | null;
  },
): Promise<{ plan: V2VesinvestPlan; scenarioId: string }> {
  const result = await api<{ plan: V2VesinvestPlan; scenarioId: string }>(
    `/v2/vesinvest/plans/${id}/forecast-sync`,
    {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    },
  );
  invalidateCachedGets('GET /v2/context', 'GET /v2/forecast/scenarios');
  return result;
}

export async function listReportsV2(
  ennusteId?: string,
  options?: GetRequestOptions,
): Promise<V2ReportListItem[]> {
  const query = ennusteId ? `?ennusteId=${encodeURIComponent(ennusteId)}` : '';
  return getCachedGet(
    `GET /v2/reports${query}`,
    () => api<V2ReportListItem[]>(`/v2/reports${query}`),
    options,
  );
}

export async function createReportV2(data: {
  ennusteId?: string;
  vesinvestPlanId: string;
  title?: string;
  variant?: 'public_summary' | 'confidential_appendix';
}): Promise<{
  reportId: string;
  title: string;
  createdAt: string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  variant: 'public_summary' | 'confidential_appendix';
  pdfUrl: string;
}> {
  const result = await api<{
    reportId: string;
    title: string;
    createdAt: string;
    baselineYear: number;
    requiredPriceToday: number;
    requiredAnnualIncreasePct: number;
    totalInvestments: number;
    variant: 'public_summary' | 'confidential_appendix';
    pdfUrl: string;
  }>('/v2/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/reports');
  return result;
}

export async function getReportV2(id: string): Promise<V2ReportDetail> {
  return api<V2ReportDetail>(`/v2/reports/${id}`);
}

export function getReportPdfUrlV2(id: string): string {
  return `${API_BASE}/v2/reports/${id}/pdf`;
}

export async function downloadReportPdfV2(id: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const token = getToken();
  const res = await fetch(getReportPdfUrlV2(id), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get('content-disposition') ?? '';
  const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  const rawName = utf8Name ? decodeURIComponent(utf8Name) : quotedName;
  const filename =
    rawName && rawName.toLowerCase().endsWith('.pdf')
      ? rawName
      : `report-${id}.pdf`;

  return { blob, filename };
}
