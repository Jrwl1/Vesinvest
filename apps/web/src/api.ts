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
// Normalize: trim whitespace and remove trailing slash to prevent double-slash URLs
const API_BASE = (envApiBase ?? 'http://localhost:3000').trim().replace(/\/+$/, '');

const TOKEN_KEY = 'access_token';

// Cached demo mode state from backend
let cachedDemoConfig: { demoMode: boolean; demoOrgId: string | null } | null = null;

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
 * Check if demo mode is enabled (via VITE_DEMO_MODE env var OR backend config)
 */
export function isDemoMode(): boolean {
  // Check frontend env var first
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  // Check cached backend config
  return cachedDemoConfig?.demoMode === true;
}

/**
 * Fetch backend configuration including demo mode status.
 * This allows the frontend to detect demo mode from the backend.
 */
export async function fetchConfig(): Promise<{ demoMode: boolean; demoOrgId: string | null }> {
  if (cachedDemoConfig) return cachedDemoConfig;
  
  try {
    const res = await fetch(`${API_BASE}/health/config`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      cachedDemoConfig = { demoMode: data.demoMode, demoOrgId: data.demoOrgId };
      return cachedDemoConfig;
    }
  } catch {
    // Ignore errors, return default
  }
  
  return { demoMode: false, demoOrgId: null };
}

/**
 * Get cached demo org ID (if in demo mode)
 */
export function getDemoOrgId(): string | null {
  return cachedDemoConfig?.demoOrgId ?? null;
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

import type {
  Asset,
  Site,
  AssetType,
  MaintenanceItem,
  CreateMaintenanceItemPayload,
  ExcelImport,
  UploadResponse,
  PlanningScenario,
  ImportMapping,
  ImportExecutionResult,
  MatchKeyStrategy,
} from './types';

export async function getAsset(id: string): Promise<Asset> {
  return api<Asset>(`/assets/${id}`);
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
    throw new Error(`Upload failed: ${errorText}`);
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

import type { SanitySummary, DemoStatus, DemoResetResult } from './types';

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
 * Get demo mode status.
 * Works in both demo and non-demo modes.
 */
export async function getDemoStatus(): Promise<DemoStatus> {
  return api<DemoStatus>('/demo/status');
}

/**
 * Reset all demo data to a clean state.
 * Only works when DEMO_MODE is enabled on backend.
 */
export async function resetDemoData(): Promise<DemoResetResult> {
  return api<DemoResetResult>('/demo/reset', { method: 'POST' });
}
