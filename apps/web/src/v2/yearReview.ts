import type { V2ImportYearDataResponse } from '../api';
import type { SetupYearStatus } from './overviewWorkflow';

export type FinancialComparisonFieldKey =
  | 'liikevaihto'
  | 'henkilostokulut'
  | 'liiketoiminnanMuutKulut'
  | 'poistot'
  | 'arvonalentumiset'
  | 'rahoitustuototJaKulut'
  | 'tilikaudenYliJaama'
  | 'omistajatuloutus'
  | 'omistajanTukiKayttokustannuksiin';

export type FinancialComparisonRow = {
  key: FinancialComparisonFieldKey;
  veetiValue: number;
  effectiveValue: number;
  changed: boolean;
};

export type PriceComparisonFieldKey =
  | 'waterUnitPrice'
  | 'wastewaterUnitPrice';

export type VolumeComparisonFieldKey =
  | 'soldWaterVolume'
  | 'soldWastewaterVolume';

export type ValueComparisonRow<T extends string> = {
  key: T;
  veetiValue: number;
  effectiveValue: number;
  changed: boolean;
};

const MANUAL_NUMERIC_EPSILON = 0.005;
const IMPORT_YEAR_REVIEW_STORAGE_PREFIX = 'v2.importYearReview';

const FINANCIAL_FIELDS: Array<{
  key: FinancialComparisonFieldKey;
  sourceKey: string;
}> = [
  { key: 'liikevaihto', sourceKey: 'Liikevaihto' },
  { key: 'henkilostokulut', sourceKey: 'Henkilostokulut' },
  {
    key: 'liiketoiminnanMuutKulut',
    sourceKey: 'LiiketoiminnanMuutKulut',
  },
  { key: 'poistot', sourceKey: 'Poistot' },
  { key: 'arvonalentumiset', sourceKey: 'Arvonalentumiset' },
  {
    key: 'rahoitustuototJaKulut',
    sourceKey: 'RahoitustuototJaKulut',
  },
  { key: 'tilikaudenYliJaama', sourceKey: 'TilikaudenYliJaama' },
  { key: 'omistajatuloutus', sourceKey: 'Omistajatuloutus' },
  {
    key: 'omistajanTukiKayttokustannuksiin',
    sourceKey: 'OmistajanTukiKayttokustannuksiin',
  },
];

const parseNumber = (value: unknown): number => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const numbersDiffer = (left: number, right: number): boolean =>
  Math.abs(left - right) > MANUAL_NUMERIC_EPSILON;

function getDatasetFirstRow(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
  kind: 'rawRows' | 'effectiveRows',
): Record<string, unknown> {
  return yearData?.datasets.find((row) => row.dataType === dataType)?.[kind]?.[0] ?? {};
}

function getDatasetRows(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
  kind: 'rawRows' | 'effectiveRows',
): Array<Record<string, unknown>> {
  return yearData?.datasets.find((row) => row.dataType === dataType)?.[kind] ?? [];
}

function getImportYearReviewStorageKey(orgId: string): string {
  return `${IMPORT_YEAR_REVIEW_STORAGE_PREFIX}.${orgId}`;
}

function normalizeYears(years: number[]): number[] {
  return [...years]
    .map((year) => Math.round(Number(year)))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);
}

function readStoredReviewedYears(orgId: string): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getImportYearReviewStorageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { reviewedYears?: number[] } | number[];
    if (Array.isArray(parsed)) {
      return normalizeYears(parsed);
    }
    return normalizeYears(parsed.reviewedYears ?? []);
  } catch {
    return [];
  }
}

function writeStoredReviewedYears(orgId: string, years: number[]): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeYears(years);
  const storageKey = getImportYearReviewStorageKey(orgId);
  try {
    if (normalized.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ reviewedYears: normalized }),
    );
  } catch {
    // Ignore storage write failures and keep the in-memory flow working.
  }
}

export function buildFinancialComparisonRows(
  yearData: V2ImportYearDataResponse | undefined,
): FinancialComparisonRow[] {
  const rawFinancials = getDatasetFirstRow(yearData, 'tilinpaatos', 'rawRows');
  const effectiveFinancials = getDatasetFirstRow(
    yearData,
    'tilinpaatos',
    'effectiveRows',
  );

  if (
    Object.keys(rawFinancials).length === 0 &&
    Object.keys(effectiveFinancials).length === 0
  ) {
    return [];
  }

  return FINANCIAL_FIELDS.map((field) => {
    const veetiValue = parseNumber(rawFinancials[field.sourceKey]);
    const effectiveValue = parseNumber(effectiveFinancials[field.sourceKey]);
    return {
      key: field.key,
      veetiValue,
      effectiveValue,
      changed: numbersDiffer(veetiValue, effectiveValue),
    };
  });
}

export function canReapplyFinancialVeeti(
  yearData: V2ImportYearDataResponse | undefined,
  isAdmin: boolean,
): boolean {
  return canReapplyDatasetVeeti(yearData, ['tilinpaatos'], isAdmin);
}

export function canReapplyDatasetVeeti(
  yearData: V2ImportYearDataResponse | undefined,
  dataTypes: string[],
  isAdmin: boolean,
): boolean {
  if (!isAdmin) return false;
  const allowedDataTypes = new Set(dataTypes);
  return (
    yearData?.datasets.some(
      (dataset) =>
        allowedDataTypes.has(dataset.dataType) &&
        dataset.reconcileNeeded === true,
    ) ?? false
  );
}

