import {
  API_BASE,
  api,
  clearToken,
  createApiError,
  dedupeInFlightGet,
  getCachedGet,
  getToken,
  invalidateCachedGets,
  parseApiErrorResponse,
  type GetRequestOptions,
} from '../core';
import type { VeetiConnectResult, VeetiOrganizationSearchHit } from '../veeti';
import type {
  V2ImportStatus,
  V2ImportYearDataResponse,
  V2ManualYearPatchPayload,
  V2ManualYearPatchResponse,
  V2OpsEventPayload,
  V2OpsFunnelSnapshot,
  V2OverviewResponse,
  V2PeerSnapshot,
  V2PlanningContextResponse,
  V2StatementPreviewResponse,
  V2WorkbookPreviewResponse,
} from './types';
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
    `/v2/import/search?q=${encodeURIComponent(
      normalizedQuery,
    )}&limit=${safeLimit}`,
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

export type V2ImportClearChallenge = {
  challengeId: string;
  confirmToken: string;
  expiresAt: string;
};

export async function requestImportClearChallengeV2(): Promise<V2ImportClearChallenge> {
  return api<V2ImportClearChallenge>('/v2/import/clear/challenge', {
    method: 'POST',
  });
}

export async function clearImportAndScenariosV2(payload: {
  challengeId: string;
  confirmToken: string;
}): Promise<{
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
    body: JSON.stringify(payload),
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

  const res = await fetch(
    `${API_BASE}/v2/import/years/${year}/statement-preview`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    },
  );

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
