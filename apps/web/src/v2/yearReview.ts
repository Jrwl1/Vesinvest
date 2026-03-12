import type { V2ImportYearDataResponse } from '../api';

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

const MANUAL_NUMERIC_EPSILON = 0.005;

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
  if (!isAdmin) return false;
  return (
    yearData?.datasets.some(
      (dataset) =>
        dataset.dataType === 'tilinpaatos' && dataset.reconcileNeeded === true,
    ) ?? false
  );
}

export function resolveReviewContinueTarget(
  rows: Array<{
    year: number;
    setupStatus: 'ready' | 'needs_attention' | 'excluded_from_plan';
  }>,
): {
  nextStep: 4 | 5;
  selectedProblemYear: number | null;
} {
  const selectedProblemYear =
    rows.find((row) => row.setupStatus === 'needs_attention')?.year ?? null;

  return selectedProblemYear == null
    ? { nextStep: 5, selectedProblemYear: null }
    : { nextStep: 4, selectedProblemYear };
}
