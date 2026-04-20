import { api } from './core';
import type { V2OverrideProvenance } from './v2';

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
  baselineReady?: boolean;
  baselineMissingRequirements?: Array<
    'financialBaseline' | 'prices' | 'volumes'
  >;
  baselineWarnings?: Array<'tariffRevenueMismatch'>;
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