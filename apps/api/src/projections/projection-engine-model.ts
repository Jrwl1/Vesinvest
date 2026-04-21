export { round2 } from './driver-paths';
import { round2 } from './driver-paths';
import {
  type ProjectionYearOverride,
  type ProjectionYearOverrides,
} from './year-overrides';

export interface BudgetLineInput {
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: number; // base amount (absolute)
}

export interface RevenueDriverInput {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta: number;
  myytyMaara: number;
  perusmaksu: number;
  liittymamaara: number;
}

export interface AssumptionMap {
  inflaatio: number; // e.g. 0.025
  energiakerroin: number; // e.g. 0.05
  vesimaaran_muutos: number; // e.g. -0.01
  hintakorotus: number; // e.g. 0.03
  investointikerroin: number; // e.g. 0.02
  [key: string]: number;
}

export interface ComputedYear {
  vuosi: number;
  tulotYhteensa: number;
  kulutYhteensa: number;
  investoinnitYhteensa: number;
  /** Depreciation split: baseline (from base-year inputs). */
  poistoPerusta: number;
  /** Depreciation split: investment-driven additional component. */
  poistoInvestoinneista: number;
  tulos: number;
  kumulatiivinenTulos: number;
  /** Kassaflöde(y) = Tulos(y) − Investoinnit(y) */
  kassafloede: number;
  /** Ackumulerad kassa(y) = sum of Kassaflöde(0..y) */
  ackumuleradKassa: number;
  vesihinta: number;
  myytyVesimaara: number;
  erittelyt: {
    tulot: Array<{ nimi: string; summa: number }>;
    kulut: Array<{ tiliryhma: string; nimi: string; summa: number }>;
    investoinnit: Array<{ tiliryhma: string; nimi: string; summa: number }>;
    ajurit: Array<{
      palvelutyyppi: string;
      yksikkohinta: number;
      myytyMaara: number;
      perusmaksu: number;
      liittymamaara: number;
      laskettuTulo: number;
    }>;
  };
}

export type UserInvestmentSnapshotRule = {
  assetClassKey: string;
  assetClassName?: string | null;
  method:
    | 'linear'
    | 'residual'
    | 'straight-line'
    | 'custom-annual-schedule'
    | 'none';
  linearYears?: number | null;
  residualPercent?: number | null;
  annualSchedule?: number[] | null;
};

/** Input for subtotal-based projections (from TalousarvioValisumma). */
export interface SubtotalInput {
  categoryKey: string;
  tyyppi: string; // tulo, kulu, poisto, rahoitus_tulo, rahoitus_kulu, investointi, tulos
  summa: number;
  palvelutyyppi?: string;
}

/** Well-known energy account groups (tiliryhma starting with 42xx) */
export const ENERGY_ACCOUNT_PREFIX = '42';
const MATERIALS_SERVICES_SUBTOTAL_CATEGORY_KEYS = new Set([
  'energy_costs',
  'materials_services',
]);
const PERSONNEL_SUBTOTAL_CATEGORY_KEYS = new Set([
  'personnel_costs',
  'henkilostokulut',
]);
export const OTHER_OPERATING_SUBTOTAL_CATEGORY_KEYS = new Set([
  'other_costs',
  'liiketoiminnan_muut_kulut',
]);
export const SALES_REVENUE_CATEGORY_KEYS = new Set(['sales_revenue', 'liikevaihto']);
export const PERSONNEL_YEAR_OVERRIDE_PREFIX = 'henkilosto_muutos_';

export function getCostCategoryBucket(
  categoryKey: string,
): 'materialsServices' | 'personnel' | 'opexOther' | null {
  if (PERSONNEL_SUBTOTAL_CATEGORY_KEYS.has(categoryKey)) return 'personnel';
  if (MATERIALS_SERVICES_SUBTOTAL_CATEGORY_KEYS.has(categoryKey)) {
    return 'materialsServices';
  }
  if (OTHER_OPERATING_SUBTOTAL_CATEGORY_KEYS.has(categoryKey)) {
    return 'opexOther';
  }
  return null;
}

