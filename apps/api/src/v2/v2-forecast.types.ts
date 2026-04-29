import type { OverrideProvenance } from '../veeti/veeti-effective-data.service';

export type SyncRequirement = 'financials' | 'prices' | 'volumes';
export type OverrideProvenanceCore = Omit<OverrideProvenance, 'fieldSources'>;
export type ScenarioAssumptionKey =
  | 'inflaatio'
  | 'energiakerroin'
  | 'henkilostokerroin'
  | 'vesimaaran_muutos'
  | 'hintakorotus'
  | 'perusmaksuMuutos'
  | 'investointikerroin';

export type ScenarioType = 'base' | 'committed' | 'hypothesis' | 'stress';

export type StatementPreviewFieldKey =
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

export type StatementPreviewRequest = {
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number;
  fileBuffer: Buffer | null;
  statementType?: string | null;
};

export type WorkbookPreviewRequest = {
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number;
  fileBuffer: Buffer | null;
};

export type StatementPreviewResponse = {
  year: number;
  statementType: 'result_statement';
  document: {
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    receivedAt: string;
    parserStatus: 'pending_parser';
  };
  fields: Array<{
    key: StatementPreviewFieldKey;
    label: string;
    sourceField: string;
    veetiValue: number | null;
    effectiveValue: number | null;
    extractedValue: number | null;
    proposedValue: number | null;
    changed: boolean;
  }>;
  sourceRows: Array<{
    label: string;
    currentYearValue: number | null;
    previousYearValue: number | null;
    pageNumber: number | null;
    lineIndex: number | null;
    mappingStatus: 'pending';
    mappedKey: StatementPreviewFieldKey | null;
  }>;
  warnings: string[];
  canApply: boolean;
};

export type WorkbookPreviewResponse = {
  document: {
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    receivedAt: string;
  };
  sheetName: string;
  workbookYears: number[];
  importedYears: number[];
  matchedYears: number[];
  unmatchedImportedYears: number[];
  unmatchedWorkbookYears: number[];
  years: Array<{
    year: number;
    sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
    rows: Array<{
      key: ImportYearSummaryFieldKey;
      sourceField: ImportYearSummarySourceField;
      currentValue: number | null;
      workbookValue: number | null;
      differs: boolean;
      currentSource: ImportYearSummarySource;
      suggestedAction: 'keep_veeti' | 'apply_workbook';
    }>;
  }>;
  canApply: boolean;
};

export type BaselineDatasetSource = {
  dataType: string;
  source: 'veeti' | 'manual' | 'none';
  provenance: OverrideProvenance | null;
  editedAt: string | null;
  editedBy: string | null;
  reason: string | null;
};

export type BaselineSourceSummary = {
  year: number;
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: BaselineDatasetSource;
  prices: BaselineDatasetSource;
  volumes: BaselineDatasetSource;
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

export type ImportYearTrustSignal = {
  level: 'none' | 'review' | 'material';
  reasons: Array<
    | 'manual_override'
    | 'statement_import'
    | 'qdis_import'
    | 'workbook_import'
    | 'mixed_source'
    | 'incomplete_source'
    | 'result_changed'
  >;
  changedSummaryKeys: ImportYearSummaryFieldKey[];
  statementImport: OverrideProvenance | null;
  workbookImport: OverrideProvenance | null;
};

export type ImportYearResultToZeroSignal = {
  rawValue: number | null;
  effectiveValue: number | null;
  delta: number | null;
  absoluteGap: number | null;
  marginPct: number | null;
  direction: 'above_zero' | 'below_zero' | 'at_zero' | 'missing';
};

export type ImportYearSubrowAvailability = {
  truthfulSubrowsAvailable: boolean;
  reason: 'year_summary_only';
  rawRowCount: number;
  effectiveRowCount: number;
};

export type TrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

export const SCENARIO_ASSUMPTION_KEYS: ScenarioAssumptionKey[] = [
  'inflaatio',
  'energiakerroin',
  'henkilostokerroin',
  'vesimaaran_muutos',
  'hintakorotus',
  'perusmaksuMuutos',
  'investointikerroin',
];

export const SCENARIO_TYPE_OVERRIDE_KEY = '__scenarioTypeCode';
export const SCENARIO_TYPE_CODE_TO_VALUE: Record<number, Exclude<ScenarioType, 'base'>> = {
  1: 'committed',
  2: 'hypothesis',
  3: 'stress',
};
export const SCENARIO_TYPE_VALUE_TO_CODE: Record<Exclude<ScenarioType, 'base'>, number> = {
  committed: 1,
  hypothesis: 2,
  stress: 3,
};

export type ScenarioYear = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  investments: number;
  baselineDepreciation: number;
  investmentDepreciation: number;
  totalDepreciation: number;
  combinedPrice: number;
  soldVolume: number;
  cashflow: number;
  cumulativeCashflow: number;
  waterPrice: number;
  wastewaterPrice: number;
  baseFeeRevenue: number;
  connectionCount: number;
};

