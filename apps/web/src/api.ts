/**
 * API helper for the Vesipolku app.
 * Reads JWT from localStorage and attaches Authorization header.
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

const inFlightGetRequests = new Map<string, Promise<unknown>>();

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

// Demo status is never inferred from env; always from GET /demo/status (see getDemoStatus()).

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

  // On 401: clear token and require re-login. No automatic dev-token or demo-login refresh.
  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const contentType = res.headers.get('Content-Type') ?? '';
    const errorText = await res.text();
    let parsedBody: Record<string, unknown> | null = null;
    let message: string;
    if (contentType.includes('application/json') && errorText) {
      try {
        parsedBody = JSON.parse(errorText) as Record<string, unknown>;
        const bodyMessage = parsedBody?.message;
        if (typeof bodyMessage === 'string') {
          message = bodyMessage;
        } else if (Array.isArray(bodyMessage)) {
          message = bodyMessage.map((item) => String(item)).join(', ');
        } else if (
          bodyMessage &&
          typeof bodyMessage === 'object' &&
          typeof (bodyMessage as { message?: unknown }).message === 'string'
        ) {
          message = (bodyMessage as { message: string }).message;
        } else if (typeof parsedBody?.error === 'string') {
          message = parsedBody.error;
        } else {
          message = errorText;
        }
      } catch {
        message = errorText;
      }
    } else {
      message = errorText || `Request failed (${res.status})`;
    }
    const err = new Error(message) as Error & {
      status?: number;
      code?: string;
      details?: Record<string, unknown> | null;
    };
    err.status = res.status;
    if (parsedBody) {
      const bodyCode = parsedBody.code;
      if (typeof bodyCode === 'string') err.code = bodyCode;
      err.details = parsedBody;
    }
    throw err;
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
    const errorText = await res.text();
    let message = 'Login failed';
    if (errorText) {
      try {
        const parsed = JSON.parse(errorText) as {
          message?: unknown;
          error?: unknown;
        };
        if (typeof parsed.message === 'string') {
          message = parsed.message;
        } else if (Array.isArray(parsed.message)) {
          message = parsed.message.map((item) => String(item)).join(', ');
        } else if (typeof parsed.error === 'string') {
          message = parsed.error;
        } else {
          message = errorText;
        }
      } catch {
        message = errorText;
      }
    }
    throw new Error(message);
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
 * Demo login: calls /auth/demo-login which bootstraps demo data and returns token.
 * Requires API DEMO_MODE=true. When server has DEMO_KEY set, pass VITE_DEMO_KEY if configured.
 * When server has no DEMO_KEY (e.g. localhost), works without a key for "always works" demo flow.
 */
export async function demoLogin(): Promise<string> {
  const demoKey = import.meta.env.VITE_DEMO_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (demoKey) headers['x-demo-key'] = demoKey;

  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers,
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
        'Demo login rejected by server (check DEMO_MODE and DEMO_KEY).',
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
 * Only works when DEMO_MODE is enabled on backend.
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
  linkedAt?: string;
  lastFetchedAt?: string | null;
  fetchStatus?: string | null;
}

export interface VeetiYearInfo {
  vuosi: number;
  dataTypes: string[];
  completeness: Record<string, boolean>;
}

export interface VeetiConnectResult {
  linked: {
    orgId: string;
    veetiId: number;
    nimi: string | null;
    ytunnus: string | null;
  };
  fetchedAt: string;
  years: number[];
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
  years: VeetiYearInfo[];
};

export type V2OverviewResponse = {
  latestVeetiYear: number | null;
  importStatus: V2ImportStatus;
  kpis: {
    revenue: V2MetricKpi;
    costs: V2MetricKpi;
    result: V2MetricKpi;
    volume: V2MetricKpi;
    combinedPrice: V2MetricKpi;
  };
  trendSeries: V2TrendPoint[];
  peerSnapshot: V2PeerSnapshot;
};

export type V2ForecastScenarioListItem = {
  id: string;
  name: string;
  onOletus: boolean;
  horizonYears: number;
  baselineYear: number | null;
  talousarvioId: string;
  updatedAt: string;
  computedYears: number;
};

export type V2ForecastYear = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  investments: number;
  combinedPrice: number;
  soldVolume: number;
  cashflow: number;
  cumulativeCashflow: number;
  waterPrice: number;
  wastewaterPrice: number;
};

export type V2ForecastScenario = {
  id: string;
  name: string;
  onOletus: boolean;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: Array<{ year: number; amount: number }>;
  requiredPriceTodayCombined: number | null;
  baselinePriceTodayCombined: number | null;
  requiredAnnualIncreasePct: number | null;
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
  updatedAt: string;
  createdAt: string;
};

export type V2ReportListItem = {
  id: string;
  title: string;
  createdAt: string;
  ennuste: { id: string; nimi: string | null };
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
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
  };
  pdfUrl: string;
};

export async function getOverviewV2(): Promise<V2OverviewResponse> {
  return dedupeInFlightGet('GET /v2/overview', () =>
    api<V2OverviewResponse>('/v2/overview'),
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
  return api<VeetiOrganizationSearchHit[]>(
    `/v2/import/search?q=${encodeURIComponent(q)}&limit=${limit}`,
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

export async function syncImportV2(years: number[]): Promise<{
  selectedYears: number[];
  sync: VeetiConnectResult;
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

export async function listForecastScenariosV2(): Promise<
  V2ForecastScenarioListItem[]
> {
  return dedupeInFlightGet('GET /v2/forecast/scenarios', () =>
    api<V2ForecastScenarioListItem[]>('/v2/forecast/scenarios'),
  );
}

export async function createForecastScenarioV2(data: {
  name?: string;
  talousarvioId?: string;
  horizonYears?: number;
  copyFromScenarioId?: string;
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
    yearlyInvestments?: Array<{ year: number; amount: number }>;
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

export async function listReportsV2(
  ennusteId?: string,
): Promise<V2ReportListItem[]> {
  const query = ennusteId ? `?ennusteId=${encodeURIComponent(ennusteId)}` : '';
  return dedupeInFlightGet(`GET /v2/reports${query}`, () =>
    api<V2ReportListItem[]>(`/v2/reports${query}`),
  );
}

export async function createReportV2(data: {
  ennusteId: string;
  title?: string;
}): Promise<{
  reportId: string;
  title: string;
  createdAt: string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  pdfUrl: string;
}> {
  return api('/v2/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getReportV2(id: string): Promise<V2ReportDetail> {
  return api<V2ReportDetail>(`/v2/reports/${id}`);
}

export function getReportPdfUrlV2(id: string): string {
  return `${API_BASE}/v2/reports/${id}/pdf`;
}
