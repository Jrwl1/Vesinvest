import type { RevenueDriver } from './budgets';
import { API_BASE,api } from './core';


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
