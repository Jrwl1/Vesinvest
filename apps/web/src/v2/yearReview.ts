import type {
  V2ImportYearDataResponse,
  V2ImportYearResultToZeroSignal,
  V2ImportYearTrustSignal,
  V2OverrideProvenance,
} from '../api';
import type { SetupYearStatus } from './overviewWorkflow';

export type FinancialComparisonFieldKey =
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

export type ImportYearSummaryFieldKey =
  | 'revenue'
  | 'materialsCosts'
  | 'personnelCosts'
  | 'depreciation'
  | 'otherOperatingCosts'
  | 'result';

export type ImportYearSummarySourceField =
  | 'Liikevaihto'
  | 'AineetJaPalvelut'
  | 'Henkilostokulut'
  | 'Poistot'
  | 'LiiketoiminnanMuutKulut'
  | 'TilikaudenYliJaama';

export type ImportYearSummarySource = 'direct' | 'missing';

export type ImportYearSummaryRow = {
  key: ImportYearSummaryFieldKey;
  sourceField: ImportYearSummarySourceField;
  rawValue: number | null;
  effectiveValue: number | null;
  changed: boolean;
  rawSource: ImportYearSummarySource;
  effectiveSource: ImportYearSummarySource;
};

export type ImportYearSourceLayer = {
  key: 'financials' | 'prices' | 'volumes';
  source: 'veeti' | 'manual' | 'none';
  provenanceKind: V2OverrideProvenance['kind'] | null;
  provenanceKinds?: V2OverrideProvenance['kind'][];
  fileName: string | null;
};

const MANUAL_NUMERIC_EPSILON = 0.005;
const IMPORT_YEAR_REVIEW_STORAGE_PREFIX = 'v2.importYearReview';

const IMPORT_YEAR_SUMMARY_FIELDS: Array<{
  key: ImportYearSummaryFieldKey;
  sourceField: ImportYearSummarySourceField;
}> = [
  { key: 'revenue', sourceField: 'Liikevaihto' },
  { key: 'materialsCosts', sourceField: 'AineetJaPalvelut' },
  { key: 'personnelCosts', sourceField: 'Henkilostokulut' },
  { key: 'depreciation', sourceField: 'Poistot' },
  { key: 'otherOperatingCosts', sourceField: 'LiiketoiminnanMuutKulut' },
  { key: 'result', sourceField: 'TilikaudenYliJaama' },
];

