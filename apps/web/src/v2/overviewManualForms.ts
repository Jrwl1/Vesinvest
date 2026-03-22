import type {
  V2ImportYearDataResponse,
  V2ManualYearPatchPayload,
  V2WorkbookPreviewResponse,
} from '../api';
import type { ImportYearSummaryFieldKey } from './yearReview';

export type InlineCardField =
  | 'liikevaihto'
  | 'aineetJaPalvelut'
  | 'henkilostokulut'
  | 'poistot'
  | 'liiketoiminnanMuutKulut'
  | 'tilikaudenYliJaama'
  | 'waterUnitPrice'
  | 'wastewaterUnitPrice'
  | 'soldWaterVolume'
  | 'soldWastewaterVolume';

export type ManualFinancialForm = {
  liikevaihto: number;
  aineetJaPalvelut: number;
  henkilostokulut: number;
  liiketoiminnanMuutKulut: number;
  poistot: number;
  arvonalentumiset: number;
  rahoitustuototJaKulut: number;
  tilikaudenYliJaama: number;
  omistajatuloutus: number;
  omistajanTukiKayttokustannuksiin: number;
};

export type ManualPriceForm = {
  waterUnitPrice: number;
  wastewaterUnitPrice: number;
};

export type ManualVolumeForm = {
  soldWaterVolume: number;
  soldWastewaterVolume: number;
};

export type ManualInvestmentForm = {
  investoinninMaara: number;
  korvausInvestoinninMaara: number;
};

export type ManualEnergyForm = {
  prosessinKayttamaSahko: number;
};

export type ManualNetworkForm = {
  verkostonPituus: number;
};

const MANUAL_NUMERIC_EPSILON = 0.005;

export const IMPORT_BOARD_CANON_ROWS: Array<{
  key: ImportYearSummaryFieldKey;
  labelKey: string;
  defaultLabel: string;
  emphasized?: boolean;
}> = [
  {
    key: 'revenue',
    labelKey: 'v2Overview.previewAccountingRevenueLabel',
    defaultLabel: 'Revenue',
  },
  {
    key: 'materialsCosts',
    labelKey: 'v2Overview.previewAccountingMaterialsLabel',
    defaultLabel: 'Materials and services',
  },
  {
    key: 'personnelCosts',
    labelKey: 'v2Overview.previewAccountingPersonnelLabel',
    defaultLabel: 'Personnel costs',
  },
  {
    key: 'depreciation',
    labelKey: 'v2Overview.previewAccountingDepreciationLabel',
    defaultLabel: 'Depreciation',
  },
  {
    key: 'otherOperatingCosts',
    labelKey: 'v2Overview.previewAccountingOtherOpexLabel',
    defaultLabel: 'Other operating costs',
  },
  {
    key: 'result',
    labelKey: 'v2Overview.previewAccountingResultLabel',
    defaultLabel: 'Result',
    emphasized: true,
  },
];

export const CARD_SUMMARY_FIELD_TO_INLINE_FIELD: Record<
  ImportYearSummaryFieldKey,
  InlineCardField
> = {
  revenue: 'liikevaihto',
  materialsCosts: 'aineetJaPalvelut',
  personnelCosts: 'henkilostokulut',
  depreciation: 'poistot',
  otherOperatingCosts: 'liiketoiminnanMuutKulut',
  result: 'tilikaudenYliJaama',
};

export const WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY: Record<
  V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
  keyof NonNullable<V2ManualYearPatchPayload['financials']>
> = {
  Liikevaihto: 'liikevaihto',
  AineetJaPalvelut: 'aineetJaPalvelut',
  Henkilostokulut: 'henkilostokulut',
  Poistot: 'poistot',
  LiiketoiminnanMuutKulut: 'liiketoiminnanMuutKulut',
  TilikaudenYliJaama: 'tilikaudenYliJaama',
};

export const parseManualNumber = (value: unknown): number => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const numbersDiffer = (left: number, right: number): boolean =>
  Math.abs(left - right) > MANUAL_NUMERIC_EPSILON;

export function getEffectiveFirstRow(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Record<string, unknown> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.effectiveRows?.[0] ??
    {}
  );
}

