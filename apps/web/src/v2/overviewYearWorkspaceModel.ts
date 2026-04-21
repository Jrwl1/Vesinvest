import { formatEur, formatNumber, formatPrice } from './format';
import {
  buildFinancialForm,
  buildPriceForm,
  buildVolumeForm,
  getEffectiveFirstRow,
  getEffectiveRows,
  getDatasetRowValue,
  getRawFirstRow,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
} from './overviewManualForms';
import type { V2ImportYearDataResponse } from '../api';
import type { MissingRequirement, SetupYearStatus } from './overviewWorkflow';

export type ReviewStatusRow = {
  year: number;
  sourceStatus: string | undefined;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  missingRequirements: MissingRequirement[];
  setupStatus: SetupYearStatus;
};

export type WorkspaceDraft = {
  financials: ManualFinancialForm;
  prices: ManualPriceForm;
  volumes: ManualVolumeForm;
  baseSignature: string;
  dirty: boolean;
};

export type WorkspaceSaveState = {
  saving: boolean;
  error: string | null;
};

export type WorkspaceTouchedFields = Record<number, Record<string, boolean>>;

export type WorkspaceFieldConfig =
  | {
      key: keyof ManualFinancialForm;
      group: 'financials';
      labelKey: string;
      defaultLabel: string;
      min?: number;
      step: string;
      formatter: (value: number) => string;
    }
  | {
      key: keyof ManualPriceForm;
      group: 'prices';
      labelKey: string;
      defaultLabel: string;
      min?: number;
      step: string;
      formatter: (value: number) => string;
    }
  | {
      key: keyof ManualVolumeForm;
      group: 'volumes';
      labelKey: string;
      defaultLabel: string;
      min?: number;
      step: string;
      formatter: (value: number) => string;
    };

export const WORKSPACE_FIELDS: WorkspaceFieldConfig[] = [
  {
    key: 'liikevaihto',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialRevenue',
    defaultLabel: 'Revenue (Liikevaihto)',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'perusmaksuYhteensa',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialFixedRevenue',
    defaultLabel: 'Fixed revenue total',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'aineetJaPalvelut',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialMaterials',
    defaultLabel: 'Materials and services',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'henkilostokulut',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialPersonnel',
    defaultLabel: 'Personnel costs',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'poistot',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialDepreciation',
    defaultLabel: 'Depreciation',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'liiketoiminnanMuutKulut',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialOtherOpex',
    defaultLabel: 'Other operating costs',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'tilikaudenYliJaama',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialYearResult',
    defaultLabel: 'Year result (Tilikauden ylijäämä/alijäämä)',
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'waterUnitPrice',
    group: 'prices',
    labelKey: 'v2Overview.manualPriceWater',
    defaultLabel: 'Water unit price (EUR/m3)',
    min: 0,
    step: '0.001',
    formatter: formatPrice,
  },
  {
    key: 'wastewaterUnitPrice',
    group: 'prices',
    labelKey: 'v2Overview.manualPriceWastewater',
    defaultLabel: 'Wastewater unit price (EUR/m3)',
    min: 0,
    step: '0.001',
    formatter: formatPrice,
  },
  {
    key: 'soldWaterVolume',
    group: 'volumes',
    labelKey: 'v2Overview.manualVolumeWater',
    defaultLabel: 'Sold water volume (m3)',
    min: 0,
    step: '1',
    formatter: (value) => formatNumber(value, 0),
  },
  {
    key: 'soldWastewaterVolume',
    group: 'volumes',
    labelKey: 'v2Overview.manualVolumeWastewater',
    defaultLabel: 'Sold wastewater volume (m3)',
    min: 0,
    step: '1',
    formatter: (value) => formatNumber(value, 0),
  },
];

export const RESULT_FIELD = WORKSPACE_FIELDS.find(
  (field) => field.group === 'financials' && field.key === 'tilikaudenYliJaama',
)!;

export const DEFAULT_WORKSPACE_FIELDS = WORKSPACE_FIELDS.filter(
  (field) => !(field.group === 'financials' && field.key === 'tilikaudenYliJaama'),
);

export function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildDraftSignature(
  financials: ManualFinancialForm,
  prices: ManualPriceForm,
  volumes: ManualVolumeForm,
): string {
  return JSON.stringify({
    financials,
    prices,
    volumes,
  });
}

export function buildDraft(yearData: V2ImportYearDataResponse): WorkspaceDraft {
  const financials = buildFinancialForm(yearData);
  const prices = buildPriceForm(yearData);
  const volumes = buildVolumeForm(yearData);
  return {
    financials,
    prices,
    volumes,
    baseSignature: buildDraftSignature(financials, prices, volumes),
    dirty: false,
  };
}

export function getWorkspaceFieldId(field: WorkspaceFieldConfig): string {
  return `${field.group}:${String(field.key)}`;
}