export type ScenarioPayload = {
  id: string;
  name: string;
  onOletus: boolean;
  scenarioType: ScenarioType;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: YearlyInvestment[];
  nearTermExpenseAssumptions: NearTermExpenseAssumption[];
  thereafterExpenseAssumptions: ThereafterExpenseAssumption;
  requiredPriceTodayCombined: number | null;
  baselinePriceTodayCombined: number | null;
  requiredAnnualIncreasePct: number | null;
  requiredPriceTodayCombinedAnnualResult: number | null;
  requiredAnnualIncreasePctAnnualResult: number | null;
  requiredPriceTodayCombinedCumulativeCash: number | null;
  requiredAnnualIncreasePctCumulativeCash: number | null;
  feeSufficiency: {
    baselineCombinedPrice: number | null;
    annualResult: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      underfundingStartYear: number | null;
      peakDeficit: number;
    };
    cumulativeCash: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      underfundingStartYear: number | null;
      peakGap: number;
    };
  };
  years: ScenarioYear[];
  priceSeries: Array<{
    year: number;
    combinedPrice: number;
    waterPrice: number;
    wastewaterPrice: number;
  }>;
  investmentSeries: Array<{ year: number; amount: number }>;
  cashflowSeries: Array<{
    year: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
  computedAt: Date | null;
  computedFromUpdatedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
};

export type SnapshotPayload = {
  scenario: ScenarioPayload;
  generatedAt: string;
  baselineSourceSummary: BaselineSourceSummary | null;
  reportVariant: ReportVariant;
  reportSections: ReportSections;
};

export type ReportVariant =
  | 'regulator_package'
  | 'board_package'
  | 'internal_appendix';

export type ReportSections = {
  baselineSources: boolean;
  assumptions: boolean;
  yearlyInvestments: boolean;
  riskSummary: boolean;
};

export type YearlyInvestment = {
  rowId?: string | null;
  year: number;
  amount: number;
  target: string | null;
  category: string | null;
  depreciationClassKey: string | null;
  depreciationRuleSnapshot: {
    assetClassKey: string;
    assetClassName: string | null;
    method: DepreciationMethod;
    linearYears: number | null;
    residualPercent: number | null;
    annualSchedule?: number[] | null;
  } | null;
  investmentType: 'replacement' | 'new' | null;
  confidence: 'low' | 'medium' | 'high' | null;
  waterAmount: number | null;
  wastewaterAmount: number | null;
  note: string | null;
  vesinvestPlanId?: string | null;
  vesinvestProjectId?: string | null;
  allocationId?: string | null;
  projectCode?: string | null;
  groupKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
};

export type NearTermExpenseAssumption = {
  year: number;
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

export type ThereafterExpenseAssumption = {
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

export type DepreciationMethod =
  | 'linear'
  | 'residual'
  | 'straight-line'
  | 'custom-annual-schedule'
  | 'none';

export type DepreciationRuleInput = {
  assetClassKey?: string;
  assetClassName?: string | null;
  method?: DepreciationMethod;
  linearYears?: number | null;
  residualPercent?: number | null;
  annualSchedule?: number[] | null;
};

export type DepreciationRuleView = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: 'residual' | 'straight-line' | 'none';
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule: number[] | null;
  updatedAt: string | Date;
  createdAt: string | Date;
};

export type ScenarioStoredDepreciationRule = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: 'residual' | 'straight-line' | 'none';
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule: number[] | null;
};