export function readYearRateOverrides(
  assumptions: AssumptionMap,
  prefix: string,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [key, raw] of Object.entries(assumptions)) {
    if (
      !key.startsWith(prefix) ||
      typeof raw !== 'number' ||
      !Number.isFinite(raw)
    )
      continue;
    const yearPart = key.slice(prefix.length);
    const year = Number.parseInt(yearPart, 10);
    if (Number.isFinite(year)) {
      out[year] = raw;
    }
  }
  return out;
}

export function pctToRate(pct: number | undefined): number | undefined {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return undefined;
  return pct / 100;
}

export function pickYearOverride(
  projectionYearOverrides: ProjectionYearOverrides | undefined,
  year: number,
): ProjectionYearOverride | undefined {
  return projectionYearOverrides?.[year];
}

export function getCostCategoryRate(
  yearOverride: ProjectionYearOverride | undefined,
  categoryKey: string,
): number | undefined {
  const growth = yearOverride?.categoryGrowthPct;
  if (!growth) return undefined;
  const bucket = getCostCategoryBucket(categoryKey);
  if (bucket === 'personnel') return pctToRate(growth.personnel);
  if (bucket === 'materialsServices') {
    const materialsServicesRaw =
      (growth as Record<string, unknown>).materialsServices ?? growth.energy;
    const materialsServicesPct =
      typeof materialsServicesRaw === 'number' &&
      Number.isFinite(materialsServicesRaw)
        ? materialsServicesRaw
        : undefined;
    return pctToRate(materialsServicesPct);
  }
  if (bucket === 'opexOther') return pctToRate(growth.opexOther);
  return undefined;
}

export function applyLineOverride(
  lineOverride: { mode: 'percent' | 'absolute'; value: number } | undefined,
  previousAmount: number,
): number | undefined {
  if (!lineOverride) return undefined;
  if (lineOverride.mode === 'absolute') return round2(lineOverride.value);
  if (lineOverride.mode === 'percent')
    return round2(previousAmount * (1 + lineOverride.value / 100));
  return undefined;
}

export function stripWaterPriceOverrides(
  projectionYearOverrides: ProjectionYearOverrides | undefined,
): ProjectionYearOverrides | undefined {
  if (!projectionYearOverrides) return undefined;
  const out: ProjectionYearOverrides = {};
  for (const [yearKey, value] of Object.entries(projectionYearOverrides)) {
    const year = Number.parseInt(yearKey, 10);
    if (!Number.isFinite(year) || !value) continue;
    const next: ProjectionYearOverride = { ...value };
    delete next.waterPriceEurM3;
    delete next.waterPriceGrowthPct;
    delete next.lockMode;
    if (Object.keys(next).length > 0) out[year] = next;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function weightedCombinedUnitPrice(
  drivers: Array<{
    palvelutyyppi: string;
    yksikkohinta: number;
    myytyMaara: number;
  }>,
): number {
  const waterDrivers = drivers.filter(
    (driver) =>
      driver.palvelutyyppi === 'vesi' || driver.palvelutyyppi === 'jatevesi',
  );
  const totalVolume = waterDrivers.reduce(
    (sum, driver) => sum + driver.myytyMaara,
    0,
  );
  if (totalVolume <= 0) return 0;
  const totalVolumeRevenue = waterDrivers.reduce(
    (sum, driver) => sum + driver.yksikkohinta * driver.myytyMaara,
    0,
  );
  return round2(totalVolumeRevenue / totalVolume);
}

export type DepreciationRuleMethod =
  | 'linear'
  | 'residual'
  | 'straight-line'
  | 'custom-annual-schedule'
  | 'none';

export type DepreciationRuleConfig = {
  classKey: string;
  method: DepreciationRuleMethod;
  linearYears?: number;
  residualPercent?: number;
  annualSchedule?: number[];
};

export type LinearCohort = {
  annualDepreciation: number;
  remainingYears: number;
};

export type ResidualCohort = {
  remainingBookValue: number;
  annualRate: number;
};

export type ScheduleCohort = {
  annualAmounts: number[];
  nextIndex: number;
};