export function buildPriceComparisonRows(
  yearData: V2ImportYearDataResponse | undefined,
): Array<ValueComparisonRow<PriceComparisonFieldKey>> {
  const rawRows = getDatasetRows(yearData, 'taksa', 'rawRows');
  const effectiveRows = getDatasetRows(yearData, 'taksa', 'effectiveRows');
  const rawWaterRow = rawRows.find(
    (row) => parseNumber((row as any).Tyyppi_Id) === 1,
  );
  const rawWastewaterRow = rawRows.find(
    (row) => parseNumber((row as any).Tyyppi_Id) === 2,
  );
  const effectiveWaterRow = effectiveRows.find(
    (row) => parseNumber((row as any).Tyyppi_Id) === 1,
  );
  const effectiveWastewaterRow = effectiveRows.find(
    (row) => parseNumber((row as any).Tyyppi_Id) === 2,
  );

  if (
    !rawWaterRow &&
    !rawWastewaterRow &&
    !effectiveWaterRow &&
    !effectiveWastewaterRow
  ) {
    return [];
  }

  const rows: Array<ValueComparisonRow<PriceComparisonFieldKey>> = [
    {
      key: 'waterUnitPrice',
      veetiValue: parseNumber((rawWaterRow as any)?.Kayttomaksu),
      effectiveValue: parseNumber((effectiveWaterRow as any)?.Kayttomaksu),
      changed: numbersDiffer(
        parseNumber((rawWaterRow as any)?.Kayttomaksu),
        parseNumber((effectiveWaterRow as any)?.Kayttomaksu),
      ),
    },
    {
      key: 'wastewaterUnitPrice',
      veetiValue: parseNumber((rawWastewaterRow as any)?.Kayttomaksu),
      effectiveValue: parseNumber((effectiveWastewaterRow as any)?.Kayttomaksu),
      changed: numbersDiffer(
        parseNumber((rawWastewaterRow as any)?.Kayttomaksu),
        parseNumber((effectiveWastewaterRow as any)?.Kayttomaksu),
      ),
    },
  ];

  return rows;
}

export function buildVolumeComparisonRows(
  yearData: V2ImportYearDataResponse | undefined,
): Array<ValueComparisonRow<VolumeComparisonFieldKey>> {
  const rawWater = getDatasetFirstRow(yearData, 'volume_vesi', 'rawRows');
  const rawWastewater = getDatasetFirstRow(
    yearData,
    'volume_jatevesi',
    'rawRows',
  );
  const effectiveWater = getDatasetFirstRow(
    yearData,
    'volume_vesi',
    'effectiveRows',
  );
  const effectiveWastewater = getDatasetFirstRow(
    yearData,
    'volume_jatevesi',
    'effectiveRows',
  );

  if (
    Object.keys(rawWater).length === 0 &&
    Object.keys(rawWastewater).length === 0 &&
    Object.keys(effectiveWater).length === 0 &&
    Object.keys(effectiveWastewater).length === 0
  ) {
    return [];
  }

  return [
    {
      key: 'soldWaterVolume',
      veetiValue: parseNumber((rawWater as any).Maara),
      effectiveValue: parseNumber((effectiveWater as any).Maara),
      changed: numbersDiffer(
        parseNumber((rawWater as any).Maara),
        parseNumber((effectiveWater as any).Maara),
      ),
    },
    {
      key: 'soldWastewaterVolume',
      veetiValue: parseNumber((rawWastewater as any).Maara),
      effectiveValue: parseNumber((effectiveWastewater as any).Maara),
      changed: numbersDiffer(
        parseNumber((rawWastewater as any).Maara),
        parseNumber((effectiveWastewater as any).Maara),
      ),
    },
  ];
}

export function resolveReviewContinueTarget(
  rows: Array<{
    year: number;
    setupStatus: SetupYearStatus;
  }>,
): {
  nextStep: 4 | 5;
  selectedProblemYear: number | null;
  yearsToMarkReviewed: number[];
} {
  const selectedProblemYear =
    rows.find((row) => row.setupStatus === 'needs_attention')?.year ?? null;

  return selectedProblemYear == null
    ? {
        nextStep: 5,
        selectedProblemYear: null,
        yearsToMarkReviewed: rows
          .filter((row) => row.setupStatus === 'ready_for_review')
          .map((row) => row.year)
          .sort((a, b) => b - a),
      }
    : { nextStep: 4, selectedProblemYear, yearsToMarkReviewed: [] };
}

export function syncPersistedReviewedImportYears(
  orgId: string | null | undefined,
  importedYears: number[],
): number[] {
  if (!orgId) return [];
  const visibleYears = new Set(normalizeYears(importedYears));
  const nextReviewedYears = readStoredReviewedYears(orgId).filter((year) =>
    visibleYears.has(year),
  );
  writeStoredReviewedYears(orgId, nextReviewedYears);
  return nextReviewedYears;
}

export function markPersistedReviewedImportYears(
  orgId: string | null | undefined,
  yearsToMark: number[],
  importedYears: number[],
): number[] {
  if (!orgId) return [];
  const visibleYears = new Set(normalizeYears(importedYears));
  const nextReviewedYears = normalizeYears([
    ...readStoredReviewedYears(orgId),
    ...yearsToMark,
  ]).filter((year) => visibleYears.has(year));
  writeStoredReviewedYears(orgId, nextReviewedYears);
  return nextReviewedYears;
}
