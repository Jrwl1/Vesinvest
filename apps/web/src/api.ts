/**
 * API helper for asset maintenance app.
 * Reads JWT from localStorage and attaches Authorization header.
 */

const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

/** Local API port (must match apps/api: main.ts uses process.env.PORT || 3000). */
const DEFAULT_DEV_API_PORT = 3000;
const DEFAULT_DEV_API_BASE = `http://localhost:${DEFAULT_DEV_API_PORT}`;

const raw = import.meta.env.VITE_API_BASE_URL;
const envApiBase = raw === undefined || raw === null ? '' : String(raw).trim();
if (IS_PROD && !envApiBase) {
  throw new Error('VITE_API_BASE_URL is required in production');
}
// If set, use VITE_API_BASE_URL; else in dev default to local API (no Cloudflare tunnel).
const API_BASE = envApiBase
  ? envApiBase.replace(/\/+$/, '')
  : IS_DEV
    ? DEFAULT_DEV_API_BASE
    : envApiBase.replace(/\/+$/, '');

const TOKEN_KEY = 'access_token';

// Demo status is never inferred from env; always from GET /demo/status (see getDemoStatus()).

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

  // On 401: clear token and require re-login. No automatic dev-token or demo-login refresh.
  if (res.status === 401) {
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const contentType = res.headers.get('Content-Type') ?? '';
    const errorText = await res.text();
    let message: string;
    if (contentType.includes('application/json') && errorText) {
      try {
        const body = JSON.parse(errorText) as { message?: string };
        message = body.message ?? errorText;
      } catch {
        message = errorText;
      }
    } else {
      message = errorText || `Request failed (${res.status})`;
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
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
 * Result of GET /demo/status. No auth. Never throws.
 * Frontend must use this as the only source of truth for demo mode; do not use VITE_DEMO_MODE for visibility.
 */
export type DemoStatusResult =
  | { enabled: true; orgId: string }
  | { enabled: false; orgId?: null }
  | { unreachable: true };

/**
 * Fetch demo status from backend. GET /demo/status, no auth, never throws.
 * Use this on app bootstrap and store in context; never infer demo mode from env alone.
 * Handles 304 (empty body) so we don't misclassify as "backend not responding".
 */
export async function getDemoStatus(): Promise<DemoStatusResult> {
  try {
    const res = await fetch(`${API_BASE}/demo/status`, {
      method: 'GET',
      cache: 'no-store', // avoid 304 so we always get a body and correct classification
    });
    if (!res.ok) return { unreachable: true };
    const text = await res.text();
    if (!text.trim()) {
      // 304 or empty body: backend responded; assume demo enabled so button stays visible
      return { enabled: true, orgId: 'demo-org-00000000-0000-0000-0000-000000000001' };
    }
    let data: { enabled?: boolean; orgId?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      return { enabled: false, orgId: null };
    }
    const enabled = data?.enabled === true;
    return enabled
      ? { enabled: true, orgId: data?.orgId ?? 'demo-org-00000000-0000-0000-0000-000000000001' }
      : { enabled: false, orgId: null };
  } catch {
    return { unreachable: true };
  }
}

/**
 * Demo login: calls /auth/demo-login which bootstraps demo data and returns token.
 * Requires API DEMO_MODE=true. When server has DEMO_KEY set, pass VITE_DEMO_KEY if configured.
 * When server has no DEMO_KEY (e.g. localhost), works without a key for "always works" demo flow.
 */
export async function demoLogin(): Promise<string> {
  const demoKey = import.meta.env.VITE_DEMO_KEY;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (demoKey) headers['x-demo-key'] = demoKey;

  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Demo login endpoint missing on backend (/auth/demo-login).');
    }
    if (res.status === 429) {
      throw new Error('Demo rate limit exceeded');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('Demo login rejected by server (check DEMO_MODE and DEMO_KEY).');
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

import type {
  Asset,
  Site,
  AssetType,
  MaintenanceItem,
  CreateMaintenanceItemPayload,
  ExcelImport,
  ImportInbox,
  UploadResponse,
  PlanningScenario,
  ImportMapping,
  ImportExecutionResult,
  MatchKeyStrategy,
} from './types';

export async function getAsset(id: string): Promise<Asset> {
  return api<Asset>(`/assets/${id}`);
}

/** Count of assets missing lifetime or replacement cost (for "Needs details" banner). */
export async function getMissingDetailsCount(): Promise<{ count: number }> {
  return api<{ count: number }>('/assets/missing-details-count');
}

// ============ Sites API ============

export async function listSites(): Promise<Site[]> {
  return api<Site[]>('/sites');
}

export async function getSite(id: string): Promise<Site> {
  return api<Site>(`/sites/${id}`);
}

export async function createSite(data: { name: string; address?: string }): Promise<Site> {
  return api<Site>('/sites', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ Asset Types API ============

export async function listAssetTypes(): Promise<AssetType[]> {
  return api<AssetType[]>('/asset-types');
}

export async function getAssetType(id: string): Promise<AssetType> {
  return api<AssetType>(`/asset-types/${id}`);
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

// ============ Excel Imports API ============

export async function listImports(): Promise<ExcelImport[]> {
  return api<ExcelImport[]>('/imports');
}

export async function getImport(id: string): Promise<ExcelImport> {
  return api<ExcelImport>(`/imports/${id}`);
}

export async function getImportInbox(importId: string): Promise<ImportInbox> {
  return api<ImportInbox>(`/imports/${importId}/inbox`);
}

export async function uploadExcel(file: File): Promise<UploadResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/imports/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (typeof parsed?.message === 'string') message = parsed.message;
    } catch {
      /* use raw errorText */
    }
    throw new Error(message);
  }

  return res.json();
}

export async function deleteImport(id: string): Promise<void> {
  await api(`/imports/${id}`, { method: 'DELETE' });
}

export async function getSheetPreview(
  importId: string,
  sheetId: string
): Promise<{
  id: string;
  sheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}> {
  return api(`/imports/${importId}/sheets/${sheetId}/preview`);
}

// ============ Planning Scenarios API ============

export async function listScenarios(): Promise<PlanningScenario[]> {
  return api<PlanningScenario[]>('/planning-scenarios');
}

export async function getScenario(id: string): Promise<PlanningScenario> {
  return api<PlanningScenario>(`/planning-scenarios/${id}`);
}

export async function createScenario(
  data: Partial<PlanningScenario>
): Promise<PlanningScenario> {
  return api<PlanningScenario>('/planning-scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateScenario(
  id: string,
  data: Partial<PlanningScenario>
): Promise<PlanningScenario> {
  return api<PlanningScenario>(`/planning-scenarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteScenario(id: string): Promise<void> {
  await api(`/planning-scenarios/${id}`, { method: 'DELETE' });
}

// ============ Import Mappings API ============

export async function listMappings(): Promise<ImportMapping[]> {
  return api<ImportMapping[]>('/mappings');
}

export async function getMapping(id: string): Promise<ImportMapping> {
  return api<ImportMapping>(`/mappings/${id}`);
}

export async function createMapping(
  data: Partial<ImportMapping>
): Promise<ImportMapping> {
  return api<ImportMapping>('/mappings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMappingSuggestions(
  importId: string,
  sheetId: string
): Promise<{ suggestions: Array<{ sourceColumn: string; targetField: string; confidence: number }> }> {
  return api(`/imports/${importId}/sheets/${sheetId}/suggestions`);
}

export async function executeImport(
  importId: string,
  mappingId: string,
  sheetId: string,
  options?: {
    dryRun?: boolean;
    matchKeyStrategy?: MatchKeyStrategy;
  }
): Promise<ImportExecutionResult> {
  return api(`/imports/${importId}/execute`, {
    method: 'POST',
    body: JSON.stringify({
      mappingId,
      sheetId,
      dryRun: options?.dryRun ?? false,
      // Per Asset Identity Contract, default to externalRef matching
      matchKeyStrategy: options?.matchKeyStrategy ?? 'externalRef',
    }),
  });
}

// ============ Template Matching API ============

import type {
  TemplateMatchResponse,
  ReadinessCheckResult,
  ImportAssumption,
  TargetEntity,
} from './types';

export async function findMatchingTemplates(
  importId: string,
  sheetId: string,
  targetEntity: TargetEntity
): Promise<TemplateMatchResponse> {
  return api(
    `/mappings/templates/match?importId=${importId}&sheetId=${sheetId}&targetEntity=${targetEntity}`
  );
}

export async function listTemplates(targetEntity?: TargetEntity): Promise<ImportMapping[]> {
  const query = targetEntity ? `?targetEntity=${targetEntity}` : '';
  return api<ImportMapping[]>(`/mappings/templates/list${query}`);
}

// ============ Readiness Gate API ============

export async function checkReadiness(
  importId: string,
  mappingId: string,
  sheetId: string,
  assumptions?: ImportAssumption[]
): Promise<ReadinessCheckResult> {
  return api(`/imports/${importId}/readiness-check`, {
    method: 'POST',
    body: JSON.stringify({
      mappingId,
      sheetId,
      assumptions: assumptions || [],
    }),
  });
}

export async function executePreview(
  importId: string,
  mappingId: string,
  sheetId: string,
  matchKeyStrategy?: MatchKeyStrategy
): Promise<ImportExecutionResult> {
  return api(`/imports/${importId}/preview`, {
    method: 'POST',
    body: JSON.stringify({
      mappingId,
      sheetId,
      // Per Asset Identity Contract, default to externalRef matching
      matchKeyStrategy: matchKeyStrategy || 'externalRef',
    }),
  });
}

// ============ Auto-Extract API ============

import type {
  SheetDefaults,
  AutoExtractAnalysis,
  AutoExtractResult,
} from './types';

/**
 * Analyze a sheet for auto-extract compatibility
 */
/**
 * Analyze a sheet for auto-extract compatibility.
 * Supports manual site override via siteOverrideId parameter.
 */
export async function analyzeForAutoExtract(
  importId: string,
  sheetId: string,
  siteOverrideId?: string
): Promise<AutoExtractAnalysis> {
  const params = siteOverrideId ? `?siteOverrideId=${encodeURIComponent(siteOverrideId)}` : '';
  return api(`/imports/${importId}/sheets/${sheetId}/auto-extract-analysis${params}`);
}

/**
 * Auto-extract assets from a sheet with minimal required fields.
 * Bypasses per-column mapping - uses sheet-level defaults.
 * 
 * Site can be specified via:
 * - siteOverrideId: Direct site ID (bypasses all site detection)
 * - sheetDefaults.site: Site name to look up
 */
export async function autoExtract(
  importId: string,
  sheetId: string,
  sheetDefaults: SheetDefaults,
  options?: {
    dryRun?: boolean;
    allowFallbackIdentity?: boolean;
    /** If provided, use this site ID for all rows (bypasses site detection) */
    siteOverrideId?: string;
  }
): Promise<AutoExtractResult> {
  return api(`/imports/${importId}/auto-extract`, {
    method: 'POST',
    body: JSON.stringify({
      sheetId,
      sheetDefaults,
      dryRun: options?.dryRun ?? false,
      allowFallbackIdentity: options?.allowFallbackIdentity ?? true,
      siteOverrideId: options?.siteOverrideId,
    }),
  });
}

// ============ Post-Import Sanity Summary API ============

import type { SanitySummary, DemoResetResult } from './types';

/**
 * Get post-import sanity summary for visual validation.
 * Returns null if summary cannot be generated (never throws).
 */
export async function getSanitySummary(importId: string): Promise<SanitySummary | null> {
  try {
    return await api<SanitySummary>(`/imports/${importId}/sanity-summary`);
  } catch {
    // Never throw - return null for graceful UI handling
    return null;
  }
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
  created?: { assumptions: number; budget: boolean; projection: boolean };
}

/**
 * Seed optional demo dataset (budget, assumptions, projection). Idempotent.
 * Only available when demo mode is enabled; returns 404 in production.
 */
export async function seedDemoData(): Promise<DemoSeedResult> {
  return api<DemoSeedResult>('/demo/seed', { method: 'POST' });
}

// ============ VA Budget API ============

/**
 * Subtotal line from KVA import (TalousarvioValisumma). Used for section totals when rivit are empty.
 * categoryKey and tyyppi align with GET /budgets/:id and KVA confirm payload (deterministic readback).
 */
export interface BudgetValisumma {
  id: string;
  talousarvioId: string;
  palvelutyyppi: string;
  categoryKey: string;
  tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
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
  importBatchId?: string | null;
  importSourceFileName?: string | null;
  importedAt?: string | null;
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

/** KVA import set (3 budgets sharing same importBatchId). For Talousarvio set selector. */
export interface BudgetSet {
  batchId: string;
  id: string;
  vuosi: number;
  nimi: string;
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

export async function createBudget(data: { vuosi: number; nimi?: string; perusmaksuYhteensa?: number }): Promise<Budget> {
  return api<Budget>('/budgets', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBudget(id: string, data: { nimi?: string; tila?: string; perusmaksuYhteensa?: number }): Promise<Budget> {
  return api<Budget>(`/budgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBudget(id: string): Promise<void> {
  await api(`/budgets/${id}`, { method: 'DELETE' });
}

// Budget Lines
export async function createBudgetLine(budgetId: string, data: {
  tiliryhma: string; nimi: string; tyyppi: string; summa: number; muistiinpanot?: string;
}): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBudgetLine(budgetId: string, lineId: string, data: Record<string, unknown>): Promise<BudgetLine> {
  return api<BudgetLine>(`/budgets/${budgetId}/rivit/${lineId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBudgetLine(budgetId: string, lineId: string): Promise<void> {
  await api(`/budgets/${budgetId}/rivit/${lineId}`, { method: 'DELETE' });
}

// Revenue Drivers
export async function createRevenueDriver(budgetId: string, data: Record<string, unknown>): Promise<RevenueDriver> {
  return api<RevenueDriver>(`/budgets/${budgetId}/tuloajurit`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateRevenueDriver(budgetId: string, driverId: string, data: Record<string, unknown>): Promise<RevenueDriver> {
  return api<RevenueDriver>(`/budgets/${budgetId}/tuloajurit/${driverId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteRevenueDriver(budgetId: string, driverId: string): Promise<void> {
  await api(`/budgets/${budgetId}/tuloajurit/${driverId}`, { method: 'DELETE' });
}

// Assumptions
export async function listAssumptions(): Promise<Assumption[]> {
  return api<Assumption[]>('/assumptions');
}

export async function upsertAssumption(avain: string, data: { arvo: number; nimi?: string; yksikko?: string; kuvaus?: string }): Promise<Assumption> {
  return api<Assumption>(`/assumptions/${avain}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function resetAssumptionDefaults(): Promise<Assumption[]> {
  return api<Assumption[]>('/assumptions/reset-defaults', { method: 'POST' });
}

// ============ Projections API ============

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
  onOletus: boolean;
  createdAt: string;
  updatedAt: string;
  talousarvio?: { id: string; vuosi: number; nimi: string };
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
}): Promise<Projection> {
  return api<Projection>('/projections', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProjection(id: string, data: {
  nimi?: string;
  aikajaksoVuosia?: number;
  olettamusYlikirjoitukset?: Record<string, number>;
  onOletus?: boolean;
}): Promise<Projection> {
  return api<Projection>(`/projections/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
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
): Promise<Projection> {
  return api<Projection>('/projections/compute-for-budget', {
    method: 'POST',
    body: JSON.stringify({ talousarvioId, olettamusYlikirjoitukset }),
  });
}

export function getProjectionExportUrl(id: string): string {
  return `${API_BASE}/projections/${id}/export`;
}

/** V1 PDF cashflow export route (ADR-017). */
export function getProjectionExportPdfUrl(id: string): string {
  return `${API_BASE}/projections/${id}/export-pdf`;
}

// ============ Budget Import API ============

export interface ImportPreviewRow {
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: number;
  muistiinpanot?: string;
}

export interface ImportProcessedSheet {
  sheetName: string;
  lines: number;
  sections?: number;
  skipped?: boolean;
  reason?: string;
}

export interface ImportKvaDebug {
  detectedSheetName: string;
  detectedHeaderRowIndex: number;
  budgetColumnIndex: number;
  parsedRowCount: number;
  firstParsedAccount: string;
  lastParsedAccount: string;
}

/** Revenue driver for KVA preview (vesi/jatevesi unit price, volume, VAT%, etc.). */
export interface ImportRevenueDriver {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta?: number;
  myytyMaara?: number;
  perusmaksu?: number;
  liittymamaara?: number;
  alvProsentti?: number;
}

/** Debug metadata for drivers extraction (selected year, sheet used). */
export interface ImportDriversDebug {
  selectedYear?: number;
  volumeSheet?: string;
  volumeLabel?: string;
  connectionSheet?: string;
  connectionYearCol?: number;
  priceSheetName?: string;
  priceHeaderRowIndex?: number;
  priceVatColumnsFound?: number[];
  chosenVatRate?: number;
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  skippedRows: number;
  detectedFormat: string;
  warnings: string[];
  /** Set when a VA template (e.g. KVA) was detected. */
  year?: number | null;
  templateId?: string;
  amountColumnUsed?: string;
  countsByType?: { tulo: number; kulu: number; investointi: number };
  processedSheets?: ImportProcessedSheet[];
  /** Temporary KVA debug (dev-only). */
  kvaDebug?: ImportKvaDebug;
  /** KVA revenue drivers (preview only). */
  revenueDrivers?: ImportRevenueDriver[];
  /** Optional debug for drivers extraction. */
  driversDebug?: ImportDriversDebug;
}

export interface ImportConfirmResult {
  success: boolean;
  created: number;
  skipped: number;
  total: number;
}

/**
 * Upload a CSV/Excel file for preview. Returns parsed rows without persisting.
 */
export async function importBudgetPreview(budgetId: string, file: File): Promise<ImportPreviewResult> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/budgets/${budgetId}/import/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Import preview failed (${res.status})`);
  }

  return res.json();
}

/**
 * Confirm import: create budget lines from previewed rows; optionally upsert revenue drivers (KVA).
 */
export async function importBudgetConfirm(
  budgetId: string,
  rows: ImportPreviewRow[],
  revenueDrivers?: ImportRevenueDriver[],
): Promise<ImportConfirmResult> {
  return api<ImportConfirmResult>(`/budgets/${budgetId}/import/confirm`, {
    method: 'POST',
    body: JSON.stringify(revenueDrivers?.length ? { rows, revenueDrivers } : { rows }),
  });
}

// ============ KVA Import API (subtotal-first flow) ============

/** Subtotal line from KVA summary sheets. */
export interface KvaSubtotalLine {
  categoryKey: string;
  categoryName: string;
  type: 'income' | 'cost' | 'depreciation' | 'financial' | 'investment' | 'result';
  amount: number;
  year: number;
  sourceSheet: string;
  palvelutyyppi?: 'vesi' | 'jatevesi';
  level?: number;
  order?: number;
}

/** KVA preview result (extends ImportPreviewResult with subtotal data). */
export interface KvaPreviewResult extends ImportPreviewResult {
  subtotalLines?: KvaSubtotalLine[];
  subtotalDebug?: {
    sourceSheets: string[];
    yearColumnsDetected: number[];
    selectedYear: number;
    selectedHistoricalYears?: number[];
    rowsMatched: number;
    rowsSkipped: number;
  };
  availableYears?: number[];
}

/** KVA confirm request body. Per-year totals and hierarchy; no Tuloajurit or Blad1 account lines in KVA flow. */
export interface KvaConfirmBody {
  nimi: string;
  vuosi: number;
  extractedYears?: number[];
  importBatchId?: string;
  importSourceFileName?: string;
  subtotalLines: Array<{
    year?: number;
    palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
    categoryKey: string;
    tyyppi: string;
    summa: number;
    label?: string;
    lahde?: string;
    level?: number;
    order?: number;
  }>;
  revenueDrivers?: Array<{
    palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
    yksikkohinta: number;
    myytyMaara: number;
    perusmaksu?: number;
    liittymamaara?: number;
    alvProsentti?: number;
  }>;
  accountLines?: ImportPreviewRow[];
}

/** KVA confirm result. */
export interface KvaConfirmResult {
  success: boolean;
  budgetId: string;
  created: {
    subtotalLines: number;
    revenueDrivers: number;
    accountLines: number;
  };
}

/**
 * KVA preview: upload Excel file without requiring pre-existing budget.
 */
export async function previewKvaImport(file: File): Promise<KvaPreviewResult> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/budgets/import/preview-kva`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `KVA preview failed (${res.status})`);
  }

  return res.json();
}

/**
 * KVA confirm: create named budget profile with subtotals + drivers.
 */
export async function confirmKvaImport(body: KvaConfirmBody): Promise<KvaConfirmResult> {
  return api<KvaConfirmResult>('/budgets/import/confirm-kva', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