export function buildRawValueLookup(
  yearData: V2ImportYearDataResponse | undefined,
) {
  const rawFinancials = getRawFirstRow(yearData, 'tilinpaatos');
  const rawPriceRows =
    yearData?.datasets.find((dataset) => dataset.dataType === 'taksa')?.rawRows ??
    [];
  const rawWaterPrice = rawPriceRows.find(
    (row) => parseOptionalNumber(getDatasetRowValue(row, 'Tyyppi_Id')) === 1,
  );
  const rawWastewaterPrice = rawPriceRows.find(
    (row) => parseOptionalNumber(getDatasetRowValue(row, 'Tyyppi_Id')) === 2,
  );
  const rawWaterVolume = getRawFirstRow(yearData, 'volume_vesi');
  const rawWastewaterVolume = getRawFirstRow(yearData, 'volume_jatevesi');

  return {
    liikevaihto: parseOptionalNumber(rawFinancials.Liikevaihto),
    perusmaksuYhteensa: parseOptionalNumber(rawFinancials.PerusmaksuYhteensa),
    aineetJaPalvelut: parseOptionalNumber(rawFinancials.AineetJaPalvelut),
    henkilostokulut: parseOptionalNumber(rawFinancials.Henkilostokulut),
    poistot: parseOptionalNumber(rawFinancials.Poistot),
    liiketoiminnanMuutKulut: parseOptionalNumber(
      rawFinancials.LiiketoiminnanMuutKulut,
    ),
    tilikaudenYliJaama: parseOptionalNumber(rawFinancials.TilikaudenYliJaama),
    waterUnitPrice: parseOptionalNumber(getDatasetRowValue(rawWaterPrice, 'Kayttomaksu')),
    wastewaterUnitPrice: parseOptionalNumber(
      getDatasetRowValue(rawWastewaterPrice, 'Kayttomaksu'),
    ),
    soldWaterVolume: parseOptionalNumber(getDatasetRowValue(rawWaterVolume, 'Maara')),
    soldWastewaterVolume: parseOptionalNumber(getDatasetRowValue(rawWastewaterVolume, 'Maara')),
  };
}

export function buildEffectiveValueLookup(
  yearData: V2ImportYearDataResponse | undefined,
) {
  const effectiveFinancials = getEffectiveFirstRow(yearData, 'tilinpaatos');
  const effectivePriceRows = getEffectiveRows(yearData, 'taksa');
  const effectiveWaterPrice = effectivePriceRows.find(
    (row) => parseOptionalNumber(getDatasetRowValue(row, 'Tyyppi_Id')) === 1,
  );
  const effectiveWastewaterPrice = effectivePriceRows.find(
    (row) => parseOptionalNumber(getDatasetRowValue(row, 'Tyyppi_Id')) === 2,
  );
  const effectiveWaterVolume = getEffectiveFirstRow(yearData, 'volume_vesi');
  const effectiveWastewaterVolume = getEffectiveFirstRow(
    yearData,
    'volume_jatevesi',
  );

  return {
    liikevaihto: parseOptionalNumber(effectiveFinancials.Liikevaihto),
    perusmaksuYhteensa: parseOptionalNumber(
      effectiveFinancials.PerusmaksuYhteensa,
    ),
    aineetJaPalvelut: parseOptionalNumber(
      effectiveFinancials.AineetJaPalvelut,
    ),
    henkilostokulut: parseOptionalNumber(
      effectiveFinancials.Henkilostokulut,
    ),
    poistot: parseOptionalNumber(effectiveFinancials.Poistot),
    liiketoiminnanMuutKulut: parseOptionalNumber(
      effectiveFinancials.LiiketoiminnanMuutKulut,
    ),
    tilikaudenYliJaama: parseOptionalNumber(
      effectiveFinancials.TilikaudenYliJaama,
    ),
    waterUnitPrice: parseOptionalNumber(
      getDatasetRowValue(effectiveWaterPrice, 'Kayttomaksu'),
    ),
    wastewaterUnitPrice: parseOptionalNumber(
      getDatasetRowValue(effectiveWastewaterPrice, 'Kayttomaksu'),
    ),
    soldWaterVolume: parseOptionalNumber(getDatasetRowValue(effectiveWaterVolume, 'Maara')),
    soldWastewaterVolume: parseOptionalNumber(
      getDatasetRowValue(effectiveWastewaterVolume, 'Maara'),
    ),
  };
}

export function buildResultBaselineFinancials(
  yearData: V2ImportYearDataResponse | undefined,
): ManualFinancialForm {
  const rawFinancials = getRawFirstRow(yearData, 'tilinpaatos');
  const effectiveFinancials = getEffectiveFirstRow(yearData, 'tilinpaatos');
  const pickFinancialValue = (key: string): number =>
    parseOptionalNumber(rawFinancials[key]) ??
    parseOptionalNumber(effectiveFinancials[key]) ??
    0;

  return {
    liikevaihto: pickFinancialValue('Liikevaihto'),
    perusmaksuYhteensa: pickFinancialValue('PerusmaksuYhteensa'),
    aineetJaPalvelut: pickFinancialValue('AineetJaPalvelut'),
    henkilostokulut: pickFinancialValue('Henkilostokulut'),
    liiketoiminnanMuutKulut: pickFinancialValue('LiiketoiminnanMuutKulut'),
    poistot: pickFinancialValue('Poistot'),
    arvonalentumiset: pickFinancialValue('Arvonalentumiset'),
    rahoitustuototJaKulut: pickFinancialValue('RahoitustuototJaKulut'),
    tilikaudenYliJaama: pickFinancialValue('TilikaudenYliJaama'),
    omistajatuloutus: pickFinancialValue('Omistajatuloutus'),
    omistajanTukiKayttokustannuksiin: pickFinancialValue(
      'OmistajanTukiKayttokustannuksiin',
    ),
  };
}

export function getWorkspaceDraftFieldValue(
  draft: WorkspaceDraft,
  field: WorkspaceFieldConfig,
): number {
  return field.group === 'financials'
    ? draft.financials[field.key as keyof ManualFinancialForm]
    : field.group === 'prices'
      ? draft.prices[field.key as keyof ManualPriceForm]
      : draft.volumes[field.key as keyof ManualVolumeForm];
}