const FINANCIAL_FIELDS: Array<{
  key: FinancialComparisonFieldKey;
  sourceKey: string;
}> = [
  { key: 'liikevaihto', sourceKey: 'Liikevaihto' },
  { key: 'aineetJaPalvelut', sourceKey: 'AineetJaPalvelut' },
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

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const numbersDiffer = (left: number, right: number): boolean =>
  Math.abs(left - right) > MANUAL_NUMERIC_EPSILON;

const summaryValuesDiffer = (
  left: number | null,
  right: number | null,
): boolean => {
  if (left == null && right == null) return false;
  if (left == null || right == null) return true;
  return numbersDiffer(left, right);
};

const roundTo2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function normalizeNonNegativeValue(value: number | null): number | null {
  if (value == null) return null;
  return roundTo2(Math.max(0, value));
}

function getSummaryFieldValue(
  row: Record<string, unknown>,
  sourceKey: string,
): {
  value: number | null;
  source: ImportYearSummarySource;
} {
  const value = parseNullableNumber(row[sourceKey]);
  return {
    value,
    source: value == null ? 'missing' : 'direct',
  };
}

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

function resolveSourceLayer(
  key: ImportYearSourceLayer['key'],
  datasets: Array<V2ImportYearDataResponse['datasets'][number]>,
): ImportYearSourceLayer {
  const relevant =
    key === 'financials'
      ? datasets.filter((dataset) => dataset.dataType === 'tilinpaatos')
      : key === 'prices'
      ? datasets.filter((dataset) => dataset.dataType === 'taksa')
      : datasets.filter(
          (dataset) =>
            dataset.dataType === 'volume_vesi' ||
            dataset.dataType === 'volume_jatevesi',
        );
  const provenance =
    relevant
      .map((dataset) => dataset.overrideMeta?.provenance ?? null)
      .find((item): item is V2OverrideProvenance => item != null) ?? null;
  const provenanceKinds = [
    ...new Set(
      [
        provenance?.kind ?? null,
        ...(provenance?.fieldSources?.map((item) => item.provenance.kind) ?? []),
      ].filter((item): item is V2OverrideProvenance['kind'] => item != null),
    ),
  ];

  if (provenance?.kind === 'qdis_import') {
    return {
      key,
      source: 'manual',
      provenanceKind: 'qdis_import',
      provenanceKinds,
      fileName: provenance.fileName,
    };
  }
  if (
    provenance?.kind === 'kva_import' ||
    provenance?.kind === 'excel_import'
  ) {
    return {
      key,
      source: 'manual',
      provenanceKind: provenance.kind,
      provenanceKinds,
      fileName: provenance.fileName,
    };
  }
  if (provenance?.kind === 'statement_import') {
    return {
      key,
      source: 'manual',
      provenanceKind: 'statement_import',
      provenanceKinds,
      fileName: provenance.fileName,
    };
  }
  if (relevant.some((dataset) => dataset.source === 'manual')) {
    return {
      key,
      source: 'manual',
      provenanceKind: 'manual_edit',
      provenanceKinds,
      fileName: provenance?.fileName ?? null,
    };
  }
  if (relevant.some((dataset) => dataset.source === 'veeti')) {
    return {
      key,
      source: 'veeti',
      provenanceKind: null,
      provenanceKinds,
      fileName: null,
    };
  }
  return {
    key,
    source: 'none',
    provenanceKind: null,
    provenanceKinds,
    fileName: null,
  };
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

export function buildImportYearSummaryRows(
  yearData: V2ImportYearDataResponse | undefined,
): ImportYearSummaryRow[] {
  if (yearData?.summaryRows && yearData.summaryRows.length > 0) {
    return yearData.summaryRows;
  }
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

  const buildRowValues = (sourceField: ImportYearSummarySourceField) => {
    const raw = getSummaryFieldValue(rawFinancials, sourceField);
    const effective = getSummaryFieldValue(effectiveFinancials, sourceField);
    const normalizeValue =
      sourceField === 'TilikaudenYliJaama'
        ? (value: number | null) => value
        : normalizeNonNegativeValue;
    return {
      rawValue: normalizeValue(raw.value),
      effectiveValue: normalizeValue(effective.value),
      rawSource: raw.source,
      effectiveSource: effective.source,
    };
  };

  return IMPORT_YEAR_SUMMARY_FIELDS.map(({ key, sourceField }) => {
    const values = buildRowValues(sourceField);
    return {
      key,
      sourceField,
      rawValue: values.rawValue,
      effectiveValue: values.effectiveValue,
      changed: summaryValuesDiffer(values.rawValue, values.effectiveValue),
      rawSource: values.rawSource,
      effectiveSource: values.effectiveSource,
    };
  });
}

export function buildImportYearTrustSignal(
  yearData: V2ImportYearDataResponse | undefined,
): V2ImportYearTrustSignal {
  if (yearData?.trustSignal) {
    return yearData.trustSignal;
  }

  const summaryRows = buildImportYearSummaryRows(yearData);
  const changedSummaryKeys = summaryRows
    .filter((row) => row.changed)
    .map((row) => row.key);
  const statementImport = findDatasetProvenanceByKind(yearData?.datasets, [
    'statement_import',
  ]);
  const workbookImport = findDatasetProvenanceByKind(yearData?.datasets, [
    'kva_import',
    'excel_import',
  ]);
  const reasons = new Set<V2ImportYearTrustSignal['reasons'][number]>();

  if (statementImport) {
    reasons.add('statement_import');
  }
  if (workbookImport) {
    reasons.add('workbook_import');
  } else if (
    yearData?.datasets.some(
      (dataset) => dataset.overrideMeta?.provenance?.kind === 'qdis_import',
    )
  ) {
    reasons.add('qdis_import');
  } else if ((yearData?.hasManualOverrides ?? false) && changedSummaryKeys.length > 0) {
    reasons.add('manual_override');
  }
  if (yearData?.sourceStatus === 'MIXED') {
    reasons.add('mixed_source');
  }
  if (yearData?.sourceStatus === 'INCOMPLETE') {
    reasons.add('incomplete_source');
  }
  if (changedSummaryKeys.includes('result')) {
    reasons.add('result_changed');
  }

  return {
    level:
      changedSummaryKeys.length > 0 && (statementImport != null || yearData?.hasManualOverrides)
        ? 'material'
        : reasons.size > 0
        ? 'review'
        : 'none',
    reasons: [...reasons],
    changedSummaryKeys,
    statementImport,
    workbookImport,
  };
}

function findDatasetProvenanceByKind(
  datasets: V2ImportYearDataResponse['datasets'] | undefined,
  kinds: Array<V2OverrideProvenance['kind']>,
): V2OverrideProvenance | null {
  for (const dataset of datasets ?? []) {
    const provenance = dataset.overrideMeta?.provenance ?? null;
    if (!provenance) continue;
    if (kinds.includes(provenance.kind)) {
      return provenance;
    }
    const fieldSource = provenance.fieldSources?.find((item) =>
      kinds.includes(item.provenance.kind),
    );
    if (fieldSource) {
      return {
        ...fieldSource.provenance,
        fieldSources: [
          { sourceField: fieldSource.sourceField, provenance: fieldSource.provenance },
        ],
      };
    }
  }
  return null;
}

export function buildImportYearSourceLayers(
  yearData: V2ImportYearDataResponse | undefined,
): ImportYearSourceLayer[] {
  const datasets = yearData?.datasets ?? [];
  return [
    resolveSourceLayer('financials', datasets),
    resolveSourceLayer('prices', datasets),
    resolveSourceLayer('volumes', datasets),
  ];
}

export function buildImportYearResultToZeroSignal(
  yearData: V2ImportYearDataResponse | undefined,
): V2ImportYearResultToZeroSignal {
  if (yearData?.resultToZero) {
    return yearData.resultToZero;
  }

  const summaryRows = buildImportYearSummaryRows(yearData);
  const revenueRow = summaryRows.find((row) => row.key === 'revenue');
  const resultRow = summaryRows.find((row) => row.key === 'result');
  const rawValue = resultRow?.rawValue ?? null;
  const effectiveValue = resultRow?.effectiveValue ?? null;
  const delta =
    rawValue == null || effectiveValue == null ? null : roundTo2(effectiveValue - rawValue);
  const absoluteGap = effectiveValue == null ? null : roundTo2(Math.abs(effectiveValue));
  const marginPct =
    revenueRow?.effectiveValue == null || revenueRow.effectiveValue === 0 || effectiveValue == null
      ? null
      : roundTo2((effectiveValue / revenueRow.effectiveValue) * 100);
  const direction =
    effectiveValue == null
      ? 'missing'
      : Math.abs(effectiveValue) <= MANUAL_NUMERIC_EPSILON
      ? 'at_zero'
      : effectiveValue > 0
      ? 'above_zero'
      : 'below_zero';

  return {
    rawValue,
    effectiveValue,
    delta,
    absoluteGap,
    marginPct,
    direction,
  };
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

export function resolveApprovedYearStep(
  rows: Array<{
    year: number;
    setupStatus: SetupYearStatus;
  }>,
  approvedYear: number,
): 3 | 5 {
  const unresolvedRows = rows.some((row) => {
    if (row.year === approvedYear && row.setupStatus === 'ready_for_review') {
      return false;
    }
    return (
      row.setupStatus === 'ready_for_review' ||
      row.setupStatus === 'needs_attention'
    );
  });

  return unresolvedRows ? 3 : 5;
}

export function resolveNextReviewQueueYear(
  rows: Array<{
    year: number;
    setupStatus: SetupYearStatus;
  }>,
): number | null {
  return (
    rows.find((row) => row.setupStatus === 'needs_attention')?.year ??
    rows.find((row) => row.setupStatus === 'ready_for_review')?.year ??
    null
  );
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