export const toCanonicalDepreciationMethod = (
  method: string,
): 'residual' | 'straight-line' | 'none' | null => {
  if (method === 'linear' || method === 'straight-line') {
    return 'straight-line';
  }
  if (method === 'residual' || method === 'none') {
    return method;
  }
  if (method === 'custom-annual-schedule') {
    return 'straight-line';
  }
  return null;
};

export type ScenarioBaselineDepreciationRow = {
  year: number;
  amount: number;
};

export type ScenarioClassAllocationInput = {
  years?: Array<{
    year?: number;
    allocations?: Array<{ classKey?: string; sharePct?: number }>;
  }>;
};

export type SnapshotTrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
};

export const IMPORT_YEAR_SUMMARY_FIELDS: Array<{
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

export const MANUAL_YEAR_FINANCIAL_FIELD_MAPPINGS: Array<{
  payloadKey:
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
  sourceField: string;
}> = [
  { payloadKey: 'liikevaihto', sourceField: 'Liikevaihto' },
  { payloadKey: 'aineetJaPalvelut', sourceField: 'AineetJaPalvelut' },
  { payloadKey: 'henkilostokulut', sourceField: 'Henkilostokulut' },
  {
    payloadKey: 'liiketoiminnanMuutKulut',
    sourceField: 'LiiketoiminnanMuutKulut',
  },
  { payloadKey: 'poistot', sourceField: 'Poistot' },
  { payloadKey: 'arvonalentumiset', sourceField: 'Arvonalentumiset' },
  {
    payloadKey: 'rahoitustuototJaKulut',
    sourceField: 'RahoitustuototJaKulut',
  },
  { payloadKey: 'tilikaudenYliJaama', sourceField: 'TilikaudenYliJaama' },
  { payloadKey: 'omistajatuloutus', sourceField: 'Omistajatuloutus' },
  {
    payloadKey: 'omistajanTukiKayttokustannuksiin',
    sourceField: 'OmistajanTukiKayttokustannuksiin',
  },
];

export const STATEMENT_PREVIEW_FIELDS: Array<{
  key: StatementPreviewFieldKey;
  label: string;
  sourceField: string;
}> = [
  { key: 'liikevaihto', label: 'Liikevaihto', sourceField: 'Liikevaihto' },
  {
    key: 'aineetJaPalvelut',
    label: 'Aineet ja palvelut',
    sourceField: 'AineetJaPalvelut',
  },
  {
    key: 'henkilostokulut',
    label: 'Henkilostokulut',
    sourceField: 'Henkilostokulut',
  },
  {
    key: 'liiketoiminnanMuutKulut',
    label: 'Liiketoiminnan muut kulut',
    sourceField: 'LiiketoiminnanMuutKulut',
  },
  { key: 'poistot', label: 'Poistot', sourceField: 'Poistot' },
  {
    key: 'arvonalentumiset',
    label: 'Arvonalentumiset',
    sourceField: 'Arvonalentumiset',
  },
  {
    key: 'rahoitustuototJaKulut',
    label: 'Rahoitustuotot ja -kulut',
    sourceField: 'RahoitustuototJaKulut',
  },
  {
    key: 'tilikaudenYliJaama',
    label: 'Tilikauden ylijäämä/alijäämä',
    sourceField: 'TilikaudenYliJaama',
  },
  {
    key: 'omistajatuloutus',
    label: 'Omistajatuloutus',
    sourceField: 'Omistajatuloutus',
  },
  {
    key: 'omistajanTukiKayttokustannuksiin',
    label: 'Omistajan tuki käyttökustannuksiin',
    sourceField: 'OmistajanTukiKayttokustannuksiin',
  },
];

export const WORKBOOK_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
export const STATEMENT_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

export const ALLOWED_WORKBOOK_EXTENSIONS = new Set(['.xlsx', '.xlsm']);
export const ALLOWED_WORKBOOK_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/octet-stream',
]);

export const ALLOWED_STATEMENT_EXTENSIONS = new Set(['.pdf']);
export const ALLOWED_STATEMENT_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
]);