export function getRawFirstRow(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Record<string, unknown> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.rawRows?.[0] ?? {}
  );
}

export function getEffectiveRows(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Array<Record<string, unknown>> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.effectiveRows ?? []
  );
}

export function buildFinancialForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualFinancialForm {
  const financials = getEffectiveFirstRow(yearData, 'tilinpaatos');
  return {
    liikevaihto: parseManualNumber((financials as any).Liikevaihto),
    aineetJaPalvelut: parseManualNumber((financials as any).AineetJaPalvelut),
    henkilostokulut: parseManualNumber((financials as any).Henkilostokulut),
    liiketoiminnanMuutKulut: parseManualNumber(
      (financials as any).LiiketoiminnanMuutKulut,
    ),
    poistot: parseManualNumber((financials as any).Poistot),
    arvonalentumiset: parseManualNumber((financials as any).Arvonalentumiset),
    rahoitustuototJaKulut: parseManualNumber(
      (financials as any).RahoitustuototJaKulut,
    ),
    tilikaudenYliJaama: parseManualNumber((financials as any).TilikaudenYliJaama),
    omistajatuloutus: parseManualNumber((financials as any).Omistajatuloutus),
    omistajanTukiKayttokustannuksiin: parseManualNumber(
      (financials as any).OmistajanTukiKayttokustannuksiin,
    ),
  };
}

const roundFinancialValue = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function deriveAdjustedYearResult(
  original: ManualFinancialForm,
  next: ManualFinancialForm,
): number {
  const delta =
    (next.liikevaihto - original.liikevaihto) -
    (next.aineetJaPalvelut - original.aineetJaPalvelut) -
    (next.henkilostokulut - original.henkilostokulut) -
    (next.liiketoiminnanMuutKulut - original.liiketoiminnanMuutKulut) -
    (next.poistot - original.poistot) -
    (next.arvonalentumiset - original.arvonalentumiset) +
    (next.rahoitustuototJaKulut - original.rahoitustuototJaKulut) -
    (next.omistajatuloutus - original.omistajatuloutus) +
    (next.omistajanTukiKayttokustannuksiin -
      original.omistajanTukiKayttokustannuksiin);

  return roundFinancialValue(original.tilikaudenYliJaama + delta);
}

export function buildPriceForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualPriceForm {
  const taksaRows = getEffectiveRows(yearData, 'taksa');
  const waterPriceRow = taksaRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 1,
  );
  const wastewaterPriceRow = taksaRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 2,
  );
  return {
    waterUnitPrice: parseManualNumber((waterPriceRow as any)?.Kayttomaksu),
    wastewaterUnitPrice: parseManualNumber(
      (wastewaterPriceRow as any)?.Kayttomaksu,
    ),
  };
}

export function buildVolumeForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualVolumeForm {
  const waterVolume = getEffectiveFirstRow(yearData, 'volume_vesi');
  const wastewaterVolume = getEffectiveFirstRow(yearData, 'volume_jatevesi');
  return {
    soldWaterVolume: parseManualNumber((waterVolume as any).Maara),
    soldWastewaterVolume: parseManualNumber((wastewaterVolume as any).Maara),
  };
}

export function buildInvestmentForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualInvestmentForm {
  const investments = getEffectiveFirstRow(yearData, 'investointi');
  return {
    investoinninMaara: parseManualNumber((investments as any).InvestoinninMaara),
    korvausInvestoinninMaara: parseManualNumber(
      (investments as any).KorvausInvestoinninMaara,
    ),
  };
}

export function buildEnergyForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualEnergyForm {
  const energy = getEffectiveFirstRow(yearData, 'energia');
  return {
    prosessinKayttamaSahko: parseManualNumber(
      (energy as any).ProsessinKayttamaSahko,
    ),
  };
}

export function buildNetworkForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualNetworkForm {
  const network = getEffectiveFirstRow(yearData, 'verkko');
  return {
    verkostonPituus: parseManualNumber((network as any).VerkostonPituus),
  };
}

export function formsDiffer<T extends Record<string, number>>(left: T, right: T): boolean {
  return Object.keys(left).some((key) =>
    numbersDiffer(left[key as keyof T], right[key as keyof T]),
  );
}
